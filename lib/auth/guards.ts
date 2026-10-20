import "server-only";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  role: Role;
  email: string | null;
  name: string | null;
  image: string | null;
  isTestAccount: boolean;
  memberNumber: number;
  mustChangePassword: boolean;
  /** View-only guest admin: may open admin pages, may not change anything. */
  isGuest: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.role) return null;
  return {
    id: u.id,
    role: u.role,
    email: u.email ?? null,
    name: u.name ?? null,
    image: u.image ?? null,
    isTestAccount: Boolean(u.isTestAccount),
    memberNumber: u.memberNumber,
    mustChangePassword: Boolean(u.mustChangePassword),
    isGuest: Boolean(u.isGuest),
  };
}

export function signInPath(locale: string, callbackPath: string) {
  return `/${locale}/signin?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

/** For pages/layouts: redirect to sign-in (and back) when signed out. */
export async function requireUser(locale: string, callbackPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(signInPath(locale, callbackPath));
  return user;
}

const RANK: Record<Role, number> = { MEMBER: 0, STAFF: 1, ADMIN: 2 };

export function hasRole(user: Pick<SessionUser, "role"> | null, min: Role) {
  return Boolean(user && RANK[user.role] >= RANK[min]);
}

/** For pages/layouts: requires at least `min` role, otherwise 404-ish redirect home. */
export async function requireRole(locale: string, min: Role, callbackPath: string): Promise<SessionUser> {
  const user = await requireUser(locale, callbackPath);
  if (!hasRole(user, min)) redirect(`/${locale}`);
  return user;
}

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN" | "READ_ONLY") {
    super(code);
  }
}

/**
 * For server actions / route handlers: throws instead of redirecting.
 * Every admin change and the CSV export go through here, so the view-only guest admin is
 * stopped in one place.
 */
export async function assertRole(min: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  if (!hasRole(user, min)) throw new AuthError("FORBIDDEN");
  if (user.isGuest) throw new AuthError("READ_ONLY");
  return user;
}

/** For member-side actions (orders, memberships, profile): the guest admin can't use them. */
export async function getActingUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && !user.isGuest ? user : null;
}
