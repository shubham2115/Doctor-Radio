import Redis from "ioredis";

/**
 * Fixed-window rate limiter. Uses Redis when REDIS_URL is reachable (shared across instances),
 * otherwise falls back to a per-process Map so local dev works without infrastructure.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null; rlMemory?: Map<string, { n: number; reset: number }> };

function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  const url = process.env.REDIS_URL;
  if (!url) return (globalForRedis.redis = null);
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
  client.on("error", () => {}); // degrade to memory limiter; never crash requests
  return (globalForRedis.redis = client);
}

const memory = (globalForRedis.rlMemory ??= new Map());

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const redis = getRedis();
  if (redis && redis.status === "ready") {
    try {
      const k = `rl:${key}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, windowSec);
      const ttl = await redis.ttl(k);
      return { ok: n <= limit, retryAfter: Math.max(ttl, 1) };
    } catch {
      /* fall through to memory */
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.reset < now) {
    memory.set(key, { n: 1, reset: now + windowSec * 1000 });
    return { ok: true, retryAfter: windowSec };
  }
  entry.n += 1;
  return { ok: entry.n <= limit, retryAfter: Math.ceil((entry.reset - now) / 1000) };
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
