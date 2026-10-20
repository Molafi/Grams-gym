import "server-only";
import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { env, guestAdminEnabled, testAccountsEnabled, testAdminEnabled } from "@/lib/env";
import { parseMemberNumber } from "@/lib/member-number";
import { clientIp, hit, isLimited } from "@/lib/rate-limit";
import { verifyPassword } from "./password";
import { dbKnownDown, isDbUnavailable, markDbDown } from "@/lib/db-status";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isTestAccount: boolean;
      memberNumber: number;
      mustChangePassword: boolean;
      isGuest: boolean;
    } & DefaultSession["user"];
  }
}

// No `declare module "next-auth/jwt"` augmentation: it doesn't resolve in next-auth v5 beta
// (TS2664). Custom token fields are narrowed explicitly in the callbacks below instead.
const tokenString = (v: unknown) => (typeof v === "string" ? v : undefined);
const ROLES: readonly Role[] = ["MEMBER", "STAFF", "ADMIN"];
const tokenRole = (v: unknown) => (ROLES.includes(v as Role) ? (v as Role) : undefined);
const tokenNumber = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : undefined);

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Surfaced to the sign-in form as "too many attempts" (Auth.js passes `code` through). */
export class SignInRateLimited extends CredentialsSignin {
  code = "rate";
}

// Failed attempts only. Per number+IP so nobody can lock someone else out from their own
// connection; a much higher per-number ceiling stops distributed guessing.
const FAIL_WINDOW = 15 * 60_000;
const FAILS_PER_IP = 8;
const FAILS_PER_NUMBER = 100;

const memberSchema = z.object({
  memberNumber: z.string().min(1).max(20),
  password: z.string().min(1).max(200),
});

