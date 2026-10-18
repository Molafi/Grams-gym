/**
 * Photo registry. The original photos were not in the files received in this build,
 * so every entry starts as `src: null` and renders an art-directed placeholder.
 * To upgrade: drop the file into /public/images/... and set `src`. See docs/OWNER-TODO.md.
 */
export type MediaItem = {
  src: string | null;
  width: number;
  height: number;
  alt: { ar: string; en: string };
  tone: "navy" | "ember" | "steel";
};

export const media = {
  heroBg: {
    src: null,
    width: 2400,
    height: 1600,
    alt: { ar: "جدار جرامز جيم الأزرق مع شعار GG", en: "The navy GRAMS GYM wall with the GG monogram" },
    tone: "navy",
  },
  gymInterior: {
    src: null,
    width: 2000,
    height: 1333,
    alt: { ar: "صالة جرامز جيم من الداخل", en: "Inside GRAMS GYM" },
    tone: "steel",
  },
  freeWeights: {
    src: null,
    width: 2000,
    height: 1333,
    alt: { ar: "رف الدمبلز", en: "The dumbbell rack" },
    tone: "navy",
  },
  cardio: {
    src: null,
    width: 2000,
    height: 1333,
    alt: { ar: "منطقة الكارديو", en: "The cardio zone" },
    tone: "steel",
  },
  machines: {
    src: null,
    width: 2000,
    height: 1333,
    alt: { ar: "أجهزة المقاومة", en: "Resistance machines" },
    tone: "ember",
  },
  nutrition: {
    src: null,
    width: 2000,
    height: 1333,
    alt: { ar: "وجبات صحية محضرة", en: "Prepared healthy meals" },
    tone: "ember",
  },
} satisfies Record<string, MediaItem>;

export type MediaKey = keyof typeof media;
