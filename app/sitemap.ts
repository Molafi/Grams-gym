import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { db } from "@/lib/db";

// Regenerate hourly at runtime so product URLs appear even when the build ran without a DB.
export const revalidate = 3600;

const STATIC = ["", "/packages", "/shop", "/about", "/services", "/facilities", "/contact", "/legal/terms", "/legal/privacy", "/legal/refunds", "/legal/shipping"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    products = await db.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  } catch {
    /* DB unavailable at build — static routes only */
  }
  const entry = (path: string, lastModified?: Date): MetadataRoute.Sitemap[number] => ({
    url: `${site.url}/ar${path}`,
    lastModified,
    alternates: { languages: { ar: `${site.url}/ar${path}`, en: `${site.url}/en${path}` } },
  });
  return [...STATIC.map((p) => entry(p)), ...products.map((p) => entry(`/shop/${p.slug}`, p.updatedAt))];
}
