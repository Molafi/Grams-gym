import { setRequestLocale } from "next-intl/server";
import { pageMetadata, type PageProps } from "@/lib/metadata";
import { Hero } from "@/components/home/Hero";
import { StorySection } from "@/components/home/StorySection";
import { CoachesGrid, ConsultationCTA, FacilitiesStrip, PackagesPreview, ShopHighlights } from "@/components/home/Sections";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "home", "/");
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero locale={locale} />
      <PackagesPreview locale={locale} />
      <ShopHighlights locale={locale} />
      <FacilitiesStrip locale={locale} />
      <CoachesGrid locale={locale} />
      <ConsultationCTA locale={locale} />
      {/* The scroll story with the 3D weights closes the page, right above the footer. */}
      <StorySection />
    </>
  );
}
