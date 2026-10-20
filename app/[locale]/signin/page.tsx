import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eye, FlaskConical, ShieldCheck, UserRound } from "lucide-react";
import { firstParam, pageMetadata, type PageProps } from "@/lib/metadata";
import { env, guestAdminEnabled, guestAdminPassword, testAccountsEnabled, testAdminEnabled } from "@/lib/env";
import { GUEST_ADMIN_NUMBER, TEST_MEMBER_NUMBER } from "@/lib/demo-accounts";
import { formatMemberNumber } from "@/lib/member-number";
import { getSessionUser } from "@/lib/auth/guards";
import { redirect } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { getMedia } from "@/lib/media";
import { Link } from "@/lib/i18n/navigation";
import { signInAsGuestAdmin, signInAsTestAccount } from "@/features/auth/actions";
import { RegisterForm, SignInForm } from "@/features/auth/AuthForms";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "signin", "/signin", { noindex: true });
}

export default async function SignInPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const callbackUrl = firstParam(sp.callbackUrl) ?? "";
  const error = firstParam(sp.error);
  const mode = firstParam(sp.mode) === "register" ? "register" : "signin";

  const user = await getSessionUser();
  if (user) {
    const safe = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl.replace(/^\/(ar|en)(?=\/|$)/, "") || "/" : "/account";
    redirect({ href: safe, locale });
  }

  const t = await getTranslations({ locale, namespace: "auth" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const media = await getMedia();

  return (
    <section className="atmosphere flex min-h-[90vh] items-center pb-24 pt-36">
      <Container className="max-w-md">
        <div className="card p-8 sm:p-10">
          <Logo src={media.logo.src} className="h-16 w-16" />
          <h1 className="display mt-6 text-3xl">{mode === "register" ? t("registerTitle") : t("title")}</h1>
          <p className="mt-3 text-muted">{mode === "register" ? t("registerSubtitle") : t("subtitle")}</p>

          {error ? (
            <p role="alert" className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error === "rate" ? tc("rateLimited") : error === "db" ? t("errors.db") : t("error")}
            </p>
          ) : null}

          <div className="mt-8">
            {mode === "register" ? <RegisterForm callbackUrl={callbackUrl} /> : <SignInForm callbackUrl={callbackUrl} />}
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "register" ? t("haveNumber") : t("noNumber")}{" "}
            <Link
              href={{ pathname: "/signin", query: { ...(mode === "register" ? {} : { mode: "register" }), ...(callbackUrl ? { callbackUrl } : {}) } }}
              className="text-ember underline underline-offset-4"
            >
              {mode === "register" ? t("signIn") : t("createAccount")}
            </Link>
          </p>

          {testAccountsEnabled ? (
            <div className="mt-8 rounded-2xl border border-dashed border-ember/50 bg-ember/[.04] p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-ember">
                <FlaskConical className="h-4 w-4" aria-hidden /> {t("testTitle")}
              </p>
              <div className="mt-4 grid gap-2">
                <form action={signInAsTestAccount}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="kind" value="member" />
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                  <Button type="submit" className="w-full" data-testid="test-member-login">
                    <UserRound className="h-4 w-4" aria-hidden /> {t("testMember")}
                  </Button>
                </form>
                {testAdminEnabled ? (
                  <form action={signInAsTestAccount}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="kind" value="admin" />
                    <input type="hidden" name="callbackUrl" value={callbackUrl} />
                    <Button type="submit" variant="glass" className="w-full" data-testid="test-admin-login">
                      <ShieldCheck className="h-4 w-4" aria-hidden /> {t("testAdmin")}
                    </Button>
                  </form>
                ) : null}
                {testAdminEnabled && guestAdminEnabled ? (
                  <form action={signInAsGuestAdmin}>
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="glass" className="w-full" data-testid="guest-admin-login">
                      <Eye className="h-4 w-4" aria-hidden /> {t("testGuest")}
                    </Button>
                  </form>
                ) : null}
              </div>
              {/* The same accounts also work in the form above (handy for sharing with someone). */}
              <dl className="mt-4 grid gap-1 font-mono text-xs text-muted" dir="ltr">
                {env.TEST_MEMBER_PASSWORD ? (
                  <div className="flex justify-between gap-3">
                    <dt>{t("testMemberShort")}</dt>
                    <dd>
                      {formatMemberNumber(TEST_MEMBER_NUMBER)} · {env.TEST_MEMBER_PASSWORD}
                    </dd>
                  </div>
                ) : null}
                {testAdminEnabled && guestAdminEnabled && guestAdminPassword ? (
                  <div className="flex justify-between gap-3">
                    <dt>{t("testGuestShort")}</dt>
                    <dd>
                      {formatMemberNumber(GUEST_ADMIN_NUMBER)} · {guestAdminPassword}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs text-muted">{t("testNote")}</p>
            </div>
          ) : null}

          <p className="mt-8 text-center text-xs text-muted">
            {t.rich("terms", {
              terms: (chunks) => (
                <Link href="/legal/terms" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </Container>
    </section>
  );
}
