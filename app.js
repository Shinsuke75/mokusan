const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県",
  "埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県",
  "佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

const MM3_TO_M3_DIVISOR = 1_000_000_000;
const GEOLOCATION_TIMEOUT_MS = 8000;
const GEOLOCATION_MAX_AGE_MS = 60000;

const DEFAULT_CHIPS = ["スギ（製材品）", "ヒノキ（製材品）", "2×4材（SPF）"];

const DEFAULT_LIST = [
  { species: "スギ（製材品）",  unitPrice: 68200 },
  { species: "ヒノキ（製材品）", unitPrice: 85000 },
  { species: "2×4材（SPF）",  unitPrice: 71500 },
  { species: "ホワイトウッド",  unitPrice: 70000 },
  { species: "ナラ",          unitPrice: 865000 },
  { species: "タモ",          unitPrice: 790000 },
  { species: "ウォルナット",   unitPrice: 1100000 },
];

function makeDefaultEntries() {
  return DEFAULT_LIST
    .filter((d) => DEFAULT_CHIPS.includes(d.species))
    .map((d, i) => ({
      id: `default_${i}`,
      species: d.species,
      unitPrice: d.unitPrice,
      isDefault: true,
      widthMm: 0, heightMm: 0, lengthMm: 0,
      qty: 0, volumeM3: 0, totalPrice: 0
    }));
}

const state = {
  imageBase64: "",
  mimeType: "image/jpeg",
  location: { prefecture: "", city: "", source: "manual" },
  selectedFile: null,
  priceData: { recent: [] },
  priceDataLoaded: false,
  list: (() => {
    const saved = localStorage.getItem("mokusan_list");
    if (saved !== null) return JSON.parse(saved);
    return makeDefaultEntries();
  })()
};

const getElement = (id) => document.getElementById(id);

const els = {
  geoStatus: getElement("geoStatus"),
  locationAuto: getElement("locationAuto"),
  locationManual: getElement("locationManual"),
  prefectureText: getElement("prefectureText"),
  cityText: getElement("cityText"),
  manualPrefecture: getElement("manualPrefecture"),
  manualCity: getElement("manualCity"),
  cameraButton: getElement("cameraButton"),
  galleryButton: getElement("galleryButton"),
  cameraInput: getElement("cameraInput"),
  galleryInput: getElement("galleryInput"),
  photoPreview: getElement("photoPreview"),
  photoName: getElement("photoName"),
  storeName: getElement("storeName"),
  scanButton: getElement("scanButton"),
  scanStatus: getElement("scanStatus"),
  confirmSection: getElement("confirmSection"),
  species: getElement("species"),
  priceYen: getElement("priceYen"),
  widthMm: getElement("widthMm"),
  heightMm: getElement("heightMm"),
  lengthMm: getElement("lengthMm"),
  quantity: getElement("quantity"),
  note: getElement("note"),
  volumeText: getElement("volumeText"),
  unitPriceText: getElement("unitPriceText"),
  addScanToListButton: getElement("addScanToListButton"),
  submitStatus: getElement("submitStatus"),
  doneSection: getElement("doneSection"),
  tabScan: getElement("tabScan"),
  tabCalc: getElement("tabCalc"),
  tabList: getElement("tabList"),
  scanContent: getElement("scanContent"),
  calcContent: getElement("calcContent"),
  listContent: getElement("listContent"),
  calcSpecies: getElement("calcSpecies"),
  myPriceChips: getElement("myPriceChips"),
  calcUnitPrice: getElement("calcUnitPrice"),
  unitPriceSource: getElement("unitPriceSource"),
  calcWidth: getElement("calcWidth"),
  calcHeight: getElement("calcHeight"),
  calcLength: getElement("calcLength"),
  calcQty: getElement("calcQty"),
  calcVolume: getElement("calcVolume"),
  calcPrice: getElement("calcPrice"),
  addToListButton: getElement("addToListButton"),
  recentStatus: getElement("recentStatus"),
  recentTable: getElement("recentTable"),
  listEmpty: getElement("listEmpty"),
  listTable: getElement("listTable"),
  listTotal: getElement("listTotal"),
  totalVolume: getElement("totalVolume"),
  totalPrice: getElement("totalPrice"),
  shareButton: getElement("shareButton"),
  resetListButton: getElement("resetListButton"),
  clearListButton: getElement("clearListButton")
};

