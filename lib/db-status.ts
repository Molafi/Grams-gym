import "server-only";
import { Prisma } from "@prisma/client";

/** True when the error means "can't reach the database" (not a bug in a query). */
export function isDbUnavailable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) return ["P1001", "P1002", "P1008", "P1017"].includes(e.code);
  // Auth.js wraps errors thrown in `authorize` (CallbackRouteError → cause.err).
  const cause = (e as { cause?: { err?: unknown } } | null)?.cause;
  return cause?.err !== undefined && cause.err !== e ? isDbUnavailable(cause.err) : false;
}

/*
 * Circuit breaker. Every failed connection attempt waits for a timeout (seconds). Once one
 * fails, skip optional reads for a short while instead of waiting again on every query of
 * every page — that's what made pages take 10+ seconds without a database.
 */
const DOWN_FOR_MS = 15_000;
let downUntil = 0;
let lastWarning = 0;

export const dbKnownDown = () => Date.now() < downUntil;

/** Where the app is trying to connect ("localhost:51214"), without the password. */
export function dbTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "DATABASE_URL is not set";
  try {
    const u = new URL(raw.replace(/^"|"$/g, ""));
    return `${u.hostname}:${u.port || "5432"}`;
  } catch {
    return "an invalid DATABASE_URL";
  }
}

export function markDbDown(where: string) {
  downUntil = Date.now() + DOWN_FOR_MS;
  const now = Date.now();
  if (now - lastWarning < 60_000) return;
  lastWarning = now;
  console.warn(
    `[db] Can't reach the database at ${dbTarget()} (${where}). Is \`npm run db:local\` running, and does DATABASE_URL in .env match the address it prints? Run \`npm run db:check\`.`,
  );
}

/** For `promise.catch(...)`: turns "database down" into `null`; real errors still throw. */
export const nullIfDbDown =
  (where: string) =>
  (e: unknown): null => {
    if (!isDbUnavailable(e)) throw e;
    markDbDown(where);
    return null;
  };

/** Run a read unless the database is known to be down. Null = unavailable. */
export async function readOrNull<T>(where: string, load: () => Promise<T>): Promise<T | null> {
  if (dbKnownDown()) return null;
  return load().catch(nullIfDbDown(where));
}

/** Logs a failed optional read: one short warning if the DB is down, the full error otherwise. */
export function logOptionalReadFailure(where: string, e: unknown) {
  if (isDbUnavailable(e)) markDbDown(where);
  else console.error(`[${where}] read failed; using defaults`, e);
}
