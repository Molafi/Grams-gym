import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { startOfAmmanDay, ymdIso, type ImportRow } from "@/lib/legacy-import";

export type ImportSummary = {
  members: number;
  membersCreated: number;
  membersUpdated: number;
  membersUnchanged: number;
  subscriptionsCreated: number;
  subscriptionsExisting: number;
  /** Numbers that already belong to an account made on this site (not imported, not demo). */
  conflicts: number[];
  /** Members whose phone already belongs to another member (phone kept, not used for sign-up checks). */
  sharedPhones: number[];
  /** Demo members moved to a new number to make room for an imported one. */
  renumberedDemo: number;
};

const SEQ = Prisma.sql`pg_get_serial_sequence('"User"', 'memberNumber')`;

const existingSelect = {
  id: true,
  memberNumber: true,
  importedAt: true,
  isDemo: true,
  name: true,
  phone: true,
  phoneDigits: true,
  gender: true,
} satisfies Prisma.UserSelect;
type ExistingUser = Prisma.UserGetPayload<{ select: typeof existingSelect }>;

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

const periodKey = (r: ImportRow) => `legacy:${r.memberNumber}:${ymdIso(r.from!)}:${ymdIso(r.to!)}`;

function noteFor(r: ImportRow): string {
  return ["Imported from the old program", r.program, r.offer ? `Offer: ${r.offer}` : null, r.notes].filter(Boolean).join(" · ").slice(0, 500);
}

/**
 * Imports members (keeping their old membership numbers) and their memberships as
 * front-desk ("manual") memberships. Safe to run again with a newer export: members are
 * updated, memberships that were already imported are left as they are (staff may have
 * extended them here), new periods are added.
 */
export async function importLegacyRows(rows: ImportRow[], opts: { planId: string; actorId: string | null }): Promise<ImportSummary> {
  // One profile per member number: the row with the latest end date wins.
  const byNumber = new Map<number, ImportRow>();
  for (const r of rows) {
    const prev = byNumber.get(r.memberNumber);
    if (!prev || !prev.to || (r.to && ymdIso(r.to) >= ymdIso(prev.to))) byNumber.set(r.memberNumber, r);
  }
  const numbers = [...byNumber.keys()];
  const summary: ImportSummary = {
    members: numbers.length,
    membersCreated: 0,
    membersUpdated: 0,
    membersUnchanged: 0,
    subscriptionsCreated: 0,
    subscriptionsExisting: 0,
    conflicts: [],
    sharedPhones: [],
    renumberedDemo: 0,
  };
  if (numbers.length === 0) return summary;

  const existing: ExistingUser[] = [];
  for (const part of chunks(numbers, 5000)) {
    existing.push(...(await db.user.findMany({ where: { memberNumber: { in: part } }, select: existingSelect })));
  }
  const existingByNumber = new Map(existing.map((u) => [u.memberNumber, u]));

  // New members created on this site get numbers after the imported ones. (Demo accounts
  // GG-99001/99002 are ignored so the counter doesn't jump to 99003.)
  const maxImported = numbers.reduce((a, b) => Math.max(a, b), 0);
  await db.$queryRaw`SELECT setval(${SEQ}, GREATEST(${maxImported}::bigint, (SELECT COALESCE(MAX("memberNumber"), 1) FROM "User" WHERE NOT "isTestAccount" AND NOT "isGuest")))`;

  const toCreate: ImportRow[] = [];
  const toUpdate: { user: ExistingUser; row: ImportRow }[] = [];
  for (const [n, row] of byNumber) {
    const u = existingByNumber.get(n);
    if (!u) toCreate.push(row);
    else if (u.importedAt) toUpdate.push({ user: u, row });
    else if (u.isDemo) {
      // Fake seed data: give it a fresh number instead of blocking a real member.
      await db.$executeRaw`UPDATE "User" SET "memberNumber" = nextval(${SEQ}) WHERE "id" = ${u.id}`;
      summary.renumberedDemo++;
      toCreate.push(row);
    } else summary.conflicts.push(n);
  }

  // One account per phone (phoneDigits is unique): members sharing a phone keep it as text only.
  const wanted = [...toCreate, ...toUpdate.map((x) => x.row)].map((r) => r.phoneDigits).filter((d): d is string => Boolean(d));
  const ownerOf = new Map<string, string>();
  for (const part of chunks([...new Set(wanted)], 5000)) {
    for (const o of await db.user.findMany({ where: { phoneDigits: { in: part } }, select: { id: true, phoneDigits: true } })) {
      if (o.phoneDigits) ownerOf.set(o.phoneDigits, o.id);
    }
  }
  const claimPhone = (row: ImportRow, userId: string | null): string | null => {
    const d = row.phoneDigits;
    if (!d) return null;
    const owner = ownerOf.get(d);
    if (owner === undefined) {
      ownerOf.set(d, userId ?? `new:${row.memberNumber}`);
      return d;
    }
    if (owner === userId) return d;
    summary.sharedPhones.push(row.memberNumber);
    return null;
  };

  const now = new Date();
  for (const part of chunks(toCreate, 500)) {
    const res = await db.user.createMany({
      data: part.map((r) => ({
        memberNumber: r.memberNumber,
        name: r.name,
        phone: r.phone,
        phoneDigits: claimPhone(r, null),
        gender: r.gender,
        importedAt: now,
      })),
      skipDuplicates: true,
    });
    summary.membersCreated += res.count;
  }

  for (const { user, row } of toUpdate) {
    const phoneDigits = claimPhone(row, user.id);
    const data = {
      name: row.name,
      phone: row.phone ?? user.phone,
      phoneDigits: row.phone ? phoneDigits : user.phoneDigits,
      gender: row.gender ?? user.gender,
    };
    if (data.name === user.name && data.phone === user.phone && data.phoneDigits === user.phoneDigits && data.gender === user.gender) {
      summary.membersUnchanged++;
      continue;
    }
    await db.user.update({ where: { id: user.id }, data: { ...data, importedAt: now } });
    summary.membersUpdated++;
  }

  // Memberships: one per (member, from, to) period, attached to imported members only.
  const idOf = new Map<number, string>();
  for (const part of chunks(numbers, 5000)) {
    for (const u of await db.user.findMany({ where: { memberNumber: { in: part }, importedAt: { not: null } }, select: { id: true, memberNumber: true } })) {
      idOf.set(u.memberNumber, u.id);
    }
  }
  const periods = new Map<string, Prisma.SubscriptionCreateManyInput>();
  for (const r of rows) {
    const userId = idOf.get(r.memberNumber);
    if (!userId || !r.from || !r.to) continue;
    const startsAt = startOfAmmanDay(r.from);
    const endsAt = startOfAmmanDay(r.to, 1); // valid through the whole "to" day
    periods.set(periodKey(r), {
      importKey: periodKey(r),
      userId,
      planId: opts.planId,
      interval: r.interval,
      provider: "manual",
      status: r.frozen ? "paused" : endsAt <= now ? "expired" : "active",
      startsAt,
      endsAt,
      notes: noteFor(r),
    });
  }
  const all = [...periods.values()];
  for (const part of chunks(all, 500)) {
    summary.subscriptionsCreated += (await db.subscription.createMany({ data: part, skipDuplicates: true })).count;
  }
  summary.subscriptionsExisting = all.length - summary.subscriptionsCreated;

  await audit(opts.actorId, "import.legacy", "User", null, {
    members: summary.members,
    created: summary.membersCreated,
    updated: summary.membersUpdated,
    subscriptions: summary.subscriptionsCreated,
    conflicts: summary.conflicts.length,
  });
  return summary;
}
