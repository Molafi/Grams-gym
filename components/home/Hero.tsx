import { getTranslations } from "next-intl/server";
import { ArrowDown } from "lucide-react";
import { whatsappLink } from "@/config/site";
import { ButtonLink, ExternalButton } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/primitives";
import { RevealText } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { HeroStage } from "./HeroStage";

export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "home.hero" });
  return (
    <HeroStage sceneLabel={t("sceneLabel")}>
      <Eyebrow className="mb-8">{t("eyebrow")}</Eyebrow>
      <h1 className="display text-[clamp(3.2rem,9vw,8.5rem)]">
        <RevealText>{t("title")}</RevealText>
        <RevealText delay={0.12}>
          <span className="text-ember">{t("titleAccent")}</span>
        </RevealText>
      </h1>
      <p className="mt-8 max-w-xl text-lg text-muted text-pretty">{t("subtitle")}</p>
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Magnetic>
          <ButtonLink href="/packages" size="lg">
            {t("ctaPrimary")}
          </ButtonLink>
        </Magnetic>
        <ExternalButton href={whatsappLink(locale)} variant="glass" size="lg">
          {t("ctaSecondary")}
        </ExternalButton>
      </div>
      <a href="#story" className="mt-16 hidden items-center gap-3 text-xs text-muted transition-colors hover:text-ink lg:inline-flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline">
          <ArrowDown className="h-4 w-4" aria-hidden />
        </span>
        {t("scroll")}
      </a>
    </HeroStage>
  );
}
