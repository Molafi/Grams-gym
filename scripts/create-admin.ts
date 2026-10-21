/**
 * Create (or promote) an admin and print their membership number + a temporary password.
 *
 *   npm run admin:create -- "Owner Name" 0791234567
 *
 * Uses DATABASE_URL from .env. If a user with that phone exists, they're promoted to ADMIN
 * and given a new temporary password. They must change it after signing in.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, temporaryPassword } from "../lib/auth/password";
import { formatMemberNumber } from "../lib/member-number";
import { phoneDigits } from "../lib/phone";
import { prismaUrl } from "../lib/db-url";

async function main() {
  const [name, phone] = process.argv.slice(2);
  if (!name || !phone || !/^[+0-9 ()-]{7,20}$/.test(phone)) {
    console.error('Usage: npm run admin:create -- "Full Name" 0791234567');
    process.exit(1);
  }
  // tsx doesn't read .env (Next.js and the Prisma CLI do), so load it for DATABASE_URL.
  try {
    process.loadEnvFile(".env");
  } catch {
    /* no .env file (or Node < 20.12): use the environment as it is */
  }
  const db = new PrismaClient({ datasourceUrl: prismaUrl() });
  try {
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const digits = phoneDigits(phone);
    const existing = await db.user.findUnique({ where: { phoneDigits: digits }, select: { id: true } });
    const user = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: { role: "ADMIN", passwordHash, mustChangePassword: true, isTestAccount: false, sessionVersion: { increment: 1 } },
        })
      : await db.user.create({ data: { name, phone, phoneDigits: digits, role: "ADMIN", passwordHash, mustChangePassword: true } });
    console.log(`\n  ${existing ? "Promoted" : "Created"} admin ${user.name ?? name}`);
    console.log(`  Membership number:  ${formatMemberNumber(user.memberNumber)}`);
    console.log(`  Temporary password: ${password}\n`);
    console.log("  Sign in at /ar/signin, then change the password in Account → Settings.\n");
  } finally {
    await db.$disconnect();
  }
}

void main();
