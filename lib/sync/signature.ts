import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The sync agent signs each request with HMAC-SHA256 over `${timestamp}.${rawBody}`
 * using the shared SYNC_SECRET. The timestamp is sent in `x-sync-timestamp` (unix ms)
 * and the hex digest in `x-sync-signature`. Binding the timestamp into the signature
 * lets the server reject replays outside a small time window.
 */
export function signSync(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export function verifySync(
  rawBody: string,
  timestamp: string | null | undefined,
  signature: string | null | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!secret || !timestamp || !signature) return false;
  if (!/^[0-9a-f]+$/i.test(signature)) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false;
  const expected = Buffer.from(signSync(timestamp, rawBody, secret), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
