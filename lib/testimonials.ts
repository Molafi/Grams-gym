/**
 * Review rules — pure functions (no DB) so they are unit-testable.
 *
 * Privacy: the public site shows a reviewer as first name + last initial ("Ahmad S.") unless
 * they agreed to show their full name, and never a membership number, email or phone.
 */
export const TESTIMONIAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

export const TESTIMONIAL_SOURCES = ["member", "admin"] as const;
export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 5;
/** Longest review text, in characters. */
export const BODY_MAX = 600;
export const AUTHOR_NAME_MAX = 80;

/** A word with a digit or "@" could be a phone number, an email or a membership number (GG-00042). */
const UNSAFE_WORD = /[\p{Nd}@]/u;
/** Arabic compound first names: "عبد الله", "عبد الرحمن"… are one name, not a name and a surname. */
const COMPOUND_FIRST = /^(عبد|abd|abdel|abdul)$/i;
/** The article in "الخطيب" / "Al-Khatib" is skipped for the initial ("خ.", not "ا."). */
const ARTICLE = /^(ال(?=\p{L}{2})|(al|el)-)/iu;

function initialOf(word: string): string {
  const letter = [...word.replace(ARTICLE, "")].find((c) => /\p{L}/u.test(c));
  return letter ? letter.toUpperCase() : "";
}

/**
 * The name shown on the public site. Empty string when nothing safe is left (show a generic
 * "member" label instead).
 */
export function publicAuthorName(t: { authorName: string; showFullName: boolean }): string {
  const words = t.authorName
    .normalize("NFC")
    .split(/\s+/)
    .filter((w) => w !== "" && !UNSAFE_WORD.test(w));
  if (words.length === 0) return "";
  if (t.showFullName) return words.join(" ");
  const firstLength = words.length > 1 && COMPOUND_FIRST.test(words[0]!) ? 2 : 1;
  const first = words.slice(0, firstLength).join(" ");
  const last = words.length > firstLength ? words[words.length - 1]! : null;
  const initial = last ? initialOf(last) : "";
  return initial ? `${first} ${initial}.` : first;
}
