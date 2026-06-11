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
  priceData: { recent: [], averages: [] },
  priceDataLoaded: false
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
  submitButton: getElement("submitButton"),
  submitStatus: getElement("submitStatus"),
  doneSection: getElement("doneSection"),
  tabScan: getElement("tabScan"),
  tabCalc: getElement("tabCalc"),
  scanContent: getElement("scanContent"),
  calcContent: getElement("calcContent"),
  calcSpecies: getElement("calcSpecies"),
  speciesList: getElement("speciesList"),
  calcPrefecture: getElement("calcPrefecture"),
  avgResult: getElement("avgResult"),
  avgUnitPrice: getElement("avgUnitPrice"),
  avgCount: getElement("avgCount"),
  noDataMsg: getElement("noDataMsg"),
  calcUnitPrice: getElement("calcUnitPrice"),
  calcWidth: getElement("calcWidth"),
  calcHeight: getElement("calcHeight"),
  calcLength: getElement("calcLength"),
  calcQty: getElement("calcQty"),
  calcVolume: getElement("calcVolume"),
  calcPrice: getElement("calcPrice"),
  recentStatus: getElement("recentStatus"),
  recentTable: getElement("recentTable")
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
    els.scanStatus.textContent = "抽出結果を確認して送信してください。";
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

async function submitRecord() {
  const loc = currentLocation();
  const { volumeM3, unitPrice } = calcVolumeAndUnitPrice();
  if (loc.source !== "geo" && !loc.prefecture) { els.submitStatus.textContent = "都道府県を入力してください。"; return; }
  if (volumeM3 <= 0) { els.submitStatus.textContent = "寸法・本数・価格を確認してください。"; return; }
  els.submitButton.disabled = true;
  els.submitStatus.textContent = "送信中...";
  try {
    const payload = {
      date: new Date().toISOString(),
      prefecture: loc.prefecture,
      city: loc.city || "",
      storeName: els.storeName.value || "",
      species: els.species.value || "",
      widthMm: toNumber(els.widthMm.value),
      heightMm: toNumber(els.heightMm.value),
      lengthMm: toNumber(els.lengthMm.value),
      priceYen: toNumber(els.priceYen.value),
      quantity: Math.max(1, toNumber(els.quantity.value, 1)),
      unitPriceYenPerM3: Math.round(unitPrice),
      note: els.note.value || ""
    };
    const res = await fetch("/api/append-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "送信に失敗しました");
    els.submitStatus.textContent = "記録しました。";
    els.doneSection.classList.remove("hidden");
  } catch (e) {
    els.submitStatus.textContent = `エラー: ${e.message}`;
  } finally {
    els.submitButton.disabled = false;
  }
}

function switchTab(tab) {
  if (tab === "scan") {
    els.tabScan.classList.add("active");
    els.tabCalc.classList.remove("active");
    els.scanContent.classList.remove("hidden");
    els.calcContent.classList.add("hidden");
  } else {
    els.tabCalc.classList.add("active");
    els.tabScan.classList.remove("active");
    els.calcContent.classList.remove("hidden");
    els.scanContent.classList.add("hidden");
    loadPriceData();
  }
}

async function loadPriceData() {
  if (state.priceDataLoaded) return;
  try {
    const res = await fetch("/api/get-prices");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "データ取得に失敗しました");
    state.priceData = data;
    state.priceDataLoaded = true;
    populateCalcDropdowns();
    renderRecentTable();
  } catch (e) {
    els.recentStatus.textContent = `エラー: ${e.message}`;
  }
}

function populateCalcDropdowns() {
  const { averages } = state.priceData;
  const speciesSet = [...new Set(averages.map((a) => a.species).filter(Boolean))];
  els.speciesList.innerHTML = speciesSet.map((s) => `<option value="${s}">`).join("");
  const prefSet = [...new Set(averages.map((a) => a.prefecture).filter(Boolean))].sort();
  els.calcPrefecture.innerHTML = '<option value="">すべて</option>' +
    prefSet.map((p) => `<option value="${p}">${p}</option>`).join("");
  if (averages.length === 0) els.noDataMsg.classList.remove("hidden");
}

function updateAvgDisplay() {
  const species = els.calcSpecies.value.trim();
  const prefecture = els.calcPrefecture.value;
  const { averages } = state.priceData;
  if (!species || averages.length === 0) { els.avgResult.classList.add("hidden"); return; }
  const matches = averages.filter((a) =>
    a.species === species && (prefecture === "" || a.prefecture === prefecture)
  );
  if (matches.length === 0) { els.avgResult.classList.add("hidden"); return; }
  const totalCount = matches.reduce((sum, m) => sum + m.count, 0);
  const weightedAvg = Math.round(
    matches.reduce((sum, m) => sum + m.avgUnitPrice * m.count, 0) / totalCount
  );
  els.avgUnitPrice.textContent = weightedAvg.toLocaleString("ja-JP");
  els.avgCount.textContent = totalCount;
  els.avgResult.classList.remove("hidden");
  els.calcUnitPrice.value = weightedAvg;
  updateCalcResult();
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
  if (recent.length === 0) {
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

[els.widthMm, els.heightMm, els.lengthMm, els.quantity, els.priceYen]
  .forEach((input) => input.addEventListener("input", calcVolumeAndUnitPrice));

els.cameraButton.addEventListener("click", () => els.cameraInput.click());
els.galleryButton.addEventListener("click", () => els.galleryInput.click());
els.cameraInput.addEventListener("change", () => { const f = els.cameraInput.files?.[0]; if (f) onFileSelected(f); });
els.galleryInput.addEventListener("change", () => { const f = els.galleryInput.files?.[0]; if (f) onFileSelected(f); });
els.scanButton.addEventListener("click", runScan);
els.submitButton.addEventListener("click", submitRecord);
els.tabScan.addEventListener("click", () => switchTab("scan"));
els.tabCalc.addEventListener("click", () => switchTab("calc"));
els.calcSpecies.addEventListener("input", updateAvgDisplay);
els.calcPrefecture.addEventListener("change", updateAvgDisplay);
[els.calcUnitPrice, els.calcWidth, els.calcHeight, els.calcLength, els.calcQty]
  .forEach((input) => input.addEventListener("input", updateCalcResult));

fillPrefectures();
detectLocation();