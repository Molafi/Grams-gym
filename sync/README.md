# Sync: old gym program → website

Keeps the website's members and memberships up to date from the **GramsGym Windows program**
(its MySQL/MariaDB database `gymgdata`, served by XAMPP on the gym PC).

```
Gym PC                                           Website (Vercel)
┌──────────────────┐   ┌──────────────┐  HTTPS   ┌────────────────────────────────────┐
│ GramsGym program │──►│ sync agent   │────────► │ /api/sync/legacy                   │
│ MySQL  gymgdata  │   │ (this folder)│ when     │  → copies of the program's tables   │
└──────────────────┘   └──────────────┘ changed  │  → website members + memberships    │
                       every 5 minutes           └────────────────────────────────────┘
```

* The agent **only reads** the gym database, with a read-only MySQL login. The desktop program
  is unaffected.
* Every 5 minutes it reads the member tables and sends them **only if something changed**.
  The website then creates new members, updates names and phones, adds new memberships and
  follows freezes. Admin → Import shows what arrived and when.
* While the old program is in use, **make changes to members and memberships there**. The
  website follows the program, not the other way round.

## What the website does with it

* Every member keeps their number from the program (`04529`). It's their username; the first
  time, their password is the same number, and the website then asks them to choose their own.
* Memberships become front-desk memberships with the program's start and end dates: each
  member's latest one, plus any that ended within the last year.
* Accounts created on the website itself (online sign-up, staff) get numbers from **50000**,
  so they never take a number the program will give its next member.
* Not copied back: nothing flows from the website to the program.

By default only the tables the website needs are sent: `members`, `programs`, `offers`,
`subscriptions`, `subscriptionsx` (the old archive), `freezes`. The agent can also mirror other
tables (check-ins, payments, staff, expenses…) as a cloud copy: add their names to `config.json`
(`"append": ["clocks", "payments"]`, `"full": [...]`). That stores more personal and business data
in the cloud (staff salaries, national ID numbers) and uses more database time, so only do it if
you need it.

## Setup (Windows, on the gym PC)

PowerShell commands, one at a time. Run PowerShell as Administrator.

### 1. Website: the shared secret
1. Make a secret (keep the window open; you'll paste it twice):
   ```powershell
   $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```
2. Vercel → your project → Settings → Environment Variables → add `SYNC_SECRET` with that value
   (Production), then Deployments → ⋯ → Redeploy. Until then the website answers 503.

### 2. Node.js
```powershell
node -v
```
It must print v20 or higher. If not, install the LTS version from https://nodejs.org and open a new
PowerShell window.

### 3. The agent folder
Copy this `sync/agent` folder to `C:\gg-sync`, then:
```powershell
cd C:\gg-sync
npm install
Copy-Item config.example.json config.json
notepad config.json
```
In `config.json` set:
* `cloud.url` → `https://YOUR-SITE/api/sync/legacy`
* `cloud.secret` → the secret from step 1
* `mysql.password` → the password of the read-only login (step 4)

### 4. The read-only database login
If it doesn't exist yet, create it with your own password (XAMPP's MySQL client):
```powershell
C:\xampp\mysql\bin\mysql.exe -u root -p
```
```sql
CREATE USER IF NOT EXISTS 'ggsync'@'localhost' IDENTIFIED BY 'choose-a-long-password';
CREATE USER IF NOT EXISTS 'ggsync'@'127.0.0.1' IDENTIFIED BY 'choose-a-long-password';
GRANT SELECT ON gymgdata.* TO 'ggsync'@'localhost';
GRANT SELECT ON gymgdata.* TO 'ggsync'@'127.0.0.1';
FLUSH PRIVILEGES;
```
If it already exists with the password that used to be printed in this file, change it:
`ALTER USER 'ggsync'@'localhost' IDENTIFIED BY '…'; ALTER USER 'ggsync'@'127.0.0.1' IDENTIFIED BY '…';`

### 5. Test, then the first sync
```powershell
node agent.mjs --ping
node agent.mjs --once
```
`--ping` must end with `website ok (true)`. The first `--once` sends everything (a minute or two)
and ends with `website members updated: … new`. Check Admin → Import on the website: "Active right
now" should be close to the program's **active** count, and names must look right. If Arabic names
show as `Ø§Ù…...`, add `"charset": "cp1256"` to the `mysql` section and run `node agent.mjs --once --force`.

### 6. Every 5 minutes, automatically
```powershell
schtasks /Create /TN "GramsGymSync" /TR "C:\gg-sync\run-once.cmd" /SC MINUTE /MO 5 /RU SYSTEM /F
```
It runs in the background, also when nobody is signed in. Each run adds a few lines to
`C:\gg-sync\agent.log`. Stop it with `schtasks /Delete /TN "GramsGymSync" /F`.

Instead of the scheduled task, `node agent.mjs` also keeps running in an open window.

## Security

* Every request is signed `HMAC-SHA256(timestamp + "." + body)` with `SYNC_SECRET`; the website
  rejects bad signatures and timestamps older than 5 minutes (replay protection).
* `config.json` holds the secret and the database password: it's ignored by git; keep it on the
  gym PC only.
* The database login is read-only and only for `gymgdata`.

## Limitations

* One way only: the program → the website.
* A membership deleted in the program stays on the website (staff can cancel it there).
* The PC must be on and online; while it's off, changes wait and go out on the next run.
