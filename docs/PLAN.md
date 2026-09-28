# PLAN.md — aktuální stav projektu (živý dokument)

Jediné místo, kde má být pravda o tom, co je hotové. Věř tomuto souboru + `git log`, ne staré konverzaci.

Kontext: `docs/kompletni-plan-tesla-pronajem.md`, panel: `docs/PANEL-REVIEW.md`, AI: `AGENTS.md`.

## Hotovo (funkční kód v main)

- [x] Express app `src/app.ts` + `src/server.ts` (listen + startup guard)
- [x] Prisma Reservation + Vehicle, stavový cyklus
- [x] Comgate + MOCK_MODE (záloha, kauce pre-auth, webhook)
- [x] Výběr vozu/termínu, doklady, return fotky, admin.html
- [x] getReservationPublic, requireAdminKey, timing-safe admin key
- [x] CI build + job `test` (Postgres), CodeQL, Dependabot, protect-main
- [x] Integrační testy webhook + settle (**napsáno; ověřit spuštěním v CI/lokálně**)
- [x] `scripts/deleteExpiredDocuments.ts` + `npm run retention:cleanup`
- [x] index.html: trust text, timeout/fallback kontakt při čekání na PAID/access
- [x] landing.html (minimální)

## Rozdělané

- [ ] package-lock.json + CI `npm ci`
- [ ] prisma/migrations/ commitnuté (teď CI `db push`)
- [ ] Secret scanning + push protection (GitHub UI)
- [ ] Ověřit zelené `npm test` / CI job test

## Čeká na majitele / externí

- [ ] Comgate, FleetBold, SendGrid/Twilio, Railway
- [ ] Zálohování uploads (R2/S3), Sentry
- [ ] Pojištění, OP, GDPR/DPIA
- [ ] Branding / fotky vozu, FILL `FALLBACK_CONTACT` v index.html

## Otevřené otázky

- Testy napsané Claudem — první ověření: majitel nebo CI Actions po tomto pushi.
- Duplicitní retenční skripty: kanonický je `scripts/deleteExpiredDocuments.ts` (purge:documents alias).
