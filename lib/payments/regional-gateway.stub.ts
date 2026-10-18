/**
 * STUB — where a regional card gateway plugs in (e.g. a Jordanian acquirer,
 * HyperPay, Network International, Tap, PayTabs, Stripe if available).
 *
 * Steps to activate a real gateway:
 *  1. Implement every method below against the gateway's API.
 *  2. Add "regional" to `ProviderId` in ./types.ts and to the Prisma
 *     `PaymentProviderId` enum (+ migration).
 *  3. Add `regional` to SUPPLEMENT_PAYMENT_MODE in lib/env.ts.
 *  4. Return it from `providerForOrders()` in ./index.ts.
 *  5. Add a webhook route at app/api/webhooks/regional/route.ts that calls
 *     `regionalProvider.handleWebhook(req)` — verify the gateway's signature with
 *     a constant-time compare and reuse the idempotent WebhookEvent pattern.
 *  6. Add the gateway's domains to the CSP in next.config.ts.
 *
 * This file is intentionally not imported anywhere.
 */
import type { CheckoutInput, CheckoutResult, ManagementUrls } from "./types";

export const regionalProvider = {
  id: "regional" as const,
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    void input;
    // const session = await gateway.createPaymentSession({ amount: input.order.totalMinor, currency: input.order.currency, ... });
    // return { type: "redirect", url: session.redirectUrl };
    throw new Error("Regional gateway not implemented");
  },
  async handleWebhook(req: Request): Promise<Response> {
    void req;
    return new Response("Not implemented", { status: 501 });
  },
  async getManagementUrls(): Promise<ManagementUrls> {
    return {};
  },
  async cancel(): Promise<void> {},
  async resume(): Promise<void> {},
};
