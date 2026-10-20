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
  /** Front-desk memberships may be granted with a future start date. */
  startsAt?: Date | null;
  /** Created by the payment simulator or a Lemon Squeezy test-mode checkout. */
  testMode?: boolean;
};

export type AccessOptions = {
  /** When false, test-mode memberships never grant access (live mode). Default true. */
  allowTestMode?: boolean;
};

const DAY = 86_400_000;

/**
 * Whether the membership is valid today, ignoring a future start date.
 * Shared by `hasActiveMembership` (which also requires the start date to have passed)
 * and `membershipRemaining` (which shows "starts in N days" for upcoming ones).
 */
function validIgnoringStart(sub: MembershipLike, now: Date, graceDays: number, opts: AccessOptions): boolean {
  if (sub.testMode && opts.allowTestMode === false) return false;
  switch (sub.status) {
    case "active":
    case "on_trial":
      // Manual (pay-at-desk) memberships carry a hard end date.
      if (sub.provider === "manual") return sub.endsAt ? now < sub.endsAt : true;
      // Card subscriptions: if the renewal date passed (plus grace) and no webhook moved
      // the row on, treat it as lapsed instead of trusting a stale "active" forever.
      if (sub.renewsAt && now.getTime() >= sub.renewsAt.getTime() + graceDays * DAY) return false;
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

const notStartedYet = (sub: MembershipLike, now: Date) => Boolean(sub.startsAt && now < sub.startsAt);

export function hasActiveMembership(sub: MembershipLike | null | undefined, now: Date, graceDays: number, opts: AccessOptions = {}): boolean {
  if (!sub) return false;
  if (notStartedYet(sub, now)) return false;
  return validIgnoringStart(sub, now, graceDays, opts);
}

export type RemainingKind = "starts" | "renews" | "ends" | "trial" | "grace" | "none";

export type Remaining = {
  kind: RemainingKind;
  /** Whole days left, rounded up. 0 when none/expired. */
  days: number;
  /** The date the countdown targets. */
  at: Date | null;
};

/** What the admin dashboard shows as "days left" for a membership. */
export function membershipRemaining(sub: MembershipLike, now: Date, graceDays: number, opts: AccessOptions = {}): Remaining {
  const toDays = (at: Date) => Math.max(0, Math.ceil((at.getTime() - now.getTime()) / DAY));
  const pick = (kind: RemainingKind, at: Date | null | undefined): Remaining =>
    at ? { kind, days: toDays(at), at } : { kind: "none", days: 0, at: null };

  if (!validIgnoringStart(sub, now, graceDays, opts)) return { kind: "none", days: 0, at: sub.endsAt ?? null };
  if (notStartedYet(sub, now)) return pick("starts", sub.startsAt);

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
  if (r.kind === "renews" || r.kind === "starts") return "ok"; // not "ending"
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
