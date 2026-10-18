import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata, type PageProps } from "@/lib/metadata";
import { Container } from "@/components/ui/primitives";
import { CartView } from "@/features/shop/CartView";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "cart", "/cart", { noindex: true });
}

export default async function CartPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cart" });
  return (
    <section className="min-h-[70vh] pb-24 pt-36">
      <Container>
        <h1 className="display mb-10 text-5xl">{t("title")}</h1>
        <CartView />
      </Container>
    </section>
  );
}
