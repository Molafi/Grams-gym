import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { firstParam, type PageProps } from "@/lib/metadata";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { updateOrderStatus } from "@/features/admin/actions";

export const dynamic = "force-dynamic";

const STATUSES: OrderStatus[] = ["pending", "paid", "pay_on_delivery", "processing", "ready", "completed", "cancelled", "refunded"];

export default async function AdminOrdersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const statusRaw = firstParam((await searchParams).status);
  const status = STATUSES.find((s) => s === statusRaw);
  const t = await getTranslations({ locale, namespace: "admin" });
  const to = await getTranslations({ locale, namespace: "order" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const f = await getFormatter({ locale });

  const orders = await db.order.findMany({
    where: status ? { status } : {},
    include: { items: true, user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl">{t("nav.orders")}</h1>
        <a href="/api/admin/export?type=orders" download className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline-strong px-4 text-sm">
          <Download className="h-4 w-4" aria-hidden /> {t("exportCsv")}
        </a>
      </div>
      <form method="get" className="flex items-end gap-3">
        <label>
          <span className="mb-1 block text-xs text-muted">{t("orderStatus")}</span>
          <select name="status" defaultValue={status ?? ""} className="field">
            <option value="">{tc("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {to(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="glass">
          {tc("filter")}
        </Button>
      </form>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{to("number")}</th>
                <th>{t("customer")}</th>
                <th>{to("items")}</th>
                <th>{to("total")}</th>
                <th>{t("orderStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <p className="tabular font-medium" dir="ltr">
                      {o.number}
                    </p>
                    <p className="text-xs text-muted">{f.dateTime(o.createdAt, { dateStyle: "short", timeStyle: "short" })}</p>
                    {o.testMode ? <Badge tone="navy">TEST</Badge> : null}
                  </td>
                  <td>
                    <p>{o.customerName}</p>
                    <p className="text-xs text-muted" dir="ltr">
                      {o.phone} · {o.user.email}
                    </p>
                    <p className="text-xs text-muted">
                      {to(`fulfillment.${o.fulfillment}`)}
                      {o.address ? ` — ${o.address}` : ""}
                    </p>
                    {o.notes ? <p className="text-xs text-warning">“{o.notes}”</p> : null}
                  </td>
                  <td className="text-xs text-muted">
                    {o.items.map((i) => (
                      <p key={i.id}>
                        {locale === "en" ? i.productNameEn : i.productNameAr} · {i.variantLabel} × {i.quantity}
                      </p>
                    ))}
                  </td>
                  <td className="tabular whitespace-nowrap">
                    {formatMoney(o.totalMinor, o.currency, locale)}
                    <p className="text-xs text-muted">{o.paymentMode}</p>
                  </td>
                  <td>
                    <form action={updateOrderStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <select name="status" defaultValue={o.status} className="field !w-auto !py-1.5 text-xs" aria-label={t("orderStatus")}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {to(`status.${s}`)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs text-muted hover:text-ember">
                        {t("updateStatus")}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
