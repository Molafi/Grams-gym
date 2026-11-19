import { z } from "zod";
import { BANNER_PLACEMENTS, isBannerImagePath, isBannerLink, localInputToDate } from "@/lib/banners";

/**
 * Input rules for banners. Server actions (features/banners/actions.ts, phase 4) parse FormData
 * with these; checkboxes arrive as `fd.get("x") === "on"`, like elsewhere in the app.
 */

const requiredText = (max: number) => z.string().trim().min(1).max(max);
/** Missing, empty or blank → null (stored as NULL). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const optionalLink = optionalText(500).refine((v) => v === null || isBannerLink(v), "must be a site path (/…) or an https:// link");
const optionalImage = optionalText(500).refine((v) => v === null || isBannerImagePath(v), "must be an upload (/media/…) or a site image (/images/…)");

/** `<input type="datetime-local">` value, in Amman time. Empty = no limit. */
const scheduleTime = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || localInputToDate(v) !== null, "invalid date and time")
  .transform((v) => (v ? localInputToDate(v) : null));

export const bannerId = z.string().regex(/^[a-z0-9]{10,40}$/i);

export const bannerSchema = z
  .object({
    id: bannerId.optional(),
    placement: z.enum(BANNER_PLACEMENTS),
    titleAr: requiredText(120),
    titleEn: requiredText(120),
    bodyAr: optionalText(300),
    bodyEn: optionalText(300),
    ctaLabelAr: optionalText(40),
    ctaLabelEn: optionalText(40),
    linkUrl: optionalLink,
    imageDesktopUrl: optionalImage,
    imageMobileUrl: optionalImage,
    startsAt: scheduleTime,
    endsAt: scheduleTime,
    active: z.boolean(),
    dismissible: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .refine((b) => !b.startsAt || !b.endsAt || b.endsAt > b.startsAt, { message: "must end after it starts", path: ["endsAt"] })
  // Every visible string in both languages.
  .refine((b) => !b.bodyAr === !b.bodyEn, { message: "text needs both Arabic and English", path: ["bodyEn"] })
  .refine((b) => !b.ctaLabelAr === !b.ctaLabelEn, { message: "button label needs both Arabic and English", path: ["ctaLabelEn"] })
  .refine((b) => !b.ctaLabelAr || b.linkUrl !== null, { message: "a button needs a link", path: ["linkUrl"] });
export type BannerInput = z.infer<typeof bannerSchema>;

export const bannerActiveSchema = z.object({ id: bannerId, active: z.boolean() });

/** New order within one placement: ids top to bottom (sortOrder = position). */
export const bannerOrderSchema = z.object({ placement: z.enum(BANNER_PLACEMENTS), ids: z.array(bannerId).min(1).max(200) });
