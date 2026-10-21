import Image from "next/image";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Dumbbell } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getMedia } from "@/lib/media";
import { COACH_KEYS, COACH_MEDIA, isCoachKey } from "@/lib/coaches";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { GGMark } from "@/components/ui/GGMark";
import { chooseCoach } from "@/features/account/actions";
import { whatsappHref, getBusiness } from "@/lib/business";

export default async function CoachPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/coach`);
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { ptCoach: true, ptCoachSetAt: true, isGuest: true } });
  const t = await getTranslations({ locale, namespace: "account" });
  const tco = await getTranslations({ locale, namespace: "coaches" });
  const f = await getFormatter({ locale });
  const media = await getMedia();
  const biz = await getBusiness();
  const current = isCoachKey(user.ptCoach) ? user.ptCoach : null;

  return (
    <div className="space-y-6">
      <Card className="p-7">
        <h2 className="display flex items-center gap-2 text-xl">
          <Dumbbell className="h-5 w-5 text-ember" aria-hidden /> {t("coachTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("coachBody")}</p>
        {current ? (
          <p role="status" className="mt-4 text-sm">
            {t("coachCurrent", { name: tco(current) })}
            {user.ptCoachSetAt ? <span className="text-muted"> · {f.dateTime(user.ptCoachSetAt, { dateStyle: "medium" })}</span> : null}
          </p>
        ) : null}
      </Card>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {COACH_KEYS.map((key) => {
          const photo = media[COACH_MEDIA[key]];
          const chosen = current === key;
          return (
            <li key={key}>
              <div className={`card h-full overflow-hidden ${chosen ? "ring-2 ring-ember" : ""}`}>
                <div className="relative aspect-[3/4] overflow-hidden bg-[radial-gradient(90%_70%_at_50%_20%,#1c2029,#07080a)]">
                  {photo.src ? (
                    <Image src={photo.src} alt={tco(key)} fill sizes="(min-width: 1024px) 20vw, 45vw" className="object-cover" />
                  ) : (
                    <div role="img" aria-label={tco(key)} className="absolute inset-0 flex items-center justify-center">
                      <GGMark className="w-1/2 opacity-15" title="" />
                    </div>
                  )}
                  {chosen ? (
                    <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-ember px-2.5 py-1 text-xs font-medium text-[#130800]">
                      <Check className="h-3.5 w-3.5" aria-hidden /> {t("coachChosen")}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="font-medium">{tco(key)}</h3>
                    <p className="text-xs text-muted">{tco("role")}</p>
                  </div>
                  {!user.isGuest && !chosen ? (
                    <form action={chooseCoach}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="coach" value={key} />
                      <Button type="submit" size="sm" variant={current ? "glass" : "primary"} wrap className="w-full">
                        {t("coachChoose")}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        {current && !user.isGuest ? (
          <form action={chooseCoach}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="coach" value="" />
            <Button type="submit" variant="ghost" size="sm">
              {t("coachRemove")}
            </Button>
          </form>
        ) : null}
        <p className="text-sm text-muted">
          {t("coachNext")}{" "}
          <a href={whatsappHref(locale, biz)} target="_blank" rel="noopener noreferrer" className="text-ember underline underline-offset-4">
            WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}
