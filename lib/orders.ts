import "server-only";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Order stock lifecycle. Stock is reserved when an order is placed
 * (features/shop/checkout-actions.ts) and must be returned exactly once when the order
 * ends without a sale. Every path that does that goes through this file.
 */

/** Statuses in which an order's stock has been returned. Orders don't leave these. */
export const CLOSED_STATUSES: readonly OrderStatus[] = ["cancelled", "refunded"];
export const isClosed = (s: OrderStatus) => CLOSED_STATUSES.includes(s);

/** Online (Lemon Squeezy) checkouts left unpaid this long are cancelled and their stock released. */
export const PENDING_HOLD_MINUTES = 120;

type Tx = Prisma.TransactionClient;

/**
 * Move an order from `from` to cancelled/refunded inside `tx`, returning its stock if it
 * wasn't already returned. The status update is conditional on `from`, so two concurrent
 * callers can't both restock. Returns false if the order was no longer in `from`.
 */
export async function closeOrder(tx: Tx, orderId: string, from: OrderStatus, to: "cancelled" | "refunded"): Promise<boolean> {
  const moved = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to } });
  if (moved.count !== 1) return false;
  if (isClosed(from)) return true; // e.g. cancelled → refunded: stock already returned
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
  for (const i of items) {
    if (i.variantId) await tx.productVariant.update({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } });
  }
  return true;
}

/**
 * Re-reserve stock for a closed order (a late payment for an expired checkout).
 * Returns false (and changes nothing) if any item is no longer in stock.
 */
export async function reopenOrder(tx: Tx, orderId: string, from: OrderStatus, to: OrderStatus): Promise<boolean> {
  const moved = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to } });
  if (moved.count !== 1) return false;
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
  for (const i of items) {
    if (!i.variantId) continue;
    const r = await tx.productVariant.updateMany({ where: { id: i.variantId, stock: { gte: i.quantity } }, data: { stock: { decrement: i.quantity } } });
    if (r.count !== 1) throw new ReopenStockError();
  }
  return true;
}

export class ReopenStockError extends Error {
  constructor() {
    super("Not enough stock to reopen the order");
  }
}

/**
 * Cancel online checkouts that were never paid and release their stock. Called
 * opportunistically (on checkout and on the admin dashboard), so no cron is needed.
 */
export async function expireStalePendingOrders(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PENDING_HOLD_MINUTES * 60_000);
  const stale = await db.order.findMany({
    where: { status: "pending", paymentMode: "lemonsqueezy", createdAt: { lt: cutoff } },
    select: { id: true },
    take: 50,
  });
  let expired = 0;
  for (const o of stale) {
    const ok = await db.$transaction((tx) => closeOrder(tx, o.id, "pending", "cancelled")).catch((e) => {
      console.error("[orders] could not expire", o.id, e);
      return false;
    });
    if (ok) expired++;
  }
  return expired;
}
