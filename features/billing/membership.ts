import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasActiveMembership, membershipRemaining } from "@/lib/membership";

const include = { plan: true } satisfies Prisma.SubscriptionInclude;
export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{ include: typeof include }>;

/** The membership that matters for a user: the active one, otherwise the most recent. */
export async function getCurrentSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
  const subs = await db.subscription.findMany({ where: { userId }, include, orderBy: { createdAt: "desc" }, take: 20 });
  const now = new Date();
  return subs.find((s) => hasActiveMembership(s, now, env.MEMBERSHIP_GRACE_DAYS)) ?? subs[0] ?? null;
}

export function describe(sub: SubscriptionWithPlan, now = new Date()) {
  return {
    active: hasActiveMembership(sub, now, env.MEMBERSHIP_GRACE_DAYS),
    remaining: membershipRemaining(sub, now, env.MEMBERSHIP_GRACE_DAYS),
  };
}

export async function getActivePlans() {
  return db.plan.findMany({ where: { active: true, kind: "membership" }, orderBy: { sortOrder: "asc" } });
}

export async function getAddons() {
  return db.plan.findMany({ where: { active: true, kind: "addon" }, orderBy: { sortOrder: "asc" } });
}

export function planPrice(
  plan: { priceMonthly: number; priceQuarterly: number; priceYearly: number },
  interval: "monthly" | "quarterly" | "yearly",
) {
  return interval === "monthly" ? plan.priceMonthly : interval === "quarterly" ? plan.priceQuarterly : plan.priceYearly;
}
