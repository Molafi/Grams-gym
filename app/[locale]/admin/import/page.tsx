import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RefreshCw } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { syncConfigured } from "@/lib/env";
import { formatMemberNumber } from "@/lib/member-number";
import { Card } from "@/components/ui/primitives";
import { ImportTool } from "@/features/admin/ImportTool";
import { SyncNowButton } from "@/features/admin/SyncNowButton";
import { syncStatus } from "@/features/admin/legacy-sync";

export const dynamic = "force-dynamic";

export default async function AdminImportPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/import`);
  const t = await getTranslations({ locale, namespace: "admin.import" });
  const f = await getFormatter({ locale });
  const [plans, sync] = await Promise.all([
    db.plan.findMany({
      where: { kind: "membership" },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: { slug: true, nameAr: true, nameEn: true },
    }),
    syncStatus(),
  ]);
  const when = (iso: string | Date | null) => (iso ? f.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("sync.never"));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </div>

      <Card className="space-y-5 p-6">
        <div>
          <h2 className="display flex items-center gap-2 text-xl">
            <RefreshCw className="h-5 w-5 text-ember" aria-hidden /> {t("sync.title")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">{t("sync.intro")}</p>
          {!syncConfigured ? <p className="mt-3 text-sm text-warning">{t("sync.notConfigured")}</p> : null}
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">{t("sync.imported")}</dt>
            <dd className="display tabular mt-1 text-3xl">{sync.importedMembers}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("sync.activeNow")}</dt>
            <dd className="display tabular mt-1 text-3xl" data-testid="sync-active-now">
              {sync.activeNow}
            </dd>
            <p className="mt-1 text-xs text-muted">{t("sync.activeHint")}</p>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("sync.lastChange")}</dt>
            <dd className="mt-1 text-sm">
              {sync.lastChange ? (
                <>
                  <span className="tabular">{when(sync.lastChange.at)}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {t("sync.lastChangeDetail", { created: sync.lastChange.created, updated: sync.lastChange.updated, periods: sync.lastChange.subscriptions })}
                  </span>
                </>
              ) : (
                <span className="text-muted">{t("sync.lastChangeNone")}</span>
              )}
            </dd>
          </div>
        </dl>

        {sync.lastChange?.conflicts.length ? (
          <p className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
            {t("sync.conflicts", { numbers: sync.lastChange.conflicts.map(formatMemberNumber).join(", ") })}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("sync.table")}</th>
                <th>{t("sync.rows")}</th>
                <th>{t("sync.received")}</th>
              </tr>
            </thead>
            <tbody>
              {sync.tables.map((r) => (
                <tr key={r.table}>
                  <td className="font-mono text-xs" dir="ltr">
                    {r.table}
                  </td>
                  <td className="tabular">{r.rows}</td>
                  <td className="tabular text-muted">{when(r.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SyncNowButton />
      </Card>

      <ImportTool plans={plans.map((p) => ({ slug: p.slug, name: locale === "en" ? p.nameEn : p.nameAr }))} />
    </div>
  );
}
