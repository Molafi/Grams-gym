"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActingUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { phoneDigits } from "@/lib/phone";

export type ProfileState = { ok?: boolean; error?: boolean };

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+0-9 ()-]*$/)
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
  } catch {
    return { error: true }; // email or phone already used by another member
  }
  revalidatePath(`/${parsed.data.locale}/account/settings`);
  return { ok: true };
}

export async function requestDataDeletion(formData: FormData): Promise<void> {
  const user = await getActingUser();
  if (!user) return;
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } });
  await audit(user.id, "user.deletion_requested", "User", user.id);
  revalidatePath(`/${locale}/account/settings`);
}
