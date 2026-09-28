# AGENTS.md — čti před úpravami

Pro AI (Claude, Grok, další). Na projektu píše víc agentů — tenhle soubor snižuje konflikty.

## Před kódem

1. Tento soubor
2. `README.md`
3. `docs/PLAN.md` + `docs/PANEL-REVIEW.md`
4. Při rozporu README vs kód → `git log`, ne vlastní domněnka

## Po změně (stejný commit)

- Endpointy → README tabulka
- Hotový PLAN bod → odškrtnout
- Nová služba → `.env.example`

## Neměnit bez majitele

- Comgate, app-based unlock (ne keybox), nešifrované doklady na disku, kauce pre-auth, názvy stavů rezervace

## Security invarianty

- requireAdminKey na PII, doklady, settle, release/capture
- veřejný GET reservation jen getReservationPublic (bez unlock URL / PII / transId)
- webhook ověřuje getPaymentStatus
- uploads/ ne veřejný static bez admin klíče

## Testy

- `src/app.ts` exportuje `app` **bez** listen
- `src/server.ts` = guard + listen
- `tests/webhook.test.ts`, `tests/settle.test.ts` — po změně peněžních cest aktualizuj testy

## Mapa

Viz README + `docs/MULTI_AI_COLLABORATION.md`.
