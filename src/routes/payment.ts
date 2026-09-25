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
} from "../services/reservationService";
import { createVehicleAccess } from "../services/vehicleAccessService";
import { sendAccessInstructions } from "../services/notificationService";

const router = Router();

/**
 * POST /api/payment/reservations
 * Krok 1-2 z onboarding flow: založí rezervaci ve stavu DRAFT,
 * ještě před platbou. Vrací reservationId, které appka pak posílá
 * do /deposit a /kauce.
 */
router.post("/reservations", async (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    vehicleVin,
    startsAt,
    endsAt,
    depositAmountCzk,
    kauceAmountCzk,
  } = req.body;
  try {
    const reservation = await createReservation({
      customerName,
      customerEmail,
      customerPhone,
      vehicleVin,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      depositAmountCzk,
      kauceAmountCzk,
    });
    res.json(reservation);
  } catch (err) {
    console.error("createReservation error", err);
    res.status(400).json({ error: "Rezervaci se nepodařilo založit" });
  }
});

/** GET /api/payment/reservations/:id - stav rezervace pro frontend (polling/refresh appky) */
router.get("/reservations/:id", async (req, res) => {
  try {
    res.json(await getReservation(req.params.id));
  } catch (err) {
    res.status(404).json({ error: "Rezervace nenalezena" });
  }
});

/**
 * Vytvoří přístup k vozu a pošle instrukce - voláno po přechodu na PAID.
 * Idempotentní: pokud už rezervace vehicleAccessId má, nic nedělá.
 * Chyba se ULOŽÍ na rezervaci, ale nevyhazuje se dál - platba je v pořádku
 * proběhlá, přístup lze kdykoli zopakovat přes /reservations/:id/retry-access
 * (viz endpoint níže), aniž by bylo nutné cokoliv platit znovu.
 */
async function ensureVehicleAccess(reservationId: string) {
  const reservation = await getReservation(reservationId);
  if (reservation.vehicleAccessId) return; // už hotovo, nic nedělat

  try {
    const access = await createVehicleAccess({
      vehicleVin: reservation.vehicleVin,
      customerEmail: reservation.customerEmail,
      customerPhone: reservation.customerPhone,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
    });
    await saveVehicleAccess({ reservationId, vehicleAccessId: access.accessId });
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
    // Záměrně nepřehazujeme dál - viz komentář výše funkce.
  }
}

/**
 * POST /api/payment/reservations/:id/retry-access
 * Ruční/cron-driven retry, pokud vytvoření přístupu po platbě selhalo
 * (např. výpadek FleetBold API). Bezpečné volat opakovaně (idempotentní).
 */
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
 * GET /api/payment/methods
 * Frontend zavolá při zobrazení platebního kroku a vykreslí tlačítka
 * (karta, Google Pay, jednotlivé banky) přesně podle toho, co Comgate
 * aktuálně nabízí - žádný hardcoded seznam bank v appce.
 */
router.get("/methods", async (_req, res) => {
  try {
    const methods = await listAvailablePaymentMethods();
    res.json({ methods });
  } catch (err) {
    console.error("methods error", err);
    res.status(502).json({ error: "Nepodařilo se načíst platební metody" });
  }
});

/**
 * POST /api/payment/deposit
 * body: { reservationId, amountCzk, customerEmail, method }
 * Vytvoří platbu zálohy zvolenou metodou a vrátí redirect URL na bránu.
 */
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

/**
 * POST /api/payment/kauce
 * body: { reservationId, depositCzk, customerEmail }
 * Vytvoří blokaci (pre-auth) kauce - peníze se zablokují, nestrhnou.
 */
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

/** POST /api/payment/kauce/:transId/release - auto vráceno bez škody */
router.post("/kauce/:transId/release", async (req, res) => {
  try {
    await releaseDepositHold(req.params.transId);
    res.json({ ok: true });
  } catch (err) {
    console.error("release error", err);
    res.status(502).json({ error: "Uvolnění kauce selhalo" });
  }
});

/** POST /api/payment/kauce/:transId/capture - strhnutí (celé/části) kauce za škodu */
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

/**
 * POST /api/payment/webhook
 * Comgate sem posílá notifikaci o změně stavu platby/kauce (jak pro
 * zálohu, tak zvlášť pro pre-auth kauce - přijde tedy typicky 2x na
 * jednu rezervaci, jednou pro každý transId).
 *
 * Nutné nastavit tuto URL jako "notifikační URL" v Comgate administraci.
 *
 * Bezpečnostní poznámka: Comgate notifikace nejsou podepsané - webhook
 * musí vždy ověřit skutečný stav zpět přes getPaymentStatus(transId),
 * ne slepě věřit obsahu notifikace (ochrana proti podvržení).
 */
router.post("/webhook", async (req, res) => {
  const { transId, refId } = req.body;
  try {
    const reservation =
      (await findReservationByTransId(transId)) ??
      (refId ? await getReservation(refId).catch(() => null) : null);

    if (!reservation) {
      console.warn(`Webhook: transId ${transId} nepřiřazen k žádné rezervaci`);
      return res.sendStatus(200); // Comgate nemá co opakovat
    }

    const verifiedStatus = await getPaymentStatus(transId);

    if (verifiedStatus.status === "PAID" || verifiedStatus.status === "AUTHORIZED") {
      // Obě transakce (záloha i kauce) musí být na rezervaci evidované,
      // než ji označíme jako plně zaplacenou a odemkneme appku pro vstup.
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
    // 500 -> Comgate notifikaci zopakuje, což je tady žádoucí
    res.sendStatus(500);
  }
});

/** GET /api/payment/:transId/status - pro polling stavu z frontendu */
router.get("/:transId/status", async (req, res) => {
  try {
    const status = await getPaymentStatus(req.params.transId);
    res.json(status);
  } catch (err) {
    res.status(502).json({ error: "Nepodařilo se zjistit stav platby" });
  }
});

export default router;
