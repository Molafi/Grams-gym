import "server-only";
import { db } from "@/lib/db";
import { ammanToday } from "@/lib/legacy-import";
import { mirrorStatus } from "@/lib/sync/legacy-ingest";
import { mirrorToImportRows, type MirrorMember, type MirrorOffer, type MirrorProgram, type MirrorSubscription } from "@/lib/sync/legacy-members";
import { importLegacyRows, type ImportSummary } from "./legacy-import";

/**
 * The website side of the sync with the old gym program: the agent on the gym PC (sync/agent)
 * copies the program's tables into legacy_* tables; this turns them into website members and
 * front-desk memberships, using the same import as /admin/import. Runs after every change the
 * agent sends (op "apply" on /api/sync/legacy) and from the "Update members now" button.
 */

/** The mirrored tables the website uses (the agent's default list, sync/agent/config.example.json). */
export const MEMBER_TABLES = ["members", "subscriptions", "subscriptionsx", "programs", "offers"] as const;

/** Imported memberships belong to this plan: not sold online, named after the gym program. */
export const SYNC_PLAN_SLUG = "gym-program";

export type SyncResult =
  | { ok: false; reason: "noMirror" }
  | { ok: true; summary: ImportSummary; skippedMembers: number; skippedPeriods: number; ms: number };

async function tableExists(name: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass(${`public."${name}"`}) IS NOT NULL AS ok`;
  return Boolean(rows[0]?.ok);
}

/** Only the columns the website needs (the mirror also holds e.g. national ID numbers). Table names are constants. */
async function read<T>(table: string, columns: string): Promise<T[]> {
  if (!(await tableExists(table))) return [];
  return db.$queryRawUnsafe<T[]>(`SELECT ${columns} FROM "${table}"`);
}

const SUBSCRIPTION_COLUMNS = `"member_id", "program_id", "offer_id", "from_date", "to_date", "freezed"`;

export async function syncMembersFromMirror(actorId: string | null): Promise<SyncResult> {
  const started = Date.now();
  if (!(await tableExists("legacy_members"))) return { ok: false, reason: "noMirror" };

  const members = await read<MirrorMember>("legacy_members", `"src_id", "number", "name", "name_x", "gender", "mobile", "phone"`);
  const programs = await read<MirrorProgram>("legacy_programs", `"src_id", "name"`);
  const offers = await read<MirrorOffer>("legacy_offers", `"src_id", "name"`);
  const live = await read<MirrorSubscription>("legacy_subscriptions", SUBSCRIPTION_COLUMNS);
  const archive = await read<MirrorSubscription>("legacy_subscriptionsx", SUBSCRIPTION_COLUMNS);

  const mapped = mirrorToImportRows(
    { members, programs, offers, subscriptions: [...live, ...archive.map((s) => ({ ...s, archived: true }))] },
    ammanToday(),
  );

  const plan = await db.plan.upsert({
    where: { slug: SYNC_PLAN_SLUG },
    update: {},
    create: {
      slug: SYNC_PLAN_SLUG,
      kind: "membership",
      nameAr: "اشتراك النادي",
      nameEn: "Gym membership",
      taglineAr: "اشتراك مسجّل في برنامج النادي",
      taglineEn: "Membership from the gym program",
      featuresAr: [],
      featuresEn: [],
      priceMonthly: 0,
      priceQuarterly: 0,
      priceYearly: 0,
      active: false,
      isPlaceholder: false,
      sortOrder: 100,
    },
    select: { id: true },
  });

  const summary = await importLegacyRows(mapped.rows, { planId: plan.id, actorId, auditAction: "sync.members", auditOnlyChanges: true });
  return { ok: true, summary, skippedMembers: mapped.skippedMembers, skippedPeriods: mapped.skippedPeriods, ms: Date.now() - started };
}

export type SyncStatus = {
  tables: { table: string; rows: number; lastSyncedAt: string | null }[];
  importedMembers: number;
  /** Imported members with a membership valid right now (compare with "active" in the old program). */
  activeNow: number;
  lastChange: { at: Date; created: number; updated: number; subscriptions: number; conflicts: number[] } | null;
};

export async function syncStatus(): Promise<SyncStatus> {
  const now = new Date();
  const [tables, importedMembers, active, last] = await Promise.all([
    mirrorStatus(MEMBER_TABLES),
    db.user.count({ where: { importedAt: { not: null } } }),
    db.subscription.findMany({
      where: { importKey: { not: null }, status: "active", startsAt: { lte: now }, endsAt: { gt: now } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.auditLog.findFirst({ where: { action: "sync.members" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, meta: true } }),
  ]);
  const meta = (last?.meta ?? {}) as unknown as { created?: number; updated?: number; subscriptions?: number; conflictNumbers?: number[] };
  return {
    tables,
    importedMembers,
    activeNow: active.length,
    lastChange: last
      ? { at: last.createdAt, created: meta.created ?? 0, updated: meta.updated ?? 0, subscriptions: meta.subscriptions ?? 0, conflicts: meta.conflictNumbers ?? [] }
      : null,
  };
}
