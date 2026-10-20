import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { site } from "@/config/site";
import { logOptionalReadFailure } from "@/lib/db-status";

/**
 * Business facts editable in /admin/content → "Business info".
 * Defaults come from config/site.ts; the SiteSetting table overrides them.
 */
export const BUSINESS_FIELDS = [
  { key: "phoneDisplay", dir: "ltr" },
  { key: "addressAr", dir: "rtl" },
  { key: "addressEn", dir: "ltr" },
  { key: "whatsappAr", dir: "rtl" },
  { key: "whatsappEn", dir: "ltr" },
  ...site.hours.flatMap((h) => [
    { key: `hours.${h.key}.ar`, dir: "rtl" as const },
    { key: `hours.${h.key}.en`, dir: "ltr" as const },
  ]),
] as const satisfies readonly { key: string; dir: "ltr" | "rtl" }[];

export type BusinessKey = (typeof BUSINESS_FIELDS)[number]["key"];

export function businessDefaults(): Record<string, string> {
  return {
    phoneDisplay: site.phone.display,
    addressAr: site.address.ar,
    addressEn: site.address.en,
    whatsappAr: site.whatsapp.consultationMessage.ar,
    whatsappEn: site.whatsapp.consultationMessage.en,
    ...Object.fromEntries(site.hours.flatMap((h) => [[`hours.${h.key}.ar`, h.label.ar], [`hours.${h.key}.en`, h.label.en]])),
  };
}

/** "079 555 6818" → "+962795556818" (Jordanian local format), or the digits as given. */
export function toE164(display: string): string {
  const d = display.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.startsWith("0")) return `+962${d.slice(1)}`;
  return `+${d}`;
}

export type Business = {
  phone: { display: string; e164: string };
  address: { ar: string; en: string; locality: string; country: string };
  whatsapp: { ar: string; en: string };
  hours: { key: string; days: readonly string[]; opens: string; closes: string; label: { ar: string; en: string } }[];
};

export const getBusiness = cache(async (): Promise<Business> => {
  const v = businessDefaults();
  try {
    for (const r of await db.siteSetting.findMany()) if (Object.hasOwn(v, r.key) && r.value.trim()) v[r.key] = r.value;
  } catch (e) {
    logOptionalReadFailure("business info", e);
  }
  return {
    phone: { display: v.phoneDisplay!, e164: toE164(v.phoneDisplay!) },
    address: { ar: v.addressAr!, en: v.addressEn!, locality: site.address.locality, country: site.address.country },
    whatsapp: { ar: v.whatsappAr!, en: v.whatsappEn! },
    hours: site.hours.map((h) => ({ ...h, label: { ar: v[`hours.${h.key}.ar`]!, en: v[`hours.${h.key}.en`]! } })),
  };
});

export function whatsappHref(locale: string, b: Business) {
  const msg = locale === "en" ? b.whatsapp.en : b.whatsapp.ar;
  // Same number as the phone shown on the site.
  return `https://wa.me/${b.phone.e164.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`;
}
