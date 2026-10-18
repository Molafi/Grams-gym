import "server-only";
import type { Prisma, ProductCategory } from "@prisma/client";
import { db } from "@/lib/db";

export const CATEGORIES: ProductCategory[] = [
  "protein",
  "creatine",
  "pre_workout",
  "amino_acids",
  "vitamins",
  "gainers",
  "accessories",
];

export type SortKey = "featured" | "price_asc" | "price_desc" | "new";

export type CatalogFilters = {
  q?: string;
  category?: ProductCategory;
  sort?: SortKey;
  inStock?: boolean;
};

const productInclude = {
  variants: { where: { active: true }, orderBy: { priceMinor: "asc" } },
} satisfies Prisma.ProductInclude;

export type ProductWithVariants = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export async function listProducts(f: CatalogFilters = {}): Promise<ProductWithVariants[]> {
  const q = f.q?.trim().slice(0, 80);
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(f.category ? { category: f.category } : {}),
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: "insensitive" } },
            { nameEn: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(f.inStock ? { variants: { some: { active: true, stock: { gt: 0 } } } } : {}),
  };
  const products = await db.product.findMany({
    where,
    include: productInclude,
    orderBy: f.sort === "new" ? { createdAt: "desc" } : [{ featured: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  const minPrice = (p: ProductWithVariants) => p.variants[0]?.priceMinor ?? Number.MAX_SAFE_INTEGER;
  if (f.sort === "price_asc") products.sort((a, b) => minPrice(a) - minPrice(b));
  if (f.sort === "price_desc") products.sort((a, b) => minPrice(b) - minPrice(a));
  return products;
}

export async function getProduct(slug: string) {
  return db.product.findFirst({ where: { slug, active: true }, include: productInclude });
}

export async function featuredProducts(limit = 4) {
  return db.product.findMany({
    where: { active: true, featured: true },
    include: productInclude,
    take: limit,
    orderBy: { createdAt: "asc" },
  });
}

export type PricedLine = {
  variantId: string;
  productId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  brand: string;
  shape: "tub" | "shaker" | "box";
  labelColor: string;
  accentColor: string;
  variantLabelAr: string;
  variantLabelEn: string;
  sku: string;
  unitMinor: number;
  currency: string;
  requestedQty: number;
  qty: number;
  stock: number;
  available: boolean;
};

export function variantLabel(v: { flavorAr: string | null; flavorEn: string | null; sizeLabel: string }, locale: string) {
  const flavor = locale === "en" ? v.flavorEn : v.flavorAr;
  return [flavor, v.sizeLabel].filter(Boolean).join(" · ");
}

/**
 * Authoritative pricing: everything comes from the DB, quantities are clamped
 * to stock. The client only ever sends (variantId, qty).
 */
export async function priceLines(items: { variantId: string; qty: number }[]): Promise<PricedLine[]> {
  const ids = [...new Set(items.map((i) => i.variantId))].slice(0, 50);
  if (ids.length === 0) return [];
  const variants = await db.productVariant.findMany({
    where: { id: { in: ids } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: PricedLine[] = [];
  for (const item of items) {
    const v = byId.get(item.variantId);
    if (!v) continue;
    const available = v.active && v.product.active && v.stock > 0;
    const requestedQty = Math.max(0, Math.floor(item.qty));
    lines.push({
      variantId: v.id,
      productId: v.productId,
      slug: v.product.slug,
      nameAr: v.product.nameAr,
      nameEn: v.product.nameEn,
      brand: v.product.brand,
      shape: v.product.shape,
      labelColor: v.product.labelColor,
      accentColor: v.product.accentColor,
      variantLabelAr: variantLabel(v, "ar"),
      variantLabelEn: variantLabel(v, "en"),
      sku: v.sku,
      unitMinor: v.priceMinor,
      currency: v.currency,
      requestedQty,
      qty: available ? Math.min(requestedQty, v.stock) : 0,
      stock: v.stock,
      available,
    });
  }
  return lines;
}
