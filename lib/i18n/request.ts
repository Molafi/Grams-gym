import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { db } from "@/lib/db";
import { applyOverrides } from "@/lib/content-keys";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const defaults = (await import(`../../messages/${locale}.json`)).default;

  // Text edited in /admin/content overrides the defaults. If the DB is down, use the defaults.
  let messages = defaults;
  try {
    const overrides = await db.contentOverride.findMany({ where: { locale }, select: { key: true, value: true } });
    if (overrides.length) messages = applyOverrides(defaults, overrides);
  } catch (e) {
    console.error("[i18n] could not load text edits; using defaults", e instanceof Error ? e.message : e);
  }

  return { locale, messages, timeZone: "Asia/Amman" };
});
