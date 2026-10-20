import type { BillingInterval } from "@/config/plans";

export type ProviderId = "lemonsqueezy" | "manual";

export type SubscriptionCheckoutInput = {
  kind: "subscription";
  user: { id: string; email: string | null; name: string | null };
  planSlug: string;
  interval: BillingInterval;
  locale: string;
};

export type OrderCheckoutInput = {
  kind: "order";
  user: { id: string; email: string | null; name: string | null };
  order: { id: string; number: string; totalMinor: number; currency: string };
  locale: string;
};

export type CheckoutInput = SubscriptionCheckoutInput | OrderCheckoutInput;

export type CheckoutResult =
  /** Send the browser to a hosted checkout page. */
  | { type: "redirect"; url: string }
  /** No online payment needed (pay at gym / cash on delivery). */
  | { type: "confirmed" };

export type ManagementUrls = {
  customerPortal?: string;
  updatePaymentMethod?: string;
};

/**
 * Every gateway implements this. UI and business logic only talk to this interface,
 * so swapping Lemon Squeezy for a regional card gateway touches one file.
 */
export interface PaymentProvider {
  readonly id: ProviderId;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Verify + process an incoming webhook. Providers without webhooks return 404. */
  handleWebhook(req: Request): Promise<Response>;
  getManagementUrls(providerSubscriptionId: string): Promise<ManagementUrls>;
  cancel(providerSubscriptionId: string): Promise<void>;
  resume(providerSubscriptionId: string): Promise<void>;
}

export class PaymentError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "VARIANT_MISSING" | "PROVIDER_ERROR" | "UNSUPPORTED",
    message?: string,
  ) {
    super(message ?? code);
  }
}
