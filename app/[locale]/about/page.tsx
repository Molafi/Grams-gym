import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, ShieldAlert, Target, Zap } from "lucide-react";
import { pageMetadata, type PageProps } from "@/lib/metadata";
import { site } from "@/config/site";
import { getMedia } from "@/lib/media";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { Reveal, RevealImage, RevealText } from "@/components/motion/Reveal";
import { CoachesGrid, ConsultationCTA } from "@/components/home/Sections";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "about", "/about");
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const media = await getMedia();
  const values = [
    { key: "discipline", Icon: Target },
    { key: "energy", Icon: Zap },
    { key: "community", Icon: ShieldAlert },
  ] as const;

  return (
    <>
      <section className="atmosphere pb-24 pt-40">
        <Container className="grid items-center gap-16 lg:grid-cols-2">
          <div className="relative z-10">
            <Eyebrow className="mb-6">{t("eyebrow")}</Eyebrow>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl">
              <RevealText>{t("title")}</RevealText>
              <RevealText delay={0.1}>
                <span className="text-ember">{t("titleAccent")}</span>
              </RevealText>
            </h1>
            <div className="mt-10 space-y-6 text-lg text-muted">
              <p>{t("p1")}</p>
              <p>{t("p2", { years: site.stats.years, members: site.stats.members })}</p>
              <p>{t("p3")}</p>
            </div>
          </div>
          <RevealImage className="aspect-[4/5] rounded-[28px] border border-hairline">
            <Photo item={media.gymInterior} locale={locale} className="h-full w-full grayscale transition-[filter] duration-700 hover:grayscale-0 [@media(hover:none)]:grayscale-0" priority pendingLabel={tc("photoPending")} />
          </RevealImage>
        </Container>
      </section>

      <section className="py-24" aria-labelledby="values-title">
        <Container>
          <h2 id="values-title" className="display mb-14 text-center text-4xl">
            {t("valuesTitle")}
          </h2>
          <ul className="grid gap-5 md:grid-cols-3">
            {values.map(({ key, Icon }, i) => (
              <Reveal as="li" key={key} index={i} className="card p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline-strong">
                  <Icon className="h-5 w-5 text-ember" aria-hidden />
                </span>
                <h3 className="display mt-6 text-2xl">{t(`values.${key}.title`)}</h3>
                <p className="mt-3 text-muted">{t(`values.${key}.body`)}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-24">
        <Container className="grid items-center gap-16 lg:grid-cols-2">
          <RevealImage className="aspect-[16/11] rounded-[28px] border border-hairline">
            <Photo item={media.machines} locale={locale} className="h-full w-full" pendingLabel={tc("photoPending")} />
          </RevealImage>
          <div className="space-y-10">
            {(["vision", "strength"] as const).map((k) => (
              <Reveal key={k}>
                <h2 className="display flex items-center gap-3 text-2xl">
                  <CheckCircle2 className="h-5 w-5 text-ember" aria-hidden />
                  {t(`${k}Title`)}
                </h2>
                <p className="mt-3 text-muted">{t(k)}</p>
              </Reveal>
            ))}
            <ButtonLink href="/services" variant="glass">
              {t("allServices")}
            </ButtonLink>
          </div>
        </Container>
      </section>

      <CoachesGrid locale={locale} />
      <ConsultationCTA locale={locale} />
    </>
  );
}
