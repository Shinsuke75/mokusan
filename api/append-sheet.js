import { google } from "googleapis";
import { checkRateLimit, isAllowedOrigin, getClientIp } from "./_ratelimit.js";

function sanitizeStr(v, maxLen = 100) {
  return String(v || "").replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function sanitizeNum(v, min = 0, max = 100_000_000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Environment variables often store private keys with escaped "\\n"; convert them back for JWT parsing.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google service account env vars are missing");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

function formatDate(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (checkRateLimit(getClientIp(req), 20)) {
    return res.status(429).json({ error: "リクエストが多すぎます。しばらくしてからお試しください。" });
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || "prices";

    if (!spreadsheetId) {
      return res.status(500).json({ error: "GOOGLE_SPREADSHEET_ID is missing" });
    }

    const body = req.body || {};
    const row = [
      formatDate(body.date),
      sanitizeStr(body.prefecture, 20),
      sanitizeStr(body.city, 50),
      "",
      sanitizeStr(body.species, 100),
      sanitizeNum(body.widthMm, 0, 10_000),
      sanitizeNum(body.heightMm, 0, 10_000),
      sanitizeNum(body.lengthMm, 0, 100_000),
      sanitizeNum(body.priceYen, 0, 10_000_000),
      sanitizeNum(body.quantity, 0, 10_000),
      sanitizeNum(body.unitPriceYenPerM3, 0, 100_000_000),
      sanitizeStr(body.note, 200)
    ];

    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:L`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row]
      }
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected error" });
  }
}
