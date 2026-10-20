"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env, testDataAllowed } from "@/lib/env";
import { getActingUser } from "@/lib/auth/guards";
import { lineTotal, sumMinor } from "@/lib/money";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { providerForOrders } from "@/lib/payments";
import { toStoreMinor } from "@/lib/payments/currency";
import { email, orderConfirmationEmail } from "@/lib/email";
import { closeOrder, expireStalePendingOrders } from "@/lib/orders";
import { priceLines } from "./catalog";

export type CheckoutState = {
  error?: "auth" | "empty" | "stock" | "invalid" | "address" | "rateLimited" | "generic";
  fields?: Partial<Record<"name" | "phone" | "address", true>>;
};

const schema = z
  .object({
    locale: z.enum(["ar", "en"]),
    fulfillment: z.enum(["pickup", "delivery"]),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/),
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(500).optional(),
    items: z
      .string()
      .transform((s, ctx) => {
        try {
          return JSON.parse(s) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "bad items" });
          return z.NEVER;
        }
      })
      .pipe(z.array(z.object({ variantId: z.string().min(1).max(64), qty: z.number().int().min(1).max(20) })).min(1).max(50)),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery" && (!v.address || v.address.length < 6)) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "address required" });
    }
  });

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GG-${ymd}-${rand}`;
}

class StockError extends Error {}

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getActingUser(); // not the view-only guest admin
  if (!user) return { error: "auth" };

  try {
    await enforceRateLimit("checkout", 10, 60_000, user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return { error: "rateLimited" };
    throw e;
  }

  const parsed = schema.safeParse({
    locale: formData.get("locale"),
    fulfillment: formData.get("fulfillment"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
    items: formData.get("items"),
  });
  if (!parsed.success) {
    const fields: CheckoutState["fields"] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "phone" || k === "address") fields[k] = true;
      if (k === "items") return { error: "empty" };
    }
    return { error: fields.address && !fields.name && !fields.phone ? "address" : "invalid", fields };
  }
  const input = parsed.data;

  // Release stock held by abandoned online checkouts before pricing this one.
  await expireStalePendingOrders().catch((e) => console.error("[checkout] expiring stale orders failed", e));

  const lines = await priceLines(input.items);
  if (lines.length === 0) return { error: "empty" };
  if (lines.some((l) => !l.available || l.qty < l.requestedQty)) return { error: "stock" };

  const currency = lines[0]!.currency;
  const subtotal = sumMinor(lines.map((l) => lineTotal(l.unitMinor, l.qty)));
  const delivery = input.fulfillment === "delivery" ? env.DELIVERY_FEE_MINOR : 0;
  const total = subtotal + delivery;
  const provider = providerForOrders();
  if (provider.id === "lemonsqueezy") {
    // Fail before reserving stock if the order can't be priced in the store currency.
    try {
      toStoreMinor(total, currency);
    } catch (e) {
      console.error("[checkout] Lemon Squeezy pricing not configured", e);
      return { error: "generic" };
    }
  }

  const created = await db
    .$transaction(async (tx) => {
      // Reserve stock atomically; fails if someone else bought it first.
      for (const l of lines) {
        const res = await tx.productVariant.updateMany({
          where: { id: l.variantId, stock: { gte: l.qty }, active: true },
          data: { stock: { decrement: l.qty } },
        });
        if (res.count !== 1) throw new StockError();
      }
      return tx.order.create({
        data: {
          number: orderNumber(),
          userId: user.id,
          status: "pending",
          fulfillment: input.fulfillment,
          paymentMode: provider.id,
          customerName: input.name,
          phone: input.phone,
          address: input.fulfillment === "delivery" ? input.address : null,
          notes: input.notes ?? null,
          subtotalMinor: subtotal,
          deliveryMinor: delivery,
          totalMinor: total,
          currency,
          testMode: testDataAllowed,
          items: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              productNameAr: l.nameAr,
              productNameEn: l.nameEn,
              variantLabel: input.locale === "en" ? l.variantLabelEn : l.variantLabelAr,
              sku: l.sku,
              unitMinor: l.unitMinor,
              quantity: l.qty,
              lineTotalMinor: lineTotal(l.unitMinor, l.qty),
            })),
          },
        },
        include: { items: true },
      });
    })
    .then(
      (o) => ({ ok: true as const, order: o }),
      (e: unknown) => ({ ok: false as const, stock: e instanceof StockError, e }),
    );

  if (!created.ok) {
    if (created.stock) return { error: "stock" };
    console.error("[checkout] order creation failed", created.e);
    return { error: "generic" };
  }
  const order = created.order;

  let target: string;
  try {
    const result = await provider.createCheckout({
      kind: "order",
      user: { id: user.id, email: user.email, name: user.name },
      order: { id: order.id, number: order.number, totalMinor: order.totalMinor, currency: order.currency },
      locale: input.locale,
    });
    target =
      result.type === "redirect"
        ? result.url
        : `/${input.locale}/checkout/success?order=${encodeURIComponent(order.number)}`;
  } catch (e) {
    console.error("[checkout] provider failed", e);
    // Don't leave the order holding stock: cancel it and put the units back. The cart is
    // untouched, so the customer can simply try again.
    await db
      .$transaction((tx) => closeOrder(tx, order.id, "pending", "cancelled"))
      .catch((err) => console.error("[checkout] could not release stock for", order.number, err));
    return { error: "generic" };
  }

  // Only now that payment is set up: clear the server cart (the client clears itself on the success page).
  await db.cartItem.deleteMany({ where: { cart: { userId: user.id } } }).catch(() => undefined);

  const msg = orderConfirmationEmail(order, input.locale);
  if (user.email) email.send({ to: user.email, ...msg }).catch((e) => console.error("[email] order confirmation failed", e));

  redirect(target);
}
