/**
 * First sign-in for members imported from the old gym program: until they choose their own
 * password, their membership number is their password (lib/auth/auth.ts), and the account
 * page makes them choose a new one before anything else (app/[locale]/account/layout.tsx).
 *
 * Staff and admins never get this: they always need a real password.
 * Pure functions (no database) so they are unit-tested.
 */

export type DefaultPasswordCandidate = {
  passwordHash: string | null;
  importedAt: Date | null;
  role: string;
  isTestAccount: boolean;
  isGuest: boolean;
};

/** An imported member who hasn't set a password yet. */
export function canUseDefaultPassword(u: DefaultPasswordCandidate): boolean {
  return !u.passwordHash && u.importedAt !== null && u.role === "MEMBER" && !u.isTestAccount && !u.isGuest;
}

/** Arabic-Indic and Persian digits → 0-9 (phone keyboards may type them). */
const latinDigits = (s: string) => s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10));

/** The membership number typed as the password: "04529" or "4529" both work for 4529. */
export function isDefaultPassword(input: string, memberNumber: number): boolean {
  const digits = latinDigits(input.trim());
  return /^\d{1,9}$/.test(digits) && Number(digits) === memberNumber;
}
