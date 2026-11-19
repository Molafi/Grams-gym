-- Reviews (Testimonial) and ads/banners (Banner). Additive only: 3 new enums, 2 new tables,
-- their indexes and one foreign key to "User". Nothing existing is altered or dropped.
--
-- Generated with
--   prisma migrate diff --from-schema-datamodel <main's schema> --to-schema-datamodel prisma/schema.prisma --script
-- and wrapped in a transaction: if any statement fails, nothing is created. Running it a second
-- time fails on the first CREATE TYPE and changes nothing.
--
-- Apply to Neon with the DIRECT (non-pooled) connection string, never with `prisma db push`
-- (db push would also try to drop the legacy_* tables the sync creates at runtime):
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/changes/20261119_reviews_banners.sql

BEGIN;

-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "TestimonialSource" AS ENUM ('member', 'admin');

-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('top_bar', 'home_hero', 'home_inline', 'packages', 'shop');

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'ar',
    "status" "TestimonialStatus" NOT NULL DEFAULT 'pending',
    "source" "TestimonialSource" NOT NULL DEFAULT 'member',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showFullName" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "placement" "BannerPlacement" NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "bodyEn" TEXT,
    "ctaLabelAr" TEXT,
    "ctaLabelEn" TEXT,
    "linkUrl" TEXT,
    "imageDesktopUrl" TEXT,
    "imageMobileUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_userId_key" ON "Testimonial"("userId");

-- CreateIndex
CREATE INDEX "Testimonial_status_idx" ON "Testimonial"("status");

-- CreateIndex
CREATE INDEX "Testimonial_featured_idx" ON "Testimonial"("featured");

-- CreateIndex
CREATE INDEX "Testimonial_sortOrder_idx" ON "Testimonial"("sortOrder");

-- CreateIndex
CREATE INDEX "Banner_placement_active_idx" ON "Banner"("placement", "active");

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
