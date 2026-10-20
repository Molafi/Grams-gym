import "server-only";
import { Prisma } from "@prisma/client";

/** True when the error means "can't reach the database" (not a bug in a query). */
export function isDbUnavailable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) return ["P1001", "P1002", "P1008", "P1017"].includes(e.code);
  return false;
}

let lastWarning = 0;

/** One short warning per minute instead of a red error on every request. */
export function warnDbUnavailable(where: string) {
  const now = Date.now();
  if (now - lastWarning < 60_000) return;
  lastWarning = now;
  console.warn(`[db] Database unreachable (${where}). Pages show defaults until it's running — see docs/SETUP.md.`);
}

/** For `promise.catch(...)`: turns "database down" into `null`; real errors still throw. */
export const nullIfDbDown =
  (where: string) =>
  (e: unknown): null => {
    if (!isDbUnavailable(e)) throw e;
    warnDbUnavailable(where);
    return null;
  };

/** Logs a failed optional read: a short warning if the DB is down, the full error otherwise. */
export function logOptionalReadFailure(where: string, e: unknown) {
  if (isDbUnavailable(e)) warnDbUnavailable(where);
  else console.error(`[${where}] read failed; using defaults`, e);
}
