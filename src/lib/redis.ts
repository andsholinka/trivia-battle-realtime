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
