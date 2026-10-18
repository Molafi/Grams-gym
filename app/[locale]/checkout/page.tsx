import { getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Container } from "@/components/ui/primitives";
import { CheckoutForm } from "@/features/shop/CheckoutForm";

export const metadata = { robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/checkout`);
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true } });
  const t = await getTranslations({ locale, namespace: "checkout" });

  return (
    <section className="min-h-[70vh] pb-24 pt-36">
      <Container>
        <h1 className="display mb-10 text-5xl">{t("title")}</h1>
        <CheckoutForm
          deliveryFeeMinor={env.DELIVERY_FEE_MINOR}
          paymentMode={env.SUPPLEMENT_PAYMENT_MODE}
          defaults={{ name: profile?.name ?? "", phone: profile?.phone ?? "" }}
        />
      </Container>
    </section>
  );
}
