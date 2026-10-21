import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Gift, Share2, Users } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatMemberNumber } from "@/lib/member-number";
import { canStillBeReferred, REFERRAL_WINDOW_DAYS } from "@/lib/referral";
import { site } from "@/config/site";
import { Badge, Card } from "@/components/ui/primitives";
import { ReferralForm } from "@/features/account/ReferralForm";

/** Only the first name of an invited friend is shown to the inviter. */
const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] || "—";

export default async function ReferralsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/referrals`);
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      id: true,
      memberNumber: true,
      createdAt: true,
      referredById: true,
      importedAt: true,
      isTestAccount: true,
      isGuest: true,
      referredBy: { select: { name: true, memberNumber: true } },
      referrals: { select: { name: true, createdAt: true, referralRewardedAt: true }, orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  const t = await getTranslations({ locale, namespace: "account" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const f = await getFormatter({ locale });
  const number = formatMemberNumber(user.memberNumber);
  const days = tc("days", { count: env.REFERRAL_BONUS_DAYS });
  const shareText = t("referShareText", { number, site: `${site.url}/${locale}/signin?mode=register` });
  const rewarded = user.referrals.filter((r) => r.referralRewardedAt).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-7">
        <h2 className="display flex items-center gap-2 text-xl">
          <Gift className="h-5 w-5 text-ember" aria-hidden /> {t("referTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted">{env.REFERRAL_BONUS_DAYS > 0 ? t("referBody", { days }) : t("referBodyNoReward")}</p>
        <p className="mt-6 text-xs text-muted">{t("yourNumber")}</p>
        <p className="display tabular mt-1 select-all text-4xl text-ember" dir="ltr">
          {number}
        </p>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-5 text-sm hover:text-ember"
        >
          <Share2 className="h-4 w-4" aria-hidden /> {t("referShare")}
        </a>
      </Card>

      <Card className="h-fit p-7">
        <h2 className="display text-xl">{t("referWhoTitle")}</h2>
        {user.referredBy ? (
          <p className="mt-3 text-sm">
            {t("referInvitedBy", { name: firstName(user.referredBy.name), number: formatMemberNumber(user.referredBy.memberNumber) })}
          </p>
        ) : !user.isGuest && canStillBeReferred(user, new Date()) ? (
          <>
            <p className="mb-4 mt-2 text-sm text-muted">{t("referWhoBody", { days: REFERRAL_WINDOW_DAYS })}</p>
            <ReferralForm />
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("referWhoClosed", { days: REFERRAL_WINDOW_DAYS })}</p>
        )}
      </Card>

      <Card className="p-7 lg:col-span-2">
        <h2 className="display flex items-center gap-2 text-xl">
          <Users className="h-5 w-5 text-ember" aria-hidden /> {t("referListTitle")}
        </h2>
        {user.referrals.length ? (
          <>
            <p className="mt-2 text-sm text-muted">{t("referListSummary", { count: user.referrals.length, rewarded })}</p>
            <ul className="mt-5 divide-y divide-hairline">
              {user.referrals.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {firstName(r.name)} <span className="text-muted">· {f.dateTime(r.createdAt, { dateStyle: "medium" })}</span>
                  </span>
                  {r.referralRewardedAt ? <Badge tone="success">{t("referStatusRewarded", { days })}</Badge> : <Badge>{t("referStatusPending")}</Badge>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("referListEmpty")}</p>
        )}
      </Card>
    </div>
  );
}
