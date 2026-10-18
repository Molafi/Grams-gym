import { getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { lsVariantId } from "@/lib/env";
import { requireRole } from "@/lib/auth/guards";
import { toMajorString } from "@/lib/money";
import { PlanForm } from "@/features/admin/PlanForm";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/plans`);
  const t = await getTranslations({ locale, namespace: "admin" });
  const plans = await db.plan.findMany({ where: { kind: "membership" }, orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-8">
      <h1 className="display text-4xl">{t("nav.plans")}</h1>
      <div className="space-y-6">
        {plans.map((p) => (
          <PlanForm
            key={p.id}
            plan={{
              id: p.id,
              slug: p.slug,
              nameAr: p.nameAr,
              nameEn: p.nameEn,
              taglineAr: p.taglineAr,
              taglineEn: p.taglineEn,
              featuresAr: p.featuresAr.join("\n"),
              featuresEn: p.featuresEn.join("\n"),
              priceMonthly: toMajorString(p.priceMonthly, p.currency),
              priceQuarterly: toMajorString(p.priceQuarterly, p.currency),
              priceYearly: toMajorString(p.priceYearly, p.currency),
              recommended: p.recommended,
              active: p.active,
              isPlaceholder: p.isPlaceholder,
              variants: (["monthly", "quarterly", "yearly"] as const).map((i) => ({ interval: i, set: Boolean(lsVariantId(p.slug, i)) })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
