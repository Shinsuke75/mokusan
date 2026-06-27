import { Redis } from "@upstash/redis";

// ===== Redis（任意）=====
// Vercel KV / Upstash Redis の環境変数があれば分散レート制限を使う。
// 未設定ならインメモリにフォールバックする（従来動作）。
let redis = null;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (redisUrl && redisToken) {
  try {
    redis = new Redis({ url: redisUrl, token: redisToken });
  } catch {
    redis = null;
  }
}

// ===== インメモリ・フォールバック =====
// ⚠️ Vercel Serverless は複数インスタンスが起動するためインスタンス間で
// カウントが共有されない。Redis 未設定時の簡易防御にとどまる。
const counts = new Map();

function checkRateLimitMemory(ip, limit, windowMs) {
  const windowKey = Math.floor(Date.now() / windowMs);
  const key = `${ip}:${windowKey}`;
  for (const k of counts.keys()) {
    if (!k.endsWith(`:${windowKey}`)) counts.delete(k);
  }
  const count = (counts.get(key) || 0) + 1;
  counts.set(key, count);
  return count > limit;
}

// 制限を超えていれば true を返す（async）。
// Redis があれば INCR + EXPIRE でインスタンス横断のカウントを行う。
export async function checkRateLimit(ip, limit = 20, windowMs = 60_000) {
  if (redis) {
    try {
      const windowKey = Math.floor(Date.now() / windowMs);
      const key = `rl:${ip}:${windowKey}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000) + 1);
      }
      return count > limit;
    } catch {
      // Redis 障害時はインメモリにフォールバック（可用性優先）
      return checkRateLimitMemory(ip, limit, windowMs);
    }
  }
  return checkRateLimitMemory(ip, limit, windowMs);
}

// ブラウザは Origin/Referer を必ず送るため、両方が無いリクエスト（curl 等）は拒否する。
export function isAllowedOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return false;
  return /^https?:\/\/(localhost(:\d+)?|mokusan[^.]*\.vercel\.app)/.test(origin);
}

export function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket?.remoteAddress
    || "unknown";
}
