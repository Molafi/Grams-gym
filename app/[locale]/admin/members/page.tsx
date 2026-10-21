import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Download, Search, ShieldCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { firstParam, type PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/auth/guards";
import { urgency } from "@/lib/membership";
import { isMembershipActive, remainingFor } from "@/features/billing/membership";
import { INTERVAL_MONTHS } from "@/config/plans";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { DaysLeft } from "@/components/admin/DaysLeft";
import { changeRole } from "@/features/admin/actions";
import { ResetPasswordButton } from "@/features/admin/ResetPasswordButton";
import { TeamForm } from "@/features/admin/TeamForm";
import { formatMemberNumber, parseMemberNumber } from "@/lib/member-number";
import { COACH_KEYS, isCoachKey } from "@/lib/coaches";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Each admin page checks the role itself; the layout check alone is not an auth boundary.
  const me = await requireRole(locale, "STAFF", `/${locale}/admin/members`);
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() ?? "";
  const teamOnly = firstParam(sp.team) === "1";
  const coachRaw = firstParam(sp.coach);
  const coach = isCoachKey(coachRaw) ? coachRaw : undefined;
  const t = await getTranslations({ locale, namespace: "admin" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const tco = await getTranslations({ locale, namespace: "coaches" });
  const f = await getFormatter({ locale });
  const isAdmin = hasRole(me, "ADMIN");

  const asNumber = q ? parseMemberNumber(q) : null;
  const filters: Prisma.UserWhereInput[] = [];
  if (q) {
    filters.push({
      OR: [
        ...(asNumber ? [{ memberNumber: asNumber }] : []),
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }
  if (teamOnly) filters.push({ role: { in: ["STAFF", "ADMIN"] } });
  if (coach) filters.push({ ptCoach: coach });
  const where: Prisma.UserWhereInput = filters.length ? { AND: filters } : {};
  const users = await db.user.findMany({
    where,
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      referredBy: { select: { memberNumber: true, name: true } },
      _count: { select: { referrals: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const now = new Date();
  const filterHref = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, team: teamOnly ? "1" : undefined, coach, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl">{t("nav.members")}</h1>
        <a href="/api/admin/export?type=members" download className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline-strong px-4 text-sm">
          <Download className="h-4 w-4" aria-hidden /> {t("exportCsv")}
        </a>
      </div>

      {isAdmin ? (
        <Card className="p-6">
          <h2 className="display flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-ember" aria-hidden /> {t("teamTitle")}
          </h2>
          <p className="mb-5 mt-2 text-sm text-muted">{t("teamBody")}</p>
          <TeamForm />
        </Card>
      ) : null}

      <form method="get" className="flex flex-wrap gap-3" role="search">
        {teamOnly ? <input type="hidden" name="team" value="1" /> : null}
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">{t("searchMember")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder={t("searchMember")} className="field ps-11" />
        </label>
        <label>
          <span className="sr-only">{t("filterCoach")}</span>
          <select name="coach" defaultValue={coach ?? ""} className="field !w-auto" aria-label={t("filterCoach")}>
            <option value="">{t("anyCoach")}</option>
            {COACH_KEYS.map((k) => (
              <option key={k} value={k}>
                {tco(k)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="glass">
          {tc("search")}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label={t("role")}>
        <a href={filterHref({ team: undefined })} aria-current={!teamOnly ? "true" : undefined} className={`rounded-full border px-4 py-1.5 ${!teamOnly ? "border-ember text-ink" : "border-hairline text-muted hover:text-ink"}`}>
          {t("everyone")}
        </a>
        <a href={filterHref({ team: "1" })} aria-current={teamOnly ? "true" : undefined} className={`rounded-full border px-4 py-1.5 ${teamOnly ? "border-ember text-ink" : "border-hairline text-muted hover:text-ink"}`}>
          {t("onlyTeam")}
        </a>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("member")}</th>
                <th>{t("membershipCol")}</th>
                <th>{t("daysLeft")}</th>
                <th>{t("coachCol")}</th>
                <th>{t("joined")}</th>
                <th>{t("role")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sub = u.subscriptions.find((s) => isMembershipActive(s, now)) ?? u.subscriptions[0];
                const rem = sub ? remainingFor(sub, now) : null;
                const active = sub ? isMembershipActive(sub, now) : false;
                const locked = u.isTestAccount || u.isGuest;
                return (
                  <tr key={u.id}>
                    <td>
                      <p className="font-medium">
                        {u.name ?? "—"} {u.isTestAccount ? <Badge tone="navy">TEST</Badge> : null} {u.isDemo ? <Badge tone="warning">{tc("demo")}</Badge> : null}
                        {u.deletionRequestedAt ? <Badge tone="danger">DELETE?</Badge> : null}
                      </p>
                      <p className="text-xs text-muted" dir="ltr">
                        <span className="font-mono text-ember">{formatMemberNumber(u.memberNumber)}</span>
                        {u.phone ? ` · ${u.phone}` : ""}
                        {u.gender ? ` · ${t(`gender.${u.gender}`)}` : ""}
                        {u.email ? ` · ${u.email}` : ""}
                      </p>
                      {u.referredBy || u._count.referrals > 0 || u.pendingBonusDays > 0 ? (
                        <p className="mt-1 text-xs text-muted">
                          {u.referredBy ? (
                            <span>
                              {t("invitedBy")}{" "}
                              <span className="font-mono" dir="ltr">
                                {formatMemberNumber(u.referredBy.memberNumber)}
                              </span>
                            </span>
                          ) : null}
                          {u.referredBy && u._count.referrals > 0 ? " · " : null}
                          {u._count.referrals > 0 ? t("invitedCount", { count: u._count.referrals }) : null}
                          {u.pendingBonusDays > 0 ? (
                            <span className="text-ember">
                              {u.referredBy || u._count.referrals > 0 ? " · " : null}
                              {t("pendingBonus", { days: tc("days", { count: u.pendingBonusDays }) })}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      {!u.isTestAccount && (isAdmin || u.role === "MEMBER") ? (
                        <div className="mt-1.5">
                          <ResetPasswordButton userId={u.id} />
                        </div>
                      ) : null}
                    </td>
                    <td>{sub ? <span className={active ? "" : "text-muted"}>{locale === "en" ? sub.plan.nameEn : sub.plan.nameAr}</span> : <span className="text-muted">—</span>}</td>
                    <td>
                      {sub && rem ? (
                        <DaysLeft remaining={rem} urgency={urgency(rem)} periodLeft={active ? Math.min(1, rem.days / (INTERVAL_MONTHS[sub.interval] * 30)) : 0} locale={locale} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap">{isCoachKey(u.ptCoach) ? tco(u.ptCoach) : <span className="text-muted">—</span>}</td>
                    <td className="tabular whitespace-nowrap text-muted">{f.dateTime(u.createdAt, { dateStyle: "medium" })}</td>
                    <td>
                      {isAdmin && me?.id !== u.id && !locked ? (
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
                        <Badge tone={u.role === "ADMIN" ? "ember" : "neutral"}>{u.role}</Badge>
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
