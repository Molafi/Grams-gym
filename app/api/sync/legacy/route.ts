import { env, syncConfigured } from "@/lib/env";
import { verifySync } from "@/lib/sync/signature";
import { MIRROR } from "@/lib/sync/legacy-schema";
import { ensureTable, mirrorStatus, tableMaxSrcIds, upsertRows, type LegacyRow } from "@/lib/sync/legacy-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Ingestion endpoint for the on-site sync agent (sync/agent). All requests are signed
 * with HMAC-SHA256 over `${timestamp}.${rawBody}` using SYNC_SECRET.
 *
 * Body is one of:
 *   { "op": "ping" }
 *   { "op": "cursors" }                                  → { cursors: { table: maxSrcId } }
 *   { "op": "status" }                                   → { tables: [{ table, rows, lastSyncedAt }] }
 *   { "op": "upsert", "table": "clocks", "rows": [...] } → { ok, table, upserted }
 */
export async function POST(req: Request) {
  if (!syncConfigured) return json({ error: "sync not configured (set SYNC_SECRET)" }, 503);

  const raw = await req.text();
  const ok = verifySync(
    raw,
    req.headers.get("x-sync-timestamp"),
    req.headers.get("x-sync-signature"),
    env.SYNC_SECRET,
  );
  if (!ok) return json({ error: "invalid signature" }, 401);

  let payload: { op?: string; table?: string; rows?: LegacyRow[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  try {
    switch (payload.op) {
      case "ping":
        return json({ ok: true, now: Date.now() });

      case "cursors":
        return json({ cursors: await tableMaxSrcIds() });

      case "status":
        return json({ tables: await mirrorStatus() });

      case "upsert": {
        const { table, rows } = payload;
        if (!table || !MIRROR[table]) return json({ error: `unknown table: ${table}` }, 400);
        if (!Array.isArray(rows)) return json({ error: "rows must be an array" }, 400);
        await ensureTable(table);
        const upserted = await upsertRows(table, rows);
        return json({ ok: true, table, received: rows.length, upserted });
      }

      default:
        return json({ error: `unknown op: ${payload.op}` }, 400);
    }
  } catch (err) {
    console.error("[sync/legacy]", err);
    return json({ error: "ingest failed" }, 500);
  }
}