const providers: Provider[] = [
  // Members, staff and admins all sign in with their membership number + password.
  Credentials({
    id: "member",
    name: "Membership number",
    credentials: { memberNumber: {}, password: {} },
    async authorize(raw) {
      const parsed = memberSchema.safeParse(raw);
      if (!parsed.success) return null;
      const number = parseMemberNumber(parsed.data.memberNumber);
      if (!number) return null;
      const ip = await clientIp().catch(() => "unknown");
      const ipKey = `signin-fail:${number}:${ip}`;
      const numberKey = `signin-fail:${number}`;
      if (isLimited(ipKey, FAILS_PER_IP) || isLimited(numberKey, FAILS_PER_NUMBER)) throw new SignInRateLimited();

      const user = await db.user.findUnique({
        where: { memberNumber: number },
        select: { id: true, email: true, name: true, image: true, passwordHash: true, isTestAccount: true, isGuest: true, deletionRequestedAt: true },
      });
      // Always run the hash check, even for unknown numbers, so timing doesn't reveal which exist.
      const ok = await verifyPassword(parsed.data.password, user?.passwordHash);
      if (!user || !ok) {
        hit(ipKey, FAILS_PER_IP, FAIL_WINDOW);
        hit(numberKey, FAILS_PER_NUMBER, FAIL_WINDOW);
        return null;
      }
      // Demo accounts only work while they're switched on (see lib/env.ts).
      if (user.isTestAccount && !testAccountsEnabled) return null;
      if (user.isGuest && !guestAdminEnabled) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (testAccountsEnabled) {
  providers.push(
    Credentials({
      id: "test-account",
      name: "Test account",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        // Re-check at call time — never trust that the provider list is current.
        if (!testAccountsEnabled) return null;
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const pairs = [
          { email: env.TEST_MEMBER_EMAIL, password: env.TEST_MEMBER_PASSWORD, role: "MEMBER" as const, name: "Test Member" },
          // Never in production (see testAdminEnabled).
          ...(testAdminEnabled ? [{ email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD, role: "ADMIN" as const, name: "Test Admin" }] : []),
        ];
        const match = pairs.find((p) => p.email && p.password && p.email === email && safeEqual(p.password, password));
        if (!match || !match.email) return null;

        // Refuse if the test email belongs to a real account (one with a password):
        // the upsert below would flag it as a test account and lock it out at go-live.
        const existing = await db.user.findUnique({ where: { email: match.email }, select: { isTestAccount: true, passwordHash: true } });
        if (existing && !existing.isTestAccount && existing.passwordHash) {
          console.error(`[auth] ${match.email} is a real account; refusing to use it as a test account`);
          return null;
        }

        const user = await db.user.upsert({
          where: { email: match.email },
          update: { isTestAccount: true, role: match.role },
          create: { email: match.email, name: match.name, role: match.role, isTestAccount: true },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials-only, so no database adapter: sessions are JWTs re-checked against the DB below.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  secret: env.AUTH_SECRET,
  trustHost: true,
  providers,
  pages: { signIn: "/ar/signin", error: "/ar/signin" },
  callbacks: {
    async jwt({ token, user }) {
      const uid = user?.id ?? tokenString(token.uid) ?? token.sub;
      if (uid) {
        const signedOut = { ...token, uid: undefined, role: undefined };
        // Database unreachable: keep the session as it was instead of making every page wait
        // for a connection timeout. (Nothing that needs the database works meanwhile anyway.)
        // The on/off switches for demo accounts are still enforced from the token.
        const offline = () => {
          if (token.isTestAccount && !testAccountsEnabled) return signedOut;
          if (token.isTestAccount && token.role !== "MEMBER" && !testAdminEnabled) return signedOut;
          if (token.isGuest && !guestAdminEnabled) return signedOut;
          return token;
        };
        if (!user && dbKnownDown()) return offline();
        // Refresh role on every token evaluation so role changes / revocations apply quickly.
        let dbUser;
        try {
          dbUser = await db.user.findUnique({ where: { id: uid }, select: { id: true, role: true, isTestAccount: true, isGuest: true, memberNumber: true, mustChangePassword: true, name: true, email: true, sessionVersion: true } });
        } catch (e) {
          if (user || !isDbUnavailable(e)) throw e;
          markDbDown("session check");
          return offline();
        }
        if (!dbUser) return { ...token, uid: undefined, role: undefined };
        // Password changed or reset since this session was issued → sign it out.
        if (user) token.sv = dbUser.sessionVersion;
        else if ((tokenNumber(token.sv) ?? 0) !== dbUser.sessionVersion) return { ...token, uid: undefined, role: undefined };
        // A test-account session must die the moment test mode is switched off.
        if (dbUser.isTestAccount && !testAccountsEnabled) return { ...token, uid: undefined, role: undefined };
        // …and a test account with staff/admin rights must die wherever the test admin login
        // isn't allowed (production), including sessions issued before that rule existed.
        if (dbUser.isTestAccount && dbUser.role !== "MEMBER" && !testAdminEnabled) return { ...token, uid: undefined, role: undefined };
        // The guest admin is signed out as soon as it's switched off.
        if (dbUser.isGuest && !guestAdminEnabled) return { ...token, uid: undefined, role: undefined };
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.isTestAccount = dbUser.isTestAccount;
        token.memberNumber = dbUser.memberNumber;
        token.mustChangePassword = dbUser.mustChangePassword;
        token.isGuest = dbUser.isGuest;
        token.name = dbUser.name;
        token.email = dbUser.email;
      }
      return token;
    },
    async session({ session, token }) {
      const uid = tokenString(token.uid);
      const role = tokenRole(token.role);
      if (uid && role) {
        session.user.id = uid;
        session.user.role = role;
        session.user.isTestAccount = Boolean(token.isTestAccount);
        session.user.memberNumber = tokenNumber(token.memberNumber) ?? 0;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.isGuest = Boolean(token.isGuest);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Only same-origin redirects (prevents open redirects through callbackUrl).
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        /* ignore */
      }
      return baseUrl;
    },
  },
});
