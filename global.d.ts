import type en from "./messages/en.json";

// `Locale` is intentionally NOT narrowed to "ar" | "en": Next.js types route params as
// `string`, and narrowing here breaks every getTranslations/setRequestLocale call.
// Unknown locales are rejected at runtime in app/[locale]/layout.tsx (hasLocale → notFound).
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}
