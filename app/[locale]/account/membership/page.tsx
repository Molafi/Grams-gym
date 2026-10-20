import QRCode from "qrcode";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { firstParam, type PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { Card } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/Button";
import { describe, getCurrentSubscription } from "@/features/billing/membership";
import { MembershipSummary } from "@/features/billing/MembershipSummary";
import { CheckoutConfirming } from "@/features/billing/CheckoutConfirming";
import { MemberCard } from "@/features/billing/MemberCard";
import { cancelMembership, resumeMembership } from "@/features/billing/actions";

export default async function MembershipPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/account/membership`);
  const checkout = firstParam((await searchParams).checkout);
  const sub = await getCurrentSubscription(user.id);
  const t = await getTranslations({ locale, namespace: "membership" });
  const f = await getFormatter({ locale });
  const state = sub ? describe(sub) : null;

  const waiting = checkout === "success" && !state?.active;

  if (!sub || !state) {
    return (
      <div className="space-y-6">
        {waiting ? <CheckoutConfirming /> : null}
        <Card className="p-8">
          <p className="text-muted">{t("none")}</p>
          <ButtonLink href="/packages" className="mt-5">
            {t("browse")}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const qr = await QRCode.toDataURL(`GG:${sub.memberCode}`, { margin: 1, width: 320, color: { dark: "#07080A", light: "#F4F2EE" } });
  const isLs = sub.provider === "lemonsqueezy";
  const isSimulated = sub.lsSubscriptionId?.startsWith("sim_") ?? false;
  const validLabel = state.remaining.at ? `${state.remaining.kind === "renews" ? t("renews") : state.remaining.kind === "starts" ? t("starts") : t("ends")} ${f.dateTime(state.remaining.at, { dateStyle: "medium" })}` : "";

  return (
    <div className="space-y-6">
      {waiting ? <CheckoutConfirming /> : null}
      {sub.status === "past_due" ? (
        <div role="alert" className="card flex items-center gap-3 border-warning/40 p-5 text-sm text-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden /> {t("graceNote")}
        </div>
      ) : null}

      <Card className="p-7">
        <MembershipSummary sub={sub} locale={locale} {...state} />
        {sub.cardLastFour ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <CreditCard className="h-4 w-4" aria-hidden /> {t("card")}:{" "}
            <span dir="ltr" className="tabular text-ink">
              {(sub.cardBrand ?? "card").toUpperCase()} •••• {sub.cardLastFour}
            </span>
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-hairline pt-6">
          {isLs && sub.customerPortalUrl ? (
            <a href={sub.customerPortalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-5 text-sm">
              {t("manage")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          {isLs && sub.updatePaymentMethodUrl ? (
            <a href={sub.updatePaymentMethodUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-5 text-sm">
              {t("updateCard")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          {isLs && state.active && !sub.cancelled ? (
            <form action={cancelMembership}>
              <input type="hidden" name="subscriptionId" value={sub.id} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="danger" title={t("cancelConfirm")}>
                {t("cancel")}
              </Button>
            </form>
          ) : null}
          {isLs && sub.cancelled && state.active ? (
            <form action={resumeMembership}>
              <input type="hidden" name="subscriptionId" value={sub.id} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit">{t("resume")}</Button>
            </form>
          ) : null}
          {!isLs ? <p className="text-sm text-muted">{t("manualNote")}</p> : null}
          {isSimulated ? <p className="w-full text-xs text-muted">{t("simulated")}</p> : null}
        </div>
        {isLs && state.active && !sub.cancelled ? <p className="mt-3 text-xs text-muted">{t("cancelConfirm")}</p> : null}
      </Card>

      {state.active ? (
        <Card className="p-7">
          <h2 className="display mb-6 text-xl">{t("memberCard")}</h2>
          <MemberCard
            name={user.name ?? user.email ?? ""}
            planName={locale === "en" ? sub.plan.nameEn : sub.plan.nameAr}
            qrDataUrl={qr}
            memberCode={sub.memberCode}
            validLabel={validLabel}
          />
        </Card>
      ) : (
        <ButtonLink href="/packages">{t("browse")}</ButtonLink>
      )}
    </div>
  );
}
