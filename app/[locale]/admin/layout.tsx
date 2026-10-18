import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guards";
import { AdminNav } from "./nav";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireRole(locale, "STAFF", `/${locale}/admin`);
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] gap-8 px-5 pb-24 pt-28 sm:px-8">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-28">
          <p className="eyebrow mb-1">{t("title")}</p>
          <p className="mb-6 truncate text-sm text-muted">
            {user.name ?? user.email} · {user.role}
          </p>
          <AdminNav role={user.role} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-6 lg:hidden">
          <AdminNav role={user.role} horizontal />
        </div>
        {children}
      </div>
    </div>
  );
}
