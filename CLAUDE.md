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
├─ index.html            # メイン画面（スキャン・計算・リスト タブ）
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

## 画面構成（3タブ）

### 📷 スキャンタブ
1. 値札画像読み取り（カメラ/ギャラリー選択 → Geminiで解析）
2. 抽出結果確認・修正（樹種・価格・幅・厚み・長さ・本数・備考）
   - 体積・立米単価をリアルタイム算出
3. 場所・店舗（任意）← 確認セクション下部に配置
   - 位置情報自動取得 or 手動入力
4. 「＋ リストに追加（価格表にも記録）」ボタン1つで：
   - 材料リスト（localStorage）に追加
   - Google Sheetsへ同時記録

### 📊 計算タブ
- 樹種チップ（スキャン・追加済み材料の樹種から生成）
  - タップで樹種・単価・寸法を自動入力
- 立米単価 × 体積 → 金額をリアルタイム算出
- 「＋ リストに追加」ボタン
- みんなの記録（Google Sheetsの最新20件）

### 📋 リストタブ
- 追加した材料の一覧（樹種・寸法・本数・単価・体積・金額）
- 合計体積・合計金額（寸法入力済み材料のみ集計）
- 「共有」ボタン → 簡易見積もりテキストをネイティブ共有（メール・LINE等）
- 「初期値に戻す」ボタン → デフォルト参照単価7種に戻す
- 「リストをすべて削除」ボタン
- 各行の「×」で個別削除

## デフォルト参照単価（DEFAULT_LIST）

初回起動時（localStorage未設定）に自動挿入される参照エントリ。
寸法なし（volumeM3=0）のためチップには表示されない。
樹種名を入力すると単価が自動補完される。

| 樹種 | 立米単価（円/m³） |
|------|-----------------|
| スギ（製材品） | 68,200 |
| ヒノキ（製材品） | 85,000 |
| 2×4材（SPF） | 71,500 |
| ホワイトウッド | 70,000 |
| ナラ | 865,000 |
| タモ | 790,000 |
| ウォルナット | 1,100,000 |

## localStorage

| キー | 内容 |
|------|------|
| `mokusan_list` | 材料リスト（JSON配列）。未設定ならDEFAULT_LISTで初期化 |

### リストエントリの型
```js
{
  id: number | string,   // Date.now() or "default_N"
  species: string,
  unitPrice: number,
  isDefault: boolean,    // デフォルト参照エントリのみ true
  widthMm: number,
  heightMm: number,
  lengthMm: number,
  qty: number,
  volumeM3: number,      // 0 = 参照エントリ
  totalPrice: number
}
```

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
