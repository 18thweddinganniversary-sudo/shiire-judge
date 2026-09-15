# MASTER SPEC — 仕入れ判断

Status: initial baseline for context-safe development. Existing implementation remains authoritative where this file does not yet specify behavior; unknown items must not be guessed.

## Product goal
店頭でJANをスキャンし、Keepa等の実データを使って仕入れ可否を即断する。🟢の信頼性を最優先し、曖昧・データ不足は🟢にしない。

## Canonical verdict thresholds (v9.42 baseline)
- データ鮮度: 6時間以内
- 最低利益: 500円
- 最低粗利率: 20%
- 最低ROI: 20%
- 出品者数: 15以下
- 需要レベル: 2以上
- 現在価格 / 90日平均価格: 0.75〜1.15
- 判定ロジックの正本: `decision-engine.js`

基準を緩めて無理に🟢を作らない。

## Store workflow invariant
- 起動後、JANをスキャンできる。
- 通常スキャン結果は一覧へ追加/更新する。
- **通常スキャン完了を理由に詳細画面を自動で開かない。**
- 詳細はユーザーが対象商品をタップしたときに開く。
- 連続スキャンを邪魔しない。

※ 現在の実装がこの仕様に違反していることは既知。基盤完成後の正式修正対象とする。

## Data safety invariants
- JAN不一致の外部応答を対象商品のデータとして採用しない。
- 古い非同期応答で新しい検索結果を上書きしない。
- 中古・ジャンク・欠陥品を新品判定へ混入させない。
- Keepa/API失敗、必須データ不足、鮮度不足では🟢にしない。
- 一時的APIエラーを「Amazon商品が存在しない」と誤表示しない。

## Keepa invariants
- APIキーはサーバー側のみ。
- 通常スキャンで不必要な高コストKeepaリクエストを行わない。
- 同一JANの新鮮な成功データを不必要に再取得しない。
- 自動テストで実Keepa APIを反復呼び出さない。
- 現行 `offers=20` / `update=1` の必要性とトークン経済性は未解決。基盤完成後の最優先修正対象。

## Same-shelf
同棚候補は商品種別・容量・入数等を考慮し、別種商品を安全側に除外する。Nintendo Switch本体にJoy-Con等の周辺機器を同棚候補として混入させない。

## Known deferred feature
Gate 0: Amazonアカウント固有の出品可否判定は未実装。SP-API等の認証連携が必要。未実装のまま実装済みと表示しない。

## Human-device facts already observed
- iPhone Safariでカメラ起動成功の実績あり。
- 手入力JAN成功の実績あり。
- 履歴保存/表示成功の実績あり。
これらは今後の変更で回帰させない。
