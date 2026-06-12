# mokusan — 木材積算計算機 ＋ 値札OCR

## プロジェクト概要

木材値札をスマホで撮影してOCRし、立米単価を計算、Google Sheetsに記録するWebアプリ。
Vercelにデプロイ済み: https://mokusan.vercel.app

## ディレクトリ構成

```
.
├─ api/
│  ├─ _ratelimit.js      # IPベースのレート制限ヘルパー＋オリジン検証
│  ├─ scan-tag.js        # Gemini APIで画像OCR → JSON返却（税込/税抜も検出）
│  ├─ reverse-geocode.js # Nominatimで緯度経度 → 都道府県・市区町村
│  ├─ append-sheet.js    # Google Sheetsに1行追記（入力サニタイズ済み）
│  └─ get-prices.js      # Google Sheetsから価格データ取得（recent + averages）
├─ app.js                # フロントエンドロジック（ES modules）
├─ index.html            # メイン画面（スキャン・計算・リスト タブ）
├─ privacy.html          # プライバシーポリシーページ
├─ styles.css            # モバイル向けスタイル
├─ manifest.json         # PWAマニフェスト
├─ sw.js                 # Service Worker（HTMLネットワーク優先・JS/CSSキャッシュ優先）
├─ icon.svg              # アプリアイコン（木 on 青背景）
└─ package.json          # dependencies: googleapis
```

## 技術スタック

- **フロントエンド**: バニラJS（ES modules）、モバイルファースト、PWA対応
- **バックエンド**: Vercel Serverless Functions（Node.js）
- **OCR**: Gemini 2.5 Flash API（`v1beta`エンドポイント）
- **位置情報**: Geolocation API + Nominatim逆ジオコーディング
- **データ保存**: Google Sheets（googleapis v4）
- **デプロイ**: Vercel（GitHubリポジトリ連携）

## 画面構成（3タブ）

### 📷 スキャンタブ
1. 値札画像読み取り（カメラ/ギャラリー選択 → Geminiで解析）
2. 抽出結果確認・修正（樹種・価格・税込チェック・幅・厚み・長さ・備考）
   - 体積・立米単価をリアルタイム算出（税込チェック時は÷1.1して税抜換算）
   - Geminiが値札の税込/税抜表記を自動検出しチェック状態を設定
3. 場所（任意）← 確認セクション下部に配置
   - 位置情報自動取得 or 手動入力（都道府県・市区町村のみ。店舗名は収集しない）
4. 「みんなの記録に共有する」チェックボックス（**デフォルトOFF**）
5. 「＋ リストに追加」ボタン1つで：
   - 材料リスト（localStorage）に追加（qty=1で保存）
   - チェックON時のみGoogle Sheetsへ同時記録

### 📊 計算タブ
- 樹種チップ（ユーザー追加：青 / デフォルト3種：グレー）
  - タップで樹種・単価・寸法を自動入力
- 立米単価 × 体積 → 金額をリアルタイム算出
- 「＋ リストに追加」ボタン
- みんなの記録（Google Sheetsの最新20件）

### 📋 リストタブ
- 追加した材料をカード形式で表示（樹種・寸法・単価・本数±ボタン・金額・×削除）
- 本数±ボタンで本数変更 → 体積・金額・合計をリアルタイム更新
- 合計体積・合計金額（寸法入力済み材料のみ集計）
- 「共有」ボタン → 簡易見積もりテキストをネイティブ共有（メール・LINE等）
- 「初期値に戻す」ボタン → デフォルト参照単価3種に戻す
- 「リストをすべて削除」ボタン

## セキュリティ対策（実装済み）

- **レート制限**: scan-tag 10req/min、append-sheet 20req/min、geocode 30req/min、get-prices 60req/min（IPベース・インメモリ）
- **オリジン検証**: mokusan.vercel.app 以外からのAPIアクセスを拒否（全エンドポイント共通）
- **入力サニタイズ**: append-sheet でHTMLタグ除去・文字数制限・数値バリデーション
- **XSS対策**: みんなの記録の表示時にescapeHtmlを適用
- **座標バリデーション**: reverse-geocode で lat/lon を parseFloat + 範囲チェック（lat:±90、lon:±180）
- **プライバシー**: 位置情報共有は任意（チェックボックス・デフォルトOFF）・プライバシーポリシーページあり・同意ラベルにポリシーリンク設置

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

