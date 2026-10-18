import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/audit`);
  const t = await getTranslations({ locale, namespace: "admin" });
  const f = await getFormatter({ locale });
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { name: true, email: true } } } });

  return (
    <div className="space-y-8">
      <h1 className="display text-4xl">{t("nav.audit")}</h1>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("audit.when")}</th>
                <th>{t("audit.actor")}</th>
                <th>{t("audit.action")}</th>
                <th>{t("audit.entity")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="tabular whitespace-nowrap text-muted">{f.dateTime(l.createdAt, { dateStyle: "short", timeStyle: "medium" })}</td>
                  <td>{l.actor?.name ?? l.actor?.email ?? "system"}</td>
                  <td className="font-mono text-xs" dir="ltr">
                    {l.action}
                  </td>
                  <td className="font-mono text-xs text-muted" dir="ltr">
                    {l.entity}
                    {l.entityId ? `:${l.entityId.slice(0, 10)}` : ""} {l.meta ? JSON.stringify(l.meta).slice(0, 120) : ""}
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted">
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
