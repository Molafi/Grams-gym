/**
 * Membership plans — PLACEHOLDERS. The owner supplies real names, benefits and prices
 * (docs/OWNER-TODO.md). The DB `Plan` table is seeded from this file and is what the
 * site actually reads, so prices can later be edited in /admin/plans.
 *
 * Money is integer minor units. JOD has 3 decimals: 35000 = 35.000 JOD.
 */
export const BILLING_INTERVALS = ["monthly", "quarterly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const INTERVAL_MONTHS: Record<BillingInterval, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export type PlanSeed = {
  slug: "starter" | "pro" | "elite";
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  featuresAr: string[];
  featuresEn: string[];
  prices: Record<BillingInterval, number>;
  recommended: boolean;
  sortOrder: number;
};

export const PLAN_SEEDS: PlanSeed[] = [
  {
    slug: "starter",
    nameAr: "ستارتر",
    nameEn: "Starter",
    taglineAr: "البداية الصح. حديد، كارديو، ونظام.",
    taglineEn: "The right start. Iron, cardio, discipline.",
    featuresAr: ["دخول كامل للصالة خلال ساعات العمل", "منطقة الكارديو والأوزان الحرة", "جلسة تعريفية مع مدرب"],
    featuresEn: ["Full gym access during opening hours", "Cardio zone and free weights", "One onboarding session with a coach"],
    prices: { monthly: 30000, quarterly: 80000, yearly: 280000 },
    recommended: false,
    sortOrder: 1,
  },
  {
    slug: "pro",
    nameAr: "برو",
    nameEn: "Pro",
    taglineAr: "للي ناوي جد. متابعة وبرنامج على مقاسك.",
    taglineEn: "For the serious. Tracking and a program built for you.",
    featuresAr: ["كل مزايا ستارتر", "برنامج تمارين شخصي يتجدد شهرياً", "قياس وتقييم جسم شهري", "خطة تغذية أساسية"],
    featuresEn: ["Everything in Starter", "Personal training program, refreshed monthly", "Monthly body assessment", "Baseline nutrition plan"],
    prices: { monthly: 45000, quarterly: 120000, yearly: 420000 },
    recommended: true,
    sortOrder: 2,
  },
  {
    slug: "elite",
    nameAr: "إيليت",
    nameEn: "Elite",
    taglineAr: "مصنع العضلات بكامل طاقته.",
    taglineEn: "The Muscle Factory at full power.",
    featuresAr: ["كل مزايا برو", "٤ جلسات تدريب شخصي شهرياً", "متابعة تغذية أسبوعية", "أولوية الحجز والدعم"],
    featuresEn: ["Everything in Pro", "4 personal-training sessions a month", "Weekly nutrition check-ins", "Priority booking and support"],
    prices: { monthly: 75000, quarterly: 210000, yearly: 750000 },
    recommended: false,
    sortOrder: 3,
  },
];

/** Env var holding the Lemon Squeezy variant ID for a (plan, interval). */
export function variantEnvKey(slug: string, interval: BillingInterval) {
  return `LS_VARIANT_${slug.toUpperCase()}_${interval.toUpperCase()}`;
}
