import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { eventHash, signPayload, verifySignature } from "@/lib/payments/signature";

const secret = "whsec_test_123";
const body = JSON.stringify({ meta: { event_name: "subscription_created" }, data: { id: "1" } });

describe("Lemon Squeezy webhook signature", () => {
  it("matches an independent HMAC-SHA256 hex digest of the raw body", () => {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    expect(signPayload(body, secret)).toBe(expected);
  });

  it("accepts a valid signature", () => {
    expect(verifySignature(body, signPayload(body, secret), secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body.replace('"1"', '"2"'), sig, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifySignature(body, signPayload(body, "other"), secret)).toBe(false);
  });

  it("rejects missing, malformed and wrong-length signatures without throwing", () => {
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "", secret)).toBe(false);
    expect(verifySignature(body, "zz-not-hex", secret)).toBe(false);
    expect(verifySignature(body, "abcd", secret)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(verifySignature(body, signPayload(body, secret), undefined)).toBe(false);
  });

  it("produces a stable idempotency hash per (event, body)", () => {
    expect(eventHash(body, "a")).toBe(eventHash(body, "a"));
    expect(eventHash(body, "a")).not.toBe(eventHash(body, "b"));
  });
});
