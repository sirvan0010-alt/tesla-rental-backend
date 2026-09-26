import { prisma } from "../db";
import { ReservationStatus } from "@prisma/client";

/** Vytvoří novou rezervaci ve stavu DRAFT. Bere vehicleId, dopočítá VIN a ceny, ověří dostupnost. */
export async function createReservation(params: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.vehicleId } });
  if (!vehicle || !vehicle.active) {
    throw new Error("Vůz neexistuje nebo není aktivně nabízený");
  }

  const conflicting = await prisma.reservation.findFirst({
    where: {
      vehicleId: params.vehicleId,
      status: { notIn: [ReservationStatus.FAILED, ReservationStatus.CANCELLED] },
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
    },
  });
  if (conflicting) {
    throw new Error("Vůz je v tomto termínu už rezervovaný");
  }

  const days = Math.max(1, Math.ceil((params.endsAt.getTime() - params.startsAt.getTime()) / (24 * 3600 * 1000)));

  return prisma.reservation.create({
    data: {
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      vehicleId: vehicle.id,
      vehicleVin: vehicle.vin,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      depositAmountCzk: days * vehicle.dailyPriceCzk,
      kauceAmountCzk: vehicle.kauceAmountCzk,
      status: ReservationStatus.DRAFT,
    },
  });
}

export async function getReservation(id: string) {
  return prisma.reservation.findUniqueOrThrow({ where: { id } });
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

export async function markReturned(params: { reservationId: string; photoUrls: string[] }) {
  return prisma.reservation.update({
    where: { id: params.reservationId },
    data: { status: ReservationStatus.RETURNED, returnPhotosUrls: params.photoUrls },
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
