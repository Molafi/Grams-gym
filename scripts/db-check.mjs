// npm run db:check — explains, step by step, why the site can or can't reach its database.
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m, fix) => {
  console.log(`  ✖ ${m}`);
  if (fix) console.log(`    → ${fix}`);
  process.exit(1);
};

console.log("\nGRAMS GYM — database check\n");

// 1. .env and DATABASE_URL
if (!existsSync(".env")) bad("No .env file in this folder.", `Run this in the project folder, or create it: copy .env.example .env`);
const line = readFileSync(".env", "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
if (!line) bad("DATABASE_URL is missing from .env.", "Add the DATABASE_URL line printed by `npm run db:local`.");
const url = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
let host, port;
try {
  const u = new URL(url);
  host = u.hostname;
  port = Number(u.port || 5432);
} catch {
  bad("DATABASE_URL in .env isn't a valid address.", "Copy it again from the `npm run db:local` window.");
}
ok(`.env points to ${host}:${port}`);
if (port === 5432) console.log("    (5432 is the Docker database. For `npm run db:local` it's usually 51214.)");

// 2. Is anything listening there?
await new Promise((resolve) => {
  const s = connect({ host, port, timeout: 3000 }, () => {
    s.end();
    resolve();
  });
  const fail = () =>
    bad(
      `Nothing is listening on ${host}:${port}.`,
      port === 5432
        ? "Start Docker Desktop and run `npm run db:up` — or use `npm run db:local` and put the address it prints into .env."
        : "Start the database in another window and keep it open: npm run db:local",
    );
  s.on("error", fail);
  s.on("timeout", fail);
});
ok("The database server is running");

// 3. Can Prisma log in and are the tables there?
// Same rule as lib/db-url.ts: the local `prisma dev` server needs unnamed statements and one connection.
let runtime = url;
if (/@(localhost|127\.0\.0\.1):512\d\d\//.test(url)) {
  const u = new URL(url);
  if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
  u.searchParams.set("connection_limit", "1");
  runtime = u.toString();
}
const db = new PrismaClient({ datasourceUrl: runtime });
try {
  await db.$queryRaw`SELECT 1`;
  ok("Connected");
  const [{ exists }] = await db.$queryRaw`SELECT to_regclass('public."Plan"') IS NOT NULL AS exists`;
  if (!exists) bad("The tables don't exist yet.", "npm run db:setup");
  ok("Tables exist");
  const [plans, products, users] = await Promise.all([db.plan.count(), db.product.count(), db.user.count()]);
  if (plans === 0) bad("No membership plans yet.", "npm run db:seed");
  ok(`${plans} plans, ${products} products, ${users} users`);
  console.log("\n  All good. If the site still says the database isn't running, stop `npm run dev` (Ctrl+C) and start it again.\n");
} catch (e) {
  bad(`Couldn't use the database: ${e instanceof Error ? e.message.split("\n").filter(Boolean).pop() : e}`, "Check the address in .env, then run npm run db:setup");
} finally {
  await db.$disconnect();
}
