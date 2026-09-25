import { prisma } from "../db";
import { ReservationStatus } from "@prisma/client";

/** Vytvoří novou rezervaci ve stavu DRAFT (krok 1-2 z onboarding flow). */
export async function createReservation(params: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleVin: string;
  startsAt: Date;
  endsAt: Date;
  depositAmountCzk: number;
  kauceAmountCzk: number;
}) {
  return prisma.reservation.create({
    data: { ...params, status: ReservationStatus.DRAFT },
  });
}

export async function getReservation(id: string) {
  return prisma.reservation.findUniqueOrThrow({ where: { id } });
}

/** Volá se hned po vytvoření platby zálohy/kauce na Comgate - ukládá transId a přepne na PENDING_PAYMENT. */
export async function markPendingPayment(params: {
  reservationId: string;
  depositTransId?: string;
  kauceTransId?: string;
}) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: {
      status: ReservationStatus.PENDING_PAYMENT,
      ...(params.depositTransId && { depositTransId: params.depositTransId }),
      ...(params.kauceTransId && { kauceTransId: params.kauceTransId }),
    },
  });
}

/**
 * Volá webhook, jakmile Comgate potvrdí, že ZÁROVEň záloha i kauce prošly.
 * Teprve tady je bezpečné vytvořit přístup k vozu (Tesla/FleetBold invite).
 */
export async function findReservationByTransId(transId: string) {
  return prisma.reservation.findFirst({
    where: {
      OR: [{ depositTransId: transId }, { kauceTransId: transId }],
    },
  });
}

export async function isFullyPaid(reservationId: string) {
  const r = await getReservation(reservationId);
  // Obě transakce musí existovat - konkrétní "zaplaceno" status ověřuje webhook
  // handler přes getPaymentStatus() u obou transId před zavoláním markPaid().
  return Boolean(r.depositTransId && r.kauceTransId);
}

export async function markPaid(reservationId: string) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.PAID },
  });
}

export async function markPaymentFailed(reservationId: string) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.FAILED },
  });
}

/** Po vytvoření dočasného přístupu k vozu (FleetBold/Tesla invite) po úspěšné platbě. */
export async function saveVehicleAccess(params: { reservationId: string; vehicleAccessId: string }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: { vehicleAccessId: params.vehicleAccessId, vehicleAccessError: null },
  });
}

/** Pokud vytvoření přístupu selže - uloží se chyba, ale rezervace ZŮSTÁVÁ PAID (peníze má),
 *  takže je bezpečné akci později zopakovat (viz retryVehicleAccessCreation ve webhooku). */
export async function saveVehicleAccessError(params: { reservationId: string; error: string }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: { vehicleAccessError: params.error },
  });
}

/** Přechod na ACTIVE při skutečném převzetí vozu (appka odeslala "Odemknout"/"Převzato"). */
export async function markActive(reservationId: string) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.ACTIVE },
  });
}

/** Po odevzdání vozu zákazníkem (fotky nahrané, appka odeslala "ukončit"). */
export async function markReturned(params: { reservationId: string; photoUrls: string[] }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: { status: ReservationStatus.RETURNED, returnPhotosUrls: params.photoUrls },
  });
}

/** Finální krok - kauce byla uvolněna nebo strhnuta, rezervace uzavřena. */
export async function markSettled(params: { reservationId: string; damageNoteText?: string }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: {
      status: ReservationStatus.SETTLED,
      ...(params.damageNoteText && { damageNoteText: params.damageNoteText }),
    },
  });
}
