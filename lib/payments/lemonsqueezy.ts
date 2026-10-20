import "server-only";
import {
  cancelSubscription,
  createCheckout,
  getSubscription,
  lemonSqueezySetup,
  updateSubscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import { env, lemonSqueezyConfigured, lsVariantId } from "@/lib/env";
import { PENDING_HOLD_MINUTES } from "@/lib/orders";
import { toStoreMinor } from "./currency";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { ingestLemonSqueezyEvent } from "./lemonsqueezy-events";
import { verifySignature } from "./signature";
import { PaymentError, type CheckoutInput, type CheckoutResult, type ManagementUrls, type PaymentProvider } from "./types";

let configured = false;
function setup() {
  if (!lemonSqueezyConfigured) throw new PaymentError("NOT_CONFIGURED", "Lemon Squeezy env vars are missing");
  if (!configured) {
    lemonSqueezySetup({
      apiKey: env.LEMONSQUEEZY_API_KEY!,
      onError: (e) => console.error("[lemonsqueezy]", e.message),
    });
    configured = true;
  }
}

const site = () => env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

export const lemonSqueezyProvider: PaymentProvider = {
  id: "lemonsqueezy",

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    setup();
    const storeId = env.LEMONSQUEEZY_STORE_ID!;

    if (input.kind === "subscription") {
      const variantId = lsVariantId(input.planSlug, input.interval);
      if (!variantId) throw new PaymentError("VARIANT_MISSING", `No variant for ${input.planSlug}/${input.interval}`);
      const { data, error } = await createCheckout(storeId, variantId, {
        checkoutData: {
          email: input.user.email,
          name: input.user.name ?? undefined,
          custom: { user_id: input.user.id, plan_slug: input.planSlug, interval: input.interval },
        },
        productOptions: {
          redirectUrl: `${site()}/${input.locale}/account/membership?checkout=success`,
        },
        checkoutOptions: { embed: false },
        testMode: env.LEMONSQUEEZY_TEST_MODE,
      });
      const url = data?.data.attributes.url;
      if (error || !url) throw new PaymentError("PROVIDER_ERROR", error?.message ?? "No checkout URL");
      return { type: "redirect", url };
    }

    // Supplement order through Lemon Squeezy (only when SUPPLEMENT_PAYMENT_MODE=lemonsqueezy).
    const variantId = env.LS_VARIANT_SUPPLEMENT_ORDER;
    if (!variantId) throw new PaymentError("VARIANT_MISSING", "LS_VARIANT_SUPPLEMENT_ORDER is not set");
    const { data, error } = await createCheckout(storeId, variantId, {
      customPrice: toStoreMinor(input.order.totalMinor, input.order.currency),
      checkoutData: {
        email: input.user.email,
        name: input.user.name ?? undefined,
        custom: { user_id: input.user.id, order_id: input.order.id },
      },
      productOptions: {
        name: `GRAMS GYM order ${input.order.number}`,
        redirectUrl: `${site()}/${input.locale}/checkout/success?order=${encodeURIComponent(input.order.number)}`,
      },
      // Same lifetime as the stock hold, so customers can't pay after the units were released.
      expiresAt: new Date(Date.now() + PENDING_HOLD_MINUTES * 60_000).toISOString(),
      testMode: env.LEMONSQUEEZY_TEST_MODE,
    });
    const url = data?.data.attributes.url;
    if (error || !url) throw new PaymentError("PROVIDER_ERROR", error?.message ?? "No checkout URL");
    return { type: "redirect", url };
  },

  async handleWebhook(req: Request): Promise<Response> {
    // Verify first (cheap HMAC). Only unsigned/forged requests are rate-limited, per IP,
    // so junk traffic can never use up a shared budget and get real deliveries rejected.
    const raw = await req.text();
    const signature = req.headers.get("x-signature");
    if (!verifySignature(raw, signature, env.LEMONSQUEEZY_WEBHOOK_SECRET)) {
      try {
        await enforceRateLimit("webhook-ls-invalid", 30, 60_000);
      } catch (e) {
        if (e instanceof RateLimitError) return new Response("Too many requests", { status: 429 });
        throw e;
      }
      return new Response("Invalid signature", { status: 401 });
    }
    try {
      const result = await ingestLemonSqueezyEvent(raw);
      // 200 even on processing failure: the event is stored and retryable from /admin/webhooks.
      return Response.json({ ok: true, status: result.status });
    } catch (e) {
      console.error("[webhook] could not store event", e);
      // Could not even store it → ask Lemon Squeezy to retry.
      return new Response("Storage error", { status: 500 });
    }
  },

  async getManagementUrls(subscriptionId: string): Promise<ManagementUrls> {
    setup();
    const { data, error } = await getSubscription(subscriptionId);
    if (error || !data) throw new PaymentError("PROVIDER_ERROR", error?.message);
    const urls = data.data.attributes.urls;
    return {
      customerPortal: urls.customer_portal ?? undefined,
      updatePaymentMethod: urls.update_payment_method ?? undefined,
    };
  },

  async cancel(subscriptionId: string) {
    setup();
    const { error } = await cancelSubscription(subscriptionId);
    if (error) throw new PaymentError("PROVIDER_ERROR", error.message);
  },

  async resume(subscriptionId: string) {
    setup();
    const { error } = await updateSubscription(subscriptionId, { cancelled: false });
    if (error) throw new PaymentError("PROVIDER_ERROR", error.message);
  },
};
