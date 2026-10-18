import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type MetaKey = "home" | "about" | "services" | "facilities" | "contact" | "packages" | "shop" | "cart" | "signin" | "account" | "admin" | "legal";

/** Localised title + canonical + hreflang alternates for a route. `path` excludes the locale. */
export async function pageMetadata(locale: string, key: MetaKey, path: string, opts: { noindex?: boolean } = {}): Promise<Metadata> {
  const t = await getTranslations({ locale: locale === "en" ? "en" : "ar", namespace: "meta" });
  const clean = path === "/" ? "" : path;
  return {
    title: key === "home" ? { absolute: t("siteTitle") } : t(key),
    alternates: {
      canonical: `/${locale}${clean}`,
      languages: { ar: `/ar${clean}`, en: `/en${clean}`, "x-default": `/ar${clean}` },
    },
    openGraph: { url: `/${locale}${clean}` },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}

export type PageProps<P extends object = object> = {
  params: Promise<{ locale: string } & P>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