function fillPrefectures() {
  els.manualPrefecture.innerHTML = '<option value="">選択してください</option>' +
    PREFECTURES.map((p) => `<option value="${p}">${p}</option>`).join("");
}

async function detectLocation() {
  if (!navigator.geolocation) {
    enableManualLocation("このブラウザでは位置情報が利用できません。");
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "住所取得に失敗しました");
      state.location = { prefecture: data.prefecture || "", city: data.city || "", source: "geo" };
      els.prefectureText.textContent = state.location.prefecture || "不明";
      els.cityText.textContent = state.location.city || "不明";
      els.geoStatus.textContent = "位置情報を自動取得しました。";
      els.locationAuto.classList.remove("hidden");
      els.locationManual.classList.add("hidden");
    } catch (e) {
      enableManualLocation(`位置情報の住所変換に失敗: ${e.message}`);
    }
  }, (error) => {
    if (error?.code === 1) { enableManualLocation("位置情報が拒否されたため手動入力に切り替えました。"); return; }
    if (error?.code === 2) { enableManualLocation("現在地を特定できなかったため手動入力に切り替えました。"); return; }
    if (error?.code === 3) { enableManualLocation("位置情報の取得がタイムアウトしたため手動入力に切り替えました。"); return; }
    enableManualLocation("位置情報の取得に失敗したため手動入力に切り替えました。");
  }, { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: GEOLOCATION_MAX_AGE_MS });
}

function enableManualLocation(message) {
  els.geoStatus.textContent = message;
  els.locationManual.classList.remove("hidden");
  els.locationAuto.classList.add("hidden");
}

function compressImage(file, maxPx = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像のデコードに失敗しました"));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcVolumeAndUnitPrice() {
  const width = toNumber(els.widthMm.value);
  const height = toNumber(els.heightMm.value);
  const length = toNumber(els.lengthMm.value);
  const qty = Math.max(1, toNumber(els.quantity.value, 1));
  const price = toNumber(els.priceYen.value);
  const volumeM3 = (width * height * length * qty) / MM3_TO_M3_DIVISOR;
  const unitPrice = volumeM3 > 0 ? price / volumeM3 : 0;
  els.volumeText.textContent = volumeM3 > 0 ? volumeM3.toFixed(6) : "-";
  els.unitPriceText.textContent = volumeM3 > 0 ? Math.round(unitPrice).toLocaleString("ja-JP") : "-";
  return { volumeM3, unitPrice };
}

function onFileSelected(file) {
  state.selectedFile = file;
  els.photoName.textContent = file.name;
  els.photoName.classList.remove("hidden");
  const url = URL.createObjectURL(file);
  els.photoPreview.src = url;
  els.photoPreview.classList.remove("hidden");
}