DEFAULT_CHIPS（計算タブのグレーチップ）: スギ・ヒノキ・2×4材の3種のみ

## localStorage

| キー | 内容 |
|------|------|
| `mokusan_list` | 材料リスト（JSON配列）。未設定ならDEFAULT_LISTで初期化 |

### リストエントリの型
```js
{
  id: number | string,   // Date.now() or "default_N"
  species: string,
  unitPrice: number,     // 税抜単価（円/m³）
  isDefault: boolean,    // デフォルト参照エントリのみ true
  widthMm: number,
  heightMm: number,
  lengthMm: number,
  qty: number,           // 本数（±ボタンで変更可）
  volumeM3: number,      // qty × 1本の体積。0 = 参照エントリ
  totalPrice: number     // unitPrice × volumeM3（税抜）
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

A:日付, B:都道府県, C:市区町村, D:（空欄）, E:樹種, F:幅(mm), G:高さ(mm), H:長さ(mm), I:価格(円・タグ表示値）, J:本数, K:立米単価(円/m³・税抜), L:備考

## ローカル開発

```bash
npm install
npm run dev   # vercel dev → http://localhost:3000
```

## ブランチ運用

- `main`: 本番（Vercelが自動デプロイ）
- `claude/mokusan-app-dev-wp3bir`: 開発用ブランチ

---

## 変更履歴

### 2026-06-12 — セキュリティ・プライバシー修正（優先度高5件）

**背景**: コードレビューで発見された下記の問題を修正。

| ファイル | 変更内容 |
|----------|----------|
| `api/get-prices.js` | `checkRateLimit` / `getClientIp` を追加インポートし、60req/min のレート制限を追加（未設定だった） |
| `api/reverse-geocode.js` | `isAllowedOrigin` を追加インポートし、originチェックを追加（他エンドポイントと同等の保護に統一） |
| `api/reverse-geocode.js` | `lat`/`lon` クエリパラメータを `parseFloat` で数値変換 + 範囲外（lat>90等）は400エラーで拒否 |
| `index.html` | 共有チェックボックスの `checked` 属性を削除 → デフォルトOFF（プライバシーのオプトイン原則） |
| `index.html` | 共有同意ラベルにプライバシーポリシーへのインラインリンクを追加 |

---

## 今後の実装候補（優先度順）

### 優先度：高（セキュリティ・インフラ）
1. **レート制限を分散ストアに移行** — 現状のインメモリ実装は Vercel の複数インスタンス間で共有されないため実効性が低い。[Vercel KV](https://vercel.com/docs/storage/vercel-kv)（Redis）や Upstash Redis への移行を推奨。
2. **PWAアイコンをPNGでも追加** — iOS Safari は `apple-touch-icon` に PNG（192×192・512×512）を要求する。現状は SVG のみのためホーム画面アイコンが欠落する場合あり。

### 優先度：中（UX改善）
3. **寸法単位セレクト（mm / cm / m）の追加** — 現場では cm 表記の値札も多く、OCR後に手動換算が必要になる。単位切り替えで自動 mm 変換する。
4. **OCR後の確認カードへの自動スクロール** — スキャン成功時に `confirmSection.scrollIntoView({ behavior: 'smooth' })` を呼ぶ。スマホで確認カードが表示されたことに気づきにくい。
5. **「続けてスキャンする」ボタンを doneSection に追加** — 大量スキャン時に毎回リロードが必要になるのを解消。
6. **「みんなの記録」フィルタ** — 樹種・都道府県での絞り込み。記録が増えると一覧が長くなるため。
7. **OCRプロンプト改善** — 寸法単位（cm・m）の自動 mm 変換、価格の税込/税抜判定精度向上。

### 優先度：中（プライバシー・法的対応）
8. **プライバシーポリシーの連絡先改善** — 現状は GitHub Issue 経由のみ。一般ユーザーにはハードルが高いため、メールアドレスまたはフォームへのリンクに変更。
9. **事業者情報の明記** — 個人情報保護法対応として、ポリシーページに運営者氏名・連絡先を掲載。
10. **データ保存期間の明確化** — 「サービス運営上必要な期間」は曖昧。具体的な期間または削除トリガー（例: 最終更新から◯年）を明記。

### 優先度：低
11. **オフライン手動入力モード** — 電波がない場所で後からOCRできるよう画像をlocalStorageに保存。
