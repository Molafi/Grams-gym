"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";

const TABS = [
  { key: "overview", href: "/account" },
  { key: "membership", href: "/account/membership" },
  { key: "orders", href: "/account/orders" },
  { key: "settings", href: "/account/settings" },
] as const;

export function AccountTabs() {
  const t = useTranslations("account");
  const pathname = usePathname();
  return (
    <nav aria-label={t("title")} className="flex gap-1 overflow-x-auto border-b border-hairline">
      {TABS.map((tab) => {
        const active = tab.href === "/account" ? pathname === "/account" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${active ? "border-ember text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
