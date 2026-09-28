# Tesla rental — contactless backend

Backend + minimální frontend pro bezkontaktní pronájem **Tesla Model Y Performance** (Comgate platby, rezervace, doklady, přístup k vozu, vrácení, vyrovnání kauce).

## Stav projektu (aktuální)

Hotové v kódu (end-to-end tok v `MOCK_MODE`):

- výběr vozu + termínu + kontrola dostupnosti (`Vehicle`, `src/routes/vehicles.ts`, seed)
- nahrání dokladů (řidičák povinně, občanka volitelně) + admin prohlížení
- platba zálohy + pre-auth kauce (Comgate nebo mock)
- webhook → PAID → dočasný přístup k vozu (FleetBold šablona / mock)
- odemčení (ACTIVE) → vrácení s fotkami (RETURNED) → settle kauce (SETTLED)
- security: `getReservationPublic`, `requireAdminKey` na settle/kauce, timing-safe compare, startup guard
- integrační testy (Vitest): webhook + settle (ověřit v CI / lokálně)
- retence dokladů: `npm run retention:cleanup`

Ještě není ostré (čeká na vás):

- registrace Comgate + FleetBold + veřejná HTTPS (Railway)
- reálné e-mail/SMS (SendGrid/Twilio — zatím `console.log`)

## Lokální spuštění (MOCK)

```bash
git clone https://github.com/sirvan0010-alt/tesla-rental-backend.git
cd tesla-rental-backend
cp .env.example .env
docker compose up -d
npm install
npm run prisma:migrate   # nebo npx prisma db push
npm run prisma:seed
npm test                 # vyžaduje běžící Postgres + prisma generate
npm run dev
# http://localhost:3000
# http://localhost:3000/admin.html
# http://localhost:3000/landing.html
```

## Testy

- `tests/webhook.test.ts` — platba → webhook → PAID → přístup; veřejný GET bez PII
- `tests/settle.test.ts` — settle + 401 bez admin klíče + 409 po SETTLED

CI job `test` běží proti Postgres service kontejneru.

## Retence dokladů

```bash
npm run retention:cleanup
```

## Dokumentace pro AI

- `AGENTS.md` — pravidla pro AI
- `docs/PLAN.md` — živý stav
- `docs/PANEL-REVIEW.md` — výtky panelu
- `docs/MULTI_AI_COLLABORATION.md` — multi-AI spolupráce
