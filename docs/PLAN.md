# PLAN.md — zdroj pravdy

## Miniplán / P1 (2026-09-28)

| Krok | Stav |
|------|------|
| Frontend pay bez klientských částek + moneySecurity testy | ✅ |
| Settle claimSettlement | ✅ |
| Serializable booking + rate limit + CORS | ✅ |
| **Customer access token** (`/customer-session` + `/activate`) | ✅ kód `4fbe7b7` + service |
| Frontend accessToken flow | ⏳ push index (session v unlock) — ověřit v main |
| CI / npm test ověřeno zeleně | ⏳ owner / Actions |
| Settlement reconciliation job | ⏳ další |

## Customer access (jak to funguje)

1. Po PAID webhook vystaví token (nebo při `/customer-session`).
2. `POST /reservations/:id/customer-session` + `{ customerEmail }` → `{ accessToken, expiresAt }`.
3. `POST /reservations/:id/activate` + `{ accessToken, customerEmail? }` → ACTIVE + unlock URL.
4. Token TTL 48 h, po aktivaci `usedAt` — druhý activate → 401.
5. Veřejný GET **nevrací** token.

## Schema

Po pull: `npx prisma db push` (nová pole customerAccessToken*).

## Business

ECONOMICS/DEMAND zatím **nezapisovat** — čeká samostatná analýza (max 3 dny).

## Owner

- `npm test` / Actions log
- Comgate, pojištění, FALLBACK telefon
