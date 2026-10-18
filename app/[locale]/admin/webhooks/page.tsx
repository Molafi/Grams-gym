import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RefreshCw } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { Badge, Card } from "@/components/ui/primitives";
import { retryWebhook } from "@/features/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminWebhooksPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/webhooks`);
  const t = await getTranslations({ locale, namespace: "admin" });
  const f = await getFormatter({ locale });
  const events = await db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-8">
      <h1 className="display text-4xl">{t("nav.webhooks")}</h1>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("webhook.event")}</th>
                <th>{t("webhook.received")}</th>
                <th>{t("status")}</th>
                <th>{t("webhook.attempts")}</th>
                <th>{t("webhook.error")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="font-mono text-xs" dir="ltr">
                      {e.eventName}
                    </span>{" "}
                    {e.testMode ? <Badge tone="navy">TEST</Badge> : null}
                  </td>
                  <td className="tabular whitespace-nowrap text-muted">{f.dateTime(e.createdAt, { dateStyle: "short", timeStyle: "medium" })}</td>
                  <td>
                    <Badge tone={e.error ? "danger" : e.processedAt ? "success" : "warning"}>{e.error ? t("webhook.failed") : e.processedAt ? t("webhook.ok") : "…"}</Badge>
                  </td>
                  <td className="tabular">{e.attempts}</td>
                  <td className="max-w-[360px] truncate font-mono text-xs text-danger" title={e.error ?? ""} dir="ltr">
                    {e.error ?? ""}
                  </td>
                  <td>
                    {e.error ? (
                      <form action={retryWebhook}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button type="submit" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ember">
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t("webhook.retry")}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
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
