/**
 * Membership access rules — pure functions (no DB, no env) so they are unit-testable.
 */
export const SUBSCRIPTION_STATUSES = [
  "on_trial",
  "active",
  "paused",
  "past_due",
  "unpaid",
  "cancelled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type MembershipLike = {
  status: SubscriptionStatus;
  provider: "lemonsqueezy" | "manual";
  renewsAt: Date | null;
  endsAt: Date | null;
  trialEndsAt?: Date | null;
  pastDueSince?: Date | null;
};

const DAY = 86_400_000;

export function hasActiveMembership(sub: MembershipLike | null | undefined, now: Date, graceDays: number): boolean {
  if (!sub) return false;
  switch (sub.status) {
    case "active":
    case "on_trial":
      // Manual (pay-at-desk) memberships carry a hard end date.
      if (sub.provider === "manual" && sub.endsAt) return now < sub.endsAt;
      return true;
    case "cancelled":
      return sub.endsAt != null && now < sub.endsAt;
    case "past_due": {
      const since = sub.pastDueSince ?? sub.renewsAt;
      if (!since) return false;
      return now.getTime() < since.getTime() + graceDays * DAY;
    }
    case "paused":
    case "unpaid":
    case "expired":
    default:
      return false;
  }
}

export type RemainingKind = "renews" | "ends" | "trial" | "grace" | "none";

export type Remaining = {
  kind: RemainingKind;
  /** Whole days left, rounded up. 0 when none/expired. */
  days: number;
  /** The date the countdown targets. */
  at: Date | null;
};

/** What the admin dashboard shows as "days left" for a membership. */
export function membershipRemaining(sub: MembershipLike, now: Date, graceDays: number): Remaining {
  const toDays = (at: Date) => Math.max(0, Math.ceil((at.getTime() - now.getTime()) / DAY));
  const pick = (kind: RemainingKind, at: Date | null | undefined): Remaining =>
    at ? { kind, days: toDays(at), at } : { kind: "none", days: 0, at: null };

  if (!hasActiveMembership(sub, now, graceDays)) return { kind: "none", days: 0, at: sub.endsAt ?? null };

  switch (sub.status) {
    case "on_trial":
      return pick("trial", sub.trialEndsAt ?? sub.renewsAt);
    case "active":
      return sub.provider === "manual" ? pick("ends", sub.endsAt) : pick("renews", sub.renewsAt);
    case "cancelled":
      return pick("ends", sub.endsAt);
    case "past_due": {
      const since = sub.pastDueSince ?? sub.renewsAt;
      return pick("grace", since ? new Date(since.getTime() + graceDays * DAY) : null);
    }
    default:
      return { kind: "none", days: 0, at: null };
  }
}

/** Urgency bucket for colour-coding in the admin. */
export function urgency(r: Remaining): "expired" | "critical" | "soon" | "ok" {
  if (r.kind === "none") return "expired";
  if (r.kind === "renews") return "ok"; // auto-renewing card subscriptions aren't "ending"
  if (r.days <= 3) return "critical";
  if (r.days <= 7) return "soon";
  return "ok";
}

/** Add calendar months safely (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Normalise a Lemon Squeezy status string into our enum. */
export function normaliseLsStatus(status: string): SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(status) ? (status as SubscriptionStatus) : "expired";
}
