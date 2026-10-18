import { getSessionUser } from "@/lib/auth/guards";
import { describe, getCurrentSubscription } from "@/features/billing/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by the "confirming your payment…" state until the webhook has landed. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ active: false }, { status: 401 });
  const sub = await getCurrentSubscription(user.id);
  if (!sub) return Response.json({ active: false });
  const { active } = describe(sub);
  return Response.json(
    { active, status: sub.status, plan: sub.plan.slug },
    { headers: { "Cache-Control": "no-store" } },
  );
}