async function runScan() {
  const file = state.selectedFile;
  if (!file) { els.scanStatus.textContent = "値札画像を選択してください。"; return; }
  els.scanButton.disabled = true;
  els.scanStatus.textContent = "Geminiで解析中...";
  try {
    const dataUrl = await compressImage(file);
    const [meta, base64] = dataUrl.split(",");
    state.imageBase64 = base64;
    state.mimeType = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
    const res = await fetch("/api/scan-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: state.imageBase64, mimeType: state.mimeType })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "OCRに失敗しました");
    els.species.value = data.species || "";
    els.widthMm.value = data.widthMm || "";
    els.heightMm.value = data.heightMm || "";
    els.lengthMm.value = data.lengthMm || "";
    els.priceYen.value = data.priceYen || "";
    els.quantity.value = data.quantity || 1;
    els.note.value = data.note || "";
    calcVolumeAndUnitPrice();
    els.confirmSection.classList.remove("hidden");
    els.scanStatus.textContent = "抽出結果を確認して追加してください。";
  } catch (e) {
    els.scanStatus.textContent = `エラー: ${e.message}`;
  } finally {
    els.scanButton.disabled = false;
  }
}

function currentLocation() {
  if (!els.locationManual.classList.contains("hidden")) {
    return { prefecture: els.manualPrefecture.value, city: els.manualCity.value, source: "manual" };
  }
  return state.location;
}

async function addScanToList() {
  const loc = currentLocation();
  const width = toNumber(els.widthMm.value);
  const height = toNumber(els.heightMm.value);
  const length = toNumber(els.lengthMm.value);
  const qty = Math.max(1, toNumber(els.quantity.value, 1));
  const priceYen = toNumber(els.priceYen.value);

  if (!width || !height || !length) { alert("寸法を確認してください。"); return; }

  const volumeM3 = (width * height * length * qty) / MM3_TO_M3_DIVISOR;
  const unitPrice = volumeM3 > 0 ? priceYen / volumeM3 : 0;

  state.list.push({
    id: Date.now(),
    species: els.species.value || "（未設定）",
    widthMm: width, heightMm: height, lengthMm: length,
    qty, unitPrice: Math.round(unitPrice), volumeM3, totalPrice: priceYen
  });
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  renderListChips();

  // 価格表にも同時登録
  els.addScanToListButton.disabled = true;
  els.submitStatus.textContent = "登録中...";
  try {
    const payload = {
      date: new Date().toISOString(),
      prefecture: loc.prefecture || "",
      city: loc.city || "",
      storeName: els.storeName.value || "",
      species: els.species.value || "",
      widthMm: width, heightMm: height, lengthMm: length,
      priceYen, quantity: qty,
      unitPriceYenPerM3: Math.round(unitPrice),
      note: els.note.value || ""
    };
    await fetch("/api/append-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn("価格表への登録に失敗:", e.message);
  } finally {
    els.addScanToListButton.disabled = false;
    els.submitStatus.textContent = "";
  }

  switchTab("list");
}

function switchTab(tab) {
  els.tabScan.classList.toggle("active", tab === "scan");
  els.tabCalc.classList.toggle("active", tab === "calc");
  els.tabList.classList.toggle("active", tab === "list");
  els.scanContent.classList.toggle("hidden", tab !== "scan");
  els.calcContent.classList.toggle("hidden", tab !== "calc");
  els.listContent.classList.toggle("hidden", tab !== "list");
  if (tab === "calc") loadPriceData();
  if (tab === "list") renderList();
}

async function loadPriceData() {
  if (state.priceDataLoaded) return;
  try {
    const res = await fetch("/api/get-prices");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "データ取得に失敗しました");
    state.priceData = data;
    state.priceDataLoaded = true;
    renderRecentTable();
  } catch (e) {
    els.recentStatus.textContent = `エラー: ${e.message}`;
  }
}

// 樹種チップを描画（ユーザー追加：青 / デフォルト3種：グレー）
function renderListChips() {
  const seen = new Set();
  const userSpecies = state.list
    .filter((item) => item.volumeM3 > 0)
    .map((item) => item.species)
    .filter((s) => s && s !== "（未設定）" && !seen.has(s) && seen.add(s));
  const defaultChips = DEFAULT_CHIPS.filter((s) => !seen.has(s));

  const userHTML = userSpecies.map((s) =>
    `<button type="button" class="chip" data-species="${s}">${s}</button>`
  ).join("");
  const defaultHTML = defaultChips.map((s) =>
    `<button type="button" class="chip chip--default" data-species="${s}">${s}</button>`
  ).join("");

  els.myPriceChips.innerHTML = userHTML + defaultHTML;
  els.myPriceChips.querySelectorAll(".chip, .chip--default").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.calcSpecies.value = btn.dataset.species;
      onSpeciesChange();
    });
  });
}

// 樹種入力時にリストの最新単価・寸法を自動補完
function onSpeciesChange() {
  const species = els.calcSpecies.value.trim();
  if (!species) {
    els.unitPriceSource.textContent = "";
    return;
  }
  const match = [...state.list].reverse().find((item) => item.species === species);
  if (match) {
    els.calcUnitPrice.value = match.unitPrice;
    if (match.volumeM3 > 0) {
      els.calcWidth.value = match.widthMm;
      els.calcHeight.value = match.heightMm;
      els.calcLength.value = match.lengthMm;
      els.calcQty.value = match.qty;
      els.unitPriceSource.textContent = `リストから参照 (${match.unitPrice.toLocaleString("ja-JP")} 円/m³・寸法も入力済み)`;
    } else {
      els.unitPriceSource.textContent = `リストから参照 (${match.unitPrice.toLocaleString("ja-JP")} 円/m³)`;
    }
    els.unitPriceSource.className = "hint-text avg-price";
    updateCalcResult();
  } else {
    els.unitPriceSource.textContent = "";
    els.unitPriceSource.className = "hint-text";
  }
}

