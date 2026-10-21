import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { assertRole, AuthError } from "@/lib/auth/guards";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { formatMemberNumber } from "@/lib/member-number";
import { parseLegacyTable, startOfAmmanDay, ymdIso } from "@/lib/legacy-import";
import { importLegacyRows } from "@/features/admin/legacy-import";

export const dynamic = "force-dynamic";
// Large lists on a cloud host (Vercel allows up to 60 s on the free plan).
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().max(4_000_000),
  mode: z.enum(["preview", "import"]),
  plan: z.string().max(80).optional(),
});

const digest = (s: string) => createHash("sha256").update(s).digest();
const sameToken = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** Same-origin check for browser requests (server actions get this built in; route handlers don't). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

/**
 * POST { text, mode: "preview" | "import", plan? }
 * Auth: a signed-in admin (the /admin/import page) or `Authorization: Bearer IMPORT_API_TOKEN`
 * (a script, e.g. a scheduled export from the gym PC).
 */
export async function POST(req: Request) {
  let actorId: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    if (!env.IMPORT_API_TOKEN || !sameToken(auth.slice(7).trim(), env.IMPORT_API_TOKEN)) {
      try {
        await enforceRateLimit("import-token-fail", 10, 60_000);
      } catch (e) {
        if (e instanceof RateLimitError) return fail("rate", 429);
        throw e;
      }
      return fail("unauthorized", 401);
    }
  } else {
    if (!sameOrigin(req)) return fail("forbidden", 403);
    try {
      actorId = (await assertRole("ADMIN")).id;
    } catch (e) {
      if (e instanceof AuthError) return fail(e.code === "READ_ONLY" ? "readOnly" : "forbidden", e.code === "UNAUTHENTICATED" ? 401 : 403);
      throw e;
    }
  }

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(body.error.issues.some((i) => i.code === "too_big") ? "tooBig" : "generic", 400);
  const parsed = parseLegacyTable(body.data.text);
  if (!parsed.ok) return fail(parsed.error, 400);

  if (body.data.mode === "preview") {
    const now = Date.now();
    const periods = new Set(parsed.rows.filter((r) => r.from && r.to).map((r) => `${r.memberNumber}:${ymdIso(r.from!)}:${ymdIso(r.to!)}`));
    const active = new Set(
      parsed.rows
        .filter((r) => r.from && r.to && !r.frozen && startOfAmmanDay(r.from).getTime() <= now && startOfAmmanDay(r.to, 1).getTime() > now)
        .map((r) => r.memberNumber),
    );
    return Response.json({
      ok: true,
      columns: parsed.columns,
      dateOrder: parsed.dateOrder,
      rows: parsed.rows.length,
      members: new Set(parsed.rows.map((r) => r.memberNumber)).size,
      periods: periods.size,
      active: active.size,
      sample: parsed.rows.slice(0, 12).map((r) => ({
        line: r.line,
        number: formatMemberNumber(r.memberNumber),
        name: r.name,
        phone: r.phone,
        gender: r.gender,
        program: r.program,
        from: r.from ? ymdIso(r.from) : null,
        to: r.to ? ymdIso(r.to) : null,
        frozen: r.frozen,
      })),
      skipped: parsed.skipped.slice(0, 50),
      skippedCount: parsed.skipped.length,
      warnings: parsed.warnings.slice(0, 50),
      warningsCount: parsed.warnings.length,
    });
  }

  const plan =
    (body.data.plan ? await db.plan.findFirst({ where: { slug: body.data.plan, kind: "membership" }, select: { id: true } }) : null) ??
    (await db.plan.findFirst({ where: { kind: "membership" }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }], select: { id: true } }));
  if (!plan) return fail("noPlan", 400);

  const summary = await importLegacyRows(parsed.rows, { planId: plan.id, actorId });
  return Response.json({ ok: true, summary });
}
