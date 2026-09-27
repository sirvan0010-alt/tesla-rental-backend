# Plán — Tesla Y pronájem (Prostějov)

## Cíl

Bezkontaktní krátkodobý pronájem **Tesla Model Y Performance 2023** (bílý interiér), software-first (app přístup, bez keyboxu).

## Co je hotové v kódu

| Oblast | Stav |
|--------|------|
| Výběr vozu + termín + dostupnost | ✅ |
| Doklady (ŘP + volitelně OP) + admin view | ✅ |
| Záloha + pre-auth kauce (Comgate / MOCK) | ✅ |
| Webhook → PAID → vehicle access (mock/šablona) | ✅ |
| ACTIVE → RETURNED (fotky) → SETTLED | ✅ |
| Security (public GET, admin key, startup guard) | ✅ |
| CI + Dependabot + CodeQL + protect-main | ✅ |
| Ostré Comgate / FleetBold / notifikace / hosting | ❌ čeká na majitele |

## Zbývá

### 1. U majitele (rychlé)

- [ ] Secret scanning + push protection (GitHub Settings → Code security)
- [ ] `npm install` → commit `package-lock.json` → volitelně CI na `npm ci`
- [ ] Lokální mock E2E podle sekce A v README / HOW_TO

### 2. Externí služby (blokují ostrý provoz)

- [ ] **Comgate** sandbox → test platby → produkce
- [ ] **FleetBold** (nebo Tesla Fleet API) → upravit jen `vehicleAccessService.ts`
- [ ] **SendGrid + Twilio/SMSbrána** → `notificationService.ts`
- [ ] **Railway / VPS** + doména + HTTPS webhook URL

### 3. Před prvním zákazníkem

- [ ] E2E v mocku end-to-end
- [ ] E2E se Comgate sandbox + ngrok (webhook)
- [ ] Silný `ADMIN_API_KEY` v produkci
- [ ] Pojištění komerčního pronájmu
- [ ] Obchodní podmínky + GDPR (právník)
- [ ] Skutečný VIN ve `prisma/seed.ts` / DB

## Doporučené pořadí prací

1. Mock E2E lokálně (0 Kč)
2. Comgate sandbox + ngrok
3. FleetBold partnerství + úprava jednoho service souboru
4. Notifikace
5. Deploy + ostré klíče
6. Právní + pojištění → první zákazník

## Odkazy

- Repo: https://github.com/sirvan0010-alt/tesla-rental-backend
- Detailní plán: `docs/kompletni-plan-tesla-pronajem.md`
- Pro AI: `AGENTS.md`
