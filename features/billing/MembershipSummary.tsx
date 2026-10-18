import { getFormatter, getTranslations } from "next-intl/server";
import type { Remaining } from "@/lib/membership";
import { Badge } from "@/components/ui/primitives";
import type { SubscriptionWithPlan } from "./membership";

export function statusTone(status: string, active: boolean): "success" | "warning" | "danger" | "neutral" {
  if (status === "past_due") return "warning";
  if (active) return "success";
  if (status === "expired" || status === "unpaid") return "danger";
  return "neutral";
}

export async function MembershipSummary({ sub, active, remaining, locale }: { sub: SubscriptionWithPlan; active: boolean; remaining: Remaining; locale: string }) {
  const t = await getTranslations({ locale, namespace: "membership" });
  const tb = await getTranslations({ locale, namespace: "billing" });
  const tp = await getTranslations({ locale, namespace: "packages" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const f = await getFormatter({ locale });
  const dateLabel = remaining.kind === "renews" ? t("renews") : t("ends");

  return (
    <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-sm text-muted">{t("plan")}</dt>
        <dd className="mt-1 font-medium">
          {locale === "en" ? sub.plan.nameEn : sub.plan.nameAr} · {tp(`interval.${sub.interval}`)}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted">{t("status")}</dt>
        <dd className="mt-1">
          <Badge tone={statusTone(sub.status, active)}>{tb(`status.${sub.status}`)}</Badge>
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted">{dateLabel}</dt>
        <dd className="tabular mt-1 font-medium">{remaining.at ? f.dateTime(remaining.at, { dateStyle: "medium" }) : "—"}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted">{t("daysLeft")}</dt>
        <dd className="display tabular mt-1 text-2xl">{active ? tc("days", { count: remaining.days }) : "—"}</dd>
      </div>
    </dl>
  );
}
