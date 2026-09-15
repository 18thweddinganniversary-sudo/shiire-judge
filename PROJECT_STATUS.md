# PROJECT STATUS

Updated: 2026-09-15

## Current phase
**Development foundation / context-loss prevention. App feature fixes are paused until this foundation passes its own acceptance test.**

## Production baseline before foundation work
- App version: v9.42
- Previously observed main baseline: `9d2a0f6d202ce529cfff2636b01cccccdd516a12`
- Real Keepa green verification previously succeeded for JAN `4549980616994`, cost 16,140円, at that historical data point.
- Automated suite previously reported 72 passing tests.

## Known current issues to fix only after foundation acceptance
1. Normal JAN scan currently auto-opens detail; desired invariant is list-first, detail-on-tap.
2. Keepa request currently uses expensive `update=1&offers=20`; token economics/necessity must be redesigned without weakening verdict safety.
3. Keepa token exhaustion/API errors need accurate UI semantics.
4. Stale-detail auto-refresh and duplicate/in-flight request behavior need review.
5. Gate 0 account-specific Amazon sellability remains deferred/unimplemented.

## Foundation work started
Created durable repository context:
- `AI_START_HERE.md`
- `PROJECT_RULES.md`
- `MASTER_SPEC.md`
- `PROJECT_STATUS.md`

## Foundation acceptance still required
- Add machine-enforced preflight/context checks.
- Add regression test for the store workflow invariant: scan must not auto-open detail.
- Configure/verify GitHub protection so failing required checks cannot enter protected main.
- Configure/verify production deployment gate so failed checks cannot silently reach production.
- Perform a deliberate negative test on a non-production branch: introduce a known invariant violation and prove the pipeline blocks it.
- Remove/revert the deliberate violation and verify production is unchanged.

## Stop rule
Until all foundation acceptance items above pass, do not start the Keepa or scan behavior production fixes.
