import { google } from "googleapis";

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

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || "prices";

    if (!spreadsheetId) {
      return res.status(500).json({ error: "GOOGLE_SPREADSHEET_ID is missing" });
    }

    const body = req.body || {};
    const row = [
      formatDate(body.date),
      body.prefecture || "",
      body.city || "",
      body.storeName || "",
      body.species || "",
      Number(body.widthMm || 0),
      Number(body.heightMm || 0),
      Number(body.lengthMm || 0),
      Number(body.priceYen || 0),
      Number(body.quantity || 1),
      Number(body.unitPriceYenPerM3 || 0),
      body.note || ""
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
