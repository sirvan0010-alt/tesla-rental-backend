import { prisma } from "../db";
import { ReservationStatus, Prisma } from "@prisma/client";

export async function createReservation(params: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  if (params.endsAt <= params.startsAt) {
    throw new Error("Datum konce musí být po datu začátku");
  }

  // Serializable snižuje šanci double-bookingu (find + create v jedné transakci).
  // Plný exclusion constraint v DB je další krok při stabilizaci schématu.
  return prisma.$transaction(
    async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id: params.vehicleId, active: true },
      });
      if (!vehicle) throw new Error("Vůz nenalezen nebo není aktivní");

      const conflict = await tx.reservation.findFirst({
        where: {
          vehicleId: params.vehicleId,
          status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.FAILED] },
          startsAt: { lt: params.endsAt },
          endsAt: { gt: params.startsAt },
        },
      });
      if (conflict) throw new Error("Vůz je v tomto termínu obsazený");

      const msPerDay = 24 * 60 * 60 * 1000;
      const days = Math.max(
        1,
        Math.ceil((params.endsAt.getTime() - params.startsAt.getTime()) / msPerDay)
      );
      const depositAmountCzk = days * vehicle.dailyPriceCzk;

      return tx.reservation.create({
        data: {
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          customerPhone: params.customerPhone,
          vehicleId: vehicle.id,
          vehicleVin: vehicle.vin,
          startsAt: params.startsAt,
          endsAt: params.endsAt,
          depositAmountCzk,
          kauceAmountCzk: vehicle.kauceAmountCzk,
          status: ReservationStatus.DRAFT,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function getReservation(id: string) {
  return prisma.reservation.findUniqueOrThrow({ where: { id } });
}

/** Veřejné DTO — bez VIN, PII, unlock URL, transId, access error detail. */
export async function getReservationPublic(id: string) {
  const r = await prisma.reservation.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      depositAmountCzk: true,
      kauceAmountCzk: true,
      vehicleId: true,
      createdAt: true,
      vehicleAccessId: true,
    },
  });
  return {
    id: r.id,
    status: r.status,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    depositAmountCzk: r.depositAmountCzk,
    kauceAmountCzk: r.kauceAmountCzk,
    vehicleId: r.vehicleId,
    createdAt: r.createdAt,
    vehicleAccessReady: Boolean(r.vehicleAccessId),
  };
}

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

export async function findReservationByTransId(transId: string) {
  return prisma.reservation.findFirst({
    where: {
      OR: [{ depositTransId: transId }, { kauceTransId: transId }],
    },
  });
}

export async function isFullyPaid(reservationId: string) {
  const r = await getReservation(reservationId);
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

export async function saveVehicleAccess(params: {
  reservationId: string;
  vehicleAccessId: string;
  vehicleUnlockUrl?: string;
}) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: {
      vehicleAccessId: params.vehicleAccessId,
      vehicleUnlockUrl: params.vehicleUnlockUrl,
      vehicleAccessError: null,
    },
  });
}

export async function saveVehicleAccessError(params: { reservationId: string; error: string }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: { vehicleAccessError: params.error },
  });
}

export async function markActive(reservationId: string) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.ACTIVE },
  });
}

/** RETURNED jen z ACTIVE (ne z DRAFT). */
export async function markReturned(params: { reservationId: string; photoUrls: string[] }) {
  const r = await getReservation(params.reservationId);
  if (r.status !== ReservationStatus.ACTIVE) {
    const err = new Error(`Vrácení povoleno jen ze stavu ACTIVE (teď: ${r.status})`);
    (err as any).statusCode = 409;
    throw err;
  }
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: { status: ReservationStatus.RETURNED, returnPhotosUrls: params.photoUrls },
  });
}

/**
 * Atomicky „zabere“ RETURNED → SETTLED (count 0 = už vyrovnáno / race).
 * Peněžní operace volajícího musí proběhnout až po úspěšném claimu;
 * při selhání Comgate volej releaseSettlementClaim.
 */
export async function claimSettlement(params: {
  reservationId: string;
  damageNoteText?: string;
}) {
  const result = await prisma.reservation.updateMany({
    where: {
      id: params.reservationId,
      status: ReservationStatus.RETURNED,
    },
    data: {
      status: ReservationStatus.SETTLED,
      ...(params.damageNoteText ? { damageNoteText: params.damageNoteText } : {}),
    },
  });
  return result.count === 1;
}

export async function releaseSettlementClaim(reservationId: string) {
  return prisma.reservation.updateMany({
    where: { id: reservationId, status: ReservationStatus.SETTLED },
    data: { status: ReservationStatus.RETURNED, damageNoteText: null },
  });
}

export async function markSettled(params: { reservationId: string; damageNoteText?: string }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: {
      status: ReservationStatus.SETTLED,
      ...(params.damageNoteText && { damageNoteText: params.damageNoteText }),
    },
  });
}
