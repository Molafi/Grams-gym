import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata, type PageProps } from "@/lib/metadata";
import { getMedia } from "@/lib/media";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { Photo } from "@/components/ui/Photo";
import { Reveal, RevealImage } from "@/components/motion/Reveal";
import { ConsultationCTA } from "@/components/home/Sections";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "facilities", "/facilities");
}

export default async function FacilitiesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "facilities" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const media = await getMedia();
  const items = [
    { key: "weights", media: media.freeWeights },
    { key: "machines", media: media.machines },
    { key: "cardio", media: media.cardio },
    { key: "lounge", media: media.gymInterior },
  ] as const;

  return (
    <>
      <section className="atmosphere pb-16 pt-40">
        <Container>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} />
        </Container>
      </section>
      <section className="py-16">
        <Container className="space-y-28">
          {items.map((it, i) => (
            <div key={it.key} className={`grid items-center gap-12 lg:grid-cols-[1.3fr_1fr] ${i % 2 ? "lg:[&>*:first-child]:order-last" : ""}`}>
              <RevealImage className="aspect-[16/10] rounded-[28px] border border-hairline">
                <Photo item={it.media} locale={locale} className="h-full w-full" priority={i === 0} pendingLabel={tc("photoPending")} sizes="(min-width: 1024px) 60vw, 100vw" />
              </RevealImage>
              <Reveal>
                <p className="tabular text-sm text-ember" dir="ltr">
                  0{i + 1}
                </p>
                <h2 className="display mt-3 text-4xl">{t(`items.${it.key}.title`)}</h2>
                <p className="mt-4 text-lg text-muted">{t(`items.${it.key}.body`)}</p>
              </Reveal>
            </div>
          ))}
        </Container>
      </section>
      <ConsultationCTA locale={locale} />
    </>
  );
}
