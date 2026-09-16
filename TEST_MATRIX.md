# 仕入れ判断 検証表

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

## v9.43 Keepa cache / dedupe acceptance
- 正常取得したKeepaデータは6時間以内なら保存値を再利用。
- 同一JAN in-flight requestを重複させない。
- 詳細表示だけではKeepaを再取得しない。
- 通常UIから `offers=20` を使用しない。
- release candidate automated suite: 79/79 passed.

## v9.44 token-efficiency acceptance（2026-09-16）
- 通常 `/api/keepa` は `update=1` を送らない。
- 通常 `/api/keepa` は `offers=20` を送らない。
- 明示的 `Keepa再取得` だけ `refresh=1` を送り、serverが `update=1` を付与する。
- 明示的な通常再取得でも marketplace offer pages は要求しない。
- regression TDD: 変更前に新テストのfailureを確認し、実装修正後のquality-gate成功を確認。
- Production commit: `a966481c90fd0e5c22ed97deb6305272c2e74b6a`
- Production deployment: `dpl_3ARffFXgsUSb8gL9PSBgdgTX7nNA` READY.
- 実Keepa確認: JAN `4549980616994` → HTTP 200 / `mode=basic` / `tokensConsumed=1` / `tokensLeft=59`.
- 実機5商品テスト: 対象期間のKeepa lookupは5回、`/api/keepa` も5回。余計なKeepa重複通信なし。

## Manual store-use acceptance — next
- 連続スキャンが店舗動線で止まらない。
- 一覧→詳細→戻るが自然に動く。
- 仕入価格入力と判定結果が一覧/詳細で矛盾しない。
- 同棚候補が別商品種/容量/入数を混入させない。
- 再読込後も履歴・価格・Keepa取得時刻が保持される。
- `Keepa再取得` はユーザーが明示したときだけ追加消費する。
- 最終的なAmazonアカウント固有の出品可否は、候補商品だけSeller Central / FBAで確認する。
