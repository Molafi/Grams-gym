import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { parseMemberNumber } from "@/lib/member-number";
import { hasContactInfo, referralError, type ReferralError } from "@/lib/referral";
import { isMembershipActive, remainingFor } from "@/features/billing/membership";

/**
 * Free membership days.
 *
 *  • Bonus days are stored on the membership (`Subscription.bonusDays`) and push its end
 *    date later (lib/membership.ts). Webhooks never touch that column, so it works for
 *    front-desk and card memberships alike.
 *  • Days earned while a member has no membership wait on `User.pendingBonusDays` and are
 *    moved onto their next membership as soon as it exists (`onMembershipChanged`).
 *
 * Rewards:
 *  • CONTACT_BONUS_DAYS (default 1) — once, when both an email and a phone are on file.
 *  • REFERRAL_BONUS_DAYS (default 7) — to the inviter, once per invited member, when that
 *    member has a membership (so fake sign-ups earn nothing).
 *
 * Every one-time reward is claimed (a timestamp set only if still empty) and paid in the
 * same transaction: a double click or a repeated webhook can't pay twice, and a failure
 * can't leave a reward claimed but unpaid.
 */

type Tx = Prisma.TransactionClient;
type Placed = { subscriptionId: string } | { pending: true };
export type BonusReason = "contact" | "referral" | "staff";

/** The membership bonus days should go on: the active one, else one starting later. */
async function currentOrUpcoming(tx: Tx, userId: string) {
  const subs = await tx.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
  const now = new Date();
  return subs.find((s) => isMembershipActive(s, now)) ?? subs.find((s) => remainingFor(s, now).kind === "starts") ?? null;
}

/** Put the days on the current membership, or save them on the member for the next one. */
async function placeBonus(tx: Tx, userId: string, days: number): Promise<Placed> {
  const sub = await currentOrUpcoming(tx, userId);
  if (sub) {
    await tx.subscription.update({ where: { id: sub.id }, data: { bonusDays: { increment: days } } });
    return { subscriptionId: sub.id };
  }
  await tx.user.update({ where: { id: userId }, data: { pendingBonusDays: { increment: days } } });
  return { pending: true };
}

async function auditPlaced(placed: Placed, userId: string, days: number, reason: BonusReason | "pending", meta: Record<string, string | number>, actorId: string | null) {
  if ("subscriptionId" in placed) await audit(actorId, "membership.bonus", "Subscription", placed.subscriptionId, { days, reason, userId, ...meta });
  else await audit(actorId, "user.bonus_pending", "User", userId, { days, reason, ...meta });
}

/** Give a member free days: on their current membership, or saved for the next one. */
export async function awardBonusDays(userId: string, days: number, reason: BonusReason, meta: Record<string, string | number> = {}, actorId: string | null = null) {
  if (!Number.isInteger(days) || days <= 0) return;
  const placed = await db.$transaction((tx) => placeBonus(tx, userId, days));
  await auditPlaced(placed, userId, days, reason, meta, actorId);
  // A membership may have been created while we looked: don't leave the days waiting.
  if ("pending" in placed) await applyPendingBonus(userId);
}

/** Move days saved on the member onto their (new) membership. */
async function applyPendingBonus(userId: string) {
  const moved = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { pendingBonusDays: true } });
    const days = user?.pendingBonusDays ?? 0;
    if (days <= 0) return null;
    const sub = await currentOrUpcoming(tx, userId);
    if (!sub) return null;
    // Only if nobody moved them in the meantime (double webhook, two staff members…).
    const claimed = await tx.user.updateMany({ where: { id: userId, pendingBonusDays: days }, data: { pendingBonusDays: 0 } });
    if (claimed.count !== 1) return null;
    await tx.subscription.update({ where: { id: sub.id }, data: { bonusDays: { increment: days } } });
    return { subscriptionId: sub.id, days };
  });
  if (moved) await audit(null, "membership.bonus", "Subscription", moved.subscriptionId, { days: moved.days, reason: "pending", userId });
}

/** Reward the inviter once, as soon as the invited member has a membership. */
async function rewardReferrer(userId: string) {
  const days = env.REFERRAL_BONUS_DAYS;
  if (days <= 0) return; // reward switched off: leave it unclaimed so it can pay later
  const result = await db.$transaction(async (tx) => {
    const me = await tx.user.findUnique({ where: { id: userId }, select: { referredById: true, referralRewardedAt: true, memberNumber: true } });
    if (!me?.referredById || me.referralRewardedAt) return null;
    if (!(await currentOrUpcoming(tx, userId))) return null;
    const claimed = await tx.user.updateMany({ where: { id: userId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
    if (claimed.count !== 1) return null;
    return { referrerId: me.referredById, invited: me.memberNumber, placed: await placeBonus(tx, me.referredById, days) };
  });
  if (!result) return;
  await auditPlaced(result.placed, result.referrerId, days, "referral", { invited: result.invited }, null);
  if ("pending" in result.placed) await applyPendingBonus(result.referrerId);
}

/**
 * Call after a membership is created or extended for a member (front desk, card webhook).
 * Never throws: a reward problem must not undo a payment or a grant.
 */
export async function onMembershipChanged(userId: string) {
  try {
    await applyPendingBonus(userId);
    await rewardReferrer(userId);
  } catch (e) {
    console.error("[rewards] after membership change", e);
  }
}

/** The one-time "email + phone" bonus. Returns the days given (0 if not eligible / already given). */
export async function giveContactBonus(userId: string): Promise<number> {
  const days = env.CONTACT_BONUS_DAYS;
  if (days <= 0) return 0;
  const placed = await db.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, contactBonusAt: true, isGuest: true } });
    if (!u || u.isGuest || u.contactBonusAt || !hasContactInfo(u)) return null;
    // Set once: removing and re-adding an email later doesn't pay out again.
    const claimed = await tx.user.updateMany({ where: { id: userId, contactBonusAt: null }, data: { contactBonusAt: new Date() } });
    if (claimed.count !== 1) return null;
    return placeBonus(tx, userId, days);
  });
  if (!placed) return 0;
  await auditPlaced(placed, userId, days, "contact", {}, null);
  if ("pending" in placed) await applyPendingBonus(userId);
  return days;
}

/** Find the inviter by membership number (without linking). Used to validate sign-up forms. */
export async function findReferrer(input: string) {
  const n = parseMemberNumber(input);
  if (!n) return null;
  return db.user.findUnique({
    where: { memberNumber: n },
    select: { id: true, referredById: true, isGuest: true, isTestAccount: true, memberNumber: true, name: true },
  });
}

/** Record who invited this member. Returns an error code, or null when linked. */
export async function linkReferral(userId: string, input: string): Promise<ReferralError | null> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, createdAt: true, referredById: true, importedAt: true, isTestAccount: true },
  });
  if (!me) return "notFound";
  const referrer = await findReferrer(input);
  const error = referralError({ me, referrer, now: new Date() });
  if (error || !referrer) return error ?? "notFound";
  const linked = await db.user.updateMany({ where: { id: userId, referredById: null }, data: { referredById: referrer.id, referredAt: new Date() } });
  if (linked.count !== 1) return "already";
  await audit(userId, "user.referral", "User", userId, { referrer: referrer.memberNumber });
  // Already has a membership (e.g. joined at the desk first)? Reward right away.
  await onMembershipChanged(userId);
  return null;
}
