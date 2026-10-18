import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/primitives";
import type { ProductWithVariants } from "@/features/shop/catalog";
import { PackArt } from "./PackArt";

export async function ProductCard({ product, locale }: { product: ProductWithVariants; locale: string }) {
  const t = await getTranslations({ locale, namespace: "shop" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const cheapest = product.variants[0];
  const totalStock = product.variants.reduce((n, v) => n + v.stock, 0);
  const name = locale === "en" ? product.nameEn : product.nameAr;

  return (
    <Link href={`/shop/${product.slug}`} className="card group block overflow-hidden p-5 transition-[border-color,transform] duration-700 hover:-translate-y-1 hover:border-hairline-strong">
      <div className="relative aspect-[5/6] overflow-hidden rounded-[18px] bg-[radial-gradient(80%_70%_at_50%_30%,#1c2029,#0b0c10)]">
        <PackArt
          shape={product.shape}
          labelColor={product.labelColor}
          accentColor={product.accentColor}
          brand={product.brand}
          className="absolute inset-0 m-auto h-[82%] w-[82%] text-ink transition-transform duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]"
        />
        <div className="absolute start-3 top-3 flex gap-1.5">
          <Badge>{t(`categories.${product.category}`)}</Badge>
          {product.isDemo ? <Badge tone="warning">{tc("demo")}</Badge> : null}
        </div>
      </div>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow truncate" dir="ltr">
            {product.brand}
          </p>
          <h3 className="mt-1.5 line-clamp-2 font-medium">{name}</h3>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="tabular">{cheapest ? t("from", { price: formatMoney(cheapest.priceMinor, cheapest.currency, locale) }) : "—"}</span>
        <span className={totalStock > 0 ? "text-muted" : "text-danger"}>{totalStock > 0 ? t("inStock") : t("outOfStock")}</span>
      </div>
    </Link>
  );
}
