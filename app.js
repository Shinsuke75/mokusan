const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県",
  "埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県",
  "佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

// 1m³ = 1,000mm × 1,000mm × 1,000mm = 1,000,000,000mm³
const MM3_TO_M3_DIVISOR = 1_000_000_000;
const GEOLOCATION_TIMEOUT_MS = 8000;
const GEOLOCATION_MAX_AGE_MS = 60000;

const state = {
  imageBase64: "",
  mimeType: "image/jpeg",
  location: { prefecture: "", city: "", source: "manual" }
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
  photoInput: getElement("photoInput"),
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
  doneSection: getElement("doneSection")
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
    if (error?.code === 1) {
      enableManualLocation("位置情報が拒否されたため手動入力に切り替えました。");
      return;
    }
    if (error?.code === 2) {
      enableManualLocation("現在地を特定できなかったため手動入力に切り替えました。");
      return;
    }
    if (error?.code === 3) {
      enableManualLocation("位置情報の取得がタイムアウトしたため手動入力に切り替えました。");
      return;
    }
    enableManualLocation("位置情報の取得に失敗したため手動入力に切り替えました。");
  }, {
    enableHighAccuracy: false,
    timeout: GEOLOCATION_TIMEOUT_MS,
    maximumAge: GEOLOCATION_MAX_AGE_MS
  });
}

function enableManualLocation(message) {
  els.geoStatus.textContent = message;
  els.locationManual.classList.remove("hidden");
  els.locationAuto.classList.add("hidden");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
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

async function runScan() {
  const file = els.photoInput.files?.[0];
  if (!file) {
    els.scanStatus.textContent = "値札画像を選択してください。";
    return;
  }

  els.scanButton.disabled = true;
  els.scanStatus.textContent = "Geminiで解析中...";

  try {
    const dataUrl = await fileToDataUrl(file);
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
    return {
      prefecture: els.manualPrefecture.value,
      city: els.manualCity.value,
      source: "manual"
    };
  }
  return state.location;
}

async function submitRecord() {
  const loc = currentLocation();
  const { volumeM3, unitPrice } = calcVolumeAndUnitPrice();

  if (!loc.prefecture) {
    els.submitStatus.textContent = "都道府県を入力してください。";
    return;
  }
  if (volumeM3 <= 0) {
    els.submitStatus.textContent = "寸法・本数・価格を確認してください。";
    return;
  }

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

[
  els.widthMm,
  els.heightMm,
  els.lengthMm,
  els.quantity,
  els.priceYen
].forEach((input) => input.addEventListener("input", calcVolumeAndUnitPrice));

els.scanButton.addEventListener("click", runScan);
els.submitButton.addEventListener("click", submitRecord);

fillPrefectures();
detectLocation();
