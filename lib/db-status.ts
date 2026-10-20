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

export function markDbDown(where: string) {
  downUntil = Date.now() + DOWN_FOR_MS;
  const now = Date.now();
  if (now - lastWarning < 60_000) return;
  lastWarning = now;
  console.warn(`[db] Database unreachable (${where}). Showing defaults until it's running — see docs/SETUP.md.`);
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
