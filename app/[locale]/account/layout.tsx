import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { Container } from "@/components/ui/primitives";
import { signOutAction } from "@/features/auth/actions";
import { AccountTabs } from "./tabs";
import { Link } from "@/lib/i18n/navigation";
import { formatMemberNumber } from "@/lib/member-number";

export const metadata = { robots: { index: false } };

export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale, `/${locale}/account`);
  const t = await getTranslations({ locale, namespace: "account" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <section className="min-h-[80vh] pb-24 pt-36">
      <Container>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-3">{t("title")}</p>
            <h1 className="display text-4xl sm:text-5xl">{t("hello", { name: user.name ?? "" })}</h1>
            <p className="mt-3 text-sm text-muted">
              {t("yourNumber")}{" "}
              <span className="font-mono text-base text-ember" dir="ltr">
                {formatMemberNumber(user.memberNumber)}
              </span>
            </p>
          </div>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
              <LogOut className="flip-rtl h-4 w-4" aria-hidden /> {tn("signOut")}
            </button>
          </form>
        </div>
        {user.mustChangePassword ? (
          <p role="alert" className="mb-8 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
            {t("mustChange")}{" "}
            <Link href="/account/settings" className="text-ember underline underline-offset-4">
              {t("mustChangeLink")}
            </Link>
          </p>
        ) : null}
        <AccountTabs />
        <div className="mt-10">{children}</div>
      </Container>
    </section>
  );
}
