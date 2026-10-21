# Legacy desktop-DB → cloud sync

Mirrors the **GramsGym Windows program's** database (`gymgdata`, a MySQL/MariaDB served
by XAMPP on the gym PC) into the Grams-gym cloud Postgres, in **near-real-time**.

```
Gym PC                                           Cloud (this Next.js app)
┌──────────────────┐                             ┌───────────────────────────┐
│ GramsGym.exe      │                             │ POST /api/sync/legacy      │
│   ▼ writes        │     reads (read-only)       │   • verifies HMAC signature│
│ MySQL  gymgdata   │ ◄────────── sync agent ───► │   • upserts into legacy_*  │
│ (XAMPP, port 3306)│      HTTPS + signature      │     Postgres tables        │
└──────────────────┘      every few seconds       └───────────────────────────┘
```

* The agent **only reads** the gym database (via a dedicated read-only `ggsync` login).
  It never writes to it, so the desktop program is unaffected.
* **Append tables** (check-ins, payments, …) are polled by primary key every few seconds —
  this is the live path. **Full tables** (members, subscriptions, programs, …) are small
  and re-sent every few minutes to pick up in-place edits (renewals, phone changes…).
* Cursors are stored locally, so the agent resumes after a reboot or internet outage and
  **loses nothing** — a cursor only advances after the cloud confirms the batch.

## What gets synced

Stored verbatim in Postgres tables named `legacy_<table>` (e.g. `legacy_members`).
BLOB columns (member/staff photos, fingerprint templates, free-text notes/addresses) and
the `users` (app-login password hashes) and biometric `prints`/`sprints` tables are **not**
mirrored — large and/or sensitive. Edit `sync/agent/config.json` + `lib/sync/legacy-schema.ts`
to add more.

| Mode | Tables |
|------|--------|
| **append** (live, by `ID`) | `clocks` (check-ins), `attendance`, `payments`, `subscriptionsx` (archive), `messages_log`, `lists` |
| **full** (small, re-upserted) | `members`, `programs`, `offers`, `subscriptions`, `freezes`, `staff`, `guests`, `dayuse`, lookups (`nationalities`, `jobtitles`, `contracts`, `shifts`), `campaigns`, `events`, `expenses*`, `transactions`, `accounts`, `variables` |

### Notes on this gym's data (decoded 2026-10)

* `members.Gender` is always `1` (male-only gym); `Status` is always `1` (active).
* `subscriptions` is the **live** table (updated daily); `subscriptionsx` is an older
  archive frozen in Feb 2026 — both are mirrored so nothing is lost.
* `clocks.Type`: `1` = member check-in, `2` = staff. `payments.Method`: `1`/`2`/`3` ≈ cash/card/other.
* Money is JOD, stored as `decimal(10,5)` → mirrored as `numeric(14,5)`.
* Dates/times are local (Asia/Amman) wall-clock and are stored unchanged (no TZ shifting).

## Setup

### 1. Cloud side (this app)

1. Set a strong secret in the deployment environment:
   ```
   SYNC_SECRET=<openssl rand -base64 33>
   ```
   The endpoint returns **503** until this is set (min 16 chars). The `legacy_*` tables are
   created automatically on first sync — no migration needed.
2. Deploy. The endpoint lives at `https://<your-site>/api/sync/legacy`.

### 2. The read-only database login (already created on the gym PC)

A read-only MySQL user was added for the agent (SELECT on `gymgdata` only):

```sql
CREATE USER IF NOT EXISTS 'ggsync'@'localhost'  IDENTIFIED BY 'GgSync_ReadOnly_2026';
CREATE USER IF NOT EXISTS 'ggsync'@'127.0.0.1'  IDENTIFIED BY 'GgSync_ReadOnly_2026';
GRANT SELECT ON gymgdata.* TO 'ggsync'@'localhost';
GRANT SELECT ON gymgdata.* TO 'ggsync'@'127.0.0.1';
FLUSH PRIVILEGES;
```

> Change this password in production and update `config.json` to match.

### 3. The agent (on the gym PC)

1. Install **Node.js 20+** (https://nodejs.org).
2. Copy this `sync/agent` folder to the PC (e.g. `C:\gg-sync`).
3. `cd C:\gg-sync` then `npm install`.
4. Copy `config.example.json` → `config.json` and fill in:
   * `cloud.url` — your deployed endpoint URL.
   * `cloud.secret` — the **same** value as `SYNC_SECRET`.
   * `mysql.password` — the `ggsync` password if you changed it.
5. Test connectivity (reads nothing, just checks DB + cloud + shows cloud cursors):
   ```
   node agent.mjs --ping
   ```
6. Run it:
   ```
   node agent.mjs
   ```
   The first run backfills all history (a few minutes), then streams changes.

### 4. Run it automatically (Windows service)

So it starts with the PC and restarts on crash, use **NSSM** (https://nssm.cc):

```
nssm install GramsGymSync "C:\Program Files\nodejs\node.exe" "C:\gg-sync\agent.mjs"
nssm set GramsGymSync AppDirectory "C:\gg-sync"
nssm set GramsGymSync AppStdout "C:\gg-sync\agent.log"
nssm set GramsGymSync AppStderr "C:\gg-sync\agent.log"
nssm start GramsGymSync
```

## Verify it's working

From anywhere, a signed `status` request returns row counts + last-synced time per table.
Easiest check: on the PC run `node agent.mjs --ping` (shows the cloud's current cursors),
then watch `agent.log` — new check-ins should appear within seconds of a member clocking in.

## Security

* Every request is signed `HMAC-SHA256(timestamp + "." + body)` with `SYNC_SECRET`; the
  server rejects bad signatures and timestamps older than 5 minutes (replay protection).
* The agent's DB login is **read-only** and scoped to `gymgdata`.
* Serve the endpoint over **HTTPS** only.

## Limitations

* One-way (gym PC → cloud). Changes made in the cloud do **not** flow back to the desktop
  program (that would mean writing into the vendor's database — intentionally avoided).
* The PC must be on and online for live updates; while it's off, changes queue up and
  catch up automatically when it returns.
* In-place edits to `members`/`subscriptions` appear at the **full-sync** cadence
  (default 10 min), not instantly. New check-ins/payments are near-instant.
