#!/usr/bin/env node
/**
 * GRAMS GYM — on-site sync agent.
 *
 * Runs on the gym PC next to the GramsGym desktop program. It reads the local MySQL/MariaDB
 * database (gymgdata) with a READ-ONLY login and sends it to the website (/api/sync/legacy)
 * over HTTPS, signed with a shared secret. The website then updates its members and
 * memberships from it ("apply").
 *
 *   • "full" tables (members, subscriptions, programs, …) are read completely each pass and
 *     sent only when something in them changed (a fingerprint is kept in agent-state.json).
 *     Once a day everything is sent again, so the website heals if it ever lost data.
 *   • "append" tables (check-ins, payments, … — optional) only ever gain rows: the agent sends
 *     rows with an ID greater than the last one it sent.
 *   • After a pass in which a member-related table changed, the agent asks the website to
 *     update its members. If that fails, it asks again on the next pass.
 *
 * The agent never writes to the gym database. Cursors and fingerprints are stored locally, so
 * nothing is lost if the internet or the PC goes down.
 *
 * Usage:
 *   node agent.mjs [config.json]    keep running (append every pollSeconds, full every fullSyncMinutes)
 *   node agent.mjs --once           one pass, then exit (Windows Task Scheduler runs run-once.cmd)
 *   node agent.mjs --once --force   one pass that resends every table
 *   node agent.mjs --ping           test the database and the website, then exit
 */

import { createHash, createHmac } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const BLOB_TYPES = new Set(["blob", "tinyblob", "mediumblob", "longblob"]);
/** Tables the website builds its members and memberships from. */
const MEMBER_TABLES = new Set(["members", "programs", "offers", "subscriptions", "subscriptionsx", "freezes"]);
const here = dirname(fileURLToPath(import.meta.url));

