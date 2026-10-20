import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { env, googleEnabled, testAccountsEnabled, testAdminEnabled } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isTestAccount: boolean;
    } & DefaultSession["user"];
  }
}

// No `declare module "next-auth/jwt"` augmentation: it doesn't resolve in next-auth v5 beta
// (TS2664). Custom token fields are narrowed explicitly in the callbacks below instead.
const tokenString = (v: unknown) => (typeof v === "string" ? v : undefined);
const ROLES: readonly Role[] = ["MEMBER", "STAFF", "ADMIN"];
const tokenRole = (v: unknown) => (ROLES.includes(v as Role) ? (v as Role) : undefined);

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers: Provider[] = [];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // Members created at the front desk (or by the seed) have a User row but no linked
      // Google account. Without this, Auth.js refuses their first Google sign-in with
      // OAuthAccountNotLinked. Safe here because Google verifies email ownership.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

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

        // Refuse if the test email belongs to a real account (one that signs in with Google):
        // the upsert below would flag it as a test account and lock it out at go-live.
        const existing = await db.user.findUnique({ where: { email: match.email }, select: { isTestAccount: true, _count: { select: { accounts: true } } } });
        if (existing && !existing.isTestAccount && existing._count.accounts > 0) {
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
  adapter: PrismaAdapter(db),
  // Credentials requires JWT sessions.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  secret: env.AUTH_SECRET,
  trustHost: true,
  providers,
  pages: { signIn: "/ar/signin", error: "/ar/signin" },
  callbacks: {
    async signIn({ user, account }) {
      // With email linking on, a Google identity using a TEST_*_EMAIL address would take
      // over the test-account row (and its role). Test accounts sign in with credentials only.
      if (account?.provider === "google" && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email }, select: { isTestAccount: true } });
        if (existing?.isTestAccount) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      const uid = user?.id ?? tokenString(token.uid) ?? token.sub;
      if (uid) {
        // Refresh role on every token evaluation so role changes / revocations apply quickly.
        const dbUser = await db.user.findUnique({ where: { id: uid }, select: { id: true, role: true, isTestAccount: true } });
        if (!dbUser) return { ...token, uid: undefined, role: undefined };
        // A test-account session must die the moment test mode is switched off.
        if (dbUser.isTestAccount && !testAccountsEnabled) return { ...token, uid: undefined, role: undefined };
        // …and a test account with staff/admin rights must die wherever the test admin login
        // isn't allowed (production), including sessions issued before that rule existed.
        if (dbUser.isTestAccount && dbUser.role !== "MEMBER" && !testAdminEnabled) return { ...token, uid: undefined, role: undefined };
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.isTestAccount = dbUser.isTestAccount;
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
