import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth/password";

/**
 * Two demo accounts with fixed membership numbers (far above real ones):
 *   GG-99001  test member   — password TEST_MEMBER_PASSWORD
 *   GG-99002  guest admin   — password GUEST_ADMIN_PASSWORD; sees every admin page, changes nothing
 * No "server-only" import: the seed (run with tsx) uses this too.
 */
export const TEST_MEMBER_NUMBER = 99001;
export const GUEST_ADMIN_NUMBER = 99002;

export async function ensureDemoAccounts(
  db: PrismaClient,
  o: { memberEmail?: string; memberPassword?: string; guestPassword?: string },
): Promise<void> {
  if (o.memberEmail && o.memberPassword) {
    const passwordHash = await hashPassword(o.memberPassword);
    await db.user.upsert({
      where: { email: o.memberEmail },
      update: { isTestAccount: true, role: "MEMBER", memberNumber: TEST_MEMBER_NUMBER, passwordHash },
      create: { email: o.memberEmail, name: "Test Member", role: "MEMBER", isTestAccount: true, memberNumber: TEST_MEMBER_NUMBER, passwordHash },
    });
  }
  if (o.guestPassword) {
    const passwordHash = await hashPassword(o.guestPassword);
    await db.user.upsert({
      where: { memberNumber: GUEST_ADMIN_NUMBER },
      update: { role: "ADMIN", isGuest: true, isTestAccount: false, passwordHash, mustChangePassword: false },
      create: { name: "Guest Admin", role: "ADMIN", isGuest: true, memberNumber: GUEST_ADMIN_NUMBER, passwordHash },
    });
  }
}
