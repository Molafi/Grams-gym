import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { firstParam, type PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Container } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { ClearCart } from "@/features/shop/ClearCart";

export const metadata = { robots: { index: false } };

export default async function CheckoutSuccessPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const number = firstParam((await searchParams).order) ?? "";
  const user = await requireUser(locale, `/${locale}/checkout/success?order=${encodeURIComponent(number)}`);
  const t = await getTranslations({ locale, namespace: "checkout" });
  const to = await getTranslations({ locale, namespace: "order" });
  const order = number ? await db.order.findFirst({ where: { number, userId: user.id }, include: { items: true } }) : null;

  return (
    <section className="min-h-[70vh] pb-24 pt-40">
      <ClearCart />
      <Container className="max-w-2xl">
        <div className="card p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
          <h1 className="display mt-6 text-4xl">{t("successTitle")}</h1>
          {order ? (
            <>
              <p className="mt-4 text-muted" aria-live="polite">
                {t("successBody", { number: order.number, phone: order.phone })}
              </p>
              <p className="mt-4">
                <Badge tone={order.status === "paid" ? "success" : "ember"}>{to(`status.${order.status}`)}</Badge>
              </p>
              <ul className="mt-8 space-y-2 text-start text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-4 border-b border-hairline pb-2">
                    <span>
                      {locale === "en" ? i.productNameEn : i.productNameAr} <span className="text-muted">· {i.variantLabel} × {i.quantity}</span>
                    </span>
                    <span className="tabular">{formatMoney(i.lineTotalMinor, order.currency, locale)}</span>
                  </li>
                ))}
                <li className="flex justify-between pt-2 font-medium">
                  <span>{t("total")}</span>
                  <span className="tabular">{formatMoney(order.totalMinor, order.currency, locale)}</span>
                </li>
              </ul>
            </>
          ) : null}
          <ButtonLink href="/account/orders" className="mt-10">
            {t("viewOrders")}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
