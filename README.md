# mokusan - 木材積算計算機 ＋ 値札OCR（フェーズ1 MVP）

## 1. ディレクトリ構成

```txt
.
├─ api/
│  ├─ append-sheet.js
│  ├─ reverse-geocode.js
│  └─ scan-tag.js
├─ app.js
├─ index.html
├─ styles.css
├─ package.json
└─ README.md
```

## 2. 各ファイルの役割

- `index.html`
  - MVP画面（撮影→確認→送信→完了）
- `styles.css`
  - モバイル向けの基本UIスタイル
- `app.js`
  - Geolocation取得、Nominatim呼び出し、Gemini OCR実行、立米単価計算、送信処理
- `api/scan-tag.js`
  - Gemini 1.5 Flashへ画像を送り、構造化データを返すAPI
- `api/reverse-geocode.js`
  - 緯度経度をNominatimで逆ジオコーディングするAPI
- `api/append-sheet.js`
  - Google Sheets APIへ1行追加するAPI
- `package.json`
  - 依存パッケージとローカル実行スクリプト

## 3. フェーズ1（MVP）の実装内容

- Gemini APIへの画像送信と構造化データ取得
  - `/api/scan-tag` が `imageBase64` を受け取り、JSON形式で樹種・寸法・価格・数量を返却
- Geolocation API＋Nominatimによる位置情報自動取得
  - `app.js` で `navigator.geolocation` を呼び、`/api/reverse-geocode` 経由で都道府県・市区町村を取得
  - 位置情報拒否時は都道府県セレクト＋市区町村入力へフォールバック
- 立米単価の計算ロジック
  - `価格 ÷ ((幅×高さ×長さ×本数) / 1,000,000,000)` をリアルタイム算出
- Google Sheets APIへの書き込み
  - `/api/append-sheet` が
    `日付, 都道府県, 市区町村, 店舗名, 樹種, 幅, 高さ, 長さ, 価格, 本数, 立米単価, 備考`
    の順で追記
- フロントエンド画面
  - 画像選択 → OCR解析 → 抽出値の修正 → 送信 → 完了表示

## 4. 環境変数・APIキー設定

Vercelプロジェクトの Environment Variables に以下を設定:

- `GEMINI_API_KEY`
  - Gemini APIキー
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - Googleサービスアカウントの `client_email`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - Googleサービスアカウントの `private_key`
  - 改行は `\n` を含む文字列で登録
- `GOOGLE_SPREADSHEET_ID`
  - 保存先スプレッドシートID
- `GOOGLE_SHEET_NAME`
  - シート名（例: `prices`）
- `NOMINATIM_CONTACT_EMAIL`
  - NominatimのUser-Agentに含める連絡先メールアドレス

### Google Sheets側の事前設定

1. Google CloudでSheets APIを有効化
2. サービスアカウントを作成しJSONキーを発行
3. スプレッドシートをサービスアカウントメールへ共有（編集者）
4. 1行目にヘッダーを作成
   - 日付, 都道府県, 市区町村, 店舗名, 樹種, 幅(mm), 高さ(mm), 長さ(mm), 価格(円), 本数, 立米単価(円/m³), 備考

## 5. Vercelへのデプロイ手順

1. リポジトリをGitHubへpush
2. Vercelで `New Project` から当該リポジトリをImport
3. 上記環境変数をすべて設定
4. Deploy実行
5. 公開URLで動作確認
   - 位置情報許可 → 値札画像読み取り → 確認修正 → Sheetsへ記録

## ローカル確認

```bash
npm install
npm run dev
```

`http://localhost:3000` で確認できます。
