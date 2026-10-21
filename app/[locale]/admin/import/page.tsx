import { getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ImportTool } from "@/features/admin/ImportTool";

export const dynamic = "force-dynamic";

export default async function AdminImportPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/import`);
  const t = await getTranslations({ locale, namespace: "admin.import" });
  const plans = await db.plan.findMany({
    where: { kind: "membership" },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    select: { slug: true, nameAr: true, nameEn: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </div>
      <ImportTool plans={plans.map((p) => ({ slug: p.slug, name: locale === "en" ? p.nameEn : p.nameAr }))} />
    </div>
  );
}
