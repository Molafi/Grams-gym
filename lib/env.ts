import "server-only";
import { z } from "zod";

/** "true"/"false" strings → boolean with a default. */
const flag = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : v === "true" || v === "1"));

const opt = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_GOOGLE_ID: opt,
  AUTH_GOOGLE_SECRET: opt,

  ENABLE_TEST_ACCOUNT: flag(false),
  ALLOW_TEST_ACCOUNT_IN_PROD: flag(false),
  TEST_MEMBER_EMAIL: opt,
  TEST_MEMBER_PASSWORD: opt,
  TEST_ADMIN_EMAIL: opt,
  TEST_ADMIN_PASSWORD: opt,

  LEMONSQUEEZY_API_KEY: opt,
  LEMONSQUEEZY_STORE_ID: opt,
  LEMONSQUEEZY_WEBHOOK_SECRET: opt,
  // Fails closed: defaults to live mode in production so a forgotten variable can't let
  // anyone buy a membership with a test card.
  LEMONSQUEEZY_TEST_MODE: flag(process.env.NODE_ENV !== "production"),
  LS_VARIANT_SUPPLEMENT_ORDER: opt,
  /** Currency of the Lemon Squeezy store (custom prices are sent in its minor units). */
  LS_STORE_CURRENCY: opt
    .transform((v) => (v ?? "USD").toUpperCase())
    .refine((v) => /^[A-Z]{3}$/.test(v), "must be a 3-letter currency code"),
  /** Store-currency units per 1 JOD, e.g. 1.41 for USD. Required for LS supplement orders when the store isn't JOD. */
  LS_JOD_EXCHANGE_RATE: opt
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), "must be a positive number"),

  SUPPLEMENT_PAYMENT_MODE: z.enum(["manual", "lemonsqueezy"]).default("manual"),
  MEMBERSHIP_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  DELIVERY_FEE_MINOR: z.coerce.number().int().min(0).default(2000),

  RESEND_API_KEY: opt,
  EMAIL_FROM: opt,
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return parsed.data;
  if (process.env.SKIP_ENV_VALIDATION) {
    // Build images without secrets. Runtime will still fail on first DB/auth access.
    return schema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://invalid",
      AUTH_SECRET: process.env.AUTH_SECRET || "skip-env-validation-placeholder",
    });
  }
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`\n❌ Invalid environment variables:\n${issues}\nSee .env.example\n`);
}

export const env = load();

/** Single switch for the build-phase test accounts. */
export const testAccountsEnabled =
  env.ENABLE_TEST_ACCOUNT && (env.NODE_ENV !== "production" || env.ALLOW_TEST_ACCOUNT_IN_PROD);

/**
 * The one-click *admin* test login is never offered in production, even with
 * ALLOW_TEST_ACCOUNT_IN_PROD: anyone who can reach /signin would become ADMIN.
 */
export const testAdminEnabled = testAccountsEnabled && env.NODE_ENV !== "production";

/**
 * Whether memberships/orders created in test mode (payment simulator, LS test checkouts)
 * still count. Once the site is live (test accounts off, LS live mode) they grant nothing.
 */
export const testDataAllowed = testAccountsEnabled || env.LEMONSQUEEZY_TEST_MODE;

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export const lemonSqueezyConfigured = Boolean(
  env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID && env.LEMONSQUEEZY_WEBHOOK_SECRET,
);

/**
 * Payment simulator: lets testers complete a membership "checkout" without a
 * Lemon Squeezy account. Only when LS is NOT configured AND test accounts are on.
 */
export const paymentSimulatorEnabled = !lemonSqueezyConfigured && testAccountsEnabled;

export function lsVariantId(slug: string, interval: string): string | undefined {
  const v = process.env[`LS_VARIANT_${slug.toUpperCase()}_${interval.toUpperCase()}`];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** Reverse lookup: variant ID → (plan slug, interval). Used by the webhook. */
export function planForVariant(variantId: string | number): { slug: string; interval: string } | undefined {
  const id = String(variantId);
  for (const slug of ["starter", "pro", "elite"]) {
    for (const interval of ["monthly", "quarterly", "yearly"]) {
      if (lsVariantId(slug, interval) === id) return { slug, interval };
    }
  }
  return undefined;
}
