import "server-only";
import { db } from "@/lib/db";
import {
  MIRROR,
  MIRROR_TABLES,
  PG_TYPE_SQL,
  assertIdent,
  normalizeCol,
  type PgType,
} from "./legacy-schema";

/** Incoming rows are keyed by the SOURCE column names (e.g. "Job Title", "From"). */
export type LegacyRow = Record<string, unknown>;

const mirrorTableName = (table: string): string => assertIdent(`legacy_${table}`);

/** Coerce a value from the agent into something Postgres accepts for the column type. */
function coerce(type: PgType, v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  switch (type) {
    case "id":
    case "int":
    case "small": {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case "num": {
      const s = String(v).trim();
      return s === "" ? null : s; // keep as string to preserve decimal precision
    }
    case "date":
    case "ts": {
      const s = String(v).trim();
      // MySQL/MariaDB can hold the zero date ('0000-00-00[ 00:00:00]') — not valid in Postgres.
      if (s === "" || s.startsWith("0000")) return null;
      return s;
    }
    case "time": {
      const s = String(v).trim();
      return s === "" ? null : s;
    }
    default:
      return String(v);
  }
}

/** Create legacy_<table> if it doesn't exist yet (idempotent). */
export async function ensureTable(table: string): Promise<void> {
  const def = MIRROR[table];
  if (!def) throw new Error(`unknown table: ${table}`);
  const tbl = mirrorTableName(table);
  const cols = def.columns
    .map(([src, type]) => `"${assertIdent(normalizeCol(src))}" ${PG_TYPE_SQL[type]}`)
    .join(", ");
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${tbl}" (src_id bigint PRIMARY KEY, ${cols}, synced_at timestamptz NOT NULL DEFAULT now())`,
  );
}

const CHUNK = 500;

/**
 * Upsert a batch of rows into legacy_<table>. Returns how many rows were written.
 * Rows without a valid primary key are skipped.
 */
export async function upsertRows(table: string, rows: LegacyRow[]): Promise<number> {
  const def = MIRROR[table];
  if (!def) throw new Error(`unknown table: ${table}`);
  if (rows.length === 0) return 0;

  const tbl = mirrorTableName(table);
  const colNames = ["src_id", ...def.columns.map(([src]) => normalizeCol(src))];
  const quoted = colNames.map((c) => `"${assertIdent(c)}"`).join(", ");
  const updates = def.columns
    .map(([src]) => {
      const c = assertIdent(normalizeCol(src));
      return `"${c}"=EXCLUDED."${c}"`;
    })
    .join(", ");

  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: (string | number | null)[] = [];
    const tuples: string[] = [];

    for (const r of chunk) {
      const srcId = coerce("id", r[def.pk]);
      if (srcId === null) continue; // can't upsert without a primary key
      const ph: string[] = [];
      params.push(srcId);
      ph.push(`$${params.length}`);
      for (const [src, type] of def.columns) {
        params.push(coerce(type, r[src]));
        ph.push(`$${params.length}`);
      }
      tuples.push(`(${ph.join(",")})`);
    }
    if (tuples.length === 0) continue;

    await db.$executeRawUnsafe(
      `INSERT INTO "${tbl}" (${quoted}) VALUES ${tuples.join(", ")} ` +
        `ON CONFLICT (src_id) DO UPDATE SET ${updates}, synced_at=now()`,
      ...params,
    );
    written += tuples.length;
  }
  return written;
}

/** Highest src_id stored per table (0 if the table doesn't exist yet). Lets the agent resume. */
export async function tableMaxSrcIds(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of MIRROR_TABLES) {
    const tbl = mirrorTableName(table);
    try {
      const rows = await db.$queryRawUnsafe<{ max: bigint | number | null }[]>(
        `SELECT COALESCE(MAX(src_id), 0) AS max FROM "${tbl}"`,
      );
      out[table] = Number(rows?.[0]?.max ?? 0);
    } catch {
      out[table] = 0; // table not created yet
    }
  }
  return out;
}

/** Row counts + freshness per table — for an admin status view. */
export async function mirrorStatus(): Promise<{ table: string; rows: number; lastSyncedAt: string | null }[]> {
  const out: { table: string; rows: number; lastSyncedAt: string | null }[] = [];
  for (const table of MIRROR_TABLES) {
    const tbl = mirrorTableName(table);
    try {
      const rows = await db.$queryRawUnsafe<{ n: bigint | number; last: Date | null }[]>(
        `SELECT COUNT(*) AS n, MAX(synced_at) AS last FROM "${tbl}"`,
      );
      out.push({
        table,
        rows: Number(rows?.[0]?.n ?? 0),
        lastSyncedAt: rows?.[0]?.last ? new Date(rows[0].last as Date).toISOString() : null,
      });
    } catch {
      out.push({ table, rows: 0, lastSyncedAt: null });
    }
  }
  return out;
}
