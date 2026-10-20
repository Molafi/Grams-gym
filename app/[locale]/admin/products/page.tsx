import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { hasRole, requireRole } from "@/lib/auth/guards";
import { Badge, Card } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { PackArt } from "@/components/shop/PackArt";
import { Link } from "@/lib/i18n/navigation";
import { updateStock } from "@/features/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Each admin page checks the role itself; the layout check alone is not an auth boundary.
  const me = await requireRole(locale, "STAFF", `/${locale}/admin/products`);
  const t = await getTranslations({ locale, namespace: "admin" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const ts = await getTranslations({ locale, namespace: "shop" });
  const products = await db.product.findMany({ include: { variants: { orderBy: { priceMinor: "asc" } } }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl">{t("nav.products")}</h1>
        {hasRole(me, "ADMIN") ? (
          <ButtonLink href="/admin/products/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden /> {t("newProduct")}
          </ButtonLink>
        ) : null}
      </div>
      <ul className="space-y-3">
        {products.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="h-16 w-14 shrink-0 rounded-lg bg-surface-2">
                  <PackArt shape={p.shape} labelColor={p.labelColor} accentColor={p.accentColor} brand={p.brand} className="h-full w-full text-ink" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{locale === "en" ? p.nameEn : p.nameAr}</p>
                  <p className="text-xs text-muted">
                    {ts(`categories.${p.category}`)} · <span dir="ltr">{p.slug}</span>
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    {!p.active ? <Badge tone="danger">off</Badge> : null}
                    {p.featured ? <Badge tone="ember">{t("featured")}</Badge> : null}
                    {p.isDemo ? <Badge tone="warning">{tc("demo")}</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <form key={v.id} action={updateStock} className="flex items-center gap-2 rounded-xl border border-hairline px-3 py-2 text-xs">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <span className="text-muted" dir="ltr">
                      {v.sku}
                    </span>
                    <span className="tabular">{formatMoney(v.priceMinor, v.currency, locale)}</span>
                    <label className="flex items-center gap-1">
                      <span className="sr-only">{t("stock")}</span>
                      <input name="stock" type="number" min={0} defaultValue={v.stock} className={`w-16 rounded-md border bg-transparent px-1.5 py-1 ${v.stock === 0 ? "border-danger/50 text-danger" : "border-hairline-strong"}`} dir="ltr" />
                    </label>
                    <button type="submit" className="text-muted hover:text-ember">
                      {tc("save")}
                    </button>
                  </form>
                ))}
              </div>
              {hasRole(me, "ADMIN") ? (
                <Link href={`/admin/products/${p.id}`} className="text-sm text-muted hover:text-ink">
                  {tc("edit")} →
                </Link>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
