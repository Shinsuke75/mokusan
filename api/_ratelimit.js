const counts = new Map();

export function checkRateLimit(ip, limit = 20, windowMs = 60_000) {
  const windowKey = Math.floor(Date.now() / windowMs);
  const key = `${ip}:${windowKey}`;
  for (const k of counts.keys()) {
    if (!k.endsWith(`:${windowKey}`)) counts.delete(k);
  }
  const count = (counts.get(key) || 0) + 1;
  counts.set(key, count);
  return count > limit;
}

export function isAllowedOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return true;
  return /^https?:\/\/(localhost(:\d+)?|mokusan[^.]*\.vercel\.app)/.test(origin);
}

export function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket?.remoteAddress
    || "unknown";
}
