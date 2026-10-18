import "server-only";
import { db } from "@/lib/db";
import { PaymentError, type CheckoutInput, type CheckoutResult, type PaymentProvider } from "./types";

/**
 * Manual provider: pay at the gym (pickup) or cash on delivery.
 * Orders become `pay_on_delivery`; staff mark them paid/completed in /admin/orders.
 * Manual memberships (paid at the desk) are created by staff in /admin/subscriptions.
 */
export const manualProvider: PaymentProvider = {
  id: "manual",

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (input.kind !== "order") {
      throw new PaymentError("UNSUPPORTED", "Memberships paid at the desk are created by staff");
    }
    await db.$transaction([
      db.order.update({ where: { id: input.order.id }, data: { status: "pay_on_delivery" } }),
      db.payment.create({
        data: {
          provider: "manual",
          providerRef: `order:${input.order.id}`,
          status: "pending",
          amountMinor: input.order.totalMinor,
          currency: input.order.currency,
          orderId: input.order.id,
        },
      }),
    ]);
    return { type: "confirmed" };
  },

  async handleWebhook() {
    return new Response("Not found", { status: 404 });
  },

  async getManagementUrls() {
    return {};
  },

  async cancel(subscriptionId: string) {
    await db.subscription.update({ where: { id: subscriptionId }, data: { cancelled: true, status: "cancelled" } });
  },

  async resume(subscriptionId: string) {
    await db.subscription.update({ where: { id: subscriptionId }, data: { cancelled: false, status: "active" } });
  },
};