// ── config ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const pingOnly = args.includes("--ping");
const onceOnly = args.includes("--once");
const forceAll = args.includes("--force");
const configArg = args.find((a) => !a.startsWith("--"));
const configPath = resolve(configArg ?? resolve(here, "config.json"));
if (!existsSync(configPath)) {
  console.error(`Config not found: ${configPath}\nCopy config.example.json to config.json and fill it in.`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const statePath = resolve(dirname(configPath), cfg.statePath ?? "./agent-state.json");
const batchSize = cfg.batchSize ?? 500;
const resendEveryMs = (cfg.resendEveryHours ?? 24) * 3_600_000;

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ── local state (cursors, fingerprints) ───────────────────────────────────────
function loadState() {
  let s = {};
  if (existsSync(statePath)) {
    try {
      s = JSON.parse(readFileSync(statePath, "utf8"));
    } catch {
      /* fall through to fresh state */
    }
  }
  return { cursors: {}, hashes: {}, lastFullAt: 0, lastResendAt: 0, applyPending: false, ...s };
}
const state = loadState();
const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

// ── website calls (signed) ─────────────────────────────────────────────────────
async function post(payload, timeoutMs = 60_000) {
  const body = JSON.stringify(payload);
  const ts = String(Date.now());
  const sig = createHmac("sha256", cfg.cloud.secret).update(`${ts}.${body}`, "utf8").digest("hex");
  const res = await fetch(cfg.cloud.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-timestamp": ts, "x-sync-signature": sig },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`website ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ── MySQL ────────────────────────────────────────────────────────────────────
let pool;
const colCache = new Map();

async function columnsFor(table) {
  if (colCache.has(table)) return colCache.get(table);
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
    [cfg.mysql.database, table],
  );
  // Skip BLOB columns (photos, fingerprint templates, free-text notes) — large and not mirrored.
  const cols = rows.filter((r) => !BLOB_TYPES.has(String(r.DATA_TYPE).toLowerCase())).map((r) => r.COLUMN_NAME);
  if (cols.length === 0) throw new Error(`no readable columns for ${table}`);
  colCache.set(table, cols);
  return cols;
}

const q = (id) => "`" + String(id).replace(/`/g, "") + "`";
const db = () => q(cfg.mysql.database);

async function sendBatches(table, rows) {
  let sent = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const res = await post({ op: "upsert", table, rows: chunk });
    sent += res.upserted ?? 0;
  }
  return sent;
}

/** Append table: send only rows newer than the stored cursor, paging by primary key. Returns true if rows were sent. */
async function syncAppend(table) {
  const cols = await columnsFor(table);
  const select = cols.map(q).join(",");
  let cursor = Number(state.cursors[table] ?? 0);
  let total = 0;
  for (;;) {
    const [rows] = await pool.query(
      `SELECT ${select} FROM ${db()}.${q(table)} WHERE \`ID\` > ? ORDER BY \`ID\` ASC LIMIT ?`,
      [cursor, batchSize],
    );
    if (rows.length === 0) break;
    await sendBatches(table, rows);
    cursor = Number(rows[rows.length - 1].ID);
    state.cursors[table] = cursor;
    saveState();
    total += rows.length;
    if (rows.length < batchSize) break;
  }
  if (total) log(`append ${table}: +${total} (cursor=${cursor})`);
  return total > 0;
}

/** Full table: read everything; send it only if it changed since the last send (or `force`). Returns true if sent. */
async function syncFull(table, force) {
  const cols = await columnsFor(table);
  const select = cols.map(q).join(",");
  const [rows] = await pool.query(`SELECT ${select} FROM ${db()}.${q(table)} ORDER BY \`ID\``);
  const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  if (!force && state.hashes[table] === hash) return false;
  const sent = await sendBatches(table, rows);
  state.hashes[table] = hash; // only after everything arrived, so a failed send is retried
  saveState();
  log(`full ${table}: ${rows.length} rows sent (${sent} stored)`);
  return true;
}

// ── passes ───────────────────────────────────────────────────────────────────
async function runFullCycle(force) {
  const changed = [];
  let failed = 0;
  for (const table of cfg.tables.full ?? []) {
    try {
      if (await syncFull(table, force)) changed.push(table);
    } catch (e) {
      failed++;
      log(`! full ${table} failed: ${e.message}`);
    }
  }
  state.lastFullAt = Date.now();
  if (force && failed === 0) state.lastResendAt = Date.now();
  saveState();
  return { changed, failed };
}

async function runAppendCycle() {
  const changed = [];
  let failed = 0;
  for (const table of cfg.tables.append ?? []) {
    try {
      if (await syncAppend(table)) changed.push(table);
    } catch (e) {
      failed++;
      log(`! append ${table} failed: ${e.message}`);
    }
  }
  return { changed, failed };
}

/** Ask the website to update its members, if a member table changed (or the last request failed). */
async function applyIfNeeded(changed) {
  if (!changed.some((t) => MEMBER_TABLES.has(t)) && !state.applyPending) return null;
  try {
    const res = await post({ op: "apply" }, 120_000);
    state.applyPending = false;
    saveState();
    const s = res.summary ?? {};
    log(
      `website members updated: ${s.membersCreated ?? 0} new, ${s.membersUpdated ?? 0} changed, ` +
        `${s.subscriptionsCreated ?? 0} new memberships, ${s.subscriptionsUpdated ?? 0} freezes updated` +
        (s.conflicts?.length ? `, numbers already used on the website: ${s.conflicts.join(", ")}` : "") +
        ` (${res.ms ?? "?"} ms)`,
    );
    return true;
  } catch (e) {
    state.applyPending = true;
    saveState();
    log(`! updating website members failed (will retry): ${e.message}`);
    return false;
  }
}

/** One complete pass. Returns the number of failures. */
async function pass(forceRequested) {
  const force = forceRequested || Date.now() - (state.lastResendAt ?? 0) > resendEveryMs;
  const full = await runFullCycle(force);
  const append = await runAppendCycle();
  const changed = [...full.changed, ...append.changed];
  const applied = await applyIfNeeded(changed);
  if (changed.length === 0 && applied === null) log("no changes");
  return full.failed + append.failed + (applied === false ? 1 : 0);
}

async function main() {
  pool = mysql.createPool({
    host: cfg.mysql.host,
    port: cfg.mysql.port ?? 3306,
    user: cfg.mysql.user,
    password: cfg.mysql.password,
    database: cfg.mysql.database,
    // Older gym programs sometimes store Arabic in another character set (e.g. "cp1256").
    ...(cfg.mysql.charset ? { charset: cfg.mysql.charset } : {}),
    connectionLimit: 3,
    dateStrings: true, // keep dates/datetimes as local wall-clock strings (no TZ shifting)
    decimalNumbers: false, // keep decimals as strings to preserve precision
  });

  // connectivity check
  await pool.query("SELECT 1");
  const ping = await post({ op: "ping" });
  log(`connected: MySQL ${cfg.mysql.host}:${cfg.mysql.port ?? 3306}/${cfg.mysql.database} → website ok (${ping.ok})`);

  if (pingOnly) {
    const { cursors } = await post({ op: "cursors" });
    log("website cursors:", cursors);
    await pool.end();
    return 0;
  }

  // Seed append cursors from the website on first run so existing history isn't sent again.
  if ((cfg.tables.append ?? []).length > 0 && Object.keys(state.cursors).length === 0) {
    try {
      const { cursors } = await post({ op: "cursors" });
      state.cursors = { ...cursors };
      saveState();
      log("seeded cursors from website:", state.cursors);
    } catch (e) {
      log(`! could not seed cursors (starting from 0): ${e.message}`);
    }
  }

  if (onceOnly) {
    const failures = await pass(forceAll);
    await pool.end();
    return failures > 0 ? 1 : 0;
  }

  // Keep running: first pass now, then on timers (never two passes at the same time).
  let busy = false;
  const guarded = (fn) => async () => {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      log("pass error:", e.message);
    } finally {
      busy = false;
    }
  };
  await guarded(() => pass(forceAll))();
  setInterval(
    guarded(async () => {
      const append = await runAppendCycle();
      await applyIfNeeded(append.changed);
    }),
    (cfg.pollSeconds ?? 5) * 1000,
  );
  setInterval(guarded(() => pass(false)), (cfg.fullSyncMinutes ?? 5) * 60_000);
  log(`running — append every ${cfg.pollSeconds ?? 5}s, full every ${cfg.fullSyncMinutes ?? 5}m. Ctrl+C to stop.`);
  return null;
}

process.on("SIGINT", async () => {
  log("stopping…");
  try {
    await pool?.end();
  } catch {
    /* ignore */
  }
  process.exit(0);
});

main()
  .then((code) => {
    if (code !== null) process.exit(code);
  })
  .catch((e) => {
    log("fatal:", e.message);
    process.exit(1);
  });
