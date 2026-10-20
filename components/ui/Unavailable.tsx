import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/primitives";
import { ExternalButton } from "@/components/ui/Button";
import { getBusiness, whatsappHref } from "@/lib/business";

/** Shown instead of a page section when its data (plans, products) can't be loaded right now. */
export async function Unavailable({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "common" });
  const biz = await getBusiness();
  return (
    <Container className="py-24 text-center">
      <div className="card mx-auto max-w-lg p-10">
        <p className="display text-2xl">{t("unavailableTitle")}</p>
        <p className="mt-3 text-muted">{t("unavailableBody")}</p>
        <ExternalButton href={whatsappHref(locale, biz)} variant="glass" className="mt-8">
          {t("unavailableContact")}
        </ExternalButton>
      </div>
    </Container>
  );
}
