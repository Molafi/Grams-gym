/**
 * Membership numbers are stored as integers and shown with five digits, as in the old gym
 * program: 4529 → "04529".
 */
export function formatMemberNumber(n: number): string {
  return String(n).padStart(5, "0");
}

/** Accepts "04529", "4529" and the older "GG-04529" form. Returns null if it isn't a member number. */
export function parseMemberNumber(input: string): number | null {
  const m = /^\s*(?:gg[\s-]*)?0*(\d{1,9})\s*$/i.exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Numbers the website hands out itself (online sign-ups, staff accounts) start here, so they
 * never take a number the old gym program will give to its next member. The old program's
 * numbers stay below; 90000 and up are kept for special accounts (demo accounts are 99001/99002).
 */
export const SITE_NUMBER_START = 50000;
export const SITE_NUMBER_END = 89999;
