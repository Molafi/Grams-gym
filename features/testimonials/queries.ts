import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fallbackIfTableMissing, optionalRead } from "@/lib/db-status";
import { memo } from "@/lib/memo";
import { publicAuthorName, type TestimonialStatus } from "@/lib/testimonials";

/**
 * A review as the public site gets it: the display name only (never the stored full name unless
 * the reviewer opted in) and nothing that links it to an account.
 */
export type PublicTestimonial = {
  id: string;
  /** First name + last initial, or the full name if allowed. "" = show a generic label. */
  name: string;
  rating: number;
  body: string;
  /** Language the review is written in (for `lang`/`dir` on the card). */
  locale: "ar" | "en";
  featured: boolean;
  createdAt: Date;
};

/** Approved reviews in display order: featured first, then the admin's order, then newest. */
const approved = memo(60_000, () =>
  db.testimonial
    .findMany({
      where: { status: "approved" },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: { id: true, authorName: true, showFullName: true, rating: true, body: true, locale: true, featured: true, createdAt: true },
    })
    .then((rows) =>
      rows.map(
        (r): PublicTestimonial => ({
          id: r.id,
          name: publicAuthorName(r),
          rating: r.rating,
          body: r.body,
          locale: r.locale,
          featured: r.featured,
          createdAt: r.createdAt,
        }),
      ),
    )
    .catch(fallbackIfTableMissing("reviews", [] as PublicTestimonial[])),
);

/** Call after any change to reviews (admin or member) so the site shows it at once. */
export const clearTestimonialsCache = () => approved.clear();

/** Approved reviews for the home page and /reviews. Empty if the database is unavailable. */
export const getPublicTestimonials = cache(
  async (): Promise<PublicTestimonial[]> => (await optionalRead("reviews", () => approved.get("all"))) ?? [],
);

/** The signed-in member's own review, for the form in /account. */
export function getMemberTestimonial(userId: string) {
  return db.testimonial.findUnique({
    where: { userId },
    select: { id: true, rating: true, body: true, locale: true, status: true, showFullName: true, updatedAt: true },
  });
}

const adminInclude = { user: { select: { memberNumber: true, name: true } } } satisfies Prisma.TestimonialInclude;
export type AdminTestimonial = Prisma.TestimonialGetPayload<{ include: typeof adminInclude }>;

/** Admin list: pending first (enum order), then the public order. */
export function listTestimonialsForAdmin(status?: TestimonialStatus): Promise<AdminTestimonial[]> {
  return db.testimonial.findMany({
    where: status ? { status } : {},
    include: adminInclude,
    orderBy: [{ status: "asc" }, { featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
}
