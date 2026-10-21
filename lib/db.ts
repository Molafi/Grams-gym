import "server-only";
import { PrismaClient } from "@prisma/client";
import { prismaUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaUrl?: string };

// Dev keeps one client across hot reloads. If DATABASE_URL changed in .env meanwhile, drop
// the old client (it would keep using the old address until the server restarts).
const url = prismaUrl();
if (globalForPrisma.prisma && globalForPrisma.prismaUrl !== url) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = undefined;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: url,
    // Errors are handled (and logged once, briefly) by the code that runs the query, so dev
    // doesn't print a page-long Prisma error for every query while the database is off.
    log: process.env.NODE_ENV === "development" ? ["warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaUrl = url;
}
