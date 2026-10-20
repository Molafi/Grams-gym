import "server-only";
import { headers } from "next/headers";

/**
 * Fixed-window in-memory rate limiter. Good enough for a single instance and
 * for slowing abuse; on multi-instance hosting swap for Upstash/Redis (same API).
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimitKey(scope: string, id: string) {
  return `${scope}:${id}`;
}

export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

/** True if `key` already used up `limit` in its current window (does not count as a hit). */
export function isLimited(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return Boolean(b && b.resetAt > Date.now() && b.count >= limit);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("RATE_LIMITED");
  }
}

/** Throws RateLimitError when the caller exceeded `limit` calls per `windowMs`. */
export async function enforceRateLimit(scope: string, limit: number, windowMs: number, id?: string) {
  const key = rateLimitKey(scope, id ?? (await clientIp()));
  const r = hit(key, limit, windowMs);
  if (!r.ok) throw new RateLimitError(r.retryAfter);
}
