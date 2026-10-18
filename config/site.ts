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
   * Opening hours — the old site had TWO conflicting versions.
   * Using the Contact-page version (it had AM/PM) as instructed. TODO(owner): confirm.
   * Footer version was: Sat–Wed 7:00–11:00, Thu 7:00–9:00, Fri 6:00–9:00.
   */
  hours: [
    { key: "satWed", days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"], opens: "07:00", closes: "11:00", label: { ar: "7 صباحاً – 11 صباحاً", en: "7 AM – 11 AM" } },
    { key: "thu", days: ["Thursday"], opens: "19:00", closes: "21:00", label: { ar: "7 مساءً – 9 مساءً", en: "7 PM – 9 PM" } },
    { key: "fri", days: ["Friday"], opens: "18:00", closes: "21:00", label: { ar: "6 مساءً – 9 مساءً", en: "6 PM – 9 PM" } },
  ],
  // TODO(owner): coach photos were not in the files received (and the old ones were ~10 KB).
  // Drop high-res portraits into /public/images/coaches/ and set `photo` (e.g. "/images/coaches/ahmad.jpg").
  coaches: [
    { key: "ahmad", photo: null as string | null },
    { key: "amr", photo: null as string | null },
    { key: "simon", photo: null as string | null },
    { key: "zaid", photo: null as string | null },
  ],
  credit: { label: "SAY AI AGENCY" },
  currency: "JOD",
} as const;

export type Site = typeof site;

export function whatsappLink(locale: string) {
  const msg = locale === "en" ? site.whatsapp.consultationMessage.en : site.whatsapp.consultationMessage.ar;
  return `${site.whatsapp.url}?text=${encodeURIComponent(msg)}`;
}
