# 仕入れ判断 v9.41

店頭でJANを読み、仕入れ価格を入力し、`🟢 仕入れ候補` / `🔴 見送り`を即断するモバイル向けWebアプリです。

## 判定方針

- 判定の正本は `decision-engine.js` だけです。APIは商品・Keepaの元データを返し、判定しません。
- 🟢は商品一致、価格、実手数料、利益、利益率、ROI、価格安定、競合、回転、鮮度の全条件を通過した場合だけです。
- `monthlySold` がない場合は `salesRankDrops30` を使用します。両方ない場合は「回転データ不足」で🔴です。
- `salesRank` は画面の参考表示には使いますが、カテゴリ差が大きいため単独では🟢の根拠にしません。
- 「利益条件上の仕入上限」は価格・手数料・利益条件だけから算出した数値で、総合判定の🟢とは別です。

## 現行ファイル

- `index.html`, `styles.css`, `nearby.css`: 現行画面
- `app.js`, `app-core.js`: 画面制御、入力、保存、鮮度更新
- `decision-engine.js`: 唯一の仕入れ判定・利益計算
- `related-core.js`: 同じ棚の種類・容量・入数判定
- `jan-ocr-core.js`: JAN正規化・検証・OCR補助
- `keepa-core.js`: Keepaレスポンスの厳密な変換
- `api/`: Vercel Functions
- `tests/`: Nodeの回帰テスト

旧 `v9_17_patch.js` は現行画面から参照されていなかったため削除済みです。

## 保存仕様

`localStorage` のキー `shiireJudge.v9.items` に最大30件をJSON保存します。保存対象は商品APIの情報（JAN、名称、ブランド、画像、参考価格等）、Keepa情報、Keepa取得時刻、スキャン時刻、入力した仕入価格、直近の表示用判定結果です。

再読み込みや通常のSafari再起動後も同じブラウザ・同じ端末では保持されます。ただし、履歴クリア、ブラウザデータ削除、プライベートブラウズの終了、OSによるサイトデータ削除では消える場合があります。

クラウド保存・端末間同期・ログイン機能は未実装です。現在は単一端末のローカル保存だけです。

## 開発とテスト

```bash
node --test tests/*.test.js
```

Vercel本番にはGitHub `main` から自動デプロイします。Keepa APIには `KEEPA_API_KEY` が必要です。
