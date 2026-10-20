/**
 * Image registry: the default file for every image slot on the site.
 * Admins can replace any of them in /admin/media (stored in the MediaAsset table, which
 * wins over these defaults). Resolve with `getMedia()` from lib/media.ts.
 */
export type MediaItem = {
  src: string | null;
  alt: { ar: string; en: string };
  tone: "navy" | "ember" | "steel";
};

export type MediaGroup = "brand" | "home" | "facilities" | "coaches" | "services";

export const media = {
  logo: {
    src: "/images/logo.png",
    alt: { ar: "شعار جرامز جيم", en: "GRAMS GYM logo" },
    tone: "navy",
  },
  heroBg: {
    src: "/images/hero.jpg",
    alt: { ar: "جدار جرامز جيم الأزرق مع شعار GG", en: "The navy GRAMS GYM wall with the GG monogram" },
    tone: "navy",
  },
  gymInterior: {
    src: "/images/gym-interior.jpg",
    alt: { ar: "صالة جرامز جيم من الداخل", en: "Inside GRAMS GYM" },
    tone: "steel",
  },
  freeWeights: {
    src: "/images/free-weights.jpg",
    alt: { ar: "رف الدمبلز", en: "The dumbbell rack" },
    tone: "navy",
  },
  cardio: {
    src: "/images/cardio.jpg",
    alt: { ar: "منطقة الكارديو", en: "The cardio zone" },
    tone: "steel",
  },
  machines: {
    // The uploaded machines.jpg is identical to gym-interior.jpg — replace it in /admin/media.
    src: "/images/machines.jpg",
    alt: { ar: "أجهزة المقاومة", en: "Resistance machines" },
    tone: "ember",
  },
  nutrition: {
    src: "/images/nutrition.jpg",
    alt: { ar: "وجبات صحية محضرة", en: "Prepared healthy meals" },
    tone: "ember",
  },
  coachAhmad: {
    src: "/images/coaches/ahmad.jpg",
    alt: { ar: "المدرب أحمد", en: "Coach Ahmad" },
    tone: "steel",
  },
  coachAmr: {
    src: "/images/coaches/amr.jpg",
    alt: { ar: "المدرب عمرو", en: "Coach Amr" },
    tone: "steel",
  },
  coachSimon: {
    src: "/images/coaches/simon.jpg",
    alt: { ar: "المدرب سايمون", en: "Coach Simon" },
    tone: "steel",
  },
  coachZaid: {
    src: "/images/coaches/zaid.jpg",
    alt: { ar: "المدرب زيد", en: "Coach Zaid" },
    tone: "steel",
  },
} satisfies Record<string, MediaItem>;

export type MediaKey = keyof typeof media;
export const MEDIA_KEYS = Object.keys(media) as MediaKey[];

/** How each slot is grouped and labelled in /admin/media. */
export const MEDIA_GROUPS: Record<MediaKey, MediaGroup> = {
  logo: "brand",
  heroBg: "home",
  gymInterior: "facilities",
  freeWeights: "facilities",
  cardio: "facilities",
  machines: "facilities",
  nutrition: "services",
  coachAhmad: "coaches",
  coachAmr: "coaches",
  coachSimon: "coaches",
  coachZaid: "coaches",
};

export const isMediaKey = (k: string): k is MediaKey => Object.hasOwn(media, k);
