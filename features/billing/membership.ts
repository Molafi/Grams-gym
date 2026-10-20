import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env, testDataAllowed } from "@/lib/env";
import { hasActiveMembership, membershipRemaining, type MembershipLike, type Remaining } from "@/lib/membership";

const include = { plan: true } satisfies Prisma.SubscriptionInclude;
export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{ include: typeof include }>;

/**
 * The access rules with this deployment's settings applied (grace period, and whether
 * test-mode memberships still count). Use these everywhere instead of calling
 * `hasActiveMembership` / `membershipRemaining` directly.
 */
export function isMembershipActive(sub: MembershipLike | null | undefined, now = new Date()): boolean {
  return hasActiveMembership(sub, now, env.MEMBERSHIP_GRACE_DAYS, { allowTestMode: testDataAllowed });
}

export function remainingFor(sub: MembershipLike, now = new Date()): Remaining {
  return membershipRemaining(sub, now, env.MEMBERSHIP_GRACE_DAYS, { allowTestMode: testDataAllowed });
}

/** The membership that matters for a user: the active one, otherwise the most recent. */
export async function getCurrentSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
  const subs = await db.subscription.findMany({ where: { userId }, include, orderBy: { createdAt: "desc" }, take: 20 });
  const now = new Date();
  return subs.find((s) => isMembershipActive(s, now)) ?? subs[0] ?? null;
}

export function describe(sub: SubscriptionWithPlan, now = new Date()) {
  return {
    active: isMembershipActive(sub, now),
    remaining: remainingFor(sub, now),
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
