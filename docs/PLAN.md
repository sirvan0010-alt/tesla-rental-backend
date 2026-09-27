# Plán — Tesla Y pronájem (Prostějov)

## Cíl

Bezkontaktní krátkodobý pronájem **Tesla Model Y Performance 2023** (bílý interiér), software-first (app přístup, bez keyboxu).

## Nově z panelu (integrováno)

- Vysvětlující text u nahrání dokladů + marketingová věta o bezkontaktním vyzvednutí
- Timeout / retry při čekání na `vehicleAccessReady` (+ volání `/retry-access`)
- Client-side validace e-mailu a telefonu
- `scripts/purge-old-documents.ts` — GDPR retence (cron)
- `src/app.ts` — Express app bez `listen` pro testy
- Vitest: admin auth, health, contract `getReservationPublic`
- `public/landing.html` — vstupní stránka (SEO / prodejní argumenty)
- CI spouští `npm test`

## Co je hotové v kódu

| Oblast | Stav |
|--------|------|
| Výběr vozu + termín + dostupnost | ✅ |
| Doklady (ŘP + volitelně OP) + admin view | ✅ |
| Záloha + pre-auth kauce (Comgate / MOCK) | ✅ |
| Webhook → PAID → vehicle access (mock/šablona) | ✅ |
| ACTIVE → RETURNED (fotky) → SETTLED | ✅ |
| Security (public GET, admin key, startup guard) | ✅ |
| CI + Dependabot + CodeQL + protect-main + unit tests | ✅ |
| Ostré Comgate / FleetBold / notifikace / hosting | ❌ čeká na majitele |
| Sentry / object storage pro uploads | ❌ doporučeno před ostrým provozem |
| Plné DB integrační testy webhook/settle | ❌ další iterace |

## Zbývá

### 1. U majitele (rychlé)

- [ ] Secret scanning + push protection (GitHub Settings → Code security)
- [ ] `npm install` → commit `package-lock.json` → volitelně CI na `npm ci`
- [ ] Lokální mock E2E (`MOCK_MODE=true`)
- [ ] Cron: `npm run purge:documents` (retence)

### 2. Externí služby (blokují ostrý provoz)

- [ ] **Comgate** sandbox → test platby → produkce
- [ ] **FleetBold** → upravit jen `vehicleAccessService.ts`
- [ ] **SendGrid + Twilio/SMSbrána** → `notificationService.ts`
- [ ] **Railway / VPS** + doména + HTTPS webhook
- [ ] Záloha DB + R2/S3 pro `uploads/`

### 3. Před prvním zákazníkem

- [ ] E2E mock + Comgate sandbox + ngrok
- [ ] Silný `ADMIN_API_KEY`
- [ ] Pojištění, OP + GDPR (právník), DPIA
- [ ] Skutečný VIN ve seedu
- [ ] Fotky vozu / branding na landing

## Doporučené pořadí

1. Mock E2E lokálně  
2. Comgate sandbox + ngrok  
3. FleetBold  
4. Notifikace + Sentry + R2  
5. Deploy  
6. Právní → první zákazník  

## Odkazy

- Repo: https://github.com/sirvan0010-alt/tesla-rental-backend  
- Detail: `docs/kompletni-plan-tesla-pronajem.md`  
- AI: `AGENTS.md`  
