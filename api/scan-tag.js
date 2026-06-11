function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const OCR_PROMPT = [
  "あなたは木材値札OCRの抽出器です。",
  "画像から以下のJSONだけを返してください。",
  "{",
  '  "species": "樹種文字列",',
  '  "widthMm": 数値,',
  '  "heightMm": 数値,',
  '  "lengthMm": 数値,',
  '  "priceYen": 数値,',
  '  "quantity": 数値,',
  '  "note": "補足"',
  "}",
  "数値が不明な場合は0、数量が不明な場合は1。単位はmm/円で統一。"
].join("\n");

const GEMINI_GENERATE_CONTENT_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

function normalizeResult(raw = {}) {
  return {
    species: String(raw.species || "").trim(),
    widthMm: safeNumber(raw.widthMm),
    heightMm: safeNumber(raw.heightMm),
    lengthMm: safeNumber(raw.lengthMm),
    priceYen: safeNumber(raw.priceYen),
    quantity: Math.max(1, safeNumber(raw.quantity, 1)),
    note: String(raw.note || "").trim()
  };
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  try {
    const response = await fetch(
      GEMINI_GENERATE_CONTENT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: OCR_PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType || "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API request failed"
      });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(422).json({ error: "Gemini response is empty" });
    }

    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return res.status(422).json({
        error: "Gemini response is not valid JSON. 画像の傾き補正や再撮影を行い、値札全体が写るようにしてください。"
      });
    }

    return res.status(200).json(normalizeResult(parsed));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected error" });
  }
}
