"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

/** Switches locale while preserving the current page and query string. */
export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  // next-intl's usePathname returns the path WITHOUT the locale prefix, with real param values.
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      disabled={pending}
      lang={next}
      onClick={() =>
        startTransition(() => {
          const query = window.location.search;
          router.replace(`${pathname}${query}`, { locale: next, scroll: false });
        })
      }
      className="h-10 rounded-full px-3 text-sm text-muted transition-colors hover:text-ink"
    >
      {t("switchLanguage")}
    </button>
  );
}
