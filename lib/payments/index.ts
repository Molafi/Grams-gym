import "server-only";
import { env } from "@/lib/env";
import { lemonSqueezyProvider } from "./lemonsqueezy";
import { manualProvider } from "./manual";
import type { PaymentProvider, ProviderId } from "./types";

export function providerById(id: ProviderId): PaymentProvider {
  return id === "lemonsqueezy" ? lemonSqueezyProvider : manualProvider;
}

/** Memberships bought online always go through Lemon Squeezy. */
export function providerForMemberships(): PaymentProvider {
  return lemonSqueezyProvider;
}

/** Supplements: manual by default (see docs/OWNER-TODO.md — Lemon Squeezy prohibits physical goods). */
export function providerForOrders(): PaymentProvider {
  return env.SUPPLEMENT_PAYMENT_MODE === "lemonsqueezy" ? lemonSqueezyProvider : manualProvider;
}

export * from "./types";
