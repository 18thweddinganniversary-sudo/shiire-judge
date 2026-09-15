# PROJECT STATUS

Updated: 2026-09-16

## Current phase
**Foundation accepted. v9.43 Keepa token-economy repair is in progress.**

## Production baseline
- App UI baseline: v9.42
- Current main after first v9.43 backend slice: `01fe6a68fffb3f6cbd31855adad027df03a5ea77`
- GitHub required `quality-gate` is active and a deliberate failing PR was blocked from main.
- Vercel Production Deployment Check `quality-gate` is registered for Production.
- Normal scan is list-first; detail does not auto-open.

## v9.43 completed slice
- Normal `/api/keepa` request no longer sends `offers=20`.
- Keepa official docs: base Product Request costs 1 token per ASIN; marketplace offer pages add 6 tokens per found page.
- Production real verification on JAN `4549980616994` returned HTTP 200 with `mode=basic`, `tokensConsumed=1`, `tokensLeft=59`.
- The response still contained ASIN, current/90d price, offer count, demand evidence, FBA fee and offer-update timestamp.
- Existing 6-hour decision freshness rule remains; stale offer timestamps cannot produce 🟢.
- API now exposes token telemetry: `tokensConsumed`, `tokensLeft`, `refillRate`, `refillIn`, `tokenFlowReduction`.
- `mode=offers` remains an explicit expensive path; normal scanning does not use it.

## v9.43 remaining work
1. Avoid repeat Keepa calls for the same JAN while a successful saved result is still within the 6-hour freshness window.
2. Add same-JAN in-flight deduplication where practical.
3. Stop stale detail-open from silently spending Keepa tokens; refresh should be explicit.
4. Show token exhaustion/429 as `Keepa利用上限のため現在判定できません`, not as product-not-found.
5. Wire explicit expensive offer refresh only where genuinely needed; do not weaken freshness/competition gates.
6. Bump visible app version to v9.43 only after the whole repair passes.
7. Run full automated suite, Preview, one cost-controlled real API verification, Production verification, then update this file again.

## Deferred
- Gate 0 account-specific Amazon sellability remains unimplemented; SP-API/auth integration is separate.

## Stop rule
Do not call v9.43 complete until all remaining items above pass. Do not relax profit, margin, ROI, offer-count, demand, price-stability or freshness thresholds to create a green result.
