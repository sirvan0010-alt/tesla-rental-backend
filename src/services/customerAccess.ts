import crypto from "crypto";
import { prisma } from "../db";
import { ReservationStatus } from "@prisma/client";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 h od vystavení

export function generateCustomerAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Vystaví token po PAID (idempotentní — pokud platný existuje, vrátí stejný). */
export async function ensureCustomerAccessToken(reservationId: string) {
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  if (r.status !== ReservationStatus.PAID && r.status !== ReservationStatus.ACTIVE) {
    const err = new Error(`Token lze vystavit jen pro PAID/ACTIVE (teď: ${r.status})`);
    (err as any).statusCode = 409;
    throw err;
  }
  const now = new Date();
  if (
    r.customerAccessToken &&
    r.customerAccessTokenExpiresAt &&
    r.customerAccessTokenExpiresAt > now &&
    !r.customerAccessTokenUsedAt
  ) {
    return {
      token: r.customerAccessToken,
      expiresAt: r.customerAccessTokenExpiresAt,
    };
  }
  const token = generateCustomerAccessToken();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      customerAccessToken: token,
      customerAccessTokenExpiresAt: expiresAt,
      customerAccessTokenUsedAt: null,
    },
  });
  return { token, expiresAt };
}

/**
 * Ověří token pro activate. email musí sedět s rezervací (ochrana proti úniku tokenu bez kontextu).
 * Token se po úspěšné aktivaci označí jako použitý (jednorázový pro unlock flow).
 */
export async function consumeCustomerAccessToken(params: {
  reservationId: string;
  token: string;
  customerEmail?: string;
}) {
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: params.reservationId } });
  if (!r.customerAccessToken || !r.customerAccessTokenExpiresAt) {
    const err = new Error("Přístupový token nebyl vystaven");
    (err as any).statusCode = 401;
    throw err;
  }
  if (r.customerAccessTokenUsedAt) {
    const err = new Error("Přístupový token už byl použit");
    (err as any).statusCode = 401;
    throw err;
  }
  if (r.customerAccessTokenExpiresAt < new Date()) {
    const err = new Error("Přístupový token vypršel");
    (err as any).statusCode = 401;
    throw err;
  }
  const a = Buffer.from(r.customerAccessToken);
  const b = Buffer.from(params.token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error("Neplatný přístupový token");
    (err as any).statusCode = 401;
    throw err;
  }
  if (params.customerEmail) {
    if (params.customerEmail.trim().toLowerCase() !== r.customerEmail.trim().toLowerCase()) {
      const err = new Error("E-mail neodpovídá rezervaci");
      (err as any).statusCode = 401;
      throw err;
    }
  }
  return r;
}

export async function markCustomerAccessTokenUsed(reservationId: string) {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { customerAccessTokenUsedAt: new Date() },
  });
}
