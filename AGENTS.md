# AGENTS.md — context for AI / developers

Repo: `sirvan0010-alt/tesla-rental-backend`  
Purpose: contactless rental of **Tesla Model Y Performance** (Prostějov, CZ).

**Read next:** `docs/MULTI_AI_COLLABORATION.md` (why/how multi-AI) and `docs/PANEL-REVIEW.md` (role-based review status).

## Who works here

- **Grok** — often GitHub write; implements, secures, CI, docs
- **Claude** — review, local trials, patch proposals; may lack push
- **Owner** — Comgate/FleetBold accounts, legal, insurance, car, production secrets
- **Other AIs** — allowed if they follow this file and do not invent “done” against PANEL-REVIEW

## Code status (truth = files on main)

Done:

- vehicle + date selection, availability
- document upload + admin view
- deposit + kauce (Comgate or **MOCK_MODE**)
- states DRAFT → … → SETTLED
- `getReservationPublic`, admin key guards, startup guard
- CI, Dependabot, CodeQL, unit tests, landing stub, retention script

Waiting on owner / external:

- real FleetBold API shape (`vehicleAccessService.ts` template)
- real email/SMS (`notificationService.ts` stub)
- production hosting, Sentry, object storage for uploads

## Rules

1. Prefer **MOCK_MODE** for full flow without real payment keys.
2. Sensitive routes → `requireAdminKey`.
3. Public GET reservation → only `getReservationPublic`.
4. Unlock URL → not on public GET; `/activate` (+ later email/SMS).
5. FleetBold changes → **only** `vehicleAccessService.ts`.
6. After big changes → update `docs/PLAN.md` + `docs/PANEL-REVIEW.md`.
7. Never commit real secrets or customer document binaries.

## Local verify

```bash
cp .env.example .env   # MOCK_MODE=true
docker compose up -d
npm install && npm run prisma:migrate && npm run prisma:seed
npm test && npm run dev
```

Details: `HOW_TO_WORK_WITH_THIS.md`, `docs/PLAN.md`.
