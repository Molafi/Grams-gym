import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Download, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { firstParam, type PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser, hasRole } from "@/lib/auth/guards";
import { hasActiveMembership, membershipRemaining, urgency } from "@/lib/membership";
import { INTERVAL_MONTHS } from "@/config/plans";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { DaysLeft } from "@/components/admin/DaysLeft";
import { changeRole } from "@/features/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const q = firstParam((await searchParams).q)?.trim() ?? "";
  const t = await getTranslations({ locale, namespace: "admin" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const f = await getFormatter({ locale });
  const me = await getSessionUser();
  const isAdmin = hasRole(me, "ADMIN");

  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
    : {};
  const users = await db.user.findMany({
    where,
    include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const now = new Date();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl">{t("nav.members")}</h1>
        <a href="/api/admin/export?type=members" className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline-strong px-4 text-sm">
          <Download className="h-4 w-4" aria-hidden /> {t("exportCsv")}
        </a>
      </div>
      <form method="get" className="flex gap-3" role="search">
        <label className="relative flex-1">
          <span className="sr-only">{t("searchMember")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder={t("searchMember")} className="field ps-11" />
        </label>
        <Button type="submit" variant="glass">
          {tc("search")}
        </Button>
      </form>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("member")}</th>
                <th>{t("membershipCol")}</th>
                <th>{t("daysLeft")}</th>
                <th>{t("joined")}</th>
                <th>{t("role")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sub = u.subscriptions.find((s) => hasActiveMembership(s, now, env.MEMBERSHIP_GRACE_DAYS)) ?? u.subscriptions[0];
                const rem = sub ? membershipRemaining(sub, now, env.MEMBERSHIP_GRACE_DAYS) : null;
                const active = sub ? hasActiveMembership(sub, now, env.MEMBERSHIP_GRACE_DAYS) : false;
                return (
                  <tr key={u.id}>
                    <td>
                      <p className="font-medium">
                        {u.name ?? "—"} {u.isTestAccount ? <Badge tone="navy">TEST</Badge> : null} {u.isDemo ? <Badge tone="warning">{tc("demo")}</Badge> : null}
                        {u.deletionRequestedAt ? <Badge tone="danger">DELETE?</Badge> : null}
                      </p>
                      <p className="text-xs text-muted" dir="ltr">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""}
                      </p>
                    </td>
                    <td>{sub ? <span className={active ? "" : "text-muted"}>{locale === "en" ? sub.plan.nameEn : sub.plan.nameAr}</span> : <span className="text-muted">—</span>}</td>
                    <td>
                      {sub && rem ? (
                        <DaysLeft remaining={rem} urgency={urgency(rem)} periodLeft={active ? Math.min(1, rem.days / (INTERVAL_MONTHS[sub.interval] * 30)) : 0} locale={locale} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="tabular whitespace-nowrap text-muted">{f.dateTime(u.createdAt, { dateStyle: "medium" })}</td>
                    <td>
                      {isAdmin && me?.id !== u.id ? (
                        <form action={changeRole} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <select name="role" defaultValue={u.role} className="field !w-auto !py-1.5 text-xs" aria-label={t("changeRole")}>
                            <option value="MEMBER">MEMBER</option>
                            <option value="STAFF">STAFF</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                          <button type="submit" className="text-xs text-muted hover:text-ember">
                            {tc("save")}
                          </button>
                        </form>
                      ) : (
                        <Badge>{u.role}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
