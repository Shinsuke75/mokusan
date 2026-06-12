import { checkRateLimit, getClientIp } from "./_ratelimit.js";

function pickCity(address = {}) {
  return address.city || address.town || address.village || address.county || "";
}

function pickPrefecture(address = {}, displayName = "") {
  if (address.state) return address.state;
  if (address.province) return address.province;
  if (displayName) {
    const match = displayName.match(/([^\s,、]+[都道府県])/);
    if (match) return match[1];
  }
  return "";
}

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_ZOOM_LEVEL = 14;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (checkRateLimit(getClientIp(req), 30)) {
    return res.status(429).json({ error: "Too Many Requests" });
  }

  const { lat, lon } = req.query || {};
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon are required" });
  }

  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", String(NOMINATIM_ZOOM_LEVEL));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ja");

  try {
    const contactEmail = process.env.NOMINATIM_CONTACT_EMAIL;
    if (!contactEmail) {
      return res.status(500).json({ error: "NOMINATIM_CONTACT_EMAIL is missing" });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": `zairyo-mokuzai-app/1.0 (contact: ${contactEmail})`
      }
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || "Nominatim reverse geocoding failed"
      });
    }

    const address = data.address || {};
    return res.status(200).json({
      prefecture: pickPrefecture(address, data.display_name || ""),
      city: pickCity(address)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected error" });
  }
}