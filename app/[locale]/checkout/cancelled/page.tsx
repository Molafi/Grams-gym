import { getTranslations, setRequestLocale } from "next-intl/server";
import { XCircle } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { Container } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { robots: { index: false } };

export default async function CheckoutCancelledPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "checkout" });
  return (
    <section className="min-h-[70vh] pb-24 pt-40">
      <Container className="max-w-xl">
        <div className="card p-10 text-center">
          <XCircle className="mx-auto h-12 w-12 text-muted" aria-hidden />
          <h1 className="display mt-6 text-4xl">{t("cancelledTitle")}</h1>
          <p className="mt-4 text-muted">{t("cancelledBody")}</p>
          <ButtonLink href="/cart" className="mt-8" variant="glass">
            {t("backToCart")}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
