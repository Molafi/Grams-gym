"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Package, Search } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";
import { NAV_ITEMS } from "./nav-items";

export type PaletteProduct = { slug: string; nameAr: string; nameEn: string; brand: string };

type Entry = { id: string; label: string; hint: string; href: string; group: "pages" | "products" };

/** ⌘K command palette — pages + products, keyboard-complete, ARIA combobox/listbox. */
export function CommandPalette({
  open,
  onClose,
  products,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  products: PaletteProduct[];
  locale: string;
}) {
  const t = useTranslations("palette");
  const tn = useTranslations("nav");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = [
      ...NAV_ITEMS.map((n) => ({ id: `p-${n.key}`, label: tn(n.key), hint: n.href, href: n.href, group: "pages" as const })),
      { id: "p-cart", label: tn("cart"), hint: "/cart", href: "/cart", group: "pages" },
      { id: "p-account", label: tn("account"), hint: "/account", href: "/account", group: "pages" },
    ];
    const prods: Entry[] = products.map((p) => ({
      id: `x-${p.slug}`,
      label: locale === "en" ? p.nameEn : p.nameAr,
      hint: p.brand,
      href: `/shop/${p.slug}`,
      group: "products",
    }));
    const q = query.trim().toLowerCase();
    const all = [...pages, ...prods];
    if (!q) return all.slice(0, 14);
    return all.filter((e) => e.label.toLowerCase().includes(q) || e.hint.toLowerCase().includes(q)).slice(0, 20);
  }, [products, query, locale, tn]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    setQuery("");
    router.push(e.href);
  };

  const groups: Entry["group"][] = ["pages", "products"];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          data-lenis-prevent
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("placeholder")}
            className="card w-full max-w-xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, entries.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                go(entries[active]);
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-5">
              <Search className="h-4 w-4 text-muted" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={t("placeholder")}
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={entries[active]?.id}
              />
            </div>
            <div id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {entries.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">{t("empty")}</p> : null}
              {groups.map((g) => {
                const items = entries.filter((e) => e.group === g);
                if (items.length === 0) return null;
                return (
                  <div key={g} role="group" aria-label={t(g)}>
                    <p className="eyebrow px-3 pb-1 pt-3">{t(g)}</p>
                    {items.map((e) => {
                      const idx = entries.indexOf(e);
                      const selected = idx === active;
                      return (
                        <button
                          type="button"
                          key={e.id}
                          id={e.id}
                          role="option"
                          aria-selected={selected}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(e)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${
                            selected ? "bg-white/[.06] text-ink" : "text-muted"
                          }`}
                        >
                          {g === "products" ? <Package className="h-4 w-4 shrink-0" aria-hidden /> : <ArrowUpRight className="flip-rtl h-4 w-4 shrink-0" aria-hidden />}
                          <span className="flex-1 truncate">{e.label}</span>
                          <span className="text-xs text-muted/70" dir="ltr">
                            {e.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-muted">{t("hint")}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
