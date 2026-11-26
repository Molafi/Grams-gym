import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { Card, Container } from "@/components/ui/primitives";
import { signOutAction } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/AuthForms";
import { AccountTabs } from "./tabs";
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
              <span className="font-mono text-base text-ember" dir="ltr" data-testid="member-number">
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
          // A temporary password (first sign-in with the membership number, or one the front
          // desk gave): choosing a real one comes before everything else in the account.
          <Card className="max-w-xl p-7">
            <h2 className="display text-xl">{t("mustChangeTitle")}</h2>
            <p className="mb-6 mt-2 text-sm text-muted">{t("mustChangeBody")}</p>
            <ChangePasswordForm />
          </Card>
        ) : (
          <>
            <AccountTabs />
            <div className="mt-10">{children}</div>
          </>
        )}
      </Container>
    </section>
  );
}
