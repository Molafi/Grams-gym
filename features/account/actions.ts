"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { phoneDigits } from "@/lib/phone";
import { isCoachKey } from "@/lib/coaches";
import { giveContactBonus, linkReferral } from "@/lib/rewards";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import type { ReferralError } from "@/lib/referral";

export type ProfileState = {
  ok?: boolean;
  error?: boolean | "phoneTaken" | "emailTaken";
  /** Free days just earned for completing email + phone. */
  bonusDays?: number;
};

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+0-9 ()-]{7,20}$/)
    .optional(),
  email: z.string().trim().toLowerCase().email().max(120).optional(),
  locale: z.enum(["ar", "en"]),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getActingUser();
  if (!user) return { error: true };
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: true };
  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        phoneDigits: parsed.data.phone ? phoneDigits(parsed.data.phone) : null,
        email: parsed.data.email ?? null,
        locale: parsed.data.locale,
      },
    });
  } catch (e) {
    // Email or phone already used by another member.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
      return { error: target.includes("phone") ? "phoneTaken" : "emailTaken" };
    }
    return { error: true };
  }
  const bonusDays = await giveContactBonus(user.id).catch((e) => {
    console.error("[rewards] contact bonus", e);
    return 0;
  });
  revalidatePath(`/${parsed.data.locale}/account`, "layout");
  return { ok: true, bonusDays };
}

export async function requestDataDeletion(formData: FormData): Promise<void> {
  const user = await getActingUser();
  if (!user) return;
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } });
  await audit(user.id, "user.deletion_requested", "User", user.id);
  revalidatePath(`/${locale}/account/settings`);
}

/** Pick (or clear, with an empty value) the member's personal-training coach. */
export async function chooseCoach(formData: FormData): Promise<void> {
  const user = await getActingUser();
  if (!user) return;
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const raw = formData.get("coach");
  const coach = isCoachKey(raw) ? raw : null;
  if (raw && !coach) return; // unknown coach key
  await db.user.update({ where: { id: user.id }, data: { ptCoach: coach, ptCoachSetAt: coach ? new Date() : null } });
  await audit(user.id, "user.coach", "User", user.id, { coach: coach ?? "none" });
  revalidatePath(`/${locale}/account/coach`);
}

export type ReferralState = { ok?: boolean; error?: ReferralError | "rate" | "invalid" };

/** "Who invited you?" — the member types their friend's membership number. */
export async function setReferrer(_prev: ReferralState, formData: FormData): Promise<ReferralState> {
  const user = await getActingUser();
  if (!user) return { error: "invalid" };
  try {
    // Stops anyone from trying number after number.
    await enforceRateLimit("referral", 10, 60 * 60_000, user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return { error: "rate" };
    throw e;
  }
  const input = String(formData.get("referrer") ?? "").trim();
  if (!input || input.length > 20) return { error: "invalid" };
  const error = await linkReferral(user.id, input);
  if (error) return { error };
  revalidatePath(`/${formData.get("locale") === "en" ? "en" : "ar"}/account`, "layout");
  return { ok: true };
}
