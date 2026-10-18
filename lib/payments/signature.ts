import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lemon Squeezy signs webhooks with HMAC-SHA256 over the RAW body using the
 * signing secret; the hex digest is sent in the `X-Signature` header.
 */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifySignature(rawBody: string, signature: string | null | undefined, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  if (!/^[0-9a-f]+$/i.test(signature)) return false;
  const expected = Buffer.from(signPayload(rawBody, secret), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Idempotency key for a webhook delivery. */
export function eventHash(rawBody: string, eventName: string): string {
  return createHash("sha256").update(eventName).update("\n").update(rawBody, "utf8").digest("hex");
}
