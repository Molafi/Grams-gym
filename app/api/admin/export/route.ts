import { db } from "@/lib/db";
import { assertRole, AuthError } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { toMajorString } from "@/lib/money";
import { SUBSCRIPTION_STATUSES } from "@/lib/membership";
import { listSubscriptions } from "@/features/admin/queries";
import { formatMemberNumber } from "@/lib/member-number";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV cell: quote + escape; neutralise spreadsheet formula injection. */
function cell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const toCsv = (rows: unknown[][]) => "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");

export async function GET(req: Request) {
  let actor: Awaited<ReturnType<typeof assertRole>>;
  try {
    actor = await assertRole("STAFF");
  } catch (e) {
    if (e instanceof AuthError) return new Response("Forbidden", { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
    throw e;
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  let rows: unknown[][];

  if (type === "subscriptions") {
    const statusRaw = url.searchParams.get("status") ?? undefined;
    const status = statusRaw === "activeOnly" ? "activeOnly" : SUBSCRIPTION_STATUSES.find((s) => s === statusRaw);
    const within = Number(url.searchParams.get("within")) || undefined;
    const subs = await listSubscriptions({ q: url.searchParams.get("q") ?? undefined, status, withinDays: within });
    rows = [
      ["member_number", "member", "email", "phone", "plan", "interval", "provider", "status", "active", "starts_at", "ends_or_renews_at", "days_left", "countdown_kind"],
      ...subs.map((s) => [formatMemberNumber(s.user.memberNumber), s.user.name, s.user.email, s.user.phone, s.plan.slug, s.interval, s.provider, s.status, s.active, s.startsAt, s.endsAt ?? s.renewsAt, s.remaining.days, s.remaining.kind]),
    ];
  } else if (type === "members") {
    const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });
    rows = [["member_number", "name", "email", "phone", "role", "locale", "created_at", "deletion_requested_at"], ...users.map((u) => [formatMemberNumber(u.memberNumber), u.name, u.email, u.phone, u.role, u.locale, u.createdAt, u.deletionRequestedAt])];
  } else if (type === "orders") {
    const orders = await db.order.findMany({ orderBy: { createdAt: "desc" }, include: { items: true } });
    rows = [
      ["number", "created_at", "status", "fulfillment", "payment_mode", "customer", "phone", "address", "items", "total", "currency"],
      ...orders.map((o) => [o.number, o.createdAt, o.status, o.fulfillment, o.paymentMode, o.customerName, o.phone, o.address, o.items.map((i) => `${i.sku}x${i.quantity}`).join(" "), toMajorString(o.totalMinor, o.currency), o.currency]),
    ];
  } else {
    return new Response("Unknown export type", { status: 400 });
  }

  await audit(actor.id, "export.csv", type, null, { rows: rows.length - 1 });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grams-${type}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
