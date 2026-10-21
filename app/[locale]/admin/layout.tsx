import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { AdminNav } from "./nav";
import { GuestGuard } from "@/features/admin/GuestGuard";
import { signOutAction } from "@/features/auth/actions";
import { Link } from "@/lib/i18n/navigation";

export const metadata = { robots: { index: false, follow: false } };

/** Lives outside <GuestGuard> (which blocks every form) so the view-only guest can sign out too. */
function SignOutButton({ locale, label, className = "" }: { locale: string; label: string; className?: string }) {
  return (
    <form action={signOutAction} className={className}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        data-testid="admin-sign-out"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/[.04] hover:text-ink"
      >
        <LogOut className="flip-rtl h-4 w-4" aria-hidden /> {label}
      </button>
    </form>
  );
}

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireRole(locale, "STAFF", `/${locale}/admin`);
  const t = await getTranslations({ locale, namespace: "admin" });
  const ta = await getTranslations({ locale, namespace: "account" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] gap-8 px-5 pb-24 pt-28 sm:px-8">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-28">
          <p className="eyebrow mb-1">{t("title")}</p>
          <p className="mb-6 truncate text-sm text-muted">
            {user.name ?? user.email} · {user.role}
          </p>
          <AdminNav role={user.role} />
          <div className="mt-4 border-t border-hairline pt-4">
            <SignOutButton locale={locale} label={tn("signOut")} />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-6 lg:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="truncate text-sm text-muted">
              {user.name ?? user.email} · {user.role}
            </p>
            <SignOutButton locale={locale} label={tn("signOut")} className="shrink-0" />
          </div>
          <AdminNav role={user.role} horizontal />
        </div>
        {user.isGuest ? (
          <p role="status" className="mb-6 rounded-xl border border-navy/60 bg-white/[.04] px-4 py-3 text-sm">
            {t("guestBanner")}
          </p>
        ) : null}
        {user.mustChangePassword ? (
          <p role="alert" className="mb-6 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
            {ta("mustChange")}{" "}
            <Link href="/account/settings" className="text-ember underline underline-offset-4">
              {ta("mustChangeLink")}
            </Link>
          </p>
        ) : null}
        <GuestGuard enabled={user.isGuest}>{children}</GuestGuard>
      </div>
    </div>
  );
}
