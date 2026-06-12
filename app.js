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

const state = {
  imageBase64: "",
  mimeType: "image/jpeg",
  location: { prefecture: "", city: "", source: "manual" },
  selectedFile: null,
  priceData: { recent: [] },
  priceDataLoaded: false,
  list: JSON.parse(localStorage.getItem("mokusan_list") || "[]"),
  myPrices: JSON.parse(localStorage.getItem("mokusan_my_prices") || "{}")
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
  saveUnitPriceButton: getElement("saveUnitPriceButton"),
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

  // 材料リストに追加
  state.list.push({
    id: Date.now(),
    species: els.species.value || "（未設定）",
    widthMm: width, heightMm: height, lengthMm: length,
    qty, unitPrice: Math.round(unitPrice), volumeM3, totalPrice: priceYen
  });
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));

  // スキャンした樹種・単価をマイ単価に自動保存（計算タブのチップに反映）
  const species = els.species.value.trim();
  if (species && unitPrice > 0) {
    state.myPrices[species] = Math.round(unitPrice);
    localStorage.setItem("mokusan_my_prices", JSON.stringify(state.myPrices));
    renderMyPriceChips();
  }

  // みんなの価格表にも同時登録
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

// 保存済みマイ単価のチップを描画
function renderMyPriceChips() {
  const keys = Object.keys(state.myPrices);
  if (keys.length === 0) {
    els.myPriceChips.classList.add("hidden");
    return;
  }
  els.myPriceChips.classList.remove("hidden");
  els.myPriceChips.innerHTML = keys.map((s) =>
    `<button type="button" class="chip" data-species="${s}">${s}</button>`
  ).join("");
  els.myPriceChips.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.calcSpecies.value = btn.dataset.species;
      onSpeciesChange();
    });
  });
}

// 樹種入力時にマイ単価を自動補完
function onSpeciesChange() {
  const species = els.calcSpecies.value.trim();
  if (species && state.myPrices[species] != null) {
    els.calcUnitPrice.value = state.myPrices[species];
    els.unitPriceSource.textContent = `マイ単価を使用中 (${Number(state.myPrices[species]).toLocaleString("ja-JP")} 円/m³)`;
    els.unitPriceSource.className = "hint-text my-price";
    updateCalcResult();
  } else {
    els.unitPriceSource.textContent = "";
    els.unitPriceSource.className = "hint-text";
  }
}

function saveUnitPrice() {
  const species = els.calcSpecies.value.trim();
  const price = toNumber(els.calcUnitPrice.value);
  if (!species) { alert("樹種を入力してください。"); return; }
  if (!price) { alert("立米単価を入力してください。"); return; }
  state.myPrices[species] = price;
  localStorage.setItem("mokusan_my_prices", JSON.stringify(state.myPrices));
  renderMyPriceChips();
  els.unitPriceSource.textContent = `マイ単価に保存しました (${price.toLocaleString("ja-JP")} 円/m³)`;
  els.unitPriceSource.className = "hint-text my-price";
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

// ===== 材料リスト機能 =====

function addToList() {
  const species = els.calcSpecies.value.trim();
  const unitPrice = toNumber(els.calcUnitPrice.value);
  const width = toNumber(els.calcWidth.value);
  const height = toNumber(els.calcHeight.value);
  const length = toNumber(els.calcLength.value);
  const qty = Math.max(1, toNumber(els.calcQty.value, 1));

  if (!width || !height || !length) {
    alert("幅・厚み・長さを入力してください。");
    return;
  }
  if (!unitPrice) {
    alert("立米単価を入力してください。");
    return;
  }

  const volumeM3 = (width * height * length * qty) / MM3_TO_M3_DIVISOR;
  const totalPrice = Math.round(volumeM3 * unitPrice);

  state.list.push({
    id: Date.now(),
    species: species || "（未設定）",
    widthMm: width,
    heightMm: height,
    lengthMm: length,
    qty,
    unitPrice,
    volumeM3,
    totalPrice
  });
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  switchTab("list");
}

function removeFromList(id) {
  state.list = state.list.filter((item) => item.id !== id);
  localStorage.setItem("mokusan_list", JSON.stringify(state.list));
  renderList();
}

function clearList() {
  if (!confirm("リストをすべて削除しますか？")) return;
  state.list = [];
  localStorage.removeItem("mokusan_list");
  renderList();
}

function renderList() {
  const { list } = state;
  if (list.length === 0) {
    els.listEmpty.classList.remove("hidden");
    els.listTable.innerHTML = "";
    els.listTotal.classList.add("hidden");
    els.clearListButton.classList.add("hidden");
    return;
  }

  els.listEmpty.classList.add("hidden");
  els.clearListButton.classList.remove("hidden");

  const totalVol = list.reduce((sum, item) => sum + item.volumeM3, 0);
  const totalPri = list.reduce((sum, item) => sum + item.totalPrice, 0);
  els.totalVolume.textContent = totalVol.toFixed(4);
  els.totalPrice.textContent = totalPri.toLocaleString("ja-JP");
  els.listTotal.classList.remove("hidden");

  const rows = list.map((item) => `
    <tr>
      <td>${item.species}</td>
      <td class="dim">${item.widthMm}×${item.heightMm}×${item.lengthMm}</td>
      <td>${item.qty}本</td>
      <td>${item.unitPrice.toLocaleString("ja-JP")}</td>
      <td>${item.volumeM3.toFixed(4)}</td>
      <td>${item.totalPrice.toLocaleString("ja-JP")}</td>
      <td><button class="del-btn" data-id="${item.id}">×</button></td>
    </tr>
  `).join("");

  els.listTable.innerHTML = `
    <div class="list-table-wrap">
      <table class="list-table">
        <thead><tr><th>樹種</th><th>寸法(mm)</th><th>本数</th><th>単価(円/m³)</th><th>体積(m³)</th><th>金額(円)</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  els.listTable.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeFromList(Number(btn.dataset.id)));
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
els.saveUnitPriceButton.addEventListener("click", saveUnitPrice);
els.addToListButton.addEventListener("click", addToList);
els.clearListButton.addEventListener("click", clearList);

[els.calcUnitPrice, els.calcWidth, els.calcHeight, els.calcLength, els.calcQty]
  .forEach((input) => input.addEventListener("input", updateCalcResult));

fillPrefectures();
renderMyPriceChips();
detectLocation();
