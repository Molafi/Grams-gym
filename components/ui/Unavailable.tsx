import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/primitives";
import { ExternalButton } from "@/components/ui/Button";
import { getBusiness, whatsappHref } from "@/lib/business";
import { dbTarget } from "@/lib/db-status";

/** Shown instead of a page section when its data (plans, products) can't be loaded right now. */
export async function Unavailable({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "common" });
  const biz = await getBusiness();
  return (
    <Container className="py-24 text-center">
      <div className="card mx-auto max-w-lg p-10">
        <p className="display text-2xl">{t("unavailableTitle")}</p>
        <p className="mt-3 text-muted">{t("unavailableBody")}</p>
        {process.env.NODE_ENV !== "production" ? (
          // Developer hint, never shown on the live site.
          <p className="mt-4 rounded-xl border border-hairline bg-black/30 px-3 py-2 font-mono text-xs text-muted" dir="ltr">
            dev: no database at {dbTarget()} · run npm run db:check
          </p>
        ) : null}
        <ExternalButton href={whatsappHref(locale, biz)} variant="glass" className="mt-8">
          {t("unavailableContact")}
        </ExternalButton>
      </div>
    </Container>
  );
}
