# AGENTS.md — kontext pro AI / vývojáře

Repo: `sirvan0010-alt/tesla-rental-backend`  
Účel: bezkontaktní pronájem Tesla Model Y Performance (Prostějov).

## Kdo na tom pracuje

- **Grok** — má GitHub write přístup, pushuje na `main`, integrace, security patche, CI
- **Claude** — review, návrhy, lokální testy (často bez write přístupu; ověřuje přes raw GitHub URL)
- **Majitel** — registrace Comgate/FleetBold, produkční klíče, právní věci, auto

## Aktuální stav kódu (pravda = soubory, ne staré README)

Hotové:

- výběr vozu + termín + dostupnost (`Vehicle`, `src/routes/vehicles.ts`, `prisma/seed.ts`)
- doklady (multer, `documents.ts`, `admin.html`)
- platba + kauce (Comgate + **MOCK_MODE**)
- stavy: DRAFT → PENDING_PAYMENT → PAID → ACTIVE → RETURNED → SETTLED
- `getReservationPublic` (bez leaku unlock URL / PII)
- `requireAdminKey` na settle + kauce release/capture
- timing-safe admin key + startup guard (default klíč + MOCK_MODE=false = process.exit)
- CI (tsc, prisma validate, build), Dependabot, CodeQL, branch ruleset na `main`

Záměrně stub / čeká na majitele:

- `vehicleAccessService.ts` — šablona FleetBold, v MOCK vrací fiktivní access
- `notificationService.ts` — console.log, ne reálný e-mail/SMS
- ostré Comgate / FleetBold / Railway

## Pravidla pro změny

1. **Nejdřív MOCK_MODE** — celý tok musí jít bez reálných platebních klíčů.
2. **Citlivé endpointy** — doklady, settle, release/capture kauce = vždy `requireAdminKey`.
3. **Veřejný GET rezervace** — jen `getReservationPublic`, nikdy plný Prisma objekt.
4. **Unlock URL** — ne do public GET; jen `/activate` (a později e-mail/SMS).
5. **Jeden soubor pro FleetBold** — `vehicleAccessService.ts`; zbytek appky se nemění.
6. Po větších změnách aktualizovat `README.md` a `docs/PLAN.md` (ať Claude nečte zastaralý text).
7. `package-lock.json` generovat lokálně (`npm install`) a commitnout; CI pak může `npm ci`.

## Lokální ověření (majitel)

```bash
cp .env.example .env   # MOCK_MODE=true
docker compose up -d
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
# http://localhost:3000  +  /admin.html
```

Detail: `HOW_TO_WORK_WITH_THIS.md`, `docs/PLAN.md`.
