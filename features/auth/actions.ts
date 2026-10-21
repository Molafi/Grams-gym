"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth/auth";
import { getSessionUser } from "@/lib/auth/guards";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { env, guestAdminEnabled, guestAdminPassword, testAccountsEnabled, testAdminEnabled } from "@/lib/env";
import { ensureDemoAccounts, GUEST_ADMIN_NUMBER } from "@/lib/demo-accounts";
import { audit } from "@/lib/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { dbKnownDown, isDbUnavailable, markDbDown } from "@/lib/db-status";
import { phoneDigits } from "@/lib/phone";
import { findReferrer, giveContactBonus, linkReferral } from "@/lib/rewards";

function safeCallback(raw: FormDataEntryValue | null, locale: string) {
  const v = typeof raw === "string" ? raw : "";
  // Same-origin relative paths only.
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  return `/${locale}/account`;
}

function localeOf(formData: FormData) {
  return formData.get("locale") === "en" ? "en" : "ar";
}

export type AuthFormState = {
  error?: "credentials" | "rate" | "invalid" | "mismatch" | "phoneTaken" | "emailTaken" | "weak" | "current" | "generic" | "db" | "referrer";
  ok?: boolean;
};

async function limited(scope: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    await enforceRateLimit(scope, limit, windowMs);
    return false;
  } catch (e) {
    if (e instanceof RateLimitError) return true;
    throw e;
  }
}

/** "Database down" → a clear message instead of a crash or a misleading "wrong password". */
function dbDown(e: unknown, where: string): boolean {
  if (!isDbUnavailable(e)) return false;
  markDbDown(where);
  return true;
}

/** Sign in with membership number + password. */
export async function signInWithMemberNumber(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  if (dbKnownDown()) return { error: "db" };
  if (await limited("signin", 20, 60_000)) return { error: "rate" };
  const memberNumber = String(formData.get("memberNumber") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!memberNumber.trim() || !password) return { error: "invalid" };
  try {
    await signIn("member", { memberNumber, password, redirectTo: safeCallback(formData.get("callbackUrl"), locale) });
  } catch (e) {
    if (dbDown(e, "sign-in")) return { error: "db" };
    if (e instanceof AuthError) return { error: (e as { code?: string }).code === "rate" ? "rate" : "credentials" };
    throw e; // NEXT_REDIRECT must propagate
  }
  return {};
}

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/),
    email: z.string().trim().toLowerCase().email().max(120).optional(),
    password: z.string().min(PASSWORD_MIN).max(200),
    confirm: z.string(),
    /** Membership number of the friend who invited them (optional). */
    referrer: z.string().trim().max(20).optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

/** Self-service account creation. The new membership number is shown on the account page. */
export async function registerMember(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  if (dbKnownDown()) return { error: "db" };
  if (await limited("register", 5, 60 * 60_000)) return { error: "rate" };
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    referrer: formData.get("referrer") || undefined,
  });
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path[0]);
    return { error: paths.includes("confirm") ? "mismatch" : paths.includes("password") ? "weak" : paths.includes("referrer") ? "referrer" : "invalid" };
  }
  const input = parsed.data;

  // Check the inviter's number before creating the account, so a typo can be fixed.
  if (input.referrer) {
    try {
      const referrer = await findReferrer(input.referrer);
      if (!referrer || referrer.isGuest || referrer.isTestAccount) return { error: "referrer" };
    } catch (e) {
      if (dbDown(e, "registration")) return { error: "db" };
      throw e;
    }
  }

  // One account per phone (phoneDigits is unique). If the gym already registered this phone
  // at the desk, the member collects their number there: letting anyone "claim" an account
  // by phone would let them take over someone else's membership.
  let number: number;
  try {
    const user = await db.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        phoneDigits: phoneDigits(input.phone),
        email: input.email ?? null,
        locale,
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true, memberNumber: true },
    });
    number = user.memberNumber;
    await audit(user.id, "user.register", "User", user.id);
    // Rewards are extras: a problem here must never block the sign-up itself.
    if (input.referrer) {
      await linkReferral(user.id, input.referrer).catch((err) => console.error("[rewards] referral at registration", err));
    }
    // Phone is required; the bonus applies when an email was given too.
    await giveContactBonus(user.id).catch((err) => console.error("[rewards] contact bonus at registration", err));
  } catch (e) {
    if (dbDown(e, "registration")) return { error: "db" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
      return { error: target.includes("phone") ? "phoneTaken" : "emailTaken" };
    }
    throw e;
  }

  try {
    // Back to where they were going (e.g. joining a plan), otherwise the welcome card with their number.
    const raw = formData.get("callbackUrl");
    const redirectTo = typeof raw === "string" && raw ? safeCallback(raw, locale) : `/${locale}/account?welcome=1`;
    await signIn("member", { memberNumber: String(number), password: input.password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) return { error: "generic" };
    throw e;
  }
  return {};
}

