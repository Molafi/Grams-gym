"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { lemonSqueezyConfigured, lsVariantId, paymentSimulatorEnabled } from "@/lib/env";
import { getSessionUser, signInPath } from "@/lib/auth/guards";
import { addMonths } from "@/lib/membership";
import { INTERVAL_MONTHS } from "@/config/plans";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { providerForMemberships } from "@/lib/payments";
import { ingestLemonSqueezyEvent } from "@/lib/payments/lemonsqueezy-events";
import { getCurrentSubscription, isMembershipActive, planPrice } from "./membership";

const joinSchema = z.object({
  plan: z.string().min(1).max(40),
  interval: z.enum(["monthly", "quarterly", "yearly"]),
  locale: z.enum(["ar", "en"]),
});

export type JoinState = { error?: "notConfigured" | "rateLimited" | "generic" };

/** "Join" on a plan card → hosted Lemon Squeezy checkout (or the simulator in test mode). */
export async function startMembershipCheckout(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const input = joinSchema.parse({
    plan: formData.get("plan"),
    interval: formData.get("interval"),
    locale: formData.get("locale"),
  });

  const user = await getSessionUser();
  if (!user || !user.email) {
    redirect(signInPath(input.locale, `/${input.locale}/packages?join=${input.plan}&interval=${input.interval}`));
  }

  try {
    await enforceRateLimit("membership-checkout", 8, 60_000, user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return { error: "rateLimited" };
    throw e;
  }

  const plan = await db.plan.findFirst({ where: { slug: input.plan, active: true, kind: "membership" } });
  if (!plan) return { error: "generic" };

  // Already paying by card? Don't start a second recurring subscription; plan changes,
  // cancellation and card updates happen from the membership page / customer portal.
  const current = await getCurrentSubscription(user.id);
  if (current && current.provider === "lemonsqueezy" && !current.cancelled && isMembershipActive(current)) {
    redirect(`/${input.locale}/account/membership`);
  }

  let target: string;
  if (paymentSimulatorEnabled) {
    // The simulator is for the built-in test accounts only; real users wait for real payments.
    if (!user.isTestAccount) return { error: "notConfigured" };
    target = `/${input.locale}/checkout/simulate?plan=${plan.slug}&interval=${input.interval}`;
  } else {
    if (!lemonSqueezyConfigured || !lsVariantId(plan.slug, input.interval)) return { error: "notConfigured" };
    try {
      const result = await providerForMemberships().createCheckout({
        kind: "subscription",
        user: { id: user.id, email: user.email, name: user.name },
        planSlug: plan.slug,
        interval: input.interval,
        locale: input.locale,
      });
      if (result.type !== "redirect") return { error: "generic" };
      target = result.url;
    } catch (e) {
      console.error("[billing] checkout failed", e);
      return { error: "generic" };
    }
  }
  redirect(target);
}

/**
 * TEST MODE ONLY. Emits Lemon Squeezy-shaped events and runs them through the
 * same ingestion pipeline as the real webhook (stored in WebhookEvent, idempotent).
 */
export async function simulateMembershipPayment(formData: FormData): Promise<void> {
  if (!paymentSimulatorEnabled) throw new Error("Simulator disabled");
  const input = joinSchema.parse({
    plan: formData.get("plan"),
    interval: formData.get("interval"),
    locale: formData.get("locale"),
  });
  const user = await getSessionUser();
  if (!user || !user.email) redirect(signInPath(input.locale, `/${input.locale}/packages`));
  // Only the built-in test accounts may use the simulator. A real (Google) user must never
  // be able to grant themselves a free membership, even while test mode is on.
  if (!user.isTestAccount) throw new Error("Simulator is for test accounts only");

  const plan = await db.plan.findFirstOrThrow({ where: { slug: input.plan, kind: "membership", active: true } });
  const now = new Date();
  const subId = `sim_${randomUUID()}`;
  const custom = { user_id: user.id, plan_slug: plan.slug, interval: input.interval };
  const attributes = {
    customer_id: "sim_customer",
    variant_id: "sim_variant",
    user_email: user.email,
    status: "active",
    cancelled: false,
    card_brand: "visa",
    card_last_four: "4242",
    trial_ends_at: null,
    renews_at: addMonths(now, INTERVAL_MONTHS[input.interval]).toISOString(),
    ends_at: null,
    updated_at: now.toISOString(),
    test_mode: true,
    urls: { customer_portal: null, update_payment_method: null },
  };

  await ingestLemonSqueezyEvent(
    JSON.stringify({ meta: { event_name: "subscription_created", test_mode: true, custom_data: custom }, data: { type: "subscriptions", id: subId, attributes } }),
  );
  await ingestLemonSqueezyEvent(
    JSON.stringify({
      meta: { event_name: "subscription_payment_success", test_mode: true, custom_data: custom },
      data: {
        type: "subscription-invoices",
        id: `sim_inv_${randomUUID()}`,
        attributes: { subscription_id: subId, status: "paid", total: planPrice(plan, input.interval), currency: plan.currency },
      },
    }),
  );

  redirect(`/${input.locale}/account/membership?checkout=success`);
}

async function ownedSubscription(subscriptionId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const sub = await db.subscription.findFirst({ where: { id: subscriptionId, userId: user.id } });
  if (!sub) throw new Error("NOT_FOUND");
  return sub;
}

async function simulateLifecycle(sub: { lsSubscriptionId: string | null; renewsAt: Date | null; userId: string; planId: string; interval: string }, cancelled: boolean) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: sub.planId } });
  const user = await db.user.findUniqueOrThrow({ where: { id: sub.userId } });
  await ingestLemonSqueezyEvent(
    JSON.stringify({
      meta: {
        event_name: cancelled ? "subscription_cancelled" : "subscription_resumed",
        test_mode: true,
        custom_data: { user_id: sub.userId, plan_slug: plan.slug, interval: sub.interval },
        nonce: randomUUID(),
      },
      data: {
        type: "subscriptions",
        id: sub.lsSubscriptionId,
        attributes: {
          customer_id: "sim_customer",
          variant_id: "sim_variant",
          user_email: user.email,
          status: cancelled ? "cancelled" : "active",
          cancelled,
          card_brand: "visa",
          card_last_four: "4242",
          trial_ends_at: null,
          renews_at: sub.renewsAt?.toISOString() ?? null,
          ends_at: cancelled ? (sub.renewsAt?.toISOString() ?? null) : null,
          updated_at: new Date().toISOString(),
          test_mode: true,
          urls: { customer_portal: null, update_payment_method: null },
        },
      },
    }),
  );
}

