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
4. 「みんなの記録に共有する」チェックボックス（**デフォルトON・オプトアウト方式**）
   - ユーザーは任意で外せる。PPリンクをラベル内に設置
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

- **レート制限**: scan-tag 10req/min、append-sheet 20req/min、reverse-geocode 30req/min、get-prices 60req/min（IPベース・インメモリ）
  - ⚠️ 制限: Vercel Serverless は複数インスタンスが起動するためインスタンス間でカウントが共有されない。本番の限界はインスタンス数×制限値になる
- **オリジン検証**: 全APIエンドポイントで mokusan.vercel.app 以外からのアクセスを拒否（`_ratelimit.js`の`isAllowedOrigin`）
  - ⚠️ 制限: curl等で Origin ヘッダーを偽装すれば回避可能。ブラウザ外からの悪用を完全には防げない
- **入力サニタイズ**: append-sheet でHTMLタグ除去・文字数制限・数値バリデーション
- **XSS対策**: みんなの記録の表示時に`escapeHtml`を適用
- **座標バリデーション**: reverse-geocode で lat（±90）・lon（±180）の範囲外は400エラー
- **プライバシー**: 位置情報共有は任意（チェックボックス、デフォルトON）・PPページあり

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

## 変更履歴（主要マイルストーン）

| 日付 | PR | 内容 |
|------|----|------|
| 2026-06 | #34 | PWA化（マニフェスト・SW・アイコン）＋税込/税抜フラグ |
| 2026-06 | #35 | 店舗名削除・Gemini OCRで税込/税抜自動検出 |
| 2026-06 | #36 | 店舗名に関する記述を全ファイルから削除 |
| 2026-06 | #37 | SW v2: HTMLネットワーク優先・旧キャッシュ強制クリア |
| 2026-06 | #38 | CLAUDE.md全面更新 |
| 2026-06 | #39 | セキュリティ5件修正（get-pricesレート制限・reverse-geocodeオリジン検証・座標バリデーション・PPリンク追加） |
| 2026-06 | #40/#41 | shareConsentをデフォルトON（オプトアウト）に確定 |

---

## 今後の実装候補（優先度順）

### 🔴 優先度：高（インフラ・セキュリティ）
1. **レート制限をVercel KV / Upstash Redisに移行** — 現状のインメモリ実装は複数インスタンス間で有効に機能しない。Vercel KVは同一プロジェクトから無料枠で使用可

### 🟡 優先度：中（UX改善）
2. **寸法単位セレクト（mm / cm / m）** — 現場ではcm表記の値札も多い。OCR後の修正作業を減らせる
3. **OCR後の確認カードへの自動スクロール** — `confirmSection.scrollIntoView({ behavior: 'smooth' })` をスキャン成功時に追加するだけ
4. **「続けてスキャンする」ボタン** — doneSectionに追加。大量スキャン時のUX向上
5. **みんなの記録フィルタ（樹種・都道府県）** — 記録が増えたときの利便性向上
6. **OCRプロンプト改善** — 寸法単位（cm・m）の自動mm変換、価格の税込/税抜判定精度向上

### 🟡 優先度：中（プライバシー・法的対応）
7. **プライバシーポリシーの連絡先をメール/フォームに変更** — GitHub Issueは一般ユーザーに敷居が高い
8. **事業者情報の明記** — 個人情報保護委員会ガイドラインで氏名・連絡先の公表が求められる
9. **データ保存期間の具体化** — 「サービス運営上必要な期間」は曖昧。削除依頼への対応手段も明記

### 🟢 優先度：低
10. **PWAアイコンをPNG形式でも追加** — iOS Safariはapple-touch-iconとしてPNGを要求する。SVGのみだとホーム画面アイコンが欠落する場合がある
11. **オフライン手動入力モード** — 電波がない場所で後からOCRできるよう画像をlocalStorageに保存
