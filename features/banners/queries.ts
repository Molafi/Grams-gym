import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fallbackIfTableMissing, optionalRead } from "@/lib/db-status";
import { memo } from "@/lib/memo";
import { bannersForPlacement, type BannerPlacement } from "@/lib/banners";

/** What the public site needs (no click counts). */
const publicSelect = {
  id: true,
  placement: true,
  titleAr: true,
  titleEn: true,
  bodyAr: true,
  bodyEn: true,
  ctaLabelAr: true,
  ctaLabelEn: true,
  linkUrl: true,
  imageDesktopUrl: true,
  imageMobileUrl: true,
  startsAt: true,
  endsAt: true,
  active: true,
  dismissible: true,
  sortOrder: true,
  createdAt: true,
} satisfies Prisma.BannerSelect;
export type PublicBanner = Prisma.BannerGetPayload<{ select: typeof publicSelect }>;

/**
 * Active banners that haven't ended, cached for a minute. Start and end times are checked again
 * on every request (bannersForPlacement), so a schedule takes effect on time even while cached.
 */
const active = memo(60_000, () =>
  db.banner
    .findMany({ where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, select: publicSelect, take: 200 })
    .catch(fallbackIfTableMissing("banners", [] as PublicBanner[])),
);

/** Call after any admin change to banners so the site shows it at once. */
export const clearBannersCache = () => active.clear();

const activeBanners = cache(async (): Promise<PublicBanner[]> => (await optionalRead("banners", () => active.get("all"))) ?? []);

/** Live banners for one placement, in display order. Empty if the database is unavailable. */
export async function getBanners(placement: BannerPlacement, opts: { limit?: number } = {}): Promise<PublicBanner[]> {
  return bannersForPlacement(await activeBanners(), placement, new Date(), opts);
}

/** Admin list: grouped by placement, in display order. */
export function listBannersForAdmin() {
  return db.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 500 });
}

export function getBannerForAdmin(id: string) {
  return db.banner.findUnique({ where: { id } });
}
