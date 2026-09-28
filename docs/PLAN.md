# PLAN.md — aktuální stav projektu

Zdroj pravdy: tento soubor + `git log`. Panel: `docs/PANEL-REVIEW.md`.

## Hotovo v kódu (main)

- Stavový cyklus, Comgate/MOCK, vozidla, doklady, return, settle, admin
- Security baseline: getReservationPublic, admin key, startup guard
- **P0 fix (2026-09-28):** deposit/kauce berou částku + e-mail **jen z DB**, ne z klienta
- **damageAmountCzk ≤ kauceAmountCzk** při settle
- **RETURNED jen z ACTIVE**; upload dokladů jen DRAFT/PENDING_PAYMENT
- Public DTO bez VIN / accessError / PII
- Testy webhook/settle (CI test job — ověřit zelenou)
- Retence skript, landing stub, multi-AI docs

## P0/P1 backlog (ChatGPT security review — souhlasíme)

### P0 finance / spolehlivost
- [x] Server-authoritative deposit/kauce
- [x] Limit škody ≤ kauce
- [ ] Idempotentní settle (settlement pending / failed stav)
- [ ] Webhook + periodická reconciliation plateb
- [ ] DB exclusion / constraint proti double-bookingu termínu

### P1 security / stavy
- [x] RETURNED jen z ACTIVE
- [ ] Customer access token (ne jen reservation ID) pro activate
- [ ] Rate limiting + produkční CORS
- [ ] Silnější validace uploadů
- [ ] Negativní testy (špatná částka, DRAFT→RETURNED, …)

### Externí / owner
- [ ] Comgate, FleetBold, SendGrid/Twilio, Railway
- [ ] package-lock + npm ci; zelené CI
- [ ] Pojištění komerční, OP, DPIA
- [ ] **Demand engine** (8–12 dní/měsíc) — větší riziko než backend

## Business (shrnutí z marketing review — ne kód)

- Produkt ≠ Bolt doprava; = „Tesla na 24 h / víkend“ (max ~1–3 dny)
- Ceník modelově: 24h / 2d / 3d + km limit (benchmark ~300 km/den u konkurence)
- Break-even ~8–10 dní/měsíc při ~3,5k Kč/den (orientační model, ne faktura)
- Konkurence (např. tesla-pujcovna.cz): app key + bezkontakt; my + kauce pre-auth + silnější ID tok
- **IDV provider (Sumsub/Veriff) v produkci** = návrh ke zvážení, ne hotové rozhodnutí — dnes upload fotek (AGENTS: neměnit bez souhlasu majitele)
- Decentní branding, ne celopolep; dárkové poukazy; Google lokální SEO

## Návrhy ke zvážení (neimplementovat bez majitele)

- Externí IDV místo raw upload dokladů
- PricingService + admin ceník (snapshot do rezervace)
- RentalSession odděleně od Reservation
- Customer model / 2FA

## Otevřené

- CI `test` job historicky padal — po P0 opravách znovu ověřit Actions
- package-lock chybí
