# PROJECT STATUS

Updated: 2026-09-17

## Current phase
**v9.44 Keepa token-economy repairと、せどりGOの候補探索→上位5件詳細化→既存店頭最終判定への統合がProductionで完了。買付け結果記録はPR #13のPreviewで実装・自動検証済み。**

## Production baseline
- Visible app version remains v9.43 (`Keepa効率改善版`); v9.44 is an internal behavior revision and did not change the visible version label.
- Current main release commit: `15acb6582c15251e7c2e8f2e939e52786a7f9498`.
- せどりGO production deployment: `dpl_BVrM6zNFfberNFExXe98N8PchfCP`, READY and assigned to `shiirejudgev5vercel-1.vercel.app`.
- Production root HTTP 200 and includes camera-first `カメラ → JAN操作 → せどりGO候補探索` layout.
- Production `/api/product?jan=4901777300545` returned HTTP 200 with a real Yahoo product match after release.
- Normal scan remains list-first; detail does not auto-open.
- Existing accepted behavior remains: 正当な🟢成立、一覧/詳細一致、仕入れ上限1円境界、同JAN 6時間キャッシュでKeepa再通信なし。

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

## せどりGO Production implementation
PR #12 merged to main with squash commit `15acb6582c15251e7c2e8f2e939e52786a7f9498`.
- Bounded Keepa Product Finder一次絞り込み。
- 1回の明示操作につき1 Finder request、page 0 / max 50、no auto paging、no `stats=1`。
- Amazon本体なし、月販30以上、新品価格1,500円以上、90日平均あり、新品出品者1〜15、90日価格差 -15%〜+25%、FBA feeあり、商品/offer更新6時間以内、sales rank 1〜50,000でpre-filter。
- Finder上位5 ASINだけ低コストProduct Requestで詳細化。`update`/`offers`なし。
- JANなし / 利益上限算出不可は店頭候補リストから除外。
- 6時間candidate cache。
- 候補カードの「店頭で確認」で既存JAN最終判定へ接続。
- iPhone実機でカメラ最上部配置を確認済み。

## Real Keepa acceptance evidence
- Controlled Finder probe: `tokensConsumed=11`。
- Controlled top-5 detail probe: `tokensConsumed=5`。
- Finder母数を有料試行で何度も削る方式は採用せず、上位少数だけ詳細化する二段階方式を採用。
- Preview `KEEPA_API_KEY` / `YAHOO_APP_ID` はProduction + Previewで設定済み。

## 買付け結果記録 Preview
Branch: `feature/sedori-go-purchase-record`
PR: #13 (draft)

Design:
- アプリ判定 (`GO` / `見送り` / `判定不能`) とユーザーの実結果 (`bought` / `skipped`) を別フィールドで保存。
- 最終判断はユーザー。アプリは自動購入判断をしない。
- localStorageのみ。外部アカウント/クラウド同期は追加しない。
- 保存項目: JAN、商品名、店頭価格、アプリ判定、ユーザー結果、日時。
- `買った` は正の店頭価格必須。`見送った` は価格なしでも記録可。
- 最大200件の直近履歴に制限し、破損JSONは空配列として安全に扱う。

Implemented:
- `purchase-record-core.js`: 正規化・検証・安全な履歴操作。
- `purchase-record-ui.js`: 詳細シートからユーザー結果をlocalStorageへ保存。
- `purchase-record.css`: スマホ向け2ボタン。
- 詳細シートの既存判定の下に「実際の買付け結果」「買った」「見送った」を追加。

TDD / Preview evidence:
- Record core contract: RED quality-gate run 197 → GREEN run 200。
- UI contract: RED quality-gate run 203 → GREEN run 210。
- Latest Preview deployment `dpl_7XRRQnSF9fjKuhqe1wejoWqx8Moy` READY。
- Preview root HTTP 200で新module、買った/見送ったcontrolsを配信確認。
- `purchase-record-ui.js` HTTP 200確認。
- この機能はcandidate API/Keepa requestを変更しないため、有料Keepa再試験は実施しない。

## Next acceptance
- PR #13の最終quality-gateを確認してmainへ統合する。
- Production反映後、root配信と新module配信を確認する。
- 実機で買付け結果ボタンの操作感に問題が出た場合だけ最小修正する。
- 次の大規模機能は追加せず、まず実店舗で候補探索→店頭判定→結果記録の一連運用を優先する。

## Amazon sellability decision
- Gate 0 / SP-API account-specific sellability will not be implemented for now.
- Final sellability is checked only for narrowed candidates in Seller Central / FBA.
- Public product data must not be used to guess account-specific sellability.

## Release rule
GitHub source is source of truth。合格済み項目を再試験せず、実証された不具合だけ最小修正する。完成済みv9.44 token workは反証がない限り再オープンしない。
