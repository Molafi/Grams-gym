import { getTranslations, setRequestLocale } from "next-intl/server";
import { firstParam, pageMetadata, type PageProps } from "@/lib/metadata";
import { formatMoney } from "@/lib/money";
import { getSessionUser } from "@/lib/auth/guards";
import { Badge, Container, SectionHeading } from "@/components/ui/primitives";
import { JoinButton, PlanCards } from "@/features/billing/PlanCards";
import { toPlanCard } from "@/features/billing/plan-data";
import { describe, getActivePlans, getAddons, getCurrentSubscription } from "@/features/billing/membership";
import { nullIfDbDown } from "@/lib/db-status";
import { Unavailable } from "@/components/ui/Unavailable";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "packages", "/packages");
}

const INTERVALS = ["monthly", "quarterly", "yearly"] as const;

export default async function PackagesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "packages" });
  const data = await Promise.all([getActivePlans(), getAddons(), getSessionUser()]).catch(nullIfDbDown("memberships page"));
  if (!data) {
    return (
      <section className="atmosphere pb-10 pt-40">
        <Container>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} className="mx-auto text-center [&_.eyebrow]:justify-center [&_p]:mx-auto" />
        </Container>
        <Unavailable locale={locale} />
      </section>
    );
  }
  const [plans, addons, user] = data;
  const current = user ? await getCurrentSubscription(user.id) : null;
  const currentSlug = current && describe(current).active ? current.plan.slug : null;

  const joinSlug = firstParam(sp.join);
  const rawInterval = firstParam(sp.interval);
  const joinInterval = INTERVALS.find((i) => i === rawInterval) ?? "monthly";
  const resumePlan = user && joinSlug ? plans.find((p) => p.slug === joinSlug) : undefined;

  return (
    <>
      <section className="atmosphere pb-10 pt-40">
        <Container>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} className="mx-auto text-center [&_.eyebrow]:justify-center [&_p]:mx-auto" />
        </Container>
      </section>

      {resumePlan ? (
        <Container className="mb-12">
          <div className="card mx-auto flex max-w-2xl flex-col items-center gap-4 border-ember/40 p-6 text-center sm:flex-row sm:text-start">
            <div className="flex-1">
              <p className="font-medium">{locale === "en" ? resumePlan.nameEn : resumePlan.nameAr}</p>
              <p className="text-sm text-muted">{t(`interval.${joinInterval}`)}</p>
            </div>
            <div className="w-full sm:w-64">
              <JoinButton plan={resumePlan.slug} interval={joinInterval} label={t("join", { plan: locale === "en" ? resumePlan.nameEn : resumePlan.nameAr })} primary />
            </div>
          </div>
        </Container>
      ) : null}

      <section className="pb-24">
        <Container>
          <PlanCards plans={plans.map((p) => toPlanCard(p, locale))} currentPlanSlug={currentSlug} initialInterval={joinInterval} />
          <p className="mt-10 text-center text-sm text-muted">{t("payAtDesk")}</p>
          {plans.some((p) => p.isPlaceholder) ? (
            <p className="mt-3 text-center">
              <Badge tone="warning">{t("placeholderNote")}</Badge>
            </p>
          ) : null}
        </Container>
      </section>

      {addons.length > 0 ? (
        <section className="pb-24">
          <Container>
            <h2 className="display mb-8 text-3xl">{t("addonsTitle")}</h2>
            <ul className="grid gap-5 md:grid-cols-2">
              {addons.map((a) => (
                <li key={a.id} className="card flex items-center justify-between gap-6 p-7">
                  <div>
                    <h3 className="font-medium">{locale === "en" ? a.nameEn : a.nameAr}</h3>
                    <p className="mt-1 text-sm text-muted">{(locale === "en" ? a.featuresEn : a.featuresAr).join(" · ")}</p>
                  </div>
                  <p className="display tabular shrink-0 text-2xl">{a.priceOnce != null ? formatMoney(a.priceOnce, a.currency, locale) : "—"}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  );
}
