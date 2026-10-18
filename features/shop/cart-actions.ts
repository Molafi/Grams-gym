"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/guards";
import { priceLines, type PricedLine } from "./catalog";

const itemsSchema = z
  .array(z.object({ variantId: z.string().min(1).max(64), qty: z.number().int().min(0).max(20) }))
  .max(50);

/** Public: re-price a cart from the DB (never trusts client prices). */
export async function getCartLines(raw: unknown): Promise<PricedLine[]> {
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return priceLines(parsed.data);
}

/** On sign-in: merge the guest (localStorage) cart into the DB cart; returns the merged cart. */
export async function mergeCart(raw: unknown): Promise<{ variantId: string; qty: number }[]> {
  const user = await getSessionUser();
  const parsed = itemsSchema.safeParse(raw);
  const local = parsed.success ? parsed.data : [];
  if (!user) return local;

  const dbCart = await db.cart.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    include: { items: true },
  });
  const merged = new Map<string, number>();
  for (const i of dbCart.items) merged.set(i.variantId, i.quantity);
  for (const i of local) merged.set(i.variantId, Math.max(merged.get(i.variantId) ?? 0, i.qty));

  const priced = await priceLines([...merged].map(([variantId, qty]) => ({ variantId, qty })));
  const final = priced.filter((l) => l.qty > 0).map((l) => ({ variantId: l.variantId, qty: l.qty }));
  await writeCart(dbCart.id, final);
  return final;
}

/** Keep the DB cart in sync with the client cart (signed-in users only). */
export async function syncCart(raw: unknown): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) return;
  const dbCart = await db.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  const existing = new Set(
    (await db.productVariant.findMany({ where: { id: { in: parsed.data.map((i) => i.variantId) } }, select: { id: true } })).map((v) => v.id),
  );
  await writeCart(
    dbCart.id,
    parsed.data.filter((i) => i.qty > 0 && existing.has(i.variantId)),
  );
}

async function writeCart(cartId: string, items: { variantId: string; qty: number }[]) {
  await db.$transaction([
    db.cartItem.deleteMany({ where: { cartId } }),
    db.cartItem.createMany({ data: items.map((i) => ({ cartId, variantId: i.variantId, quantity: i.qty })) }),
  ]);
}
