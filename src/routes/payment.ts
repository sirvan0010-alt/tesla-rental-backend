import { Router } from "express";
import {
  listAvailablePaymentMethods,
  createDepositPayment,
  createDepositHold,
  releaseDepositHold,
  captureDepositHold,
  getPaymentStatus,
} from "../paymentService";
import {
  createReservation,
  getReservation,
  markPendingPayment,
  findReservationByTransId,
  isFullyPaid,
  markPaid,
  markPaymentFailed,
  saveVehicleAccess,
  saveVehicleAccessError,
  markActive,
  markSettled,
} from "../services/reservationService";
import { createVehicleAccess, revokeVehicleAccess } from "../services/vehicleAccessService";
import { sendAccessInstructions } from "../services/notificationService";
import { requireAdminKey } from "../middleware/adminAuth";

const router = Router();

router.post("/reservations", async (req, res) => {
  const { customerName, customerEmail, customerPhone, vehicleId, startsAt, endsAt } = req.body;
  try {
    const reservation = await createReservation({
      customerName,
      customerEmail,
      customerPhone,
      vehicleId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    });
    res.json(reservation);
  } catch (err) {
    console.error("createReservation error", err);
    const message = err instanceof Error ? err.message : "Rezervaci se nepodařilo založit";
    res.status(400).json({ error: message });
  }
});

router.get("/reservations/:id", async (req, res) => {
  try {
    res.json(await getReservation(req.params.id));
  } catch (err) {
    res.status(404).json({ error: "Rezervace nenalezena" });
  }
});

