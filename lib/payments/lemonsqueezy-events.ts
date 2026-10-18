import "server-only";
import { Prisma, type BillingInterval } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { env, lemonSqueezyConfigured, planForVariant, testDataAllowed } from "@/lib/env";
import { closeOrder, reopenOrder, ReopenStockError } from "@/lib/orders";
import { toStoreMinor } from "./currency";
import { normaliseLsStatus } from "@/lib/membership";
import { eventHash } from "./signature";

/** Events we act on. Anything else is stored and marked processed. */
export const HANDLED_EVENTS = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
  "order_created",
  "order_refunded",
] as const;

const id = z.union([z.string(), z.number()]).transform(String);
const nullableDate = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null));

const envelope = z.object({
  meta: z.object({
    event_name: z.string(),
    test_mode: z.boolean().optional(),
    custom_data: z.record(z.string(), z.unknown()).nullish(),
  }),
  data: z.object({
    type: z.string(),
    id,
    attributes: z.record(z.string(), z.unknown()),
  }),
});

const subscriptionAttrs = z.object({
  customer_id: id,
  variant_id: id,
  user_email: z.string().nullish(),
  status: z.string(),
  cancelled: z.boolean().default(false),
  card_brand: z.string().nullish(),
  card_last_four: z.string().nullish(),
  trial_ends_at: nullableDate,
  renews_at: nullableDate,
  ends_at: nullableDate,
  updated_at: nullableDate,
  test_mode: z.boolean().default(false),
  urls: z
    .object({
      customer_portal: z.string().nullish(),
      update_payment_method: z.string().nullish(),
    })
    .partial()
    .nullish(),
});

const invoiceAttrs = z.object({
  subscription_id: id,
  status: z.string(),
  total: z.number().int(),
  currency: z.string(),
});

const orderAttrs = z.object({
  status: z.string(),
  total: z.number().int(),
  subtotal: z.number().int().optional(),
  currency: z.string(),
  first_order_item: z.object({ variant_id: id }).partial().nullish(),
});

const customSchema = z
  .object({
    user_id: z.string().optional(),
    plan_slug: z.string().optional(),
    interval: z.enum(["monthly", "quarterly", "yearly"]).optional(),
    order_id: z.string().optional(),
  })
  .partial();

export type ParsedEvent = z.infer<typeof envelope>;

export function parseEnvelope(payload: unknown): ParsedEvent {
  return envelope.parse(payload);
}

async function upsertSubscription(evt: ParsedEvent) {
  const a = subscriptionAttrs.parse(evt.data.attributes);
  const custom = customSchema.parse(evt.meta.custom_data ?? {});
  const lsId = evt.data.id;
  const existing = await db.subscription.findUnique({ where: { lsSubscriptionId: lsId } });

  // Lemon Squeezy doesn't guarantee delivery order, and admins can retry old failed events.
  // Never let an older snapshot overwrite a newer one.
  if (existing?.lsUpdatedAt && a.updated_at && a.updated_at < existing.lsUpdatedAt) {
    console.warn(`[webhook] skipping stale ${evt.meta.event_name} for ${lsId}`);
    return;
  }

  // Resolve the user: custom data first, then existing row, then email.
  let userId: string | undefined;
  if (custom.user_id) userId = (await db.user.findUnique({ where: { id: custom.user_id }, select: { id: true } }))?.id;
  if (!userId && existing) userId = existing.userId;
  if (!userId && a.user_email) userId = (await db.user.findUnique({ where: { email: a.user_email }, select: { id: true } }))?.id;
  if (!userId) throw new Error(`No user found for subscription ${lsId}`);

  // Resolve plan + interval from the variant map (authoritative), else the stored row.
  // `custom_data` can be set by whoever opens a checkout link, so it may only choose the
  // plan for simulator events or before Lemon Squeezy is configured. Otherwise a cheap
  // unmapped variant in the same store could be bought with plan_slug=elite.
  const mapped = planForVariant(a.variant_id);
  const trustCustom = !lemonSqueezyConfigured || a.variant_id.startsWith("sim_");
  const slug = mapped?.slug ?? (trustCustom ? custom.plan_slug : undefined);
  const interval = (mapped?.interval ?? (trustCustom ? custom.interval : undefined) ?? existing?.interval) as BillingInterval | undefined;
  const plan = slug ? await db.plan.findUnique({ where: { slug } }) : existing ? await db.plan.findUnique({ where: { id: existing.planId } }) : null;
  if (!plan || !interval) throw new Error(`Cannot map variant ${a.variant_id} to a plan/interval (add it to the LS_VARIANT_* settings)`);

  const status = normaliseLsStatus(a.status);
  const pastDueSince = status === "past_due" ? (existing?.status === "past_due" ? existing.pastDueSince : new Date()) : null;

  const data = {
    userId,
    planId: plan.id,
    interval,
    provider: "lemonsqueezy" as const,
    status,
    lsCustomerId: a.customer_id,
    lsVariantId: a.variant_id,
    renewsAt: a.renews_at,
    endsAt: a.ends_at,
    trialEndsAt: a.trial_ends_at,
    pastDueSince,
    cancelled: a.cancelled,
    customerPortalUrl: a.urls?.customer_portal ?? null,
    updatePaymentMethodUrl: a.urls?.update_payment_method ?? null,
    cardBrand: a.card_brand ?? null,
    cardLastFour: a.card_last_four ?? null,
    testMode: a.test_mode,
    lsUpdatedAt: a.updated_at ?? existing?.lsUpdatedAt ?? null,
  };

  const saved = await db.subscription.upsert({
    where: { lsSubscriptionId: lsId },
    create: { ...data, lsSubscriptionId: lsId },
    update: data,
    select: { id: true },
  });
  // Link invoices that arrived before this subscription existed.
  await db.payment.updateMany({ where: { lsSubscriptionId: lsId, subscriptionId: null }, data: { subscriptionId: saved.id } });
}

