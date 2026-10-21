/**
 * Referral rules — pure functions (no DB) so they are easy to reason about and test.
 *
 * A member types the membership number of the friend who invited them. The inviter is
 * rewarded once, when the new member's first membership starts (lib/rewards.ts).
 */

/** How long after creating an account a member can still say who invited them. */
export const REFERRAL_WINDOW_DAYS = 30;

export type ReferralError = "notFound" | "self" | "already" | "tooLate" | "loop";

export type ReferralMember = {
  id: string;
  createdAt: Date;
  referredById: string | null;
  /** Members imported from the old program are existing customers, not new referrals. */
  importedAt?: Date | null;
  isTestAccount?: boolean;
};
export type ReferralTarget = { id: string; referredById: string | null; isGuest: boolean; isTestAccount?: boolean } | null;

/** Only genuinely new members can name an inviter: a fresh, non-imported, non-test account. */
export function canStillBeReferred(me: ReferralMember, now: Date, windowDays = REFERRAL_WINDOW_DAYS): boolean {
  if (me.referredById || me.importedAt || me.isTestAccount) return false;
  return now.getTime() - me.createdAt.getTime() <= windowDays * 86_400_000;
}

export function referralError(input: { me: ReferralMember; referrer: ReferralTarget; now: Date; windowDays?: number }): ReferralError | null {
  const { me, referrer, now } = input;
  const windowDays = input.windowDays ?? REFERRAL_WINDOW_DAYS;
  if (me.referredById) return "already";
  if (!referrer || referrer.isGuest || referrer.isTestAccount) return "notFound";
  if (referrer.id === me.id) return "self";
  // A invited B, so B can't also be A's inviter.
  if (referrer.referredById === me.id) return "loop";
  if (!canStillBeReferred(me, now, windowDays)) return "tooLate";
  return null;
}

/** Both an email and a phone number on file → the one-time contact bonus. */
export function hasContactInfo(u: { email: string | null; phone: string | null }): boolean {
  return Boolean(u.email?.trim() && u.phone?.trim());
}
