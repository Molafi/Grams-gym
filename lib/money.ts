/**
 * Money helpers. All amounts are INTEGER minor units + an ISO currency code.
 * JOD (Jordanian dinar) has 3 decimals (1 JOD = 1000 fils).
 */
export const CURRENCY_DECIMALS: Record<string, number> = {
  JOD: 3,
  KWD: 3,
  BHD: 3,
  USD: 2,
  EUR: 2,
};

export function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

function assertMinor(n: number, label = "amount") {
  if (!Number.isSafeInteger(n)) throw new Error(`${label} must be a safe integer (minor units), got ${n}`);
}

/** Intl locale tag — Latin digits for Arabic (common in Jordanian commerce, tabular in our fonts). */
export function intlLocale(locale: string) {
  return locale === "ar" ? "ar-JO-u-nu-latn" : "en-JO";
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  assertMinor(minor);
  const d = decimalsFor(currency);
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(minor / 10 ** d);
}

/** Parse a decimal string ("35.5", "35.500") into minor units WITHOUT float math. */
export function toMinor(major: string | number, currency: string): number {
  const d = decimalsFor(currency);
  const s = typeof major === "number" ? major.toFixed(d) : major.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid money amount: ${major}`);
  const negative = s.startsWith("-");
  const [intPart = "0", fracRaw = ""] = s.replace("-", "").split(".");
  if (fracRaw.length > d) throw new Error(`Too many decimals for ${currency}: ${major}`);
  const frac = fracRaw.padEnd(d, "0");
  const value = Number(intPart) * 10 ** d + Number(frac || "0");
  assertMinor(value);
  return negative ? -value : value;
}

/** Minor units → plain decimal string ("35.500"). */
export function toMajorString(minor: number, currency: string): string {
  assertMinor(minor);
  const d = decimalsFor(currency);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const int = Math.floor(abs / 10 ** d);
  const frac = String(abs % 10 ** d).padStart(d, "0");
  return `${negative ? "-" : ""}${int}${d > 0 ? "." + frac : ""}`;
}

export function lineTotal(unitMinor: number, quantity: number): number {
  assertMinor(unitMinor, "unit price");
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("quantity must be a non-negative integer");
  const total = unitMinor * quantity;
  assertMinor(total, "line total");
  return total;
}

export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => {
    assertMinor(v);
    return acc + v;
  }, 0);
}

/**
 * Convert between currencies with different decimals at a 1:1 major rate.
 * Used ONLY to express a JOD total as cents for a USD-denominated provider store
 * when the owner has configured the same nominal price. Real FX is the provider's job.
 */
export function rescaleMinor(minor: number, from: string, to: string): number {
  const diff = decimalsFor(to) - decimalsFor(from);
  if (diff === 0) return minor;
  return diff > 0 ? minor * 10 ** diff : Math.round(minor / 10 ** -diff);
}
