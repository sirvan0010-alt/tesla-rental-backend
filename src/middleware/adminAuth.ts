import { RequestHandler } from "express";
import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffery musí mít stejnou délku, jinak timingSafeEqual hodí výjimku -
  // v tom případě porovnáváme proti sobě samému, ať to nic neprozradí.
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Jednoduchá ochrana admin/dokladových endpointů jedním sdíleným klíčem
 * (ADMIN_API_KEY v .env). Není to plnohodnotný login systém s uživateli -
 * pro jednoho majitele/malou půjčovnu to ale stačí a je to rychlé na
 * zavedení. Klient posílá hlavičku `x-admin-key: <klíč>`.
 *
 * Pokud budete chtít víc adminů s vlastními účty (např. zaměstnanci),
 * dejte vědět - vymění se za skutečné přihlašování (session/JWT).
 */
export const requireAdminKey: RequestHandler = (req, res, next) => {
  // Query parametr navíc kvůli <img src="...?key=..."> - prohlížeč
  // neumí poslat vlastní hlavičku u obrázkového tagu, jen u fetch().
  const provided = req.header("x-admin-key") || (req.query.key as string | undefined);
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: "ADMIN_API_KEY není nastaven na serveru" });
  }
  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: "Neplatný nebo chybějící admin klíč" });
  }
  next();
};
