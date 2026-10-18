import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Phone } from "lucide-react";
import { site, whatsappLink } from "@/config/site";
import { media } from "@/config/media";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { ButtonLink, ExternalButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { GGMark } from "@/components/ui/GGMark";
import { TiltCard } from "@/components/ui/TiltCard";
import { Reveal, RevealImage } from "@/components/motion/Reveal";
import { ProductCard } from "@/components/shop/ProductCard";
import { PlanCards } from "@/features/billing/PlanCards";
import { toPlanCard } from "@/features/billing/plan-data";
import { getActivePlans } from "@/features/billing/membership";
import { featuredProducts } from "@/features/shop/catalog";
import { Link } from "@/lib/i18n/navigation";

/**
 * The home page is the shop window: if the database is unreachable, skip the
 * data-driven sections (and log) instead of taking the whole page down.
 */
async function orEmpty<T>(what: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (e) {
    console.error(`[home] could not load ${what}; hiding the section`, e instanceof Error ? e.message : e);
    return [];
  }
}

export async function PackagesPreview({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "home.packages" });
  const plans = await orEmpty("plans", getActivePlans);
  if (plans.length === 0) return null;
  return (
    <section className="py-32" aria-labelledby="packages-title">
      <Container>
        <SectionHeading eyebrow={t("eyebrow")} title={<span id="packages-title">{t("title")}</span>} subtitle={t("subtitle")} className="mx-auto mb-16 text-center [&_p]:mx-auto [&_.eyebrow]:justify-center" />
        <PlanCards plans={plans.map((p) => toPlanCard(p, locale))} />
      </Container>
    </section>
  );
}

export async function ShopHighlights({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "home.shop" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const products = await orEmpty("featured products", () => featuredProducts(4));
  if (products.length === 0) return null;
  return (
    <section className="py-32" aria-labelledby="shop-title">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow={t("eyebrow")} title={<span id="shop-title">{t("title")}</span>} subtitle={t("subtitle")} />
          <ButtonLink href="/shop" variant="glass">
            {tc("viewAll")} <ArrowUpRight className="flip-rtl h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p, i) => (
            <Reveal as="li" key={p.id} index={i}>
              <ProductCard product={p} locale={locale} />
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export async function FacilitiesStrip({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "home.facilities" });
  const tf = await getTranslations({ locale, namespace: "facilities.items" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const items = [
    { key: "weights", media: media.freeWeights },
    { key: "machines", media: media.machines },
    { key: "cardio", media: media.cardio },
  ] as const;
  return (
    <section className="py-32" aria-labelledby="facilities-title">
      <Container>
        <SectionHeading eyebrow={t("eyebrow")} title={<span id="facilities-title">{t("title")}</span>} className="mb-14" />
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.key} index={i}>
              <Link href="/facilities" className="group block">
                <RevealImage className="aspect-[4/5] rounded-[24px] border border-hairline">
                  <Photo item={it.media} locale={locale} className="h-full w-full transition-transform duration-[1600ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.04]" pendingLabel={tc("photoPending")} sizes="(min-width: 768px) 33vw, 100vw" />
                </RevealImage>
                <h3 className="display mt-5 text-xl">{tf(`${it.key}.title`)}</h3>
                <p className="mt-1.5 text-sm text-muted">{tf(`${it.key}.body`)}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

export async function CoachesGrid({ locale, withHeading = true }: { locale: string; withHeading?: boolean }) {
  const t = await getTranslations({ locale, namespace: "home.coaches" });
  const tc = await getTranslations({ locale, namespace: "coaches" });
  return (
    <section className="py-32" aria-labelledby={withHeading ? "coaches-title" : undefined}>
      <Container>
        {withHeading ? <SectionHeading eyebrow={t("eyebrow")} title={<span id="coaches-title">{t("title")}</span>} className="mb-14" /> : null}
        <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {site.coaches.map((c, i) => (
            <Reveal as="li" key={c.key} index={i}>
              <TiltCard className="card overflow-hidden">
                <div className="relative aspect-[3/4] bg-[radial-gradient(90%_70%_at_50%_20%,#1c2029,#07080a)]">
                  {c.photo ? (
                    <Image src={c.photo} alt={tc(c.key)} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover grayscale transition-[filter] duration-700 hover:grayscale-0" />
                  ) : (
                    <div role="img" aria-label={tc(c.key)} className="absolute inset-0 flex items-center justify-center">
                      <GGMark className="w-1/2 opacity-15" title="" />
                    </div>
                  )}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
                </div>
                <div className="p-5">
                  <h3 className="font-medium">{tc(c.key)}</h3>
                  <p className="mt-0.5 text-xs text-muted">{tc("role")}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export async function ConsultationCTA({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "cta" });
  return (
    <section className="py-24">
      <Container>
        <div className="card relative overflow-hidden px-8 py-16 sm:px-14">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_120%_at_100%_0%,rgba(11,42,74,.8),transparent_60%)]" />
          <div aria-hidden className="absolute inset-y-0 start-0 w-px bg-gradient-to-b from-transparent via-ember to-transparent" />
          <div className="relative flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
            <div>
              <h2 className="display text-4xl sm:text-5xl">{t("title")}</h2>
              <p className="mt-3 text-lg text-muted">{t("subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <ExternalButton href={whatsappLink(locale)} size="lg">
                {t("button")}
              </ExternalButton>
              <a href={`tel:${site.phone.e164}`} className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline-strong">
                  <Phone className="h-4 w-4 text-ember" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs text-muted">{t("help")}</span>
                  <span className="tabular block font-semibold" dir="ltr">
                    {site.phone.display}
                  </span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
