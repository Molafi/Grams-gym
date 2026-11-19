import { z } from "zod";
import { AUTHOR_NAME_MAX, BODY_MAX, RATING_MAX, RATING_MIN, TESTIMONIAL_STATUSES } from "@/lib/testimonials";

/**
 * Input rules for reviews. Server actions (features/testimonials/actions.ts, phase 3) parse
 * FormData with these; checkboxes arrive as `fd.get("x") === "on"`, like elsewhere in the app.
 */

/** Unify line breaks (textareas send \r\n) and drop bidi override/isolate characters, which can make public text display differently from what was moderated. */
const cleanText = (v: unknown) =>
  typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u202A-\u202E\u2066-\u2069]/g, "").trim() : v;

const rating = z.coerce.number().int().min(RATING_MIN).max(RATING_MAX);
const body = z.preprocess(cleanText, z.string().min(1).max(BODY_MAX));
const locale = z.enum(["ar", "en"]);
export const testimonialId = z.string().regex(/^[a-z0-9]{10,40}$/i);

/** What a member sends from /account. Their name comes from their profile, not from the form. */
export const memberReviewSchema = z.object({
  rating,
  body,
  locale,
  showFullName: z.boolean(),
});
export type MemberReviewInput = z.infer<typeof memberReviewSchema>;

/** A name typed by an admin. No digits or "@", so a phone, email or membership number can't become public. */
const authorName = z.preprocess(
  cleanText,
  z
    .string()
    .min(1)
    .max(AUTHOR_NAME_MAX)
    .refine((v) => !/[\p{Nd}@]/u.test(v), "a name can't contain digits or @"),
);

/** Admin add/edit (reviews collected in person or on WhatsApp, or edits to a member's review). */
export const adminReviewSchema = z.object({
  id: testimonialId.optional(),
  authorName,
  rating,
  body,
  locale,
  status: z.enum(TESTIMONIAL_STATUSES),
  featured: z.boolean(),
  showFullName: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type AdminReviewInput = z.infer<typeof adminReviewSchema>;

/** Approve / reject (or back to pending). */
export const reviewStatusSchema = z.object({ id: testimonialId, status: z.enum(TESTIMONIAL_STATUSES) });

export const reviewFeaturedSchema = z.object({ id: testimonialId, featured: z.boolean() });

/** New order after drag/up-down in the admin: ids top to bottom (sortOrder = position). */
export const reviewOrderSchema = z.object({ ids: z.array(testimonialId).min(1).max(500) });
