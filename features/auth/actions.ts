"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth/auth";
import { env, googleEnabled, testAccountsEnabled } from "@/lib/env";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

function safeCallback(raw: FormDataEntryValue | null, locale: string) {
  const v = typeof raw === "string" ? raw : "";
  // Same-origin relative paths only.
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  return `/${locale}/account`;
}

function localeOf(formData: FormData) {
  return formData.get("locale") === "en" ? "en" : "ar";
}

export async function signInWithGoogle(formData: FormData) {
  const locale = localeOf(formData);
  if (!googleEnabled) redirect(`/${locale}/signin?error=google`);
  try {
    await enforceRateLimit("signin", 20, 60_000);
  } catch (e) {
    if (e instanceof RateLimitError) redirect(`/${locale}/signin?error=rate`);
    throw e;
  }
  await signIn("google", { redirectTo: safeCallback(formData.get("callbackUrl"), locale) });
}

/** One-click test login. Passwords never leave the server. */
export async function signInAsTestAccount(formData: FormData) {
  const locale = localeOf(formData);
  if (!testAccountsEnabled) redirect(`/${locale}/signin`);
  try {
    await enforceRateLimit("signin", 20, 60_000);
  } catch (e) {
    if (e instanceof RateLimitError) redirect(`/${locale}/signin?error=rate`);
    throw e;
  }
  const kind = formData.get("kind") === "admin" ? "admin" : "member";
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
