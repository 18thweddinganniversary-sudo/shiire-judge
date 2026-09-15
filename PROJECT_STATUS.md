# PROJECT STATUS

Updated: 2026-09-16

## Current phase
**Foundation accepted. v9.43 Keepa token-economy repair is complete in Production.**

## Production baseline
- Visible app version: v9.43 (`Keepa効率改善版`).
- Release main commit: `b6c2dfae57b791737328b5d333335915cdfab1b7`.
- Production deployment: `dpl_2dFa53BTDa1fE1gTihuaKg54Lcaj`, READY and assigned to the primary production alias.
- Production page verification returned HTTP 200 and served `仕入れ判断 v9.43` with asset cache key `9430`.
- GitHub required `quality-gate` remains active; Vercel Production Deployment Check `quality-gate` completed successfully for this release.
- Normal scan remains list-first; detail does not auto-open.

## v9.43 completed
- Normal `/api/keepa` request no longer sends `offers=20`; normal lookup uses the low-cost basic path.
- Production real verification on JAN `4549980616994` returned HTTP 200 with `mode=basic`, `tokensConsumed=1`, `tokensLeft=59`.
- API exposes token telemetry: `tokensConsumed`, `tokensLeft`, `refillRate`, `refillIn`, `tokenFlowReduction`.
- A successful saved Keepa result is reused while it remains inside the 6-hour freshness window.
- Same-JAN in-flight Keepa requests are deduplicated.
- Opening detail does not silently refresh Keepa; stale or insufficient data tells the user to use `Keepa再取得` explicitly.
- HTTP 429 is displayed as `Keepa利用上限のため現在判定できません`, not product-not-found.
- `mode=offers` remains an explicit expensive API path and is not used by normal scanning. The current basic response already supplies the competition evidence used by the decision engine, so the UI does not spend extra offer-page tokens without a demonstrated need.
- Existing 6-hour decision freshness and competition rules remain. Stale/missing evidence cannot produce 🟢.
- Profit ¥500, margin 20%, ROI 20%, offers <=15, demand, price-stability and product-match gates were not relaxed.
- Full automated suite passed at release candidate stage: 79/79 tests.
- Preview checks passed, release PR was merged through protected main, Vercel production deployment reached READY, and the primary production page was verified after deployment.

## Deferred / next phase
- Gate 0 account-specific Amazon sellability remains unimplemented; SP-API/auth integration is a separate phase and must not be guessed from public product data.
- Any future Keepa `mode=offers` UI wiring requires a concrete missing-data case and token-cost justification before implementation.

## Release rule
v9.43 is complete. Future changes must start from the canonical files and preserve the automated invariants; do not weaken decision thresholds to create a green result.
