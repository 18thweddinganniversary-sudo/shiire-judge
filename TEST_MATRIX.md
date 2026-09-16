# 仕入れ判断 / せどりGO 検証表

## Core regression checks
1. コーラ: 手数料不足 → 🔴見送り（黄色なし）
2. コーラ: 同じ棚チェック → 帽子/靴/雑貨を出さない
3. 候補なし → 「この棚の候補はありません」
4. 商品単位/ASIN不一致 → 🔴見送り
5. 入数不一致 → 🔴見送り
6. 靴バリエーション → JAN子ASIN一致確認、怪しければ🔴
7. 価格急騰 → 🔴
8. 実手数料あり + 利益500円以上 + 利益率20%以上 + ROI20%以上 + 価格安定 + 競争条件 + 鮮度 + 回転条件 → 🟢
9. 商品カード・詳細画面に 🟡/🟠/⚪ が残らない
10. 別の商品を通常スキャンすると「同じ棚」の基準商品が更新される
11. 一覧に『要確認』が残らず『見送り』になる
12. 『条件未達』が赤表示になり、緑表示と混在しない
13. `monthlySold=null` → `salesRankDrops30`、次に `salesRank` を表示し、`null/月` は出さない
14. 回転の実測0 → 「回転不足」、回転値なし → 「回転データ不足」
15. 新規Keepa取得 → 鮮度OK、6時間超またはオファー更新失敗 → 🔴
16. 185ml×30本 / 2箱計60缶 / 30本×3箱 / 3ケースを別包装として扱う
17. 利益条件上限内でも回転・競合・鮮度のどれかが未達なら🔴
18. 500 → 3,000 → 10,000の入力と途中編集でカーソル・値を保持
19. 詳細を閉じた後とバックグラウンド復帰後にカメラを再開できる
20. 再読込後も商品履歴、仕入価格、Keepa取得時刻を復元する
21. 通常スキャンは一覧へ追加し、詳細を自動で開かない
22. 同一JANの6時間以内の成功Keepaデータは再利用し、Keepa通信を増やさない
23. 同一JANの同時Keepa取得はin-flight dedupeされる
24. 詳細を開くだけではKeepa通信を発生させない
25. HTTP 429は「Keepa利用上限」と表示し、商品不存在と混同しない

## v9.42 第二段階・実Keepa検証（2026-09-14）
- JAN: `4549980616994`
- ASIN: `B0861GFPBR`
- 実データ: Amazon本体なし、出品者3、Rank下降10回/30日、現在価格23,800円、90日平均23,992円、FBA手数料425円（税込）、紹介料10.4%、商品・オファー鮮度OK
- 境界確認: 仕入16,140円で `GO（仕入れ）`（利益4,760円、利益率20.0%、ROI 29.49%）。16,141円では `利益条件上限超過` で見送り

## v9.43 / v9.44 accepted
- 正常取得したKeepaデータは6時間以内なら保存値を再利用。
- 同一JAN in-flight requestを重複させない。
- 詳細表示だけではKeepaを再取得しない。
- 通常 `/api/keepa` は `update=1` / `offers=20` を送らない。
- 明示的 `Keepa再取得` だけ `refresh=1`。
- Production real JAN `4549980616994`: normal request `tokensConsumed=1`。
- 実機5商品テスト: 5商品にKeepa lookup 5回のみ。
- 実機: 正当な🟢成立、一覧/詳細一致、仕入上限1円境界、同JAN再検索はKeepa 0追加通信。

## せどりGO candidate discovery / enrichment acceptance
- Product Finderは1明示操作につき1 requestのみ。page 0 / perPage max 50 / no auto paging / no `stats=1`。
- Previewの`KEEPA_API_KEY`はProduction + Previewに設定済み。
- Finder prefilters: Amazon本体なし、月販30以上、新品1,500円以上、90日平均あり、出品者1〜15、90日価格差 -15%〜+25%、FBA feeあり、商品/offer更新6時間以内、sales rank 1〜50,000。
- Controlled real probes: 262,800 → 105,700 → 76,700 → 76,500 results。各Finder requestは11 token。
- これ以上Finder条件を試行錯誤して母数だけ削るのはtoken効率が悪いため停止。二段階方式へ移行。
- `api/candidate-details.js` はFinder上位5 ASINだけを1 batch Product Requestで詳細化する。
- detail requestは `history=0`, `stats=90`, no `update`, no `offers`。
- 5件超のASIN batchはKeepa通信前に400で拒否。
- Controlled real detail probe: 5 candidates / `tokensConsumed=5`。
- 実結果: 5件中4件に13桁JAN、3件は利益条件上限まで算出。JANなし / 上限算出不可はshortlistから除外。
- shortlistは「仕入れ候補」「店頭で確認」と表示し、自動的な買い指示にしない。
- candidate shortlist cacheは6時間以内だけ再利用する。

## せどりGO integrated UI acceptance
- 既存の仕入れ判断画面と別アプリにせず、同一画面に `せどりGO 候補探索` を追加。
- `候補を探す` はFinder→上位5詳細化→店頭利用可能shortlist化を1操作で行う。
- 候補カードはJAN / Amazon新品 / 90日平均 / 回転 / 出品者 / 仕入れ上限目安を表示。
- `店頭で確認` は既存JAN入力/検索へ渡し、従来の最終判定ロジックを再利用。
- 画面に「候補は仕入れ指示ではない」「現物と店頭価格を確認して最終判断」を明記。
- TDD RED/GREEN: UI wiring run 161 failure → run 172 success。
- Latest Preview `dpl_4NEJo6huaX22C7F8KA4WnKoHk25L` READY。
- Preview `/` と `/sedori-go.js` はHTTP 200で配信確認済み。静的確認ではKeepa追加消費なし。

## TDD evidence for Phase 2
- Finder price/competition/stability: RED run 128 → GREEN run 131。
- freshness/fee: RED run 134 → GREEN run 137。
- rank band: RED run 140 → GREEN run 143。
- top-5 detail enrichment: RED run 146 → GREEN run 149 / syntax run 152。
- shortlist core: RED run 155 → GREEN run 158。
- integrated UI: RED run 161 → GREEN run 172。

## Manual acceptance — next
- iPhone Previewで「せどりGO 候補探索」セクションの表示崩れがない。
- 候補カード→`店頭で確認`→既存JAN判定への動線が自然。
- Keepaを消費する候補探索は既存real API evidenceを再利用し、無意味な連打テストをしない。
- UIの実機確認後、必要な最小修正のみ行ってPR #12をmainへ統合する。
- 最終的なAmazonアカウント固有の出品可否は、絞り込んだ候補だけSeller Central / FBAで確認する。
