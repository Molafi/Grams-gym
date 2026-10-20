import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { ProfileForm } from "@/features/account/ProfileForm";
import { ChangePasswordForm } from "@/features/auth/AuthForms";
import { requestDataDeletion } from "@/features/account/actions";

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/settings`);
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  const t = await getTranslations({ locale, namespace: "account" });
  const f = await getFormatter({ locale });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-7">
        <h2 className="display mb-6 text-xl">{t("profile")}</h2>
        <ProfileForm defaults={{ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "", locale: user.locale }} />
      </Card>
      {!user.isTestAccount ? (
        <Card className="h-fit p-7">
          <h2 className="display mb-6 text-xl">{t("passwordTitle")}</h2>
          <ChangePasswordForm />
        </Card>
      ) : null}
      <Card className="h-fit p-7">
        <h2 className="display text-xl">{t("deleteTitle")}</h2>
        <p className="mt-3 text-sm text-muted">{t("deleteBody")}</p>
        {user.deletionRequestedAt ? (
          <p role="status" className="mt-6 text-sm text-warning">
            {t("deleteRequested", { date: f.dateTime(user.deletionRequestedAt, { dateStyle: "medium" }) })}
          </p>
        ) : (
          <form action={requestDataDeletion} className="mt-6">
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="danger">
              {t("deleteButton")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
