import { getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { CheckInScanner } from "@/features/admin/CheckInScanner";

export default async function CheckInPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin.checkin" });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("hint")}</p>
      </div>
      <CheckInScanner />
    </div>
  );
}
