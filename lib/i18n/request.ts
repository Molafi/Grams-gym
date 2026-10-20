import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { applyOverrides } from "@/lib/content-keys";
import { getTextOverrides } from "@/lib/content-store";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const defaults = (await import(`../../messages/${locale}.json`)).default;

  // Text edited in /admin/content overrides the defaults (defaults if the DB is down).
  const overrides = await getTextOverrides(locale);
  const messages = overrides?.length ? applyOverrides(defaults, overrides) : defaults;

  return { locale, messages, timeZone: "Asia/Amman" };
});