async function recordInvoice(evt: ParsedEvent) {
  const a = invoiceAttrs.parse(evt.data.attributes);
  const sub = await db.subscription.findUnique({ where: { lsSubscriptionId: a.subscription_id }, select: { id: true } });
  const status =
    evt.meta.event_name === "subscription_payment_failed" ? "failed" : a.status === "refunded" ? "refunded" : "succeeded";
  const providerRef = `invoice:${evt.data.id}`;
  await db.payment.upsert({
    where: { provider_providerRef: { provider: "lemonsqueezy", providerRef } },
    create: {
      provider: "lemonsqueezy",
      providerRef,
      status,
      amountMinor: a.total,
      currency: a.currency,
      subscriptionId: sub?.id ?? null,
      lsSubscriptionId: a.subscription_id,
      raw: evt.data.attributes as Prisma.InputJsonValue,
    },
    update: { status, subscriptionId: sub?.id ?? undefined, lsSubscriptionId: a.subscription_id },
  });
}

async function handleOrder(evt: ParsedEvent) {
  const a = orderAttrs.parse(evt.data.attributes);
  const custom = customSchema.parse(evt.meta.custom_data ?? {});
  const providerRef = `order:${evt.data.id}`;
  const refunded = evt.meta.event_name === "order_refunded" || a.status === "refunded";
  const paymentStatus = refunded ? "refunded" : a.status === "paid" ? "succeeded" : "pending";

  const order = custom.order_id ? await db.order.findUnique({ where: { id: custom.order_id } }) : null;

  await db.payment.upsert({
    where: { provider_providerRef: { provider: "lemonsqueezy", providerRef } },
    create: {
      provider: "lemonsqueezy",
      providerRef,
      status: paymentStatus,
      amountMinor: a.total,
      currency: a.currency,
      orderId: order?.id ?? null,
      raw: evt.data.attributes as Prisma.InputJsonValue,
    },
    update: { status: paymentStatus },
  });

  if (!order) return; // membership first-orders: access comes from subscription_* events

  // `order_id` is custom data, which anyone opening a checkout link can set. Only act if this
  // really is the supplement-order checkout for this order's amount.
  const variantId = a.first_order_item?.variant_id;
  const expected = toStoreMinor(order.totalMinor, order.currency);
  const charged = a.subtotal ?? a.total;
  if (
    (variantId && env.LS_VARIANT_SUPPLEMENT_ORDER && variantId !== env.LS_VARIANT_SUPPLEMENT_ORDER) ||
    a.currency.toUpperCase() !== env.LS_STORE_CURRENCY ||
    charged !== expected
  ) {
    throw new Error(`Order ${order.number}: payment doesn't match (variant ${variantId ?? "?"}, ${charged} ${a.currency}, expected ${expected} ${env.LS_STORE_CURRENCY})`);
  }

  if (refunded) {
    if (order.status === "refunded") return;
    // Same path as an admin refund: status change + stock returned exactly once.
    const ok = await db.$transaction((tx) => closeOrder(tx, order.id, order.status, "refunded"));
    if (!ok) throw new Error(`Order ${order.number} changed while refunding; retry this event`);
    return;
  }
  if (a.status !== "paid") return;

  if (order.status === "pending") {
    const moved = await db.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "paid" } });
    // 0 = the order changed under us (e.g. the expiry sweep just cancelled it). Fail so the
    // event stays retryable; a retry takes the "cancelled" branch below.
    if (moved.count !== 1) throw new Error(`Order ${order.number} changed while marking it paid; retry this event`);
  } else if (order.status === "cancelled") {
    // Paid after the hold expired and the stock was released. Re-reserve it if we still can;
    // otherwise fail loudly so it shows up in /admin/webhooks for a refund.
    try {
      const ok = await db.$transaction((tx) => reopenOrder(tx, order.id, "cancelled", "paid"));
      if (!ok) throw new Error(`Order ${order.number} changed while reopening it; retry this event`);
    } catch (e) {
      if (e instanceof ReopenStockError) {
        throw new Error(`Order ${order.number} was paid after it expired and is now out of stock — refund it or fulfil manually`);
      }
      throw e;
    }
  } else if (order.status === "refunded") {
    throw new Error(`Order ${order.number} is refunded but a payment arrived — check it in Lemon Squeezy`);
  }
}

