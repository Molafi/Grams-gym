import { getTranslations, setRequestLocale } from "next-intl/server";
import { FlaskConical, ShieldCheck, UserRound } from "lucide-react";
import { firstParam, pageMetadata, type PageProps } from "@/lib/metadata";
import { googleEnabled, testAccountsEnabled } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/guards";
import { redirect } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { GGMark } from "@/components/ui/GGMark";
import { Link } from "@/lib/i18n/navigation";
import { signInAsTestAccount, signInWithGoogle } from "@/features/auth/actions";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "signin", "/signin", { noindex: true });
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export default async function SignInPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const callbackUrl = firstParam(sp.callbackUrl) ?? "";
  const error = firstParam(sp.error);

  const user = await getSessionUser();
  if (user) {
    const safe = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl.replace(/^\/(ar|en)(?=\/|$)/, "") || "/" : "/account";
    redirect({ href: safe, locale });
  }

  const t = await getTranslations({ locale, namespace: "auth" });
  const tl = await getTranslations({ locale, namespace: "legal" });
  const tc = await getTranslations({ locale, namespace: "common" });

  return (
    <section className="atmosphere flex min-h-[90vh] items-center pb-24 pt-36">
      <Container className="max-w-md">
        <div className="card p-8 sm:p-10">
          <GGMark className="h-9 w-auto" title="" />
          <h1 className="display mt-8 text-3xl">{t("title")}</h1>
          <p className="mt-3 text-muted">{t("subtitle")}</p>

          {error ? (
            <p role="alert" className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error === "rate" ? tc("rateLimited") : error === "google" ? t("googleMissing") : t("error")}
            </p>
          ) : null}

          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" variant="glass" size="lg" className="w-full" disabled={!googleEnabled}>
              <GoogleIcon /> {t("google")}
            </Button>
            {!googleEnabled ? <p className="mt-2 text-center text-xs text-muted">{t("googleMissing")}</p> : null}
          </form>

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
                <form action={signInAsTestAccount}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="kind" value="admin" />
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                  <Button type="submit" variant="glass" className="w-full" data-testid="test-admin-login">
                    <ShieldCheck className="h-4 w-4" aria-hidden /> {t("testAdmin")}
                  </Button>
                </form>
              </div>
              <p className="mt-3 text-xs text-muted">{t("testNote")}</p>
            </div>
          ) : null}

          <p className="mt-8 text-center text-xs text-muted">
            {t.rich("terms", {
              terms: (
                <Link href="/legal/terms" className="underline underline-offset-4">
                  {tl("terms")}
                </Link>
              ),
              privacy: (
                <Link href="/legal/privacy" className="underline underline-offset-4">
                  {tl("privacy")}
                </Link>
              ),
            })}
          </p>
        </div>
      </Container>
    </section>
  );
}
