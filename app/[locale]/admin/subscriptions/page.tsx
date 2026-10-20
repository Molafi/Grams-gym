import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Download, Search } from "lucide-react";
import type { SubscriptionStatus } from "@prisma/client";
import { firstParam, type PageProps } from "@/lib/metadata";
import { hasRole, requireRole } from "@/lib/auth/guards";
import { SUBSCRIPTION_STATUSES } from "@/lib/membership";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { DaysLeft } from "@/components/admin/DaysLeft";
import { statusTone } from "@/features/billing/MembershipSummary";
import { getActivePlans } from "@/features/billing/membership";
import { listSubscriptions } from "@/features/admin/queries";
import { cancelManualMembership, extendMembership } from "@/features/admin/actions";
import { GrantForm } from "@/features/admin/GrantForm";
import { formatMemberNumber } from "@/lib/member-number";

export const dynamic = "force-dynamic";

const WINDOWS = [3, 7, 14, 30];

export default async function AdminSubscriptionsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Each admin page checks the role itself; the layout check alone is not an auth boundary.
  const me = await requireRole(locale, "STAFF", `/${locale}/admin/subscriptions`);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "admin" });
  const tb = await getTranslations({ locale, namespace: "billing" });
  const tp = await getTranslations({ locale, namespace: "packages" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const f = await getFormatter({ locale });

  const q = firstParam(sp.q) ?? "";
  const statusRaw = firstParam(sp.status);
  const status = statusRaw === "activeOnly" ? "activeOnly" : (SUBSCRIPTION_STATUSES.find((s) => s === statusRaw) as SubscriptionStatus | undefined);
  const withinRaw = Number(firstParam(sp.within));
  const within = WINDOWS.includes(withinRaw) ? withinRaw : undefined;

  const [subs, plans] = await Promise.all([listSubscriptions({ q, status, withinDays: within }), getActivePlans()]);
  const exportQuery = new URLSearchParams({ type: "subscriptions", ...(q ? { q } : {}), ...(statusRaw ? { status: statusRaw } : {}), ...(within ? { within: String(within) } : {}) });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl">{t("nav.subscriptions")}</h1>
        <a href={`/api/admin/export?${exportQuery}`} download className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline-strong px-4 text-sm">
          <Download className="h-4 w-4" aria-hidden /> {t("exportCsv")}
        </a>
      </div>

      <Card className="p-6">
        <h2 className="font-medium">{t("grant")}</h2>
        <p className="mb-5 mt-1 text-sm text-muted">{t("grantHint")}</p>
        <GrantForm plans={plans.map((p) => ({ slug: p.slug, name: locale === "en" ? p.nameEn : p.nameAr }))} />
      </Card>

      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">{t("searchMember")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder={t("searchMember")} className="field ps-11" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{t("filterStatus")}</span>
          <select name="status" defaultValue={statusRaw ?? ""} className="field">
            <option value="">{tc("all")}</option>
            <option value="activeOnly">{tb("status.active")} ✓</option>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tb(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{t("filterWindow")}</span>
          <select name="within" defaultValue={within ? String(within) : ""} className="field">
            <option value="">{t("anyTime")}</option>
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {tc("days", { count: w })}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="glass">
          {tc("filter")}
        </Button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("member")}</th>
                <th>{t("plan")}</th>
                <th>{t("provider")}</th>
                <th>{t("status")}</th>
                <th>{t("start")}</th>
                <th>{t("end")}</th>
                <th>{t("daysLeft")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-medium">
                      {s.user.name ?? "—"} {s.user.isDemo ? <Badge tone="warning">{tc("demo")}</Badge> : null}
                      {s.testMode ? <Badge tone="navy">TEST</Badge> : null}
                    </p>
                    <p className="text-xs text-muted" dir="ltr">
                      {formatMemberNumber(s.user.memberNumber)}
                      {s.user.phone ? ` · ${s.user.phone}` : ""}
                    </p>
                  </td>
                  <td>
                    {locale === "en" ? s.plan.nameEn : s.plan.nameAr}
                    <p className="text-xs text-muted">{tp(`interval.${s.interval}`)}</p>
                  </td>
                  <td>
                    <Badge>{s.provider === "manual" ? t("providerManual") : t("providerCard")}</Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone(s.status, s.active)}>{tb(`status.${s.status}`)}</Badge>
                  </td>
                  <td className="tabular whitespace-nowrap text-muted">{f.dateTime(s.startsAt, { dateStyle: "medium" })}</td>
                  <td className="tabular whitespace-nowrap text-muted">{(s.endsAt ?? s.renewsAt) ? f.dateTime((s.endsAt ?? s.renewsAt)!, { dateStyle: "medium" }) : "—"}</td>
                  <td>
                    <DaysLeft remaining={s.remaining} urgency={s.urgency} periodLeft={s.periodLeft} locale={locale} />
                  </td>
                  <td>
                    {s.provider === "manual" ? (
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 3].map((m) => (
                          <form key={m} action={extendMembership}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="months" value={m} />
                            <input type="hidden" name="locale" value={locale} />
                            <button type="submit" className="rounded-full border border-hairline-strong px-3 py-1 text-xs hover:border-ember hover:text-ember">
                              {t("extendBy", { months: m })}
                            </button>
                          </form>
                        ))}
                        {hasRole(me, "ADMIN") && s.active ? (
                          <form action={cancelManualMembership}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="locale" value={locale} />
                            <button type="submit" className="rounded-full border border-danger/40 px-3 py-1 text-xs text-danger hover:bg-danger/10">
                              {t("cancelSub")}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Lemon Squeezy</span>
                    )}
                  </td>
                </tr>
              ))}
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
