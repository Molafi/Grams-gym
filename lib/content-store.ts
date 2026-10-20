import "server-only";
import { db } from "@/lib/db";
import { memo } from "@/lib/memo";
import { optionalRead } from "@/lib/db-status";

/** Text edits from /admin/content, cached for a minute (cleared on save). Null if the DB is down. */
const overrides = memo(60_000, (locale: "ar" | "en") =>
  db.contentOverride.findMany({ where: { locale }, select: { key: true, value: true } }),
);

export const getTextOverrides = (locale: "ar" | "en") => optionalRead("text edits", () => overrides.get(locale));
export const clearTextOverrides = () => overrides.clear();
