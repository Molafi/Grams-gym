import { getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getMedia } from "@/lib/media";
import { media as defaults, MEDIA_GROUPS, MEDIA_KEYS, type MediaGroup } from "@/config/media";
import { MediaSlot } from "@/features/admin/MediaSlot";

export const dynamic = "force-dynamic";

const GROUP_ORDER: MediaGroup[] = ["brand", "home", "facilities", "services", "coaches"];

export default async function AdminMediaPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/media`);
  const t = await getTranslations({ locale, namespace: "admin.media" });
  const resolved = await getMedia();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </div>
      {GROUP_ORDER.map((g) => (
        <section key={g} className="space-y-4">
          <h2 className="eyebrow">{t(`groups.${g}`)}</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {MEDIA_KEYS.filter((k) => MEDIA_GROUPS[k] === g).map((k) => (
              <MediaSlot
                key={k}
                slotKey={k}
                label={t(`slots.${k}`)}
                src={resolved[k].src}
                custom={resolved[k].custom}
                alt={resolved[k].alt}
                altDefaults={defaults[k].alt}
                contain={k === "logo"}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