const changeSchema = z
  .object({ current: z.string().optional(), password: z.string().min(PASSWORD_MIN).max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

export async function changePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const session = await getSessionUser();
  if (!session) return { error: "generic" };
  if (await limited("change-password", 10, 15 * 60_000)) return { error: "rate" };
  const parsed = changeSchema.safeParse({
    current: formData.get("current") || undefined,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "confirm") ? "mismatch" : "weak" };

  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { passwordHash: true, isTestAccount: true, isGuest: true, memberNumber: true } });
  if (user.isTestAccount || user.isGuest) return { error: "generic" }; // shared demo logins keep their password
  // The current password is always required (a temporary one counts).
  if (!(await verifyPassword(parsed.data.current ?? "", user.passwordHash))) return { error: "current" };

  // Bumping sessionVersion signs out every other device; this one signs straight back in.
  await db.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  await audit(session.id, "user.password_changed", "User", session.id);
  try {
    await signIn("member", { memberNumber: String(user.memberNumber), password: parsed.data.password, redirect: false });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e; // worst case they sign in again with the new password
  }
  revalidatePath(`/${localeOf(formData)}/account`, "layout");
  return { ok: true };
}

/** One-click test login. Passwords never leave the server. */
export async function signInAsTestAccount(formData: FormData) {
  const locale = localeOf(formData);
  if (!testAccountsEnabled) redirect(`/${locale}/signin`);
  if (await limited("signin", 20, 60_000)) redirect(`/${locale}/signin?error=rate`);
  const kind = formData.get("kind") === "admin" ? "admin" : "member";
  if (kind === "admin" && !testAdminEnabled) redirect(`/${locale}/signin?error=testConfig`);
  const email = kind === "admin" ? env.TEST_ADMIN_EMAIL : env.TEST_MEMBER_EMAIL;
  const password = kind === "admin" ? env.TEST_ADMIN_PASSWORD : env.TEST_MEMBER_PASSWORD;
  if (!email || !password) redirect(`/${locale}/signin?error=testConfig`);

  if (dbKnownDown()) redirect(`/${locale}/signin?error=db`);
  // Keeps GG-99001 (test member) usable with the normal number + password form too.
  if (kind === "member") {
    try {
      await ensureDemoAccounts(db, { memberEmail: email, memberPassword: password });
    } catch (e) {
      if (dbDown(e, "test sign-in")) redirect(`/${locale}/signin?error=db`);
      throw e;
    }
  }

  const fallback = kind === "admin" ? `/${locale}/admin` : `/${locale}/account`;
  const raw = formData.get("callbackUrl");
  const redirectTo = typeof raw === "string" && raw ? safeCallback(raw, locale) : fallback;

  try {
    await signIn("test-account", { email, password, redirectTo });
  } catch (e) {
    if (dbDown(e, "test sign-in")) redirect(`/${locale}/signin?error=db`);
    if (e instanceof AuthError) redirect(`/${locale}/signin?error=credentials`);
    throw e; // NEXT_REDIRECT must propagate
  }
}

/** One-click view-only guest admin (local test mode only; in production it signs in with GG-99002 + password). */
export async function signInAsGuestAdmin(formData: FormData) {
  const locale = localeOf(formData);
  const password = guestAdminPassword;
  if (!guestAdminEnabled || !testAdminEnabled || !password) redirect(`/${locale}/signin`);
  if (await limited("signin", 20, 60_000)) redirect(`/${locale}/signin?error=rate`);
  if (dbKnownDown()) redirect(`/${locale}/signin?error=db`);
  try {
    await ensureDemoAccounts(db, { guestPassword: password });
    await signIn("member", { memberNumber: String(GUEST_ADMIN_NUMBER), password, redirectTo: `/${locale}/admin` });
  } catch (e) {
    if (dbDown(e, "guest sign-in")) redirect(`/${locale}/signin?error=db`);
    if (e instanceof AuthError) redirect(`/${locale}/signin?error=credentials`);
    throw e;
  }
}

export async function signOutAction(formData: FormData) {
  const locale = localeOf(formData);
  await signOut({ redirectTo: `/${locale}` });
}
