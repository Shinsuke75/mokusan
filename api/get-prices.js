import { google } from "googleapis";
import { isAllowedOrigin } from "./_ratelimit.js";

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Google service account env vars are missing");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || "prices";
    if (!spreadsheetId) return res.status(500).json({ error: "GOOGLE_SPREADSHEET_ID is missing" });

    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:L`
    });

    const rows = response.data.values || [];
    const dataRows = rows.filter((row, i) => {
      if (i === 0 && isNaN(Date.parse(row[0]))) return false;
      return Number(row[10]) > 0;
    });

    const recent = dataRows.slice(-20).reverse().map(row => ({
      date: row[0] || "",
      prefecture: row[1] || "",
      city: row[2] || "",
      storeName: row[3] || "",
      species: row[4] || "",
      unitPrice: Number(row[10]) || 0
    }));

    const map = {};
    for (const row of dataRows) {
      const species = (row[4] || "").trim();
      const prefecture = (row[1] || "").trim();
      const unitPrice = Number(row[10]) || 0;
      if (!species || unitPrice <= 0) continue;
      const key = `${species}||${prefecture}`;
      if (!map[key]) map[key] = { species, prefecture, total: 0, count: 0 };
      map[key].total += unitPrice;
      map[key].count++;
    }

    const averages = Object.values(map).map(v => ({
      species: v.species,
      prefecture: v.prefecture,
      avgUnitPrice: Math.round(v.total / v.count),
      count: v.count
    })).sort((a, b) => b.count - a.count);

    return res.status(200).json({ recent, averages });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected error" });
  }
}