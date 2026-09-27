# Panel review — Tesla rental (record for humans and AIs)

**Purpose of this file:** single source of truth for *what* was criticized, *why* it matters, *what was done*, and *what remains*.  
Any AI (Grok, Claude, Copilot, Cursor, etc.) should read this before proposing large changes.

**Project:** contactless short-term rental of one Tesla Model Y Performance (Prostějov, Czech Republic).  
**Repo:** https://github.com/sirvan0010-alt/tesla-rental-backend

---

## Why this panel exists

We are building software that touches:

- **money** (deposit + card pre-auth for kauce/deposit hold),
- **identity documents** (driver license / ID photos),
- **physical vehicle access** (digital unlock).

A single “happy path” demo is not enough. We simulated a **multi-role review panel** so gaps are named early—before real customers and real Comgate/FleetBold accounts.

This is **not** a substitute for a real lawyer, insurer, or production SRE. It is a structured debt list.

---

## How we work (multi-AI + owner)

| Actor | Role |
|-------|------|
| **Owner (human)** | Business, registrations (Comgate, FleetBold), legal, insurance, real car/VIN, GitHub visibility, production secrets |
| **Grok** | Often has GitHub write access; implements features, security fixes, CI, docs; pushes to `main` when asked |
| **Claude** | Often review + local experiments; may lack push access; verifies via raw GitHub URLs; proposes patches |
| **Other AIs** | Welcome if they follow `AGENTS.md` + this file; must not invent “done” status that contradicts the tables below |

### Rules for any AI

1. **Truth = files on `main`**, not chat history or an outdated README paragraph.
2. Prefer **MOCK_MODE** for end-to-end demos; do not require real payment keys for basic flow tests.
3. Never expose `vehicleUnlockUrl`, PII, or payment transIds on public GET reservation endpoints.
4. Admin/document/settle/kauce capture-release paths need `ADMIN_API_KEY`.
5. After structural changes, update **this file** and `docs/PLAN.md`.
6. Do not claim production-readiness while FleetBold integration is still a template and notifications are `console.log`.

---

## Panel findings by role

Status legend:

- **DONE** — implemented in repo
- **PARTIAL** — some code or docs, not complete
- **OPEN** — not done; tracked for later
- **OWNER** — requires human (legal, money, accounts, brand assets)

### 1. Senior backend / fullstack

| Finding | Why it matters | Status | Where |
|---------|----------------|--------|--------|
| No automated tests on money paths | Regressions on webhook/settle can lose money or unlock wrongly | **PARTIAL** | Unit tests: `tests/` (auth, health). Full webhook/settle DB tests still **OPEN** |
| `vehicleAccessService.ts` is a design, not verified API | Only place that may break when real FleetBold docs arrive | **OPEN** / **OWNER** | `src/services/vehicleAccessService.ts` + MOCK |
| State machine is clear | Good base for rental lifecycle | **DONE** | Prisma enum + `reservationService.ts` |

### 2. Frontend

| Finding | Why it matters | Status | Where |
|---------|----------------|--------|--------|
| 4-step flow is appropriate for non-technical users | Product requirement | **DONE** | `public/index.html` |
| Infinite wait if access never becomes ready | User stuck at car | **DONE** | Timeout + `/retry-access` in `index.html` |
| Weak client validation | Bad UX, garbage data | **DONE** | Email/phone checks in `index.html` |
| Accessibility (ARIA, contrast, screen readers) | Public-facing quality | **OPEN** | Not implemented |
| Vanilla HTML OK for MVP scope | Avoid premature React | **DONE** (by choice) | `public/index.html` |

### 3. DevOps / infrastructure

| Finding | Why it matters | Status | Where |
|---------|----------------|--------|--------|
| CI, CodeQL, Dependabot early | Catch breakages and vulns | **DONE** | `.github/workflows/`, `dependabot.yml` |
| Branch protection on `main` | Two AIs pushing independently | **DONE** | Ruleset `protect-main` (status check) |
| No structured error monitoring (Sentry etc.) | Failures only noticed by customers | **OPEN** | Listed in `docs/PLAN.md` |
| `uploads/` on single disk = SPOF | Lost ID photos = legal/ops disaster | **OPEN** | Plan: R2/S3 + DB backups |
| FleetBold single dependency, no technical fallback | Customer at car, API down | **OPEN** | Ops fallback: phone owner; no hardware keybox by product choice |

### 4. Lawyer / compliance

| Finding | Why it matters | Status | Where |
|---------|----------------|--------|--------|
| Unencrypted document storage | Sensitive ID data; needs justified DPIA | **OWNER** | Intentional; disk encryption recommended in README |
| Retention policy only “in plan”, not enforced | GDPR accountability | **PARTIAL** | `scripts/purge-old-documents.ts` (**DONE** script); legal retention period **OWNER** |
| Sharing digital access with third parties | Liability different from physical key | **OWNER** | Terms of service + insurance |
| Trust copy at upload | Reduces abandonment; not legal advice | **DONE** | Text in `index.html` |

### 5. UX / visual design

| Finding | Why it matters | Status | Where |
|---------|----------------|--------|--------|
| MVP has no brand identity / car photos | Conversion | **OPEN** / **OWNER** | Assets from owner; wire into landing/app |
| Explain why documents are required | Psychological friction at upload | **DONE** | `index.html` |

### 6. Marketing

| Finding | Why it matters | Status | Where |
|---------|----------------|--------|--------|
| Product invisible without entry page | Nobody reaches the app | **PARTIAL** | `public/landing.html` (minimal) |
| “Contactless pickup” as selling point | Differentiator vs classic rental | **DONE** (copy) | Landing + step 1 hint |
| Transparent kauce (block, not charge) | Fear of hidden fees | **DONE** (copy) | Landing + payment step |
| Local SEO, reviews | Trust for unknown provider | **OPEN** / **OWNER** | Content + real reviews |

---

## Why we prioritize this way

1. **Cheapest fixes first** — copy, timeouts, validation, landing stub (high trust, low risk).
2. **Safety before scale** — admin key guards, public reservation DTO, no unlock URL leak.
3. **Don’t pay for production gateways** until local MOCK E2E works on the owner’s machine.
4. **One integration surface for the car** — only `vehicleAccessService.ts` should change when FleetBold docs arrive.
5. **Legal/insurance are human gates** — code cannot “finish” DPIA or policy wording.

---

## How to continue the panel autonomously (lightweight)

We do **not** run six full LLM agents inside GitHub Actions by default (cost, false confidence on legal topics).

What we do instead:

1. **This document** — any AI re-scores DONE/PARTIAL/OPEN against `main`.
2. **PR template** — humans/AIs must tick panel-related checks on larger PRs.
3. **Optional** — scheduled external AI (e.g. Grok Automation) weekly: “diff this file vs repo and open a short report”.

If you add a CI “AI reviewer”, it must only comment; it must not auto-merge.

---

## Related docs

| File | Role |
|------|------|
| `AGENTS.md` | Short rules for AIs working on the repo |
| `docs/PLAN.md` | Execution checklist (owner + engineering) |
| `docs/kompletni-plan-tesla-pronajem.md` | Broader business/tech plan |
| `README.md` | Setup and current feature set |
| `HOW_TO_WORK_WITH_THIS.md` | Practical local runbook |

---

*Last integrated panel follow-ups: trust copy, access timeout/retry, validation, retention script, unit tests, landing stub, CI test step. Re-read `main` before assuming anything else is done.*
