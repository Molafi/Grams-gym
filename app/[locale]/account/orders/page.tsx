import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { PageProps } from "@/lib/metadata";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Card } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";

export default async function OrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/account/orders`);
  const orders = await db.order.findMany({ where: { userId: user.id }, include: { items: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const t = await getTranslations({ locale, namespace: "account" });
  const to = await getTranslations({ locale, namespace: "order" });
  const tcart = await getTranslations({ locale, namespace: "cart" });
  const f = await getFormatter({ locale });

  if (orders.length === 0) {
    return (
      <Card className="p-8">
        <p className="text-muted">{t("noOrders")}</p>
        <ButtonLink href="/shop" className="mt-5">
          {tcart("continue")}
        </ButtonLink>
      </Card>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id}>
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="tabular font-medium" dir="ltr">
                  {o.number}
                </p>
                <p className="text-xs text-muted">
                  {f.dateTime(o.createdAt, { dateStyle: "medium", timeStyle: "short" })} · {to(`fulfillment.${o.fulfillment}`)}
                </p>
              </div>
              <Badge tone={o.status === "completed" || o.status === "paid" ? "success" : o.status === "cancelled" || o.status === "refunded" ? "danger" : "ember"}>
                {to(`status.${o.status}`)}
              </Badge>
              <p className="display tabular text-xl">{formatMoney(o.totalMinor, o.currency, locale)}</p>
            </div>
            <ul className="mt-4 space-y-1 border-t border-hairline pt-4 text-sm text-muted">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4">
                  <span>
                    {locale === "en" ? i.productNameEn : i.productNameAr} · {i.variantLabel} × {i.quantity}
                  </span>
                  <span className="tabular">{formatMoney(i.lineTotalMinor, o.currency, locale)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ul>
  );
}
