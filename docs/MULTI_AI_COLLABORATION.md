# Multi-AI collaboration guide

This repository is developed with **more than one AI assistant** plus a human owner. This document explains **why**, **how**, and **how a new AI should behave** so it does not undo security or invent false progress.

---

## Why multiple AIs?

- **Speed:** one agent implements, another reviews from a different angle.
- **Challenge:** payment + ID documents + vehicle unlock need adversarial review (security, UX, ops).
- **Limits:** one model’s sandbox may not run Postgres/Prisma engines; another may have GitHub write access. Combining them reduces blind spots.

This is still **owner-driven**. AIs do not replace:

- company registration and payment provider KYC,
- insurance and lawyer-approved terms,
- real Tesla / FleetBold partnership,
- production secrets and hosting bills.

---

## How we do it

```
Owner sets goals / accepts risk
        │
        ├─► Grok (often write to GitHub): implement, fix, document, CI
        │
        ├─► Claude (often read + patch proposals): review, local trials, caution on security
        │
        └─► Repo on GitHub = source of truth (public or private by owner choice)
```

### Communication patterns that worked

1. **Raw URLs** for AIs that cannot browse private repos or invent paths:  
   `https://raw.githubusercontent.com/sirvan0010-alt/tesla-rental-backend/main/<path>`
2. **Patches** from a reviewing AI → implementing AI applies and pushes.
3. **PANEL-REVIEW.md** so debates become durable status, not chat archaeology.
4. **MOCK_MODE** so “E2E works” does not mean “we charged a real card”.

### Anti-patterns (do not do this)

- Updating chat claims (“everything is done”) without updating `docs/PLAN.md` / `PANEL-REVIEW.md`.
- Leaving README sections that say “files still missing” after they were added (causes false 404 panic).
- Pushing real `ADMIN_API_KEY`, Comgate secrets, or customer document images to git.
- Expanding scope into a full Turo clone before one-car MOCK E2E is green on the owner’s PC.

---

## Onboarding prompt for a foreign AI

Copy-paste when handing the repo to a new assistant:

```
You are working on github.com/sirvan0010-alt/tesla-rental-backend
Contactless Tesla Model Y rental backend (Czech Republic, Comgate, optional FleetBold).

Before changing code, read:
1. AGENTS.md
2. docs/PANEL-REVIEW.md
3. docs/PLAN.md
4. README.md

Rules:
- Source of truth is the main branch files, not prior chat.
- MOCK_MODE=true for local full flow without real Comgate/FleetBold.
- Do not put unlock URLs or PII on public GET /reservations/:id.
- Protect admin/document/settle routes with ADMIN_API_KEY.
- After meaningful changes, update docs/PLAN.md and docs/PANEL-REVIEW.md status tables.
- Prefer minimal diffs; vehicle vendor integration only in vehicleAccessService.ts.
```

---

## What “done” means here

| Level | Meaning |
|-------|--------|
| **Code-complete for MOCK E2E** | Reserve → docs → pay (mock) → unlock → return → settle path exists |
| **Sandbox-complete** | Real Comgate test + public HTTPS webhook |
| **Production-complete** | Real FleetBold, notifications, backups, strong admin key, legal/insurance |

Most AI work so far targets **code-complete for MOCK E2E** + security hardening. Do not blur these levels.

---

## Related

- `docs/PANEL-REVIEW.md` — per-role findings and status  
- `AGENTS.md` — short engineering rules  
- `docs/PLAN.md` — ordered remaining work  
