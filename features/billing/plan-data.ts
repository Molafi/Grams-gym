import type { Plan } from "@prisma/client";
import type { PlanCardData } from "./PlanCards";

export function toPlanCard(p: Plan, locale: string): PlanCardData {
  const en = locale === "en";
  return {
    slug: p.slug,
    name: en ? p.nameEn : p.nameAr,
    tagline: en ? p.taglineEn : p.taglineAr,
    features: en ? p.featuresEn : p.featuresAr,
    prices: { monthly: p.priceMonthly, quarterly: p.priceQuarterly, yearly: p.priceYearly },
    currency: p.currency,
    recommended: p.recommended,
  };
}
