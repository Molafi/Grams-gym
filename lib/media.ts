import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { media, type MediaItem, type MediaKey } from "@/config/media";

export type ResolvedMedia = Record<MediaKey, MediaItem & { custom: boolean }>;

/** URL of an uploaded image. The version segment changes on every upload, so it can be cached forever. */
export const mediaUrl = (key: string, updatedAt: Date) => `/media/${key}/${updatedAt.getTime().toString(36)}`;

/**
 * Every image slot with admin uploads applied over the defaults in config/media.ts.
 * Cached per request. If the database is unreachable the defaults are used.
 */
export const getMedia = cache(async (): Promise<ResolvedMedia> => {
  const out = Object.fromEntries(Object.entries(media).map(([k, v]) => [k, { ...v, custom: false }])) as ResolvedMedia;
  try {
    const rows = await db.mediaAsset.findMany({ select: { key: true, updatedAt: true, altAr: true, altEn: true, mime: true } });
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
  } catch (e) {
    console.error("[media] could not load uploads; using defaults", e instanceof Error ? e.message : e);
  }
  return out;
});
