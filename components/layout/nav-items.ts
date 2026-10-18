export const NAV_ITEMS = [
  { key: "home", href: "/" },
  { key: "packages", href: "/packages" },
  { key: "shop", href: "/shop" },
  { key: "facilities", href: "/facilities" },
  { key: "services", href: "/services" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];