async function ensureVehicleAccess(reservationId: string) {
  const reservation = await getReservation(reservationId);
  if (reservation.vehicleAccessId) return;

  try {
    const access = await createVehicleAccess({
      vehicleVin: reservation.vehicleVin,
      customerEmail: reservation.customerEmail,
      customerPhone: reservation.customerPhone,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
    });
    await saveVehicleAccess({
      reservationId,
      vehicleAccessId: access.accessId,
      vehicleUnlockUrl: access.unlockUrl,
    });
    await sendAccessInstructions({
      customerEmail: reservation.customerEmail,
      customerPhone: reservation.customerPhone,
      unlockUrl: access.unlockUrl,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
    });
  } catch (err) {
    console.error(`Vehicle access creation failed for ${reservationId}`, err);
    await saveVehicleAccessError({
      reservationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

router.post("/reservations/:id/retry-access", async (req, res) => {
  try {
    await ensureVehicleAccess(req.params.id);
    const reservation = await getReservation(req.params.id);
    res.json({ vehicleAccessId: reservation.vehicleAccessId, error: reservation.vehicleAccessError });
  } catch (err) {
    res.status(502).json({ error: "Pokus o vytvoření přístupu selhal" });
  }
});

router.get("/methods", async (_req, res) => {
  try {
    const methods = await listAvailablePaymentMethods();
    res.json({ methods });
  } catch (err) {
    console.error("methods error", err);
    res.status(502).json({ error: "Nepodařilo se načíst platební metody" });
  }
});

router.post("/deposit", async (req, res) => {
  const { reservationId, amountCzk, customerEmail, method } = req.body;
  try {
    const payment = await createDepositPayment({
      reservationId,
      amountCzk,
      customerEmail,
      method,
    });
    await markPendingPayment({ reservationId, depositTransId: payment.transId });
    res.json({ redirectUrl: payment.redirect, transId: payment.transId });
  } catch (err) {
    console.error("deposit error", err);
    res.status(502).json({ error: "Platbu se nepodařilo vytvořit" });
  }
});

router.post("/kauce", async (req, res) => {
  const { reservationId, depositCzk, customerEmail } = req.body;
  try {
    const hold = await createDepositHold({
      reservationId,
      depositCzk,
      customerEmail,
    });
    await markPendingPayment({ reservationId, kauceTransId: hold.transId });
    res.json({ redirectUrl: hold.redirect, transId: hold.transId });
  } catch (err) {
    console.error("kauce error", err);
    res.status(502).json({ error: "Blokaci kauce se nepodařilo vytvořit" });
  }
});

router.post("/kauce/:transId/release", async (req, res) => {
  try {
    await releaseDepositHold(req.params.transId);
    res.json({ ok: true });
  } catch (err) {
    console.error("release error", err);
    res.status(502).json({ error: "Uvolnění kauce selhalo" });
  }
});

router.post("/kauce/:transId/capture", async (req, res) => {
  const { amountCzk } = req.body;
  try {
    await captureDepositHold({
      comgateTransId: req.params.transId,
      amountCzk,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("capture error", err);
    res.status(502).json({ error: "Strhnutí kauce selhalo" });
  }
});

router.post("/webhook", async (req, res) => {
  const { transId, refId } = req.body;
  try {
    const reservation =
      (await findReservationByTransId(transId)) ??
      (refId ? await getReservation(refId).catch(() => null) : null);

    if (!reservation) {
      console.warn(`Webhook: transId ${transId} nepřiřazen k žádné rezervaci`);
      return res.sendStatus(200);
    }

    const verifiedStatus = await getPaymentStatus(transId);

    if (verifiedStatus.status === "PAID" || verifiedStatus.status === "AUTHORIZED") {
      if (await isFullyPaid(reservation.id)) {
        await markPaid(reservation.id);
        console.log(`Rezervace ${reservation.id}: PAID - vytvářím přístup k vozu`);
        await ensureVehicleAccess(reservation.id);
      }
    } else if (verifiedStatus.status === "CANCELLED" || verifiedStatus.status === "FAILED") {
      await markPaymentFailed(reservation.id);
      console.log(`Rezervace ${reservation.id}: platba selhala/zrušena`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("webhook error", err);
    res.sendStatus(500);
  }
});

router.get("/:transId/status", async (req, res) => {
  try {
    const status = await getPaymentStatus(req.params.transId);
    res.json(status);
  } catch (err) {
    res.status(502).json({ error: "Nepodařilo se zjistit stav platby" });
  }
});

router.post("/reservations/:id/activate", async (req, res) => {
  try {
    const reservation = await getReservation(req.params.id);
    if (reservation.status !== "PAID") {
      return res.status(409).json({ error: "Rezervace není ve stavu PAID" });
    }
    if (!reservation.vehicleAccessId) {
      return res.status(409).json({ error: "Přístup k vozu zatím není připraven, zkuste to za chvíli" });
    }
    const updated = await markActive(reservation.id);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: "Rezervace nenalezena" });
  }
});

router.post("/reservations/:id/settle", requireAdminKey, async (req, res) => {
  const { damaged, damageAmountCzk, note } = req.body;
  try {
    const reservation = await getReservation(req.params.id);
    if (reservation.status !== "RETURNED") {
      return res.status(409).json({ error: "Rezervace není ve stavu RETURNED - vrácení ještě neproběhlo" });
    }
    if (!reservation.kauceTransId) {
      return res.status(409).json({ error: "K rezervaci chybí kauceTransId, nelze vyrovnat" });
    }

    if (damaged) {
      if (!damageAmountCzk || damageAmountCzk <= 0) {
        return res.status(400).json({ error: "U škody je nutné zadat damageAmountCzk > 0" });
      }
      await captureDepositHold({ comgateTransId: reservation.kauceTransId, amountCzk: damageAmountCzk });
    } else {
      await releaseDepositHold(reservation.kauceTransId);
    }

    if (reservation.vehicleAccessId) {
      try {
        await revokeVehicleAccess(reservation.vehicleAccessId);
      } catch (err) {
        console.error(`Revoke vehicle access failed for ${reservation.id}`, err);
      }
    }

    const settled = await markSettled({
      reservationId: reservation.id,
      damageNoteText: damaged ? note ?? `Strženo ${damageAmountCzk} Kč z kauce` : undefined,
    });
    res.json(settled);
  } catch (err) {
    console.error("settle error", err);
    res.status(502).json({ error: "Vyrovnání kauce selhalo" });
  }
});

export default router;
