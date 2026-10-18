import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, dirFor } from "@/lib/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { site } from "@/config/site";
import { testAccountsEnabled } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { TestModeRibbon } from "@/components/layout/TestModeRibbon";
import { Cursor } from "@/components/layout/Cursor";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SceneProvider } from "@/components/3d/SceneProvider";
import { Toaster } from "@/components/ui/Toaster";
import { CartSync } from "@/features/shop/CartSync";
import { localBusinessJsonLd } from "@/lib/seo";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#07080A",
  colorScheme: "dark",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "ar", namespace: "meta" });
  return {
    metadataBase: new URL(site.url),
    title: { default: t("siteTitle"), template: `%s · GRAMS GYM` },
    description: t("siteDescription"),
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: "/ar", en: "/en", "x-default": "/ar" },
    },
    openGraph: {
      type: "website",
      siteName: "GRAMS GYM",
      locale: locale === "en" ? "en_JO" : "ar_JO",
      alternateLocale: locale === "en" ? ["ar_JO"] : ["en_JO"],
      title: t("siteTitle"),
      description: t("siteDescription"),
    },
    twitter: { card: "summary_large_image" },
    icons: { icon: "/icon.svg" },
  };
}

async function paletteProducts() {
  try {
    return await db.product.findMany({
      where: { active: true },
      select: { slug: true, nameAr: true, nameEn: true, brand: true },
      take: 100,
      orderBy: { featured: "desc" },
    });
  } catch {
    return []; // the shell must render even if the DB is unreachable
  }
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [user, products, t, ta] = await Promise.all([
    getSessionUser().catch(() => null),
    paletteProducts(),
    getTranslations({ locale, namespace: "testMode" }),
    getTranslations({ locale, namespace: "a11y" }),
  ]);
  const tc = await getTranslations({ locale, namespace: "contact" });

  return (
    <html lang={locale} dir={dirFor(locale)} className={fontVariables} suppressHydrationWarning>
      <body
        className="bg-bg text-ink"
        style={testAccountsEnabled ? ({ "--ribbon-h": "28px" } as React.CSSProperties) : undefined}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd(locale)) }} />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ember focus:px-4 focus:py-2 focus:text-[#130800]">
          {ta("skip")}
        </a>
        <NextIntlClientProvider>
          <SceneProvider>
            {testAccountsEnabled ? <TestModeRibbon label={t("ribbon")} /> : null}
            <Navbar user={user ? { name: user.name, role: user.role } : null} products={products} />
            <main id="main" className="relative" style={{ paddingTop: "var(--ribbon-h, 0px)" }}>
              {children}
            </main>
            <Footer locale={locale} />
            <WhatsAppButton locale={locale} label={tc("whatsapp")} />
            <CartSync userId={user?.id ?? null} />
            <SmoothScroll />
            <Cursor />
            <Toaster />
          </SceneProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
