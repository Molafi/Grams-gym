"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney, lineTotal, sumMinor } from "@/lib/money";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { placeOrder, type CheckoutState } from "./checkout-actions";
import { useCartLines } from "./useCartLines";

export function CheckoutForm({
  deliveryFeeMinor,
  paymentMode,
  defaults,
}: {
  deliveryFeeMinor: number;
  paymentMode: "manual" | "lemonsqueezy";
  defaults: { name: string; phone: string };
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { items, lines, loading } = useCartLines();
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {});

  if (loading) return <div className="skeleton h-96" aria-busy="true" />;
  if (!lines || lines.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-muted">{t("errors.empty")}</p>
        <Link href="/shop" className={buttonClass("primary", "md", "mt-6")}>
          {tc("back")}
        </Link>
      </div>
    );
  }

  const currency = lines[0]!.currency;
  const subtotal = sumMinor(lines.map((l) => lineTotal(l.unitMinor, l.qty)));
  const delivery = fulfillment === "delivery" ? deliveryFeeMinor : 0;
  const errorText =
    state.error === "stock"
      ? t("errors.stock")
      : state.error === "address"
        ? t("errors.address")
        : state.error === "invalid"
          ? t("errors.invalid")
          : state.error === "empty"
            ? t("errors.empty")
            : state.error === "rateLimited"
              ? tc("rateLimited")
              : state.error
                ? tc("error")
                : "";

  const payLabel = paymentMode === "lemonsqueezy" ? t("payCard") : fulfillment === "pickup" ? t("payManualPickup") : t("payManualDelivery");

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1.4fr_1fr]" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="space-y-8">
        <fieldset className="card p-6">
          <legend className="display px-2 text-xl">{t("fulfillment")}</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["pickup", "delivery"] as const).map((f) => (
              <label
                key={f}
                className={`cursor-pointer rounded-2xl border p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ember ${fulfillment === f ? "border-ember bg-ember/[.06]" : "border-hairline-strong"}`}
              >
                <input type="radio" name="fulfillment" value={f} checked={fulfillment === f} onChange={() => setFulfillment(f)} className="sr-only" />
                <span className="block font-medium">{t(f)}</span>
                <span className="mt-1 block text-sm text-muted">
                  {f === "pickup" ? t("pickupNote") : t("deliveryNote", { fee: formatMoney(deliveryFeeMinor, currency, locale) })}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="card space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">{t("name")}</span>
            <input name="name" required autoComplete="name" defaultValue={defaults.name} className="field" aria-invalid={state.fields?.name ? true : undefined} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">{t("phone")}</span>
            <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" dir="ltr" defaultValue={defaults.phone} placeholder="07X XXX XXXX" className="field text-start" aria-invalid={state.fields?.phone ? true : undefined} />
          </label>
          {fulfillment === "delivery" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">{t("address")}</span>
              <textarea name="address" required rows={3} autoComplete="street-address" className="field" aria-invalid={state.fields?.address ? true : undefined} />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">{t("notes")}</span>
            <textarea name="notes" rows={2} className="field" />
          </label>
        </fieldset>
      </div>

      <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-28">
        <ul className="space-y-3 text-sm">
          {lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-4">
              <span className="text-muted">
                {locale === "en" ? l.nameEn : l.nameAr} × {l.qty}
              </span>
              <span className="tabular">{formatMoney(lineTotal(l.unitMinor, l.qty), l.currency, locale)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-hairline pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{t("delivery_fee")}</span>
            <span className="tabular">{formatMoney(delivery, currency, locale)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="font-medium">{t("total")}</span>
            <span className="display tabular text-2xl">{formatMoney(subtotal + delivery, currency, locale)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-hairline p-4 text-sm">
          <p className="text-muted">{t("payment")}</p>
          <p className="mt-1 font-medium">{payLabel}</p>
        </div>
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
          {pending ? t("placing") : t("place")}
        </button>
        <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-danger">
          {errorText}
        </p>
        <p className="text-xs text-muted">{t("currencyNote")}</p>
      </aside>
    </form>
  );
}
