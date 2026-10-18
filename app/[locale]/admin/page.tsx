import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, CalendarClock, Coins, DoorOpen, Package, TrendingUp, UserCheck, UserX } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { formatMoney } from "@/lib/money";
import { site } from "@/config/site";
import { Badge, Card } from "@/components/ui/primitives";
import { DaysLeft } from "@/components/admin/DaysLeft";
import { Link } from "@/lib/i18n/navigation";
import { dashboardStats } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin" });
  const to = await getTranslations({ locale, namespace: "order" });
  const f = await getFormatter({ locale });
  const s = await dashboardStats();
  const cur = site.currency;
  const now = new Date();

  const kpis = [
    { label: t("kpi.active"), value: String(s.activeCount), Icon: UserCheck, tone: "text-success", href: "/admin/subscriptions?status=activeOnly" },
    { label: t("kpi.expiring7"), value: String(s.expiring7), Icon: CalendarClock, tone: s.expiring7 ? "text-warning" : "text-muted", href: "/admin/subscriptions?within=7" },
    { label: t("kpi.pastDue"), value: String(s.pastDue), Icon: AlertTriangle, tone: s.pastDue ? "text-danger" : "text-muted", href: "/admin/subscriptions?status=past_due" },
    { label: t("kpi.expired30"), value: String(s.expired30), Icon: UserX, tone: "text-muted", href: "/admin/subscriptions?status=expired" },
    { label: t("kpi.mrr"), value: formatMoney(s.mrrMinor, cur, locale), Icon: TrendingUp, tone: "text-ember", href: "/admin/subscriptions" },
    { label: t("kpi.revenue30"), value: formatMoney(s.revenue30Minor, cur, locale), Icon: Coins, tone: "text-ink", href: "/admin/orders" },
    { label: t("kpi.openOrders"), value: String(s.openOrders), Icon: Package, tone: s.openOrders ? "text-ember" : "text-muted", href: "/admin/orders" },
    { label: t("kpi.checkinsToday"), value: String(s.checkinsToday), Icon: DoorOpen, tone: "text-ink", href: "/admin/checkin" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="display text-4xl">{t("nav.dashboard")}</h1>

      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label}>
            <Link href={k.href} className="card block p-5 transition-colors hover:border-hairline-strong">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{k.label}</span>
                <k.Icon className={`h-4 w-4 ${k.tone}`} aria-hidden />
              </div>
              <p className={`display tabular mt-3 text-3xl ${k.tone}`}>{k.value}</p>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 className="font-medium">{t("expiringTitle")}</h2>
          <Link href="/admin/subscriptions?within=14" className="text-sm text-muted hover:text-ink">
            {t("nav.subscriptions")} →
          </Link>
        </div>
        {s.expiringSoon.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">{t("expiringEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("member")}</th>
                  <th>{t("plan")}</th>
                  <th>{t("provider")}</th>
                  <th>{t("end")}</th>
                  <th>{t("daysLeft")}</th>
                </tr>
              </thead>
              <tbody>
                {s.expiringSoon.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <p className="font-medium">{sub.user.name ?? "—"}</p>
                      <p className="text-xs text-muted" dir="ltr">
                        {sub.user.phone ?? sub.user.email}
                      </p>
                    </td>
                    <td>{locale === "en" ? sub.plan.nameEn : sub.plan.nameAr}</td>
                    <td>
                      <Badge>{sub.provider === "manual" ? t("providerManual") : t("providerCard")}</Badge>
                    </td>
                    <td className="tabular text-muted">{sub.remaining.at ? f.dateTime(sub.remaining.at, { dateStyle: "medium" }) : "—"}</td>
                    <td>
                      <DaysLeft remaining={sub.remaining} urgency={sub.urgency} periodLeft={sub.periodLeft} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-hairline px-6 py-4 font-medium">{t("recentOrders")}</h2>
          <ul className="divide-y divide-hairline">
            {s.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <p className="tabular font-medium" dir="ltr">
                    {o.number}
                  </p>
                  <p className="truncate text-xs text-muted">{o.user.name ?? o.user.email}</p>
                </div>
                <Badge>{to(`status.${o.status}`)}</Badge>
                <span className="tabular">{formatMoney(o.totalMinor, o.currency, locale)}</span>
              </li>
            ))}
            {s.recentOrders.length === 0 ? <li className="px-6 py-8 text-center text-sm text-muted">—</li> : null}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <h2 className="border-b border-hairline px-6 py-4 font-medium">{t("recentEvents")}</h2>
          <ul className="divide-y divide-hairline">
            {s.recentEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <span className="font-mono text-xs" dir="ltr">
                  {e.eventName}
                </span>
                <span className="text-xs text-muted">{f.relativeTime(e.createdAt, now)}</span>
                <Badge tone={e.error ? "danger" : e.processedAt ? "success" : "warning"}>{e.error ? t("webhook.failed") : t("webhook.ok")}</Badge>
              </li>
            ))}
            {s.recentEvents.length === 0 ? <li className="px-6 py-8 text-center text-sm text-muted">—</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
