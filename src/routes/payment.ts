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
  getReservationPublic,
  markPendingPayment,
  findReservationByTransId,
  isFullyPaid,
  markPaid,
  markPaymentFailed,
  saveVehicleAccess,
  saveVehicleAccessError,
  markActive,
  claimSettlement,
  releaseSettlementClaim,
} from "../services/reservationService";
import { createVehicleAccess, revokeVehicleAccess } from "../services/vehicleAccessService";
import { sendAccessInstructions } from "../services/notificationService";
import {
  ensureCustomerAccessToken,
  consumeCustomerAccessToken,
  markCustomerAccessTokenUsed,
} from "../services/customerAccess";
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
    res.json(await getReservationPublic(req.params.id));
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

/**
 * Vydá customerAccessToken po ověření e-mailu (stav PAID/ACTIVE).
 * Token se nevrací na veřejném GET /reservations/:id.
 */
router.post("/reservations/:id/customer-session", async (req, res) => {
  const email = String(req.body?.customerEmail || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "customerEmail je povinný" });
  }
  try {
    const reservation = await getReservation(req.params.id);
    if (reservation.customerEmail.trim().toLowerCase() !== email) {
      return res.status(401).json({ error: "E-mail neodpovídá rezervaci" });
    }
    if (reservation.status !== "PAID" && reservation.status !== "ACTIVE") {
      return res.status(409).json({ error: "Session lze vystavit jen po zaplacení" });
    }
    const { token, expiresAt } = await ensureCustomerAccessToken(reservation.id);
    res.json({ accessToken: token, expiresAt });
  } catch (err: any) {
    const code = err?.statusCode === 409 ? 409 : 502;
    res.status(code).json({ error: err?.message || "Session se nepodařilo vystavit" });
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
  const { reservationId, method } = req.body;
  try {
    const reservation = await getReservation(reservationId);
    if (reservation.status !== "DRAFT" && reservation.status !== "PENDING_PAYMENT") {
      return res.status(409).json({ error: "Zálohu nelze platit v tomto stavu rezervace" });
    }
    if (reservation.depositTransId) {
      return res.status(409).json({ error: "Záloha pro tuto rezervaci už byla založena" });
    }
    const payment = await createDepositPayment({
      reservationId,
      amountCzk: reservation.depositAmountCzk,
      customerEmail: reservation.customerEmail,
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
  const { reservationId } = req.body;
  try {
    const reservation = await getReservation(reservationId);
    if (reservation.status !== "DRAFT" && reservation.status !== "PENDING_PAYMENT") {
      return res.status(409).json({ error: "Kauci nelze blokovat v tomto stavu rezervace" });
    }
    if (reservation.kauceTransId) {
      return res.status(409).json({ error: "Kauce pro tuto rezervaci už byla založena" });
    }
    const hold = await createDepositHold({
      reservationId,
      depositCzk: reservation.kauceAmountCzk,
      customerEmail: reservation.customerEmail,
    });
    await markPendingPayment({ reservationId, kauceTransId: hold.transId });
    res.json({ redirectUrl: hold.redirect, transId: hold.transId });
  } catch (err) {
    console.error("kauce error", err);
    res.status(502).json({ error: "Blokaci kauce se nepodařilo vytvořit" });
  }
});

router.post("/kauce/:transId/release", requireAdminKey, async (req, res) => {
  try {
    await releaseDepositHold(req.params.transId);
    res.json({ ok: true });
  } catch (err) {
    console.error("release error", err);
    res.status(502).json({ error: "Uvolnění kauce selhalo" });
  }
});

router.post("/kauce/:transId/capture", requireAdminKey, async (req, res) => {
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
        try {
          const sess = await ensureCustomerAccessToken(reservation.id);
          console.log(`[access-token] reservation=${reservation.id} expires=${sess.expiresAt.toISOString()}`);
        } catch (e) {
          console.warn("ensureCustomerAccessToken failed", e);
        }
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

/**
 * Aktivace vyžaduje accessToken (z /customer-session), ne jen znalost ID.
 */
router.post("/reservations/:id/activate", async (req, res) => {
  const accessToken = String(req.body?.accessToken || "");
  const customerEmail = req.body?.customerEmail ? String(req.body.customerEmail) : undefined;
  if (!accessToken) {
    return res.status(401).json({ error: "Chybí accessToken — nejdřív volejte /customer-session" });
  }
  try {
    const reservation = await consumeCustomerAccessToken({
      reservationId: req.params.id,
      token: accessToken,
      customerEmail,
    });
    if (reservation.status !== "PAID") {
      return res.status(409).json({ error: "Rezervace není ve stavu PAID" });
    }
    if (!reservation.vehicleAccessId) {
      return res.status(409).json({ error: "Přístup k vozu zatím není připraven, zkuste to za chvíli" });
    }
    const updated = await markActive(reservation.id);
    await markCustomerAccessTokenUsed(reservation.id);
    res.json({
      id: updated.id,
      status: updated.status,
      vehicleUnlockUrl: updated.vehicleUnlockUrl,
    });
  } catch (err: any) {
    const code = err?.statusCode || 404;
    res.status(code).json({ error: err?.message || "Rezervace nenalezena" });
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

    let amount = 0;
    if (damaged) {
      amount = Number(damageAmountCzk);
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "U škody je nutné zadat damageAmountCzk > 0" });
      }
      if (amount > reservation.kauceAmountCzk) {
        return res.status(400).json({
          error: `damageAmountCzk nesmí překročit kauci (${reservation.kauceAmountCzk} Kč)`,
        });
      }
    }

    const noteText = damaged ? note ?? `Strženo ${amount} Kč z kauce` : undefined;
    const claimed = await claimSettlement({
      reservationId: reservation.id,
      damageNoteText: noteText,
    });
    if (!claimed) {
      return res.status(409).json({ error: "Rezervace už byla vyrovnána nebo není ve stavu RETURNED" });
    }

    try {
      if (damaged) {
        await captureDepositHold({ comgateTransId: reservation.kauceTransId, amountCzk: amount });
      } else {
        await releaseDepositHold(reservation.kauceTransId);
      }
    } catch (payErr) {
      await releaseSettlementClaim(reservation.id);
      throw payErr;
    }

    if (reservation.vehicleAccessId) {
      try {
        await revokeVehicleAccess(reservation.vehicleAccessId);
      } catch (err) {
        console.error(`Revoke vehicle access failed for ${reservation.id}`, err);
      }
    }

    const settled = await getReservation(reservation.id);
    res.json(settled);
  } catch (err) {
    console.error("settle error", err);
    res.status(502).json({ error: "Vyrovnání kauce selhalo" });
  }
});

export default router;
