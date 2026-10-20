import { getTranslations, setRequestLocale } from "next-intl/server";
import { Apple, Dumbbell, HeartPulse, UserRoundCheck } from "lucide-react";
import { pageMetadata, type PageProps } from "@/lib/metadata";
import { getMedia } from "@/lib/media";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { Photo } from "@/components/ui/Photo";
import { Reveal, RevealImage } from "@/components/motion/Reveal";
import { ConsultationCTA } from "@/components/home/Sections";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "services", "/services");
}

export default async function ServicesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "services" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const media = await getMedia();
  const items = [
    { key: "training", Icon: Dumbbell, media: media.freeWeights },
    { key: "personal", Icon: UserRoundCheck, media: media.gymInterior },
    { key: "nutrition", Icon: Apple, media: media.nutrition },
    { key: "cardio", Icon: HeartPulse, media: media.cardio },
  ] as const;

  return (
    <>
      <section className="atmosphere pb-16 pt-40">
        <Container>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} />
        </Container>
      </section>
      <section className="py-16">
        <Container className="grid gap-6 md:grid-cols-2">
          {items.map(({ key, Icon, media: m }, i) => (
            <Reveal key={key} index={i} as="article" className="card overflow-hidden">
              <RevealImage className="aspect-[16/9]">
                <Photo item={m} locale={locale} className="h-full w-full" pendingLabel={tc("photoPending")} sizes="(min-width: 768px) 50vw, 100vw" />
              </RevealImage>
              <div className="p-8">
                <Icon className="h-6 w-6 text-ember" aria-hidden />
                <h2 className="display mt-5 text-2xl">{t(`items.${key}.title`)}</h2>
                <p className="mt-3 text-muted">{t(`items.${key}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </Container>
      </section>
      <ConsultationCTA locale={locale} />
    </>
  );
}
