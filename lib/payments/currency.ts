import "server-only";
import { env } from "@/lib/env";
import { decimalsFor } from "@/lib/money";
import { PaymentError } from "./types";

/**
 * Lemon Squeezy custom prices are in the STORE currency's minor units. JOD → store currency
 * needs a real exchange rate (LS_JOD_EXCHANGE_RATE); a 1:1 rescale would charge
 * 35.000 JOD as $35.00 (~30% under). Throws rather than guessing.
 */
export function toStoreMinor(minor: number, currency: string): number {
  const from = currency.toUpperCase();
  const to = env.LS_STORE_CURRENCY;
  if (from === to) return minor;
  const rate = from === "JOD" ? env.LS_JOD_EXCHANGE_RATE : undefined;
  if (!rate) {
    throw new PaymentError("NOT_CONFIGURED", `Set LS_JOD_EXCHANGE_RATE to charge ${from} orders in a ${to} store`);
  }
  const major = minor / 10 ** decimalsFor(from);
  return Math.round(major * rate * 10 ** decimalsFor(to));
}
