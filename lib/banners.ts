/**
 * Banner rules — pure functions (no DB) so they are unit-testable.
 *
 * A banner is live while it's active and `now` is inside [startsAt, endsAt): the start is
 * inclusive, the end exclusive, and a missing date means no limit on that side.
 */
export const BANNER_PLACEMENTS = ["top_bar", "home_hero", "home_inline", "packages", "shop"] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export type BannerLike = {
  id: string;
  placement: BannerPlacement;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  dismissible: boolean;
  sortOrder: number;
  createdAt: Date;
};

export function isBannerLive(b: Pick<BannerLike, "active" | "startsAt" | "endsAt">, now: Date): boolean {
  if (!b.active) return false;
  if (b.startsAt && now < b.startsAt) return false;
  if (b.endsAt && now >= b.endsAt) return false;
  return true;
}

/**
 * Live banners for one placement in display order: the admin's order (sortOrder), then newest
 * first. `dismissed` (ids the visitor closed) only hides banners that can be dismissed.
 */
export function bannersForPlacement<T extends BannerLike>(
  banners: readonly T[],
  placement: BannerPlacement,
  now: Date,
  opts: { dismissed?: Iterable<string>; limit?: number } = {},
): T[] {
  const dismissed = new Set(opts.dismissed ?? []);
  const live = banners
    .filter((b) => b.placement === placement && isBannerLive(b, now) && !(b.dismissible && dismissed.has(b.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return opts.limit === undefined ? live : live.slice(0, Math.max(0, opts.limit));
}

/**
 * A path on this site ("/packages"). Rejects "//host" and "/\host" (both open another site) and
 * any whitespace or control character (browsers drop tabs/newlines, turning "/\t/host" into "//host").
 */
export function isSitePath(v: string): boolean {
  return v.startsWith("/") && !v.startsWith("//") && !/[\s\p{Cc}\\]/u.test(v);
}

/** Where a banner may link: a path on this site or an https:// address. */
export function isBannerLink(v: string): boolean {
  if (isSitePath(v)) return true;
  if (/[\s\p{Cc}]/u.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname !== "";
  } catch {
    return false;
  }
}

/**
 * Banner images must come from this site (the CSP only allows img-src 'self'): an upload served
 * under /media/… or a file in public/images/….
 */
export function isBannerImagePath(v: string): boolean {
  return isSitePath(v) && /^\/(media|images)\//.test(v);
}

/** The gym's time zone. Banner start/end times are entered and shown in Amman time. */
export const SITE_TIME_ZONE = "Asia/Amman";

/** How far `timeZone` is ahead of UTC at the instant `at`, in ms (Amman: 3 hours). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wall - (at.getTime() - at.getUTCMilliseconds());
}

/**
 * `<input type="datetime-local">` value ("2026-12-01T09:00") read as wall-clock time in
 * `timeZone` → the instant it means. Null when it isn't a real date and time.
 * (The server runs on UTC, so `new Date(value)` would be 3 hours off for Amman.)
 */
export function localInputToDate(value: string, timeZone: string = SITE_TIME_ZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0)) as [number, number, number, number, number, number];
  if (h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null; // e.g. 2026-02-30
  // The offset at the guessed instant, then again at the result (they differ only around a DST change).
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  return new Date(wall - zoneOffsetMs(new Date(first), timeZone));
}

/** The reverse, for filling the admin form: an instant → "YYYY-MM-DDTHH:mm" in `timeZone`. */
export function dateToLocalInput(at: Date, timeZone: string = SITE_TIME_ZONE): string {
  return new Date(at.getTime() + zoneOffsetMs(at, timeZone)).toISOString().slice(0, 16);
}
