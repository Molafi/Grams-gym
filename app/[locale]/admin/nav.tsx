"use client";

import { useTranslations } from "next-intl";
import { Boxes, ClipboardList, CreditCard, LayoutDashboard, Logs, QrCode, ScrollText, Tags, Users } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n/navigation";

const ITEMS = [
  { key: "dashboard", href: "/admin", Icon: LayoutDashboard, min: "STAFF" },
  { key: "subscriptions", href: "/admin/subscriptions", Icon: CreditCard, min: "STAFF" },
  { key: "members", href: "/admin/members", Icon: Users, min: "STAFF" },
  { key: "checkin", href: "/admin/checkin", Icon: QrCode, min: "STAFF" },
  { key: "orders", href: "/admin/orders", Icon: ClipboardList, min: "STAFF" },
  { key: "products", href: "/admin/products", Icon: Boxes, min: "STAFF" },
  { key: "plans", href: "/admin/plans", Icon: Tags, min: "ADMIN" },
  { key: "webhooks", href: "/admin/webhooks", Icon: Logs, min: "ADMIN" },
  { key: "audit", href: "/admin/audit", Icon: ScrollText, min: "ADMIN" },
] as const;

export function AdminNav({ role, horizontal = false }: { role: "MEMBER" | "STAFF" | "ADMIN"; horizontal?: boolean }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.min === "STAFF" || role === "ADMIN");
  return (
    <nav aria-label="Admin">
      <ul className={horizontal ? "flex gap-1 overflow-x-auto" : "space-y-0.5"}>
        {items.map(({ key, href, Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "bg-white/[.06] text-ink" : "text-muted hover:text-ink"}`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-ember" : ""}`} aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
