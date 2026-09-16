# PROJECT STATUS

Updated: 2026-09-16

## Current phase
**v9.44 Keepa token-economy repair is complete in Production. せどりGO統合版は隔離Previewで候補探索→上位5件詳細化→店頭最終判定への接続まで実装済み。**

## Production baseline
- Visible app version remains v9.43 (`Keepa効率改善版`); v9.44 is an internal behavior revision and did not change the visible version label.
- Current main / production commit: `251ae56791c0eb7d8934ce70e14b95116f5e3db7`.
- Current production deployment: `dpl_9j4z2GCAamTs68XVMDCg2RK6Wync`, READY and assigned to production.
- Normal scan remains list-first; detail does not auto-open.
- Production behavior already accepted: 正当な🟢成立、一覧/詳細一致、仕入れ上限1円境界、同JAN 6時間キャッシュでKeepa再通信なし。

## v9.44 completed
- Normal `/api/keepa` request uses the low-cost basic path and no longer sends `update=1` or `offers=20`.
- Explicit `Keepa再取得` sends `refresh=1`; server-side only that explicit refresh path may add `update=1`.
- User real-device acceptance researched five products; Vercel production logs showed exactly five `/api/keepa` calls for those five Keepa lookups.
- A successful saved Keepa result is reused while it remains inside the 6-hour freshness window.
- Existing profit/competition/demand/price-stability gates were not relaxed.

## せどりGO product direction
- チャッピーGO = スーパーでの家庭買い物支援。
- せどりGO = せどりの買付け支援。
- 現在の「仕入れ判断アプリ」は廃止せず、せどりGOの店頭最終判定機能として吸収する。
- せどりGOは `候補探索 → 店頭価格確認/判定 → ユーザー最終判断 → 結果記録` を一本化する。
- 最上位原則はサポート優先。候補表示は仕入れ指示ではなく、最終判断はユーザーに委ねる。
- AIループ防止ルールを `PROJECT_RULES.md` と設計書へ追加済み。

## せどりGO Preview implementation
Branch: `design/sedori-go`
PR: #12 (draft)

Implemented:
- `candidate-core.js`: Keepa Product Finder一次絞り込み。
- `api/candidates.js`: 1回の明示操作につき1 Finder request、page 0 / max 50、no auto paging、no `stats=1`。
- Finder prefilters: Amazon本体なし、月販30以上、新品価格1,500円以上、90日平均あり、新品出品者1〜15、90日価格差 -15%〜+25%、FBA feeあり、商品/offer更新6時間以内、sales rank 1〜50,000。
- `api/candidate-details.js`: Finder上位5 ASINだけを低コストProduct Requestで詳細化。`update`/`offers`なし。
- 詳細化でJAN、商品名、価格、90日平均、回転、出品者、Amazon本体、FBA fee、紹介料、仕入れ上限目安を取得。
- JANなし / 利益上限算出不可は店頭候補リストから除外。
- `sedori-go-core.js`: 店頭で使える候補だけshortlist化し、6時間cacheを判定。
- `sedori-go.js` + `sedori-go.css`: 同じアプリ画面に「せどりGO 候補探索」を統合。候補カードの「店頭で確認」で既存JAN最終判定へ接続。
- UI文言は「仕入れ候補」「店頭で確認」とし、候補を自動的な買い指示にしない。

## Real Keepa acceptance evidence
Preview `KEEPA_API_KEY` はProduction + Previewで設定済み。

Controlled Product Finder probes:
- 初期条件: `totalResults=262800`, `tokensConsumed=11`。
- 価格/競争/価格安定pre-filter後: `105700`, 11 tokens。
- fee/6h freshness追加後: `76700`, 11 tokens。
- rank<=50000追加後: `76500`, 11 tokens。

Conclusion: Finder母数そのものをさらに何度も試行して削るのは、1回11 tokenのため非効率。ここからは上位少数だけ詳細化する二段階方式を採用する。

Controlled candidate detail probe（上位5 ASIN）:
- `tokensConsumed=5`。
- 5件中4件に13桁JAN、うち3件は仕入れ上限目安まで算出できた。
- 例: VITAS JAN `4589463560215` 上限目安1,171円、medicube JAN `8809506809917` 1,170円、V CRYSTAL JAN `4595121110050` 1,520円。
- JANなし / 利益上限算出不可はshortlistから除外する。

## Verification
TDDの各production changeは先に失敗するテストを確認してから実装。
- Finder prefilters: RED run 128 → GREEN run 131。
- freshness/fee filters: RED run 134 → GREEN run 137。
- sales-rank filter: RED run 140 → GREEN run 143。
- top-5 detail enrichment: RED run 146 → GREEN run 149/152。
- shortlist core: RED run 155 → GREEN run 158。
- integrated UI wiring: RED run 161 → GREEN run 172。
- Latest Preview deployment `dpl_4NEJo6huaX22C7F8KA4WnKoHk25L` READY; `/` and `sedori-go.js` served successfully without triggering another Keepa lookup.

## Next acceptance
- iPhone実機でPreviewの統合画面レイアウトを1回確認。
- 候補探索ボタンはKeepa消費を伴うため、既存API受入証拠を再利用し、無意味な連打テストは禁止。
- UI確認後、必要な最小修正だけ行い、PR #12をmainへ統合する。
- 次段階で買付け結果記録を追加する。

## Amazon sellability decision
- Gate 0 / SP-API account-specific sellability will not be implemented for now.
- Final sellability is checked only for narrowed candidates in Seller Central / FBA.
- Public product data must not be used to guess account-specific sellability.

## Release rule
GitHub source is source of truth。合格済み項目を再試験せず、実証された不具合だけ最小修正する。完成済みv9.44 token workは反証がない限り再オープンしない。
