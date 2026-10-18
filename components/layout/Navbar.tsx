"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { GGMark } from "@/components/ui/GGMark";
import { buttonClass } from "@/components/ui/Button";
import { useCartCount } from "@/features/shop/cart-store";
import { NAV_ITEMS } from "./nav-items";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CommandPalette, type PaletteProduct } from "./CommandPalette";

export type NavUser = { name: string | null; role: "MEMBER" | "STAFF" | "ADMIN" } | null;

export function Navbar({ user, products }: { user: NavUser; products: PaletteProduct[] }) {
  const t = useTranslations("nav");
  const ta = useTranslations("a11y");
  const locale = useLocale();
  const pathname = usePathname();
  const count = useCartCount();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-700 ${
          scrolled ? "border-b border-hairline bg-bg/70 backdrop-blur-xl" : "border-b border-transparent"
        }`}
        style={{ top: "var(--ribbon-h, 0px)" }}
      >
        <nav className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-6 px-5 sm:px-8 lg:px-12" aria-label="Main">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="GRAMS GYM">
            <GGMark className="h-7 w-auto" title="" />
            <span className="hidden font-[family-name:var(--font-latin)] text-[13px] font-semibold tracking-[0.28em] sm:inline" dir="ltr">
              GRAMS <span className="text-ember">GYM</span>
            </span>
          </Link>

          <ul className="ms-6 hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.slice(1).map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`relative rounded-full px-3.5 py-2 text-sm transition-colors duration-500 ${
                    isActive(item.href) ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {t(item.key)}
                  {isActive(item.href) ? (
                    <motion.span layoutId="nav-dot" className="absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-1 rounded-full bg-ember" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ms-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 items-center gap-2 rounded-full border border-hairline px-3.5 text-sm text-muted transition-colors hover:text-ink md:flex"
              aria-label={ta("openPalette")}
            >
              <Search className="h-4 w-4" aria-hidden />
              <span>{t("search")}</span>
              <kbd className="ms-2 rounded-md border border-hairline px-1.5 text-[10px] text-muted" dir="ltr">
                ⌘K
              </kbd>
            </button>
            <LanguageSwitcher />
            <Link
              href="/cart"
              id="cart-icon"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
              aria-label={`${t("cart")} (${count})`}
            >
              <ShoppingBag className="h-[18px] w-[18px]" aria-hidden />
              <span aria-live="polite" className="sr-only">
                {count}
              </span>
              {count > 0 ? (
                <span className="tabular absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ember px-1 text-[10px] font-semibold text-[#130800]">
                  {count}
                </span>
              ) : null}
            </Link>
            {user ? (
              <Link
                href={user.role === "MEMBER" ? "/account" : "/admin"}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
                aria-label={user.role === "MEMBER" ? t("account") : t("admin")}
              >
                <User className="h-[18px] w-[18px]" aria-hidden />
              </Link>
            ) : (
              <Link href="/signin" className="hidden px-3 text-sm text-muted transition-colors hover:text-ink sm:block">
                {t("signIn")}
              </Link>
            )}
            <Link href="/packages" className={buttonClass("primary", "sm", "ms-2 hidden sm:inline-flex")}>
              {t("joinNow")}
            </Link>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? ta("close") : ta("menu")}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open ? (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-hairline bg-bg/95 backdrop-blur-xl lg:hidden"
            >
              <ul className="flex flex-col gap-1 px-5 py-6">
                {NAV_ITEMS.map((item, i) => (
                  <motion.li
                    key={item.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link href={item.href} className="display block py-2.5 text-3xl" aria-current={isActive(item.href) ? "page" : undefined}>
                      {t(item.key)}
                    </Link>
                  </motion.li>
                ))}
                <li className="mt-4 flex gap-3">
                  <button type="button" onClick={() => setPaletteOpen(true)} className={buttonClass("glass", "md")}>
                    <Search className="h-4 w-4" aria-hidden /> {t("search")}
                  </button>
                  {user ? null : (
                    <Link href="/signin" className={buttonClass("glass", "md")}>
                      {t("signIn")}
                    </Link>
                  )}
                </li>
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} products={products} locale={locale} />
    </>
  );
}
