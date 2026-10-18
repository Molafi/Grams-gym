import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { toMajorString } from "@/lib/money";
import { ProductForm, type ProductFormData } from "@/features/admin/ProductForm";

export const dynamic = "force-dynamic";

const EMPTY: ProductFormData = {
  slug: "",
  category: "protein",
  brand: "",
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  shape: "tub",
  labelColor: "#14171D",
  accentColor: "#FF7D09",
  glbUrl: "",
  regulatoryRef: "",
  featured: false,
  active: true,
  variants: [{ sku: "", flavorAr: "", flavorEn: "", sizeLabel: "", price: "", compareAt: "", stock: 0, active: true }],
};

export default async function AdminProductEditPage({ params }: PageProps<{ id: string }>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/products/${id}`);
  const t = await getTranslations({ locale, namespace: "admin" });

  let initial = EMPTY;
  let version = "new";
  if (id !== "new") {
    const p = await db.product.findUnique({ where: { id }, include: { variants: { where: { active: true }, orderBy: { priceMinor: "asc" } } } });
    if (!p) notFound();
    version = p.updatedAt.toISOString();
    initial = {
      id: p.id,
      slug: p.slug,
      category: p.category,
      brand: p.brand,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      shape: p.shape,
      labelColor: p.labelColor,
      accentColor: p.accentColor,
      glbUrl: p.glbUrl ?? "",
      regulatoryRef: p.regulatoryRef ?? "",
      featured: p.featured,
      active: p.active,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        flavorAr: v.flavorAr ?? "",
        flavorEn: v.flavorEn ?? "",
        sizeLabel: v.sizeLabel,
        price: toMajorString(v.priceMinor, v.currency),
        compareAt: v.compareAtMinor != null ? toMajorString(v.compareAtMinor, v.currency) : "",
        stock: v.stock,
        active: v.active,
      })),
    };
    if (initial.variants.length === 0) initial.variants = EMPTY.variants;
  }

  return (
    <div className="space-y-8">
      <h1 className="display text-4xl">{id === "new" ? t("newProduct") : t("editProduct")}</h1>
      <ProductForm initial={initial} version={version} />
    </div>
  );
}
