// Checks the website database after each sync pass (.github/workflows/sync-e2e.yml).
//   node verify.mjs first | unchanged | changed
// Expected numbers come from tests/e2e/sync/fixture.mjs.
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const db = new PrismaClient();
const stage = process.argv[2];
const now = new Date();
let failed = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
};
const eq = (name, actual, expected) => check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);

const importedMembers = () => db.user.count({ where: { importedAt: { not: null } } });
const importedPeriods = () => db.subscription.count({ where: { importKey: { not: null } } });
const activeImported = async () =>
  (
    await db.subscription.findMany({
      where: { importKey: { not: null }, status: "active", startsAt: { lte: now }, endsAt: { gt: now } },
      select: { userId: true },
      distinct: ["userId"],
    })
  ).length;
const memberUpdates = () => db.auditLog.count({ where: { action: "sync.members" } });
const member = (n) => db.user.findUnique({ where: { memberNumber: n }, include: { subscriptions: { orderBy: { createdAt: "desc" } } } });

if (stage === "first") {
  eq("members from the program (1 without a number is skipped)", await importedMembers(), 1207);
  eq("memberships copied (latest + last year, archive duplicates once)", await importedPeriods(), 1519);
  eq("members active right now", await activeImported(), 604);
  eq("frozen memberships paused", await db.subscription.count({ where: { importKey: { not: null }, status: "paused" } }), 301);
  eq("one member update in the audit log", await memberUpdates(), 1);

  const amr = await member(3664);
  eq("03664 name (Arabic)", amr?.name, "عمرو بسام راشد");
  eq("03664 phone", amr?.phoneDigits, "0795757237");
  eq("03664 has no password yet (first password = number)", amr?.passwordHash, null);
  eq("03664 is a member", amr?.role, "MEMBER");
  eq("03664 membership", amr?.subscriptions[0]?.status, "active");

  eq("02119 frozen → paused", (await member(2119))?.subscriptions[0]?.status, "paused");
  const longHistory = await member(777);
  eq("00777: current + 13 months of the last year", longHistory?.subscriptions.length, 14);
  const latest = longHistory?.subscriptions[0];
  check("00777: newest row is the current membership", Boolean(latest && latest.startsAt <= now && latest.endsAt && latest.endsAt > now));

  const three = await member(3);
  eq("00003 belongs to the imported member", three?.name, "Clashes With Demo");
  check("the demo account that had 00003 moved to 50000+", (await db.user.count({ where: { isDemo: true, memberNumber: { gte: 50000 } } })) >= 1);

  const phones = [(await member(4529))?.phoneDigits, (await member(42))?.phoneDigits];
  check("a shared phone belongs to one account only", phones.filter((p) => p === "0797079236").length === 1 && phones.includes(null), JSON.stringify(phones));

  const plan = await db.plan.findUnique({ where: { slug: "gym-program" } });
  check("memberships use the gym-program plan, not sold online", Boolean(plan) && plan.active === false);
} else if (stage === "unchanged") {
  eq("nothing new: still one member update", await memberUpdates(), 1);
  eq("nothing new: same memberships", await importedPeriods(), 1519);
} else if (stage === "changed") {
  eq("new member from the desk", await importedMembers(), 1208);
  eq("renewal + new member's membership", await importedPeriods(), 1521);
  eq("02119 unfrozen → active again", (await member(2119))?.subscriptions[0]?.status, "active");
  eq("04529 renewal added", (await member(4529))?.subscriptions.length, 2);
  eq("04867 has a membership", (await member(4867))?.subscriptions[0]?.status, "active");
  eq("members active right now", await activeImported(), 606);
  eq("second member update in the audit log", await memberUpdates(), 2);
} else {
  console.error("usage: node verify.mjs first | unchanged | changed");
  failed++;
}

await db.$disconnect();
process.exit(failed ? 1 : 0);
