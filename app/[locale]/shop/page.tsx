import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search } from "lucide-react";
import type { ProductCategory } from "@prisma/client";
import { firstParam, pageMetadata, type PageProps } from "@/lib/metadata";
import { CATEGORIES, listProducts, type SortKey } from "@/features/shop/catalog";
import { Badge, Container, SectionHeading } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/shop/ProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { Link } from "@/lib/i18n/navigation";
import { nullIfDbDown } from "@/lib/db-status";
import { Unavailable } from "@/components/ui/Unavailable";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "shop", "/shop");
}

const SORTS: SortKey[] = ["featured", "price_asc", "price_desc", "new"];

export default async function ShopPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop" });
  const tc = await getTranslations({ locale, namespace: "common" });

  const q = firstParam(sp.q)?.slice(0, 80) ?? "";
  const catRaw = firstParam(sp.category);
  const category = CATEGORIES.find((c) => c === catRaw) as ProductCategory | undefined;
  const sortRaw = firstParam(sp.sort);
  const sort = SORTS.find((s) => s === sortRaw) ?? "featured";
  const inStock = firstParam(sp.stock) === "1";

  const products = await listProducts({ q, category, sort, inStock }).catch(nullIfDbDown("store"));
  if (!products) {
    return (
      <section className="atmosphere pb-12 pt-40">
        <Container>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        </Container>
        <Unavailable locale={locale} />
      </section>
    );
  }
  const hasDemo = products.some((p) => p.isDemo);
  const sortLabel: Record<SortKey, string> = {
    featured: t("sortFeatured"),
    price_asc: t("sortPriceAsc"),
    price_desc: t("sortPriceDesc"),
    new: t("sortNew"),
  };

  return (
    <>
      <section className="atmosphere pb-12 pt-40">
        <Container>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        </Container>
      </section>

      <section className="pb-24">
        <Container>
          {/* Category chips */}
          <nav aria-label={t("category")} className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2">
            <Link
              href={{ pathname: "/shop", query: { ...(q ? { q } : {}), sort } }}
              aria-current={!category ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${!category ? "border-ember bg-ember/10" : "border-hairline text-muted hover:text-ink"}`}
            >
              {tc("all")}
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={{ pathname: "/shop", query: { ...(q ? { q } : {}), category: c, sort } }}
                aria-current={category === c ? "page" : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${category === c ? "border-ember bg-ember/10" : "border-hairline text-muted hover:text-ink"}`}
              >
                {t(`categories.${c}`)}
              </Link>
            ))}
          </nav>

          {/* Search / sort / stock — plain GET form: works without JS */}
          <form method="get" className="mb-10 flex flex-wrap items-center gap-3" role="search">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">{t("searchPlaceholder")}</span>
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="field ps-11" />
            </label>
            <label>
              <span className="sr-only">{t("sort")}</span>
              <select name="sort" defaultValue={sort} className="field">
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {sortLabel[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="stock" value="1" defaultChecked={inStock} className="h-4 w-4 accent-[#ff7d09]" />
              {t("inStockOnly")}
            </label>
            <Button type="submit" variant="glass">
              {tc("filter")}
            </Button>
          </form>

          {hasDemo ? (
            <p className="mb-6">
              <Badge tone="warning">{t("demoNotice")}</Badge>
            </p>
          ) : null}

          {products.length === 0 ? (
            <p className="card p-12 text-center text-muted">{t("noResults")}</p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <Reveal as="li" key={p.id} index={i % 4}>
                  <ProductCard product={p} locale={locale} />
                </Reveal>
              ))}
            </ul>
          )}

          <aside className="card mt-16 p-6 text-sm text-muted" aria-labelledby="disclaimer">
            <h2 id="disclaimer" className="mb-2 font-medium text-ink">
              {t("disclaimerTitle")}
            </h2>
            <p>{t("disclaimer")}</p>
          </aside>
        </Container>
      </section>
    </>
  );
}
