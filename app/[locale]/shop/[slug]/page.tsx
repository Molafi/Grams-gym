import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { getProduct, variantLabel } from "@/features/shop/catalog";
import { productJsonLd } from "@/lib/seo";
import { Badge, Container } from "@/components/ui/primitives";
import { ProductStage } from "@/components/shop/ProductStage";
import { AddToCart } from "@/components/shop/AddToCart";
import { Link } from "@/lib/i18n/navigation";
import { nullIfDbDown } from "@/lib/db-status";
import { Unavailable } from "@/components/ui/Unavailable";

type Props = PageProps<{ slug: string }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getProduct(slug).catch(nullIfDbDown("product metadata"));
  if (!p) return {};
  const name = locale === "en" ? p.nameEn : p.nameAr;
  return {
    title: name,
    description: (locale === "en" ? p.descriptionEn : p.descriptionAr).slice(0, 160),
    alternates: {
      canonical: `/${locale}/shop/${slug}`,
      languages: { ar: `/ar/shop/${slug}`, en: `/en/shop/${slug}` },
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  let product: Awaited<ReturnType<typeof getProduct>>;
  try {
    product = await getProduct(slug);
  } catch (e) {
    nullIfDbDown("product page")(e); // rethrows anything that isn't "database down"
    return (
      <section className="atmosphere pb-24 pt-32">
        <Unavailable locale={locale} />
      </section>
    );
  }
  if (!product) notFound();
  const t = await getTranslations({ locale, namespace: "shop" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const en = locale === "en";
  const name = en ? product.nameEn : product.nameAr;
  const first = product.variants[0];

  return (
    <section className="atmosphere pb-24 pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, locale)) }} />
      <Container>
        <Link href="/shop" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t("eyebrow")}
        </Link>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <ProductStage
            name={name}
            pack={{
              shape: product.shape,
              labelColor: product.labelColor,
              accentColor: product.accentColor,
              brand: product.brand,
              name,
              flavor: first ? (en ? first.flavorEn : first.flavorAr) : null,
              size: first?.sizeLabel ?? null,
              rtl: !en,
              glbUrl: product.glbUrl,
            }}
          />
          <div className="relative z-10">
            <div className="flex flex-wrap gap-2">
              <Badge>{t(`categories.${product.category}`)}</Badge>
              {product.isDemo ? <Badge tone="warning">{tc("demo")}</Badge> : null}
            </div>
            <p className="eyebrow mt-6" dir="ltr">
              {product.brand}
            </p>
            <h1 className="display mt-3 text-4xl sm:text-5xl">{name}</h1>
            <p className="mt-6 text-lg text-muted">{en ? product.descriptionEn : product.descriptionAr}</p>
            <div className="mt-10">
              <AddToCart
                variants={product.variants.map((v) => ({
                  id: v.id,
                  label: variantLabel(v, locale),
                  priceMinor: v.priceMinor,
                  compareAtMinor: v.compareAtMinor,
                  currency: v.currency,
                  stock: v.stock,
                  sku: v.sku,
                }))}
              />
            </div>
            {product.regulatoryRef ? (
              <p className="mt-6 text-sm text-muted">
                {t("regulatory")}: <span dir="ltr">{product.regulatoryRef}</span>
              </p>
            ) : null}
            <aside className="card mt-10 p-5 text-sm text-muted">
              <h2 className="mb-1.5 font-medium text-ink">{t("disclaimerTitle")}</h2>
              <p>{t("disclaimer")}</p>
            </aside>
          </div>
        </div>
      </Container>
    </section>
  );
}
