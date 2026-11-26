// Browser checks after the sync (.github/workflows/sync-e2e.yml): first sign-in with the
// membership number, choosing a password, admin rights, the dashboard numbers, the sync card,
// and a website sign-up getting a number from 50000. Screenshots go to sync-shots/.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const db = new PrismaClient();
const base = "http://localhost:3000";
const out = "sync-shots";
mkdirSync(out, { recursive: true });
let failed = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
};
const eq = (name, actual, expected) => check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);

/** The SQL an owner runs in Neon: admin only once the member has chosen a password. */
const promote = () => db.$executeRaw`UPDATE "User" SET role = 'ADMIN' WHERE "memberNumber" = 3664 AND "passwordHash" IS NOT NULL`;
/** Members with a valid membership now (manual memberships, as everything in this database). */
const expectedActive = async () => {
  const rows = await db.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS n FROM "Subscription"
    WHERE "startsAt" <= now() AND "endsAt" + make_interval(days => "bonusDays") > now()
      AND status IN ('active', 'on_trial', 'cancelled') AND NOT "testMode"`;
  return Number(rows[0].n);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.setDefaultTimeout(30_000);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

async function signIn(number, password) {
  await page.goto(`${base}/en/signin`);
  const form = page.locator("form", { has: page.locator('input[name="memberNumber"]') });
  await form.locator('input[name="memberNumber"]').fill(number);
  await form.locator('input[name="password"]').fill(password);
  await form.locator('button[type="submit"]').click();
}
async function signOut() {
  await page.goto(`${base}/en/account`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/?$/);
}

const NEW_PASSWORD = "Gym-pass-2026!";
try {
  eq("can't be made admin before choosing a password", await promote(), 0);

  await page.goto(`${base}/en/signin`);
  await page.getByText("First time here? Your password is your membership number.").waitFor();
  check("sign-in page explains the first password", true);

  await signIn("03664", "03664");
  await page.waitForURL(/\/en\/account/);
  await page.getByText("Choose your own password").waitFor();
  check("first sign-in with the membership number asks for a new password", true);
  eq("number shown without GG-", (await page.getByTestId("member-number").textContent())?.trim(), "03664");
  await shot("1-first-sign-in");

  const change = page.locator("form", { has: page.locator('input[name="current"]') });
  await change.locator('input[name="current"]').fill("03664");
  await change.locator('input[name="password"]').fill(NEW_PASSWORD);
  await change.locator('input[name="confirm"]').fill(NEW_PASSWORD);
  await change.locator('button[type="submit"]').click();
  await page.getByText("Choose your own password").waitFor({ state: "detached" });
  // Back on the account page (not the sign-in page), past the password step.
  await page.waitForURL(/\/en\/account/);
  await page.getByTestId("member-number").waitFor();
  const saved = await db.user.findUnique({ where: { memberNumber: 3664 } });
  check("password saved and no longer temporary", Boolean(saved?.passwordHash) && saved?.mustChangePassword === false);
  check("still signed in after choosing it", (await page.getByText("Choose your own password").count()) === 0, page.url());
  await shot("2-password-chosen");

  await signOut();
  await signIn("03664", "03664");
  await page.getByText("That membership number and password don't match.").waitFor();
  check("the membership number no longer works as the password", true);
  await signIn("03664", NEW_PASSWORD);
  await page.waitForURL(/\/en\/account/);
  check("the new password works", (await page.getByText("Choose your own password").count()) === 0);

  eq("made admin once the password is chosen", await promote(), 1);
  await page.goto(`${base}/en/admin`);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  const kpi = (await page.locator('a[href$="/admin/subscriptions?status=activeOnly"] p').last().textContent())?.trim();
  eq("dashboard active members (more than 1000 memberships)", Number(kpi), await expectedActive());
  await shot("3-dashboard");

  await page.goto(`${base}/en/admin/members`);
  await page.getByRole("heading", { name: "Admins & staff" }).waitFor();
  check("admin sees the team form and can change roles", (await page.locator('select[name="role"]').count()) > 0);

  await page.goto(`${base}/en/admin/import`);
  await page.getByText("Sync with the gym program").waitFor();
  const card = Number((await page.getByTestId("sync-active-now").textContent())?.trim());
  const imported = (
    await db.subscription.findMany({
      where: { importKey: { not: null }, status: "active", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      select: { userId: true },
      distinct: ["userId"],
    })
  ).length;
  eq("sync card: active right now", card, imported);
  await page.getByRole("button", { name: "Update members now" }).click();
  await page.getByText(/^Done:/).waitFor();
  check("Update members now works", true);
  await shot("4-import-sync");

  await signOut();
  await page.goto(`${base}/en/signin?mode=register`);
  const reg = page.locator("form", { has: page.locator('input[name="confirm"]') });
  await reg.locator('input[name="name"]').fill("Online Signup");
  await reg.locator('input[name="phone"]').fill("0791234599");
  await reg.locator('input[name="password"]').fill(NEW_PASSWORD);
  await reg.locator('input[name="confirm"]').fill(NEW_PASSWORD);
  await reg.locator('button[type="submit"]').click();
  await page.waitForURL(/\/en\/account/);
  const number = Number((await page.getByTestId("member-number").textContent())?.trim());
  check("a website sign-up gets a number from 50000", number >= 50000, `got ${number}`);
  await shot("5-sign-up");
} catch (e) {
  failed++;
  console.error("✖", e instanceof Error ? e.message : e);
  await shot("error").catch(() => {});
}

await browser.close();
await db.$disconnect();
process.exit(failed ? 1 : 0);
