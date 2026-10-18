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
import { env, googleEnabled, testAccountsEnabled } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isTestAccount: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    isTestAccount?: boolean;
  }
}

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
          { email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD, role: "ADMIN" as const, name: "Test Admin" },
        ];
        const match = pairs.find((p) => p.email && p.password && p.email === email && safeEqual(p.password, password));
        if (!match || !match.email) return null;

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
    async jwt({ token, user }) {
      const uid = user?.id ?? token.uid ?? token.sub;
      if (uid) {
        // Refresh role on every token evaluation so role changes / revocations apply quickly.
        const dbUser = await db.user.findUnique({ where: { id: uid }, select: { id: true, role: true, isTestAccount: true } });
        if (!dbUser) return { ...token, uid: undefined, role: undefined };
        // A test-account session must die the moment test mode is switched off.
        if (dbUser.isTestAccount && !testAccountsEnabled) return { ...token, uid: undefined, role: undefined };
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.isTestAccount = dbUser.isTestAccount;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && token.role) {
        session.user.id = token.uid;
        session.user.role = token.role;
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
