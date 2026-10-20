/** Membership numbers are stored as integers and shown as GG-00042. */
export function formatMemberNumber(n: number): string {
  return `GG-${String(n).padStart(5, "0")}`;
}

/** Accepts "GG-00042", "gg 42", "00042", "42". Returns null if it isn't a member number. */
export function parseMemberNumber(input: string): number | null {
  const m = /^\s*(?:gg[\s-]*)?0*(\d{1,9})\s*$/i.exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
