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
import { env, testAccountsEnabled, testAdminEnabled } from "@/lib/env";
import { audit } from "@/lib/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { phoneDigits } from "@/lib/phone";

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
  error?: "credentials" | "rate" | "invalid" | "mismatch" | "phoneTaken" | "emailTaken" | "weak" | "current" | "generic";
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

/** Sign in with membership number + password. */
export async function signInWithMemberNumber(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  if (await limited("signin", 20, 60_000)) return { error: "rate" };
  const memberNumber = String(formData.get("memberNumber") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!memberNumber.trim() || !password) return { error: "invalid" };
  try {
    await signIn("member", { memberNumber, password, redirectTo: safeCallback(formData.get("callbackUrl"), locale) });
  } catch (e) {
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
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

/** Self-service account creation. The new membership number is shown on the account page. */
export async function registerMember(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  if (await limited("register", 5, 60 * 60_000)) return { error: "rate" };
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path[0]);
    return { error: paths.includes("confirm") ? "mismatch" : paths.includes("password") ? "weak" : "invalid" };
  }
  const input = parsed.data;

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
  } catch (e) {
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

  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { passwordHash: true, isTestAccount: true, memberNumber: true } });
  if (user.isTestAccount) return { error: "generic" };
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

  const fallback = kind === "admin" ? `/${locale}/admin` : `/${locale}/account`;
  const raw = formData.get("callbackUrl");
  const redirectTo = typeof raw === "string" && raw ? safeCallback(raw, locale) : fallback;

  try {
    await signIn("test-account", { email, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/signin?error=credentials`);
    throw e; // NEXT_REDIRECT must propagate
  }
}

export async function signOutAction(formData: FormData) {
  const locale = localeOf(formData);
  await signOut({ redirectTo: `/${locale}` });
}
