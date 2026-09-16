# PROJECT STATUS

Updated: 2026-09-16

## Current phase
**v9.44 Keepa token-economy repair is complete in Production. Next phase is store-use acceptance / real product research.**

## Production baseline
- Visible app version remains v9.43 (`Keepa効率改善版`); v9.44 is an internal behavior revision and did not change the visible version label.
- Current main / production commit: `a966481c90fd0e5c22ed97deb6305272c2e74b6a`.
- Production deployment: `dpl_3ARffFXgsUSb8gL9PSBgdgTX7nNA`, READY and assigned to the primary production alias.
- GitHub `quality-gate` passed for the v9.44 token-efficiency PR before merge.
- Normal scan remains list-first; detail does not auto-open.

## v9.44 completed
- Normal `/api/keepa` request uses the low-cost basic path and no longer sends `update=1` or `offers=20`.
- Explicit `Keepa再取得` sends `refresh=1`; server-side only that explicit refresh path (or separate offers mode) may add `update=1`.
- Normal manual refresh does not request marketplace offer pages.
- Production real verification on JAN `4549980616994` returned HTTP 200 with `mode=basic`, `tokensConsumed=1`, `tokensLeft=59` after the change.
- User real-device acceptance then researched five products; Vercel production logs showed exactly five `/api/keepa` calls for those five Keepa lookups, with no extra Keepa duplicate calls in that test.
- API continues to expose token telemetry: `tokensConsumed`, `tokensLeft`, `refillRate`, `refillIn`, `tokenFlowReduction`.
- A successful saved Keepa result is reused while it remains inside the 6-hour freshness window.
- Same-JAN in-flight Keepa requests are deduplicated.
- Opening detail does not silently refresh Keepa; stale or insufficient data tells the user to use `Keepa再取得` explicitly.
- HTTP 429 is displayed as `Keepa利用上限のため現在判定できません`, not product-not-found.
- Existing 6-hour decision freshness and competition rules remain. Stale/missing evidence cannot produce 🟢.
- Profit ¥500, margin 20%, ROI 20%, offers <=15, demand, price-stability and product-match gates were not relaxed.

## Amazon sellability decision
- Gate 0 / SP-API account-specific sellability will **not** be implemented for now.
- Reason: account-specific restriction is best confirmed only after the app has narrowed the product to a viable candidate; the user will check final sellability in Seller Central / FBA for those candidates.
- Public product data must not be used to guess account-specific sellability.

## Next phase
- Use the production app in normal store-style research and verify practical flow: continuous scan, list-first results, cost entry, detail consistency, same-shelf candidates, persistence, and explicit refresh only when needed.
- If a real product exposes a correctness bug, fix only that demonstrated bug; do not loosen thresholds to create green results.

## Release rule
Future changes must start from the canonical files and preserve the automated invariants. GitHub source is the source of truth; do not rely on stale chat state or old Work output.
