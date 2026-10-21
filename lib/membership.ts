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
  /** Free days added on top of the end date (referral / profile rewards). */
  bonusDays?: number | null;
};

export type AccessOptions = {
  /** When false, test-mode memberships never grant access (live mode). Default true. */
  allowTestMode?: boolean;
};

export const DAY = 86_400_000;

const bonusMs = (sub: MembershipLike) => Math.max(0, Math.trunc(sub.bonusDays ?? 0)) * DAY;

/** A date pushed later by the membership's bonus days. */
export function withBonus(sub: MembershipLike, at: Date | null | undefined): Date | null {
  if (!at) return null;
  return new Date(at.getTime() + bonusMs(sub));
}

/** The last moment of access for a membership with an end date, including bonus days. */
export function effectiveEndsAt(sub: MembershipLike): Date | null {
  return withBonus(sub, sub.endsAt);
}

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
      // Manual (pay-at-desk) memberships carry a hard end date (plus any bonus days).
      if (sub.provider === "manual") return sub.endsAt ? now < effectiveEndsAt(sub)! : true;
      // Card subscriptions: if the renewal date passed (plus grace) and no webhook moved
      // the row on, treat it as lapsed instead of trusting a stale "active" forever.
      if (sub.renewsAt && now.getTime() >= sub.renewsAt.getTime() + graceDays * DAY + bonusMs(sub)) return false;
      return true;
    case "cancelled":
      // Bonus days are used after the paid period ends.
      return sub.endsAt != null && now < effectiveEndsAt(sub)!;
    case "past_due": {
      const since = sub.pastDueSince ?? sub.renewsAt;
      if (!since) return false;
      return now.getTime() < since.getTime() + graceDays * DAY;
    }
    case "expired":
      // Lemon Squeezy marks a card membership "expired" when its paid period is over; any
      // bonus days it carries are used after that. Front-desk "expired" means cancelled by staff.
      return cardBonusEnd(sub) != null && now < cardBonusEnd(sub)!;
    case "paused":
    case "unpaid":
    default:
      return false;
  }
}

/** End of the bonus days on an expired card membership (null when there are none). */
function cardBonusEnd(sub: MembershipLike): Date | null {
  if (sub.provider !== "lemonsqueezy" || bonusMs(sub) === 0) return null;
  return withBonus(sub, sub.endsAt ?? sub.renewsAt);
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

  if (!validIgnoringStart(sub, now, graceDays, opts)) return { kind: "none", days: 0, at: effectiveEndsAt(sub) };
  if (notStartedYet(sub, now)) return pick("starts", sub.startsAt);

  switch (sub.status) {
    case "on_trial":
      return pick("trial", sub.trialEndsAt ?? sub.renewsAt);
    case "active":
      // A card subscription keeps renewing; its bonus days only show up once it's cancelled.
      return sub.provider === "manual" ? pick("ends", effectiveEndsAt(sub)) : pick("renews", sub.renewsAt);
    case "cancelled":
      return pick("ends", effectiveEndsAt(sub));
    case "expired":
      return pick("ends", cardBonusEnd(sub));
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

/**
 * Where an extension of a front-desk membership starts. While the paid period is still
 * running, it continues from the end date and the bonus days stay on top. Once the member
 * is in their bonus days (or has expired), it continues from the real last day and the
 * bonus is folded into the new end date, so no free day is counted twice.
 */
export function extensionBase(sub: MembershipLike, now: Date): { base: Date; foldBonus: boolean } {
  if (sub.endsAt && sub.endsAt > now) return { base: sub.endsAt, foldBonus: false };
  const end = effectiveEndsAt(sub);
  return { base: end && end > now ? end : now, foldBonus: true };
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
