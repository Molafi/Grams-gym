import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { media, type MediaItem, type MediaKey } from "@/config/media";
import { optionalRead } from "@/lib/db-status";
import { memo } from "@/lib/memo";

export type ResolvedMedia = Record<MediaKey, MediaItem & { custom: boolean }>;

/** URL of an uploaded image. The version segment changes on every upload, so it can be cached forever. */
export const mediaUrl = (key: string, updatedAt: Date) => `/media/${key}/${updatedAt.getTime().toString(36)}`;

// Upload metadata (not the bytes), cached for a minute and cleared on every upload/reset.
const uploads = memo(60_000, () => db.mediaAsset.findMany({ select: { key: true, updatedAt: true, altAr: true, altEn: true, mime: true } }));
/** Call after an upload/reset so every page shows it at once. */
export const clearMediaCache = () => uploads.clear();

/**
 * Every image slot with admin uploads applied over the defaults in config/media.ts.
 * If the database is unreachable the defaults are used.
 */
export const getMedia = cache(async (): Promise<ResolvedMedia> => {
  const out = Object.fromEntries(Object.entries(media).map(([k, v]) => [k, { ...v, custom: false }])) as ResolvedMedia;
  const rows = (await optionalRead("images", () => uploads.get("all"))) ?? [];
  for (const r of rows) {
    if (!Object.hasOwn(out, r.key)) continue;
    const k = r.key as MediaKey;
    out[k] = {
      ...out[k],
      src: r.mime ? mediaUrl(r.key, r.updatedAt) : out[k].src,
      alt: { ar: r.altAr || out[k].alt.ar, en: r.altEn || out[k].alt.en },
      custom: Boolean(r.mime),
    };
  }
  return out;
});
