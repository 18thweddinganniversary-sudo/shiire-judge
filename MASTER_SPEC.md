# MASTER SPEC — 仕入れ判断

Status: canonical behavior baseline. Existing implementation remains authoritative where this file does not specify behavior; unknown items must not be guessed.

## Product goal
店頭でJANをスキャンし、Keepa等の実データを使って仕入れ可否を即断する。🟢の信頼性を最優先し、曖昧・データ不足は🟢にしない。

## Canonical verdict thresholds (v9.44 baseline)
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
- 同じJANの6時間以内の成功済みKeepaデータは再利用し、不要なKeepa再取得をしない。

## Data safety invariants
- JAN不一致の外部応答を対象商品のデータとして採用しない。
- 古い非同期応答で新しい検索結果を上書きしない。
- 中古・ジャンク・欠陥品を新品判定へ混入させない。
- Keepa/API失敗、必須データ不足、鮮度不足では🟢にしない。
- 一時的APIエラーを「Amazon商品が存在しない」と誤表示しない。

## Keepa invariants
- APIキーはサーバー側のみ。
- 通常スキャンは低コストbasic pathを使い、`offers=20` を付けない。
- 通常スキャンはKeepaへ `update=1` を送らず、強制更新トークンを使わない。
- 明示的な「Keepa再取得」のときだけ `refresh=1` を経由して `update=1` を許可する。
- `mode=offers` は通常UIから使用しない。将来利用する場合も、欠落データの具体例とトークン費用の根拠を先に示す。
- 同一JANの新鮮な成功データを不必要に再取得しない。
- 同一JANの同時Keepa取得は重複させない。
- 自動テストで実Keepa APIを反復呼び出さない。
- Keepa 429は利用上限として表示し、商品不存在と混同しない。

## Same-shelf
同棚候補は商品種別・容量・入数等を考慮し、別種商品を安全側に除外する。Nintendo Switch本体にJoy-Con等の周辺機器を同棚候補として混入させない。

## Amazon account-specific sellability
Gate 0 / SP-APIによるアカウント固有の出品可否判定は**実装しない方針**。アプリは利益・回転・競合・価格安定・鮮度・商品一致を絞り込み、最終的な出品可否は候補商品だけSeller Central / FBA側で確認する。公開商品データからアカウント固有の出品可否を推測しない。

## Human-device facts already observed
- iPhone Safariでカメラ起動成功の実績あり。
- 手入力JAN成功の実績あり。
- 履歴保存/表示成功の実績あり。
- 通常スキャンは一覧優先で、詳細画面を自動で開かない。
- v9.44本番実測で通常Keepa basic lookupは `tokensConsumed=1` を確認済み。
これらは今後の変更で回帰させない。