/** Apply one (already-verified) event to the database. Throws on failure. */
export async function applyLemonSqueezyEvent(payload: unknown): Promise<void> {
  const evt = parseEnvelope(payload);
  // Live site: a test-mode event (test card, simulator) must never grant access or mark
  // orders paid. It is stored for visibility and marked processed.
  if (evt.meta.test_mode && !testDataAllowed) {
    console.warn(`[webhook] ignoring test-mode ${evt.meta.event_name} on a live site`);
    return;
  }
  switch (evt.meta.event_name) {
    case "subscription_created":
    case "subscription_updated":
    case "subscription_cancelled":
    case "subscription_resumed":
    case "subscription_expired":
    case "subscription_paused":
    case "subscription_unpaused":
      return upsertSubscription(evt);
    case "subscription_payment_success":
    case "subscription_payment_failed":
    case "subscription_payment_recovered":
      return recordInvoice(evt);
    case "order_created":
    case "order_refunded":
      return handleOrder(evt);
    default:
      return; // stored for visibility, nothing to do
  }
}

export type IngestResult = { status: "processed" | "duplicate" | "failed"; eventId: string; error?: string };

/**
 * Store (idempotently) then apply. Used by the webhook route, the test-mode
 * payment simulator and the admin "retry" button.
 */
export async function ingestLemonSqueezyEvent(rawBody: string): Promise<IngestResult> {
  const payload: unknown = JSON.parse(rawBody);
  const evt = parseEnvelope(payload);
  const hash = eventHash(rawBody, evt.meta.event_name);

  const existing = await db.webhookEvent.findUnique({ where: { hash } });
  if (existing?.processedAt) return { status: "duplicate", eventId: existing.id };
  if (existing) return processStoredEvent(existing.id); // stored but previously failed → try again

  try {
    const created = await db.webhookEvent.create({
      data: {
        provider: "lemonsqueezy",
        eventName: evt.meta.event_name,
        hash,
        payload: payload as Prisma.InputJsonValue,
        testMode: Boolean(evt.meta.test_mode),
      },
    });
    return processStoredEvent(created.id);
  } catch (e) {
    // Concurrent duplicate delivery raced us to the unique hash.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.webhookEvent.findUnique({ where: { hash } });
      return { status: "duplicate", eventId: again?.id ?? "unknown" };
    }
    throw e;
  }
}

export async function processStoredEvent(eventId: string): Promise<IngestResult> {
  const record = await db.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
  try {
    await applyLemonSqueezyEvent(record.payload);
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: null, attempts: { increment: 1 } },
    });
    return { status: "processed", eventId: record.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { error: message.slice(0, 2000), attempts: { increment: 1 } },
    });
    console.error("[webhook] processing failed", record.eventName, message);
    return { status: "failed", eventId: record.id, error: message };
  }
}
