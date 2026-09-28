# PLAN.md — aktuální stav (zdroj pravdy + git log)

## Miniplán Grok (2026-09-28) — stav

| Krok | Stav | Commit (přibližně) |
|------|------|--------------------|
| 1 Frontend pay() bez klientských částek + negativní testy | ✅ | `c8e10f0` |
| 2 Settle idempotence (claim RETURNED→SETTLED) + return/activate guards | ✅ | `fa49cf4` / `5c1c5f8` |
| 3 Anti double-book (Serializable tx) + rate limit + CORS env | ✅ | `5c1c5f8` |
| 4 Sync PLAN | ✅ | tento commit |

## Hotovo v kódu

- Server-authoritative deposit/kauce; damage ≤ kauce
- RETURNED jen ACTIVE; doklady jen DRAFT/PENDING_PAYMENT
- Public DTO bez VIN/PII; claimSettlement
- createReservation v Serializable transakci
- rateLimit 30/min na write endpointy; CORS_ORIGINS
- Testy: webhook, settle, moneySecurity

## Zbývá (tech)

- [ ] Ověřit zelené CI / `npm test` lokálně
- [ ] package-lock + npm ci
- [ ] Customer access token (ne jen reservation id) — P1
- [ ] DB exclusion constraint (silnější než Serializable)
- [ ] Webhook reconciliation job
- [ ] Comgate / FleetBold / hosting (owner)

## Business

- BUSINESS.md / ECONOMICS zatím **nevytvářet** — čeká samostatná analýza (max 3 dny, 1–2 vs 1–3)
- Demand engine = větší riziko než backend

## AGENTS — neměnit bez majitele

Comgate, app unlock, názvy stavů, nešifrované doklady (vědomě), kauce pre-auth.