function updateCalcResult() {
  const unitPrice = toNumber(els.calcUnitPrice.value);
  const width = toNumber(els.calcWidth.value);
  const height = toNumber(els.calcHeight.value);
  const length = toNumber(els.calcLength.value);
  const qty = Math.max(1, toNumber(els.calcQty.value, 1));
  const volumeM3 = (width * height * length * qty) / MM3_TO_M3_DIVISOR;
  const totalPrice = volumeM3 > 0 && unitPrice > 0 ? Math.round(volumeM3 * unitPrice) : 0;
  els.calcVolume.textContent = volumeM3 > 0 ? volumeM3.toFixed(6) : "-";
  els.calcPrice.textContent = totalPrice > 0 ? totalPrice.toLocaleString("ja-JP") : "-";
}

function renderRecentTable() {
  const { recent } = state.priceData;
  els.recentStatus.classList.add("hidden");
  if (!recent || recent.length === 0) {
    els.recentTable.innerHTML = '<p class="status">まだ記録がありません。</p>';
    return;
  }
  const rows = recent.map((r) => `
    <tr>
      <td>${r.date}</td>
      <td>${r.prefecture}${r.city ? " " + r.city : ""}</td>
      <td>${r.species || "-"}</td>
      <td>${r.unitPrice.toLocaleString("ja-JP")}</td>
    </tr>
  `).join("");
  els.recentTable.innerHTML = `
    <table class="recent-table">
      <thead><tr><th>日付</th><th>場所</th><th>樹種</th><th>立米単価(円)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ===== リスト機能 =====

function addToList() {
  const species = els.calcSpecies.value.trim();
  const unitPrice = toNumber(els.calcUnitPrice.value);
  const width = toNumber(els.calcWidth.value);
  const height = toNumber(els.calcHeight.value);
  const length = toNumber(els.calcLength.value);
  const qty = Math.max(1, toNumber(els.calcQty.value, 1));

  if (!width || !height || !length) { alert("幅・厚み・長さを入力してください。"); return; }
  if (!unitPrice) { alert("立米単価を入力してください。"); return; }

  const volumeM3 = (width * height * length * qty) / MM3_TO_M3_DIVISOR;
  const totalPrice = Math.round(volumeM3 * unitPrice);

  state.list.push({
    id: Date.now(),
    species: species || "（未設定）",
    widthMm: width, heightMm: height, lengthMm: length,
    qty, unitPrice, volumeM3, totalPrice
  });
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  renderListChips();
  switchTab("list");
}

function removeFromList(id) {
  state.list = state.list.filter((item) => String(item.id) !== String(id));
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  renderList();
  renderListChips();
}

function resetToDefaults() {
  if (!confirm("リストを初期値に戻しますか？\n追加した項目はすべて削除されます。")) return;
  state.list = makeDefaultEntries();
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  renderList();
  renderListChips();
}

function clearList() {
  if (!confirm("リストをすべて削除しますか？")) return;
  state.list = [];
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  renderList();
  renderListChips();
}


function formatListAsText() {
  const realItems = state.list.filter((item) => item.volumeM3 > 0);
  const date = new Date().toLocaleDateString("ja-JP");
  const lines = [`【簡易見積もり】${date}`, ""];
  realItems.forEach((item) => {
    lines.push(item.species);
    lines.push(`  ${item.widthMm}×${item.heightMm}×${item.lengthMm}mm × ${item.qty}本`);
    lines.push(`  単価 ${item.unitPrice.toLocaleString("ja-JP")}円/m³ → ${item.totalPrice.toLocaleString("ja-JP")}円`);
    lines.push("");
  });
  const totalVol = realItems.reduce((s, i) => s + i.volumeM3, 0);
  const totalPri = realItems.reduce((s, i) => s + i.totalPrice, 0);
  lines.push("─────────────────");
  lines.push(`合計体積: ${totalVol.toFixed(4)} m³`);
  lines.push(`合計金額: ${totalPri.toLocaleString("ja-JP")} 円`);
  return lines.join("\n");
}

async function exportList() {
  const text = formatListAsText();
  if (navigator.share) {
    try {
      await navigator.share({ title: "簡易見積もり", text });
    } catch (e) {
      if (e.name !== "AbortError") console.warn("共有に失敗:", e.message);
    }
  } else {
    await navigator.clipboard.writeText(text);
    alert("クリップボードにコピーしました。");
  }
}

function renderList() {
  const { list } = state;
  if (list.length === 0) {
    els.listEmpty.classList.remove("hidden");
    els.listTable.innerHTML = "";
    els.listTotal.classList.add("hidden");
    els.shareButton.classList.add("hidden");
    els.resetListButton.classList.remove("hidden");
    els.clearListButton.classList.add("hidden");
    return;
  }

  els.listEmpty.classList.add("hidden");
  els.resetListButton.classList.remove("hidden");
  els.clearListButton.classList.remove("hidden");

  // 合計は実際の材料（寸法入力済み）のみ集計
  const realItems = list.filter((item) => item.volumeM3 > 0);
  if (realItems.length > 0) {
    const totalVol = realItems.reduce((sum, item) => sum + item.volumeM3, 0);
    const totalPri = realItems.reduce((sum, item) => sum + item.totalPrice, 0);
    els.totalVolume.textContent = totalVol.toFixed(4);
    els.totalPrice.textContent = totalPri.toLocaleString("ja-JP");
    els.listTotal.classList.remove("hidden");
    els.shareButton.classList.remove("hidden");
  } else {
    els.listTotal.classList.add("hidden");
    els.shareButton.classList.add("hidden");
  }

  const rows = list.map((item) => {
    const hasVolume = item.volumeM3 > 0;
    const dimStr = hasVolume ? `${item.widthMm}×${item.heightMm}×${item.lengthMm}` : "-";
    const qtyStr = hasVolume ? `${item.qty}本` : "-";
    const volStr = hasVolume ? item.volumeM3.toFixed(4) : "-";
    const priceStr = hasVolume ? item.totalPrice.toLocaleString("ja-JP") : "-";
    return `
      <tr>
        <td>${item.species}</td>
        <td class="dim">${dimStr}</td>
        <td>${qtyStr}</td>
        <td>${item.unitPrice.toLocaleString("ja-JP")}</td>
        <td>${volStr}</td>
        <td>${priceStr}</td>
        <td><button class="del-btn" data-id="${item.id}">×</button></td>
      </tr>
    `;
  }).join("");

  els.listTable.innerHTML = `
    <div class="list-table-wrap">
      <table class="list-table">
        <thead><tr><th>樹種</th><th>寸法(mm)</th><th>本数</th><th>単価(円/m³)</th><th>体積(m³)</th><th>金額(円)</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  els.listTable.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeFromList(btn.dataset.id));
  });
}