export async function cancelMembership(formData: FormData): Promise<void> {
  const sub = await ownedSubscription(String(formData.get("subscriptionId")));
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  if (sub.provider !== "lemonsqueezy" || !sub.lsSubscriptionId) return;
  if (sub.lsSubscriptionId.startsWith("sim_")) {
    await simulateLifecycle(sub, true);
  } else {
    await providerForMemberships().cancel(sub.lsSubscriptionId);
    // Optimistic; the subscription_cancelled webhook will set the authoritative endsAt.
    await db.subscription.update({ where: { id: sub.id }, data: { cancelled: true, status: "cancelled", endsAt: sub.endsAt ?? sub.renewsAt } });
  }
  revalidatePath(`/${locale}/account/membership`);
}

export async function resumeMembership(formData: FormData): Promise<void> {
  const sub = await ownedSubscription(String(formData.get("subscriptionId")));
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  if (sub.provider !== "lemonsqueezy" || !sub.lsSubscriptionId) return;
  if (sub.lsSubscriptionId.startsWith("sim_")) {
    await simulateLifecycle(sub, false);
  } else {
    await providerForMemberships().resume(sub.lsSubscriptionId);
    await db.subscription.update({ where: { id: sub.id }, data: { cancelled: false, status: "active", endsAt: null } });
  }
  revalidatePath(`/${locale}/account/membership`);
}
