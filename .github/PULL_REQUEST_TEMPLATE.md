## Summary

<!-- What does this PR change and why? -->

## Panel checklist (see `docs/PANEL-REVIEW.md`)

Tick what you touched or verified. Leave unchecked items that are out of scope.

### Backend
- [ ] Money/state paths still safe (webhook verification mindset, settle idempotency)
- [ ] No new public leak of unlock URL / PII / transIds
- [ ] Tests added or updated if behavior changed (`npm test`)

### Frontend
- [ ] Flow still understandable (large controls, clear errors)
- [ ] If waiting on external systems: timeout or retry message exists

### DevOps
- [ ] CI still green (or explained)
- [ ] No secrets committed

### Compliance / docs
- [ ] `docs/PLAN.md` or `docs/PANEL-REVIEW.md` updated if status changed
- [ ] Document retention / admin access not weakened

### Product / marketing (if user-facing copy)
- [ ] Contactless value and kauce explanation still accurate

## Test plan

- [ ] `MOCK_MODE=true` local check (or describe why not)
- [ ] `npm test`
- [ ] `npm run build` / `tsc --noEmit`
