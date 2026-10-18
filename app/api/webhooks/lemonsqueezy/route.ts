import { lemonSqueezyProvider } from "@/lib/payments/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return lemonSqueezyProvider.handleWebhook(req);
}
