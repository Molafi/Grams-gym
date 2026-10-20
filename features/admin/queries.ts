import "server-only";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { site } from "@/config/site";
import { expireStalePendingOrders } from "@/lib/orders";
import { urgency, type Remaining } from "@/lib/membership";
import { isMembershipActive, remainingFor } from "@/features/billing/membership";
import { INTERVAL_MONTHS } from "@/config/plans";
import { parseMemberNumber } from "@/lib/member-number";

const subInclude = {
  plan: true,
  user: { select: { id: true, name: true, email: true, phone: true, isDemo: true, isTestAccount: true, memberNumber: true } },
} satisfies Prisma.SubscriptionInclude;

export type AdminSubscription = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }> & {
  active: boolean;
  remaining: Remaining;
  urgency: ReturnType<typeof urgency>;
  /** 0..1 share of the current period still left (for the bar). */
  periodLeft: number;
};

const DAY = 86_400_000;

function enrich(s: Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>, now: Date): AdminSubscription {
  const active = isMembershipActive(s, now);
  const remaining = remainingFor(s, now);
  const periodDays = INTERVAL_MONTHS[s.interval] * 30;
  return {
    ...s,
    active,
    remaining,
    urgency: urgency(remaining),
    periodLeft: active ? Math.max(0, Math.min(1, remaining.days / periodDays)) : 0,
  };
}

export type SubscriptionFilters = {
  q?: string;
  status?: SubscriptionStatus | "activeOnly";
  /** Only memberships whose countdown ends within N days. */
  withinDays?: number;
};

export async function listSubscriptions(f: SubscriptionFilters = {}): Promise<AdminSubscription[]> {
  const q = f.q?.trim();
  const where: Prisma.SubscriptionWhereInput = {
    ...(f.status && f.status !== "activeOnly" ? { status: f.status } : {}),
    ...(q
      ? {
          user: {
            OR: [
              ...(parseMemberNumber(q) ? [{ memberNumber: parseMemberNumber(q)! }] : []),
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          },
        }
      : {}),
  };
  const now = new Date();
  const rows = (await db.subscription.findMany({ where, include: subInclude, orderBy: { createdAt: "desc" }, take: 1000 })).map((s) => enrich(s, now));

  let out = rows;
  if (f.status === "activeOnly") out = out.filter((s) => s.active);
  if (f.withinDays != null) out = out.filter((s) => s.active && s.remaining.kind !== "renews" && s.remaining.days <= f.withinDays!);

  // Soonest-ending first; auto-renewing next; expired last.
  const rank = (s: AdminSubscription) => (!s.active ? 1e9 : s.remaining.kind === "renews" ? 1e6 + s.remaining.days : s.remaining.days);
  return out.sort((a, b) => rank(a) - rank(b));
}

export async function dashboardStats() {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  await expireStalePendingOrders(now).catch((e) => console.error("[admin] expiring stale orders failed", e));

  const [subs, openOrders, paidOrders30, payments30, checkinsToday, recentOrders, recentEvents] = await Promise.all([
    listSubscriptions(),
    db.order.count({ where: { status: { in: ["pending", "paid", "pay_on_delivery", "processing", "ready"] } } }),
    // Only amounts in the gym's currency are summed: Lemon Squeezy invoices are in the store
    // currency (e.g. USD cents) and can't be added to JOD fils.
    db.order.aggregate({ _sum: { totalMinor: true }, where: { createdAt: { gte: since30 }, currency: site.currency, status: { in: ["paid", "completed", "ready", "processing"] } } }),
    db.payment.aggregate({ _sum: { amountMinor: true }, where: { createdAt: { gte: since30 }, currency: site.currency, status: "succeeded", subscriptionId: { not: null } } }),
    db.checkIn.count({ where: { createdAt: { gte: startOfDay }, allowed: true } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true, email: true } } } }),
    db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  // Deduplicate to one membership per member (their best/current one).
  const byUser = new Map<string, AdminSubscription>();
  for (const s of subs) {
    const prev = byUser.get(s.userId);
    if (!prev || (!prev.active && s.active)) byUser.set(s.userId, s);
  }
  const current = [...byUser.values()];
  const active = current.filter((s) => s.active);

  const mrr = active.reduce((sum, s) => {
    const price = s.interval === "monthly" ? s.plan.priceMonthly : s.interval === "quarterly" ? s.plan.priceQuarterly : s.plan.priceYearly;
    return sum + Math.round(price / INTERVAL_MONTHS[s.interval]);
  }, 0);

  const expiringSoon = active.filter((s) => s.remaining.kind !== "renews" && s.remaining.days <= 14).sort((a, b) => a.remaining.days - b.remaining.days);

  return {
    activeCount: active.length,
    expiring7: active.filter((s) => s.remaining.kind !== "renews" && s.remaining.days <= 7).length,
    pastDue: current.filter((s) => s.status === "past_due").length,
    // Upcoming (future start) memberships are inactive but not expired.
    expired30: current.filter((s) => !s.active && s.remaining.kind !== "starts" && (s.endsAt ?? s.updatedAt) >= since30).length,
    mrrMinor: mrr,
    openOrders,
    revenue30Minor: (paidOrders30._sum.totalMinor ?? 0) + (payments30._sum.amountMinor ?? 0),
    checkinsToday,
    expiringSoon,
    recentOrders,
    recentEvents,
  };
}
