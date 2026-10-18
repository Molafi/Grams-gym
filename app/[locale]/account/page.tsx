import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Card } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { describe, getCurrentSubscription } from "@/features/billing/membership";
import { MembershipSummary } from "@/features/billing/MembershipSummary";

export default async function AccountOverviewPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/account`);
  const [sub, orders] = await Promise.all([
    getCurrentSubscription(user.id),
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const t = await getTranslations({ locale, namespace: "account" });
  const tm = await getTranslations({ locale, namespace: "membership" });
  const to = await getTranslations({ locale, namespace: "order" });
  const f = await getFormatter({ locale });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-7">
        <h2 className="display mb-6 text-xl">{t("membership")}</h2>
        {sub ? (
          <MembershipSummary sub={sub} locale={locale} {...describe(sub)} />
        ) : (
          <div>
            <p className="text-muted">{tm("none")}</p>
            <ButtonLink href="/packages" className="mt-5">
              {tm("browse")}
            </ButtonLink>
          </div>
        )}
      </Card>
      <Card className="p-7">
        <h2 className="display mb-6 text-xl">{t("orders")}</h2>
        {orders.length === 0 ? (
          <p className="text-muted">{t("noOrders")}</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 border-b border-hairline pb-3">
                <div>
                  <p className="tabular font-medium" dir="ltr">
                    {o.number}
                  </p>
                  <p className="text-xs text-muted">{f.dateTime(o.createdAt, { dateStyle: "medium" })}</p>
                </div>
                <Badge>{to(`status.${o.status}`)}</Badge>
                <span className="tabular">{formatMoney(o.totalMinor, o.currency, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
