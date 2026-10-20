import { site } from "@/config/site";
import type { Business } from "@/lib/business";
import { toMajorString } from "@/lib/money";

/** SportsActivityLocation (a LocalBusiness subtype) with hours and address. */
export function localBusinessJsonLd(locale: string, biz: Business) {
  return {
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "ExerciseGym"],
    name: locale === "en" ? site.name : site.nameAr,
    alternateName: locale === "en" ? site.nameAr : site.name,
    slogan: locale === "en" ? site.tagline.en : site.tagline.ar,
    url: `${site.url}/${locale}`,
    telephone: biz.phone.e164,
    sameAs: [site.social.facebook, site.social.instagram],
    hasMap: site.maps.url,
    address: {
      "@type": "PostalAddress",
      streetAddress: locale === "en" ? biz.address.en : biz.address.ar,
      addressLocality: site.address.locality,
      addressCountry: site.address.country,
    },
    openingHoursSpecification: biz.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days.map((d) => `https://schema.org/${d}`),
      opens: h.opens,
      closes: h.closes,
    })),
  };
}

export function productJsonLd(
  p: { slug: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; brand: string; variants: { sku: string; priceMinor: number; currency: string; stock: number }[] },
  locale: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: locale === "en" ? p.nameEn : p.nameAr,
    description: locale === "en" ? p.descriptionEn : p.descriptionAr,
    brand: { "@type": "Brand", name: p.brand },
    url: `${site.url}/${locale}/shop/${p.slug}`,
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: toMajorString(v.priceMinor, v.currency),
      priceCurrency: v.currency,
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  };
}
