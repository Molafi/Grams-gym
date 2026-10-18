import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, FlaskConical } from "lucide-react";
import { firstParam, type PageProps } from "@/lib/metadata";
import { paymentSimulatorEnabled } from "@/lib/env";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Container } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/Button";
import { simulateMembershipPayment } from "@/features/billing/actions";
import { planPrice } from "@/features/billing/membership";

export const metadata = { robots: { index: false } };

/** TEST MODE ONLY — stands in for the Lemon Squeezy hosted checkout until it is connected. */
export default async function SimulatedCheckoutPage({ params, searchParams }: PageProps) {
  if (!paymentSimulatorEnabled) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const slug = firstParam(sp.plan) ?? "";
  const rawInterval = firstParam(sp.interval);
  const interval = rawInterval === "quarterly" || rawInterval === "yearly" ? rawInterval : "monthly";
  const user = await requireUser(locale, `/${locale}/checkout/simulate?plan=${slug}&interval=${interval}`);
  const plan = await db.plan.findFirst({ where: { slug, kind: "membership", active: true } });
  if (!plan) notFound();

  const t = await getTranslations({ locale, namespace: "billing" });
  const tp = await getTranslations({ locale, namespace: "packages" });
  const amount = formatMoney(planPrice(plan, interval), plan.currency, locale);

  return (
    <section className="min-h-[80vh] pb-24 pt-40">
      <Container className="max-w-lg">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline bg-ember/10 px-6 py-3 text-sm text-ember">
            <FlaskConical className="h-4 w-4" aria-hidden /> {t("simulatorTitle")}
          </div>
          <div className="p-8">
            <p className="text-sm text-muted">{t("simulatorBody")}</p>
            <div className="mt-8 rounded-2xl border border-hairline p-5">
              <p className="font-medium">{locale === "en" ? plan.nameEn : plan.nameAr}</p>
              <p className="text-sm text-muted">{tp(`interval.${interval}`)}</p>
              <p className="display tabular mt-4 text-3xl">{amount}</p>
              <p className="mt-1 text-xs text-muted" dir="ltr">
                {user.email} · VISA •••• 4242
              </p>
            </div>
            <form action={simulateMembershipPayment} className="mt-8">
              <input type="hidden" name="plan" value={plan.slug} />
              <input type="hidden" name="interval" value={interval} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" size="lg" className="w-full">
                <CreditCard className="h-4 w-4" aria-hidden /> {t("simulatorPay", { amount })}
              </Button>
            </form>
            <ButtonLink href="/checkout/cancelled" variant="ghost" className="mt-3 w-full">
              {t("simulatorCancel")}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
