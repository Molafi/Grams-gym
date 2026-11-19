/**
 * Single source of truth for GRAMS GYM business facts.
 * Anything marked `TODO(owner)` is listed in docs/OWNER-TODO.md and must be confirmed.
 */
export const site = {
  name: "GRAMS GYM",
  nameAr: "جرامز جيم",
  tagline: { ar: "كل غرام بيفرق", en: "Each Gram Matters" },
  positioning: { ar: "مصنع العضلات", en: "Muscle Factory" },
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  phone: {
    display: "079 555 6818",
    e164: "+962795556818",
  },
  whatsapp: {
    url: "https://wa.me/962795556818",
    // TODO(owner): the original prefilled consultation message was not in the files received.
    // Replace with the exact text from the old site's WhatsApp button.
    consultationMessage: {
      ar: "مرحبا جرامز جيم، بدي احجز استشارة مجانية",
      en: "Hi GRAMS GYM, I'd like to book a free consultation",
    },
  },
  social: {
    facebook: "https://www.facebook.com/Gramsgym/",
    instagram: "https://www.instagram.com/gramsgym/",
    instagramHandle: "@gramsgym",
  },
  maps: {
    url: "https://maps.app.goo.gl/JPVz1kJmhtBAgQiu7",
  },
  // TODO(owner): the exact street address from the old site was not in the files received.
  address: {
    ar: "عمّان، الأردن",
    en: "Amman, Jordan",
    locality: "Amman",
    country: "JO",
  },
  stats: {
    years: 8,
    members: 2000,
  },
  /**
   * Opening hours. The owner said "7-11", read as 07:00–23:00 every day. TODO(owner): confirm,
   * including Thursday and Friday (the old site listed shorter hours for both).
   * `label` is what the site shows and can be changed in /admin/content → Business info;
   * `opens`/`closes` feed Google's structured data (lib/seo.ts) and only change here.
   */
  hours: [
    { key: "satWed", days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"], opens: "07:00", closes: "23:00", label: { ar: "7 صباحاً – 11 مساءً", en: "7 AM – 11 PM" } },
    { key: "thu", days: ["Thursday"], opens: "07:00", closes: "23:00", label: { ar: "7 صباحاً – 11 مساءً", en: "7 AM – 11 PM" } },
    { key: "fri", days: ["Friday"], opens: "07:00", closes: "23:00", label: { ar: "7 صباحاً – 11 مساءً", en: "7 AM – 11 PM" } },
  ],
  // Coach photos are image slots in config/media.ts (coachAhmad…), editable in /admin/media.
  coaches: [{ key: "ahmad" }, { key: "amr" }, { key: "simon" }, { key: "zaid" }],
  currency: "JOD",
} as const;

export type Site = typeof site;

export function whatsappLink(locale: string) {
  const msg = locale === "en" ? site.whatsapp.consultationMessage.en : site.whatsapp.consultationMessage.ar;
  return `${site.whatsapp.url}?text=${encodeURIComponent(msg)}`;
}
