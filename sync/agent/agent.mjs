#!/usr/bin/env node
/**
 * GRAMS GYM — on-site sync agent.
 *
 * Runs on the gym PC next to the GramsGym desktop program. It connects to the local
 * MySQL/MariaDB database (gymgdata) with a READ-ONLY login and pushes changes to the
 * cloud endpoint (/api/sync/legacy) over HTTPS, signed with a shared secret.
 *
 *   • "append" tables (clocks, payments, …) only ever gain rows — the agent sends
 *     rows with ID greater than the last one it sent, every `pollSeconds`. This is the
 *     near-real-time path (new check-ins appear in the cloud within seconds).
 *   • "full" tables (members, subscriptions, programs, …) can be edited in place but
 *     are small — the agent re-sends all their rows every `fullSyncMinutes` (upserts,
 *     so this just refreshes edited rows).
 *
 * The agent never writes to the gym database. It only reads. Cursors are stored locally
 * so it resumes where it left off and loses nothing if the internet or PC goes down.
 *
 * Usage:
 *   node agent.mjs [path/to/config.json]     # default: ./config.json
 *   node agent.mjs --ping                     # test DB + cloud connectivity and exit
 */

import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const BLOB_TYPES = new Set(["blob", "tinyblob", "mediumblob", "longblob"]);
const here = dirname(fileURLToPath(import.meta.url));

// ── config ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const pingOnly = args.includes("--ping");
const configArg = args.find((a) => !a.startsWith("--"));
const configPath = resolve(configArg ?? resolve(here, "config.json"));
if (!existsSync(configPath)) {
  console.error(`Config not found: ${configPath}\nCopy config.example.json to config.json and fill it in.`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const statePath = resolve(dirname(configPath), cfg.statePath ?? "./agent-state.json");
const batchSize = cfg.batchSize ?? 500;

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ── local state (cursors) ─────────────────────────────────────────────────────
function loadState() {
  if (existsSync(statePath)) {
    try {
      return JSON.parse(readFileSync(statePath, "utf8"));
    } catch {
      /* fall through to fresh state */
    }
  }
  return { cursors: {}, lastFullAt: 0 };
}
let state = loadState();
const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

// ── cloud calls (signed) ───────────────────────────────────────────────────────
async function post(payload) {
  const body = JSON.stringify(payload);
  const ts = String(Date.now());
  const sig = createHmac("sha256", cfg.cloud.secret).update(`${ts}.${body}`, "utf8").digest("hex");
  const res = await fetch(cfg.cloud.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-timestamp": ts, "x-sync-signature": sig },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`cloud ${res.status}: ${text.slice(0, 300)}`);
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

/** Append table: send only rows newer than the stored cursor, paging by primary key. */
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
}

/** Full table: re-send all rows (upsert refreshes any edits). For small, in-place tables. */
async function syncFull(table) {
  const cols = await columnsFor(table);
  const select = cols.map(q).join(",");
  const [rows] = await pool.query(`SELECT ${select} FROM ${db()}.${q(table)}`);
  const sent = await sendBatches(table, rows);
  log(`full ${table}: ${rows.length} rows (${sent} upserted)`);
}

// ── main loop ───────────────────────────────────────────────────────────────
async function runAppendCycle() {
  for (const table of cfg.tables.append ?? []) {
    try {
      await syncAppend(table);
    } catch (e) {
      log(`! append ${table} failed: ${e.message}`);
    }
  }
}

async function runFullCycle() {
  for (const table of cfg.tables.full ?? []) {
    try {
      await syncFull(table);
    } catch (e) {
      log(`! full ${table} failed: ${e.message}`);
    }
  }
  state.lastFullAt = Date.now();
  saveState();
}

async function main() {
  pool = mysql.createPool({
    host: cfg.mysql.host,
    port: cfg.mysql.port ?? 3306,
    user: cfg.mysql.user,
    password: cfg.mysql.password,
    database: cfg.mysql.database,
    connectionLimit: 3,
    dateStrings: true, // keep dates/datetimes as local wall-clock strings (no TZ shifting)
    decimalNumbers: false, // keep decimals as strings to preserve precision
  });

  // connectivity check
  await pool.query("SELECT 1");
  const ping = await post({ op: "ping" });
  log(`connected: MySQL ${cfg.mysql.host}:${cfg.mysql.port ?? 3306}/${cfg.mysql.database} → cloud ok (${ping.ok})`);

  if (pingOnly) {
    const { cursors } = await post({ op: "cursors" });
    log("cloud cursors:", cursors);
    await pool.end();
    return;
  }

  // Seed append cursors from the cloud on first run so we don't re-send existing history.
  if (Object.keys(state.cursors).length === 0) {
    try {
      const { cursors } = await post({ op: "cursors" });
      state.cursors = { ...cursors };
      saveState();
      log("seeded cursors from cloud:", state.cursors);
    } catch (e) {
      log(`! could not seed cursors (starting from 0): ${e.message}`);
    }
  }

  // First pass immediately, then on timers.
  await runFullCycle();
  await runAppendCycle();

  const fullEveryMs = (cfg.fullSyncMinutes ?? 10) * 60_000;
  setInterval(() => {
    runAppendCycle().catch((e) => log("append cycle error:", e.message));
  }, (cfg.pollSeconds ?? 5) * 1000);
  setInterval(() => {
    runFullCycle().catch((e) => log("full cycle error:", e.message));
  }, fullEveryMs);

  log(`running — append every ${cfg.pollSeconds ?? 5}s, full every ${cfg.fullSyncMinutes ?? 10}m. Ctrl+C to stop.`);
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

main().catch((e) => {
  log("fatal:", e.message);
  process.exit(1);
});
