import Redis from "ioredis";

// Redis client setup for rate limiting
// Uses environment variable REDIS_URL for connection
const redisUrl = process.env.REDIS_URL;

let redis: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl);
} else {
  // Fallback: no Redis connection, rate limiting disabled
  console.warn("REDIS_URL not set, rate limiting disabled");
}

export { redis };

// Rate limiting configuration
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per hour

/**
 * Check if IP is rate limited for createRoom
 * Uses Redis sorted set to track requests per IP
 * @param ip - Client IP address
 * @returns Object with allowed status and remaining requests
 */
export async function checkCreateRoomRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  if (!redis) {
    // No Redis connection, allow all requests
    return { allowed: true, remaining: 999, resetInSeconds: 0 };
  }

  const key = `rate_limit:create_room:${ip}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS * 1000;

  try {
    // Remove old entries outside the time window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const currentCount = await redis.zcard(key);

    if (currentCount >= RATE_LIMIT_MAX_REQUESTS) {
      // Get the oldest request to calculate reset time
      const oldestRequest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp = parseInt(oldestRequest[1] || "0", 10);
      const resetInSeconds = Math.ceil(
        (oldestTimestamp + RATE_LIMIT_WINDOW_SECONDS * 1000 - now) / 1000
      );

      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(0, resetInSeconds),
      };
    }

    // Add current request to the sorted set
    await redis.zadd(key, now, `${now}-${Math.random().toString(36).substr(2, 9)}`);

    // Set expiry on the key
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);

    const remaining = RATE_LIMIT_MAX_REQUESTS - currentCount - 1;

    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      resetInSeconds: 0,
    };
  } catch (error) {
    console.error("Rate limiting error:", error);
    // On error, allow the request (fail open)
    return { allowed: true, remaining: 999, resetInSeconds: 0 };
  }
}

/**
 * Get client IP from request headers
 * Handles various proxy setups (Vercel, etc.)
 * @param request - Next.js request object
 * @returns IP address string
 */
export function getClientIP(request: Request): string {
  // Try various headers that might contain the real IP
  const headers = request.headers;

  // X-Forwarded-For is the most common header for proxied requests
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP (client IP) from the comma-separated list
    return forwardedFor.split(",")[0].trim();
  }

  // Other common headers
  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // CF-Connecting-IP for Cloudflare
  const cfIP = headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP;
  }

  // Fallback: return unknown
  return "unknown";
}