// ===== イベントリスナー =====

[els.widthMm, els.heightMm, els.lengthMm, els.quantity, els.priceYen]
  .forEach((input) => input.addEventListener("input", calcVolumeAndUnitPrice));

els.cameraButton.addEventListener("click", () => els.cameraInput.click());
els.galleryButton.addEventListener("click", () => els.galleryInput.click());
els.cameraInput.addEventListener("change", () => { const f = els.cameraInput.files?.[0]; if (f) onFileSelected(f); });
els.galleryInput.addEventListener("change", () => { const f = els.galleryInput.files?.[0]; if (f) onFileSelected(f); });
els.scanButton.addEventListener("click", runScan);
els.addScanToListButton.addEventListener("click", addScanToList);

els.tabScan.addEventListener("click", () => switchTab("scan"));
els.tabCalc.addEventListener("click", () => switchTab("calc"));
els.tabList.addEventListener("click", () => switchTab("list"));

els.calcSpecies.addEventListener("input", onSpeciesChange);
els.addToListButton.addEventListener("click", addToList);
els.shareButton.addEventListener("click", exportList);
els.resetListButton.addEventListener("click", resetToDefaults);
els.clearListButton.addEventListener("click", clearList);

[els.calcUnitPrice, els.calcWidth, els.calcHeight, els.calcLength, els.calcQty]
  .forEach((input) => input.addEventListener("input", updateCalcResult));

fillPrefectures();
renderListChips();
detectLocation();
