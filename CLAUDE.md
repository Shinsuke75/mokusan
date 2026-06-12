# mokusan — 木材積算計算機 ＋ 値札OCR

## プロジェクト概要

木材値札をスマホで撮影してOCRし、立米単価を計算、Google Sheetsに記録するWebアプリ。
Vercelにデプロイ済み: https://mokusan.vercel.app

## ディレクトリ構成

```
.
├─ api/
│  ├─ scan-tag.js        # Gemini APIで画像OCR → JSON返却
│  ├─ reverse-geocode.js # Nominatimで緯度経度 → 都道府県・市区町村
│  ├─ append-sheet.js    # Google Sheetsに1行追記
│  └─ get-prices.js      # Google Sheetsから価格データ取得（recent + averages）
├─ app.js                # フロントエンドロジック（ES modules）
├─ index.html            # メイン画面（スキャン・データ/計算 タブ）
├─ styles.css            # モバイル向けスタイル
└─ package.json          # dependencies: googleapis
```

## 技術スタック

- **フロントエンド**: バニラJS（ES modules）、モバイルファースト
- **バックエンド**: Vercel Serverless Functions（Node.js）
- **OCR**: Gemini 2.5 Flash API（`v1beta`エンドポイント）
- **位置情報**: Geolocation API + Nominatim逆ジオコーディング
- **データ保存**: Google Sheets（googleapis v4）
- **デプロイ**: Vercel（GitHubリポジトリ連携）

## 画面構成

### スキャンタブ
1. 位置情報（自動取得またはマニュアル入力）
2. 値札画像読み取り（カメラ/ギャラリー選択 → Gemini OCR）
3. 抽出結果確認・修正（樹種・価格・寸法・本数）
4. Google Sheetsへ記録

### データ・計算タブ
- 樹種・都道府県で平均立米単価を検索（Sheetsから取得）
- 積算計算（立米単価 × 体積）
- みんなの記録（最新20件）

## 環境変数（Vercel）

| 変数名 | 内容 |
|--------|------|
| `GEMINI_API_KEY` | Gemini APIキー |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCPサービスアカウントメール |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | 秘密鍵（`\n`区切り） |
| `GOOGLE_SPREADSHEET_ID` | スプレッドシートID |
| `GOOGLE_SHEET_NAME` | シート名（例: `prices`） |
| `NOMINATIM_CONTACT_EMAIL` | Nominatim User-Agent用メール |

## Sheetsのカラム順

A:日付, B:都道府県, C:市区町村, D:店舗名, E:樹種, F:幅(mm), G:高さ(mm), H:長さ(mm), I:価格(円), J:本数, K:立米単価(円/m³), L:備考

## ローカル開発

```bash
npm install
npm run dev   # vercel dev → http://localhost:3000
```

## ブランチ運用

- `main`: 本番（Vercelが自動デプロイ）
- `claude/mokusan-app-dev-wp3bir`: 開発用ブランチ
