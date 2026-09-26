import { Router } from "express";
import { prisma } from "../db";

const router = Router();

/** GET /api/vehicles - seznam aktivně nabízených vozů (appka je zobrazí k výběru). */
router.get("/", async (_req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { active: true },
    select: { id: true, name: true, dailyPriceCzk: true, kauceAmountCzk: true },
  });
  res.json({ vehicles });
});

/**
 * GET /api/vehicles/:id/availability?start=ISO&end=ISO
 * Vůz je nedostupný, pokud se termín překrývá s jinou rezervací, která
 * NENÍ zrušená/neúspěšná (FAILED, CANCELLED).
 */
router.get("/:id/availability", async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  if (!start || !end) {
    return res.status(400).json({ error: "Chybí start nebo end" });
  }
  const startsAt = new Date(start);
  const endsAt = new Date(end);

  const conflicting = await prisma.reservation.findFirst({
    where: {
      vehicleId: req.params.id,
      status: { notIn: ["FAILED", "CANCELLED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle) return res.status(404).json({ error: "Vůz nenalezen" });

  const days = Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / (24 * 3600 * 1000)));

  res.json({
    available: !conflicting,
    depositAmountCzk: days * vehicle.dailyPriceCzk,
    kauceAmountCzk: vehicle.kauceAmountCzk,
  });
});

export default router;
