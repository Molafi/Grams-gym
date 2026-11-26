import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { SITE_NUMBER_END, SITE_NUMBER_START } from "@/lib/member-number";

const SEQ = Prisma.sql`pg_get_serial_sequence('"User"', 'memberNumber')`;

/**
 * Makes the next number the website hands out (online sign-up, a new member added on the site,
 * a new staff account) at least SITE_NUMBER_START, so it can never take a number the old gym
 * program will give its next member. Never moves the counter backwards. Cheap: one statement.
 */
export async function ensureSiteNumberSequence(): Promise<void> {
  await db.$queryRaw`SELECT setval(${SEQ}, GREATEST(
    ${SITE_NUMBER_START - 1}::bigint,
    COALESCE(pg_sequence_last_value(${SEQ}::regclass), 0),
    COALESCE((SELECT MAX("memberNumber") FROM "User" WHERE "memberNumber" BETWEEN ${SITE_NUMBER_START} AND ${SITE_NUMBER_END}), 0)
  ))`;
}
