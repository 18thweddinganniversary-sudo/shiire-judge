# PROJECT STATUS

Updated: 2026-09-16

## Current phase
**v9.44 Keepa token-economy repair is complete in Production. せどりGO統合へ移行し、Phase 1「低コスト候補探索」を隔離ブランチで実装中。**

## Production baseline
- Visible app version remains v9.43 (`Keepa効率改善版`); v9.44 is an internal behavior revision and did not change the visible version label.
- Current main / production commit: `251ae56791c0eb7d8934ce70e14b95116f5e3db7`.
- Current production deployment: `dpl_9j4z2GCAamTs68XVMDCg2RK6Wync`, READY and assigned to production.
- Normal scan remains list-first; detail does not auto-open.
- Production behavior already accepted: 正当な🟢成立、一覧/詳細一致、仕入れ上限1円境界、同JAN 6時間キャッシュでKeepa再通信なし。

## v9.44 completed
- Normal `/api/keepa` request uses the low-cost basic path and no longer sends `update=1` or `offers=20`.
- Explicit `Keepa再取得` sends `refresh=1`; server-side only that explicit refresh path (or separate offers mode) may add `update=1`.
- Normal manual refresh does not request marketplace offer pages.
- Production real verification on JAN `4549980616994` returned HTTP 200 with `mode=basic`, `tokensConsumed=1` after the change.
- User real-device acceptance researched five products; Vercel production logs showed exactly five `/api/keepa` calls for those five Keepa lookups.
- A successful saved Keepa result is reused while it remains inside the 6-hour freshness window.
- Same-JAN in-flight Keepa requests are deduplicated.
- Existing profit/competition/demand/price-stability gates were not relaxed.

## せどりGO product direction
- チャッピーGO = スーパーでの家庭買い物支援。
- せどりGO = せどりの買付け支援。
- 現在の「仕入れ判断アプリ」は廃止せず、せどりGOの店頭最終判定機能として吸収する。
- せどりGOは `候補探索 → 店頭価格確認/判定 → ユーザー最終判断 → 結果記録` を一本化する。
- 最上位原則はサポート優先。アプリは判断材料を整理するが、最終判断はユーザーに委ねる。
- チャッピーGOで固めた「実生活/実務の流れにアプリを合わせる」思想を全開発物の共通原則にする。
- AIループ防止ルールを `PROJECT_RULES.md` と設計書へ追加済み。

## せどりGO Phase 1 — current implementation state
Branch: `design/sedori-go`
PR: #12 (draft)

Implemented on the branch:
- `candidate-core.js`: bounded Keepa Product Finder query builder.
- default filter: `domain=5`, Amazon offer absent, `monthlySold >= 30`, `productType=STANDARD`, page 0 / max 50 results.
- `api/candidates.js`: one Product Finder request per explicit call, no `stats=1`, no auto paging.
- actual token telemetry is returned; 429 is preserved as `token_limit`.
- malformed Keepa response is not treated as a valid empty candidate result.
- API key remains server-side.
- `package.json` syntax gate includes the new core and API endpoint.

TDD evidence:
- candidate-core contract first caused quality-gate failure, then implementation produced quality-gate success.
- candidate endpoint contract first caused quality-gate failure, then implementation produced quality-gate success.
- latest implementation quality-gate: run 115 = success.
- preview deployment for implementation commit `4cff3ade...`: `dpl_6susttzoDhrJnyzuiykGCHLpS9EY` READY.

## Current blocker — do not loop
The first controlled Preview `/api/candidates` probe returned `KEEPA_API_KEY_missing` before any Keepa request was made. Preview Vercel environment does not currently expose the Keepa key even though Production does.

Classification: **environment/configuration blocker**, not candidate-code failure and not a reason to change the query repeatedly.

Required next action:
1. Make the existing `KEEPA_API_KEY` available to Vercel Preview for this project without revealing/rotating it in chat/source.
2. Redeploy the branch if Vercel does not automatically redeploy after env change.
3. Call `/api/candidates` exactly once.
4. Record actual `tokensConsumed`, result count and `totalResults`.
5. Only after this passes, proceed to Phase 2 candidate enrichment/ranking. Do not merge to main before the controlled real-API acceptance passes.

## Amazon sellability decision
- Gate 0 / SP-API account-specific sellability will not be implemented for now.
- Final sellability is checked only for narrowed candidates in Seller Central / FBA.
- Public product data must not be used to guess account-specific sellability.

## Release rule
Future changes must start from the canonical files and preserve the automated invariants. GitHub source is the source of truth; do not rely on stale chat state or old Work output. Do not reopen completed v9.44 token work without contrary evidence.
