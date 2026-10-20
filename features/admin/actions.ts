"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { addMonths } from "@/lib/membership";
import { isMembershipActive, remainingFor } from "@/features/billing/membership";
import { toMinor } from "@/lib/money";
import { INTERVAL_MONTHS } from "@/config/plans";
import { processStoredEvent } from "@/lib/payments/lemonsqueezy-events";
import { closeOrder, isClosed } from "@/lib/orders";
import { hashPassword, temporaryPassword } from "@/lib/auth/password";
import { formatMemberNumber, parseMemberNumber } from "@/lib/member-number";
import { phoneDigits } from "@/lib/phone";

export type AdminState = {
  ok?: boolean;
  error?: string;
  /** Shown once to staff after creating a member or resetting a password. */
  memberNumber?: string;
  tempPassword?: string;
  name?: string | null;
};

const locale = (fd: FormData) => (fd.get("locale") === "en" ? "en" : "ar");
const revalidateAdmin = (fd: FormData) => revalidatePath(`/${locale(fd)}/admin`, "layout");

/* ─── Memberships ────────────────────────────────────────────────────────── */

const grantSchema = z.object({
  /** Existing member: their membership number. Otherwise a new member is created. */
  memberNumber: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/).optional(),
  plan: z.string().min(1),
  interval: z.enum(["monthly", "quarterly", "yearly"]),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00`) : undefined))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), "invalid date"),
});

/**
 * Pay-at-desk memberships: create a new manual membership, or — if the member
 * already has an active manual one — extend it from its current end date.
 */
export async function grantMembership(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await assertRole("STAFF");
  const parsed = grantSchema.safeParse({
    memberNumber: fd.get("memberNumber") || undefined,
    email: fd.get("email") || undefined,
    name: fd.get("name") || undefined,
    phone: fd.get("phone") || undefined,
    plan: fd.get("plan"),
    interval: fd.get("interval"),
    start: fd.get("start") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;
  const plan = await db.plan.findFirst({ where: { slug: input.plan, kind: "membership" } });
  if (!plan) return { error: "plan" };

  // Existing member (by number), or a new member who gets a number + temporary password.
  let user: { id: string; memberNumber: number; name: string | null };
  let tempPassword: string | undefined;
  if (input.memberNumber) {
    const n = parseMemberNumber(input.memberNumber);
    const found = n ? await db.user.findUnique({ where: { memberNumber: n }, select: { id: true, memberNumber: true, name: true } }) : null;
    if (!found) return { error: "notFound" };
    user = found;
  } else {
    if (!input.name || !input.phone) return { error: "newMember" };
    const samePhone = await db.user.findUnique({ where: { phoneDigits: phoneDigits(input.phone) }, select: { memberNumber: true } });
    if (samePhone) return { error: "phoneExists", memberNumber: formatMemberNumber(samePhone.memberNumber) };
    tempPassword = temporaryPassword();
    try {
      user = await db.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          phoneDigits: phoneDigits(input.phone),
          email: input.email ?? null,
          passwordHash: await hashPassword(tempPassword),
          mustChangePassword: true,
        },
        select: { id: true, memberNumber: true, name: true },
      });
    } catch {
      return { error: "emailExists" };
    }
    await audit(actor.id, "user.create", "User", user.id, { memberNumber: user.memberNumber });
  }

  const now = new Date();
  const existing = (await db.subscription.findMany({ where: { userId: user.id, provider: "manual" }, orderBy: { endsAt: "desc" } })).find((s) =>
    // Active now, or granted earlier with a start date still in the future.
    isMembershipActive(s, now) || remainingFor(s, now).kind === "starts",
  );
  const months = INTERVAL_MONTHS[input.interval];

  if (existing && existing.endsAt) {
    const endsAt = addMonths(existing.endsAt, months);
    await db.subscription.update({ where: { id: existing.id }, data: { endsAt, planId: plan.id, interval: input.interval, status: "active", cancelled: false } });
    await audit(actor.id, "membership.extend", "Subscription", existing.id, { months, endsAt: endsAt.toISOString() });
  } else {
    const startsAt = input.start ?? now;
    const sub = await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        interval: input.interval,
        provider: "manual",
        status: "active",
        startsAt,
        endsAt: addMonths(startsAt, months),
      },
    });
    await audit(actor.id, "membership.grant", "Subscription", sub.id, { plan: plan.slug, interval: input.interval });
  }
  revalidateAdmin(fd);
  return { ok: true, memberNumber: formatMemberNumber(user.memberNumber), tempPassword, name: user.name };
}

/**
 * Front desk: give a member a new temporary password (they must change it on next sign-in).
 * Staff can reset members; only admins can reset staff/admin accounts.
 */
export async function resetMemberPassword(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await assertRole("STAFF");
  const id = String(fd.get("id"));
  const target = await db.user.findUnique({ where: { id }, select: { role: true, isTestAccount: true, memberNumber: true, name: true } });
  if (!target || target.isTestAccount) return { error: "notFound" };
  if (target.role !== "MEMBER" && actor.role !== "ADMIN") return { error: "forbidden" };
  const tempPassword = temporaryPassword();
  // sessionVersion bump signs the member out everywhere (e.g. "someone else knows my password").
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, sessionVersion: { increment: 1 } } });
  await audit(actor.id, "user.password_reset", "User", id);
  return { ok: true, tempPassword, memberNumber: formatMemberNumber(target.memberNumber), name: target.name };
}

export async function extendMembership(fd: FormData): Promise<void> {
  const actor = await assertRole("STAFF");
  const id = String(fd.get("id"));
  const months = z.coerce.number().int().min(1).max(24).parse(fd.get("months"));
  const sub = await db.subscription.findUniqueOrThrow({ where: { id } });
  if (sub.provider !== "manual") throw new Error("Only manual memberships can be extended here");
  const base = sub.endsAt && sub.endsAt > new Date() ? sub.endsAt : new Date();
  const endsAt = addMonths(base, months);
  await db.subscription.update({ where: { id }, data: { endsAt, status: "active", cancelled: false } });
  await audit(actor.id, "membership.extend", "Subscription", id, { months, endsAt: endsAt.toISOString() });
  revalidateAdmin(fd);
}

export async function cancelManualMembership(fd: FormData): Promise<void> {
  const actor = await assertRole("ADMIN");
  const id = String(fd.get("id"));
  const sub = await db.subscription.findUniqueOrThrow({ where: { id } });
  if (sub.provider !== "manual") throw new Error("Card subscriptions are cancelled by the member or in Lemon Squeezy");
  await db.subscription.update({ where: { id }, data: { status: "expired", cancelled: true, endsAt: new Date() } });
  await audit(actor.id, "membership.cancel", "Subscription", id);
  revalidateAdmin(fd);
}

/* ─── Members ────────────────────────────────────────────────────────────── */

export async function changeRole(fd: FormData): Promise<void> {
  const actor = await assertRole("ADMIN");
  const id = String(fd.get("id"));
  const role = z.enum(["MEMBER", "STAFF", "ADMIN"]).parse(fd.get("role"));
  if (id === actor.id) throw new Error("You cannot change your own role");
  await db.user.update({ where: { id }, data: { role } });
  await audit(actor.id, "user.role", "User", id, { role });
  revalidateAdmin(fd);
}

/* ─── Orders ─────────────────────────────────────────────────────────────── */

const ORDER_STATUSES: OrderStatus[] = ["pending", "paid", "pay_on_delivery", "processing", "ready", "completed", "cancelled", "refunded"];

export async function updateOrderStatus(fd: FormData): Promise<void> {
  const actor = await assertRole("STAFF");
  const id = String(fd.get("id"));
  const status = z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]).parse(fd.get("status"));
  const order = await db.order.findUniqueOrThrow({ where: { id }, select: { status: true, paymentMode: true } });
  if (order.status === status) return;
  // A cancelled/refunded order has had its stock returned (possibly already resold).
  // Reopening it would sell those units twice, so staff create a new order instead.
  if (isClosed(order.status) && !isClosed(status)) throw new Error("Cancelled or refunded orders can't be reopened");

  const changed = await db.$transaction(async (tx) => {
    // Both branches only apply if the order is still in the status we read, so a
    // double-click or two staff members can't restock the same order twice.
    const ok = isClosed(status)
      ? await closeOrder(tx, id, order.status, status as "cancelled" | "refunded")
      : (await tx.order.updateMany({ where: { id, status: order.status }, data: { status } })).count === 1;
    if (ok && order.paymentMode === "manual" && (status === "completed" || status === "paid")) {
      await tx.payment.updateMany({ where: { orderId: id, provider: "manual" }, data: { status: "succeeded" } });
    }
    return ok;
  });
  if (changed) await audit(actor.id, "order.status", "Order", id, { from: order.status, to: status });
  revalidateAdmin(fd);
}

/* ─── Products ───────────────────────────────────────────────────────────── */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(40),
  flavorAr: z.string().trim().max(40).optional(),
  flavorEn: z.string().trim().max(40).optional(),
  sizeLabel: z.string().trim().min(1).max(40),
  price: z.string().trim().min(1),
  compareAt: z.string().trim().optional(),
  stock: z.coerce.number().int().min(0).max(100000),
  /** Stock value the form loaded (existing variants only). */
  stockOrig: z.coerce.number().int().min(0).max(100000).optional(),
  active: z.boolean(),
});

const productSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,80}$/),
  category: z.enum(["protein", "creatine", "pre_workout", "amino_acids", "vitamins", "gainers", "accessories"]),
  brand: z.string().trim().min(1).max(60),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionAr: z.string().trim().max(4000),
  descriptionEn: z.string().trim().max(4000),
  shape: z.enum(["tub", "shaker", "box"]),
  labelColor: hex,
  accentColor: hex,
  glbUrl: z
    .string()
    .trim()
    .optional()
    // Same-origin only (e.g. /models/whey.glb): the CSP's connect-src 'self' blocks other hosts.
    .refine((v) => !v || (v.startsWith("/") && !v.startsWith("//") && v.toLowerCase().endsWith(".glb")), "must be a local /…glb path"),
  regulatoryRef: z.string().trim().max(60).optional(),
  featured: z.boolean(),
  active: z.boolean(),
  variants: z.array(variantSchema).min(1).max(30),
});

function readVariants(fd: FormData) {
  const count = Number(fd.get("variantCount") ?? 0);
  const out: unknown[] = [];
  for (let i = 0; i < Math.min(count, 30); i++) {
    if (!fd.get(`v${i}_sku`)) continue;
    out.push({
      id: fd.get(`v${i}_id`) || undefined,
      sku: fd.get(`v${i}_sku`),
      flavorAr: fd.get(`v${i}_flavorAr`) || undefined,
      flavorEn: fd.get(`v${i}_flavorEn`) || undefined,
      sizeLabel: fd.get(`v${i}_size`),
      price: fd.get(`v${i}_price`),
      compareAt: fd.get(`v${i}_compareAt`) || undefined,
      stock: fd.get(`v${i}_stock`),
      stockOrig: fd.get(`v${i}_stockOrig`) ?? undefined,
      active: fd.get(`v${i}_active`) === "on",
    });
  }
  return out;
}

export async function saveProduct(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await assertRole("ADMIN");
  const parsed = productSchema.safeParse({
    id: fd.get("id") || undefined,
    slug: fd.get("slug"),
    category: fd.get("category"),
    brand: fd.get("brand"),
    nameAr: fd.get("nameAr"),
    nameEn: fd.get("nameEn"),
    descriptionAr: fd.get("descriptionAr") ?? "",
    descriptionEn: fd.get("descriptionEn") ?? "",
    shape: fd.get("shape"),
    labelColor: fd.get("labelColor"),
    accentColor: fd.get("accentColor"),
    glbUrl: fd.get("glbUrl") || undefined,
    regulatoryRef: fd.get("regulatoryRef") || undefined,
    featured: fd.get("featured") === "on",
    active: fd.get("active") === "on",
    variants: readVariants(fd),
  });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { variants, id, ...data } = parsed.data;

  let money: { price: number; compareAt: number | null }[];
  try {
    money = variants.map((v) => ({ price: toMinor(v.price, "JOD"), compareAt: v.compareAt ? toMinor(v.compareAt, "JOD") : null }));
  } catch {
    return { error: "price" };
  }

  const productData: Prisma.ProductUncheckedCreateInput = {
    ...data,
    glbUrl: data.glbUrl ?? null,
    regulatoryRef: data.regulatoryRef ?? null,
  };

  try {
    const saved = await db.$transaction(async (tx) => {
      const product = id ? await tx.product.update({ where: { id }, data: productData }) : await tx.product.create({ data: { ...productData, images: [] } });
      const keep: string[] = [];
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]!;
        const m = money[i]!;
        const vData = {
          sku: v.sku,
          flavorAr: v.flavorAr ?? null,
          flavorEn: v.flavorEn ?? null,
          sizeLabel: v.sizeLabel,
          priceMinor: m.price,
          compareAtMinor: m.compareAt,
          active: v.active,
        };
        let rowId: string;
        if (v.id) {
          // Apply only the admin's change to stock (form value − loaded value) on top of the
          // live number, so units sold while the form was open aren't overwritten.
          const delta = v.stock - (v.stockOrig ?? v.stock);
          const row = await tx.productVariant.update({ where: { id: v.id, productId: product.id }, data: { ...vData, stock: { increment: delta } } });
          if (row.stock < 0) await tx.productVariant.update({ where: { id: row.id }, data: { stock: 0 } });
          rowId = row.id;
        } else {
          rowId = (await tx.productVariant.create({ data: { ...vData, stock: v.stock, productId: product.id } })).id;
        }
        keep.push(rowId);
      }
      // Variants removed from the form are deactivated (kept for order history).
      await tx.productVariant.updateMany({ where: { productId: product.id, id: { notIn: keep } }, data: { active: false } });
      return product;
    });
    await audit(actor.id, id ? "product.update" : "product.create", "Product", saved.id, { slug: saved.slug });
  } catch (e) {
    return { error: e instanceof Error && e.message.includes("Unique") ? "duplicate" : "save" };
  }
  revalidateAdmin(fd);
  revalidatePath(`/${locale(fd)}/shop`, "layout");
  return { ok: true };
}

export async function updateStock(fd: FormData): Promise<void> {
  const actor = await assertRole("STAFF");
  const id = String(fd.get("id"));
  const stock = z.coerce.number().int().min(0).max(100000).parse(fd.get("stock"));
  await db.productVariant.update({ where: { id }, data: { stock } });
  await audit(actor.id, "variant.stock", "ProductVariant", id, { stock });
  revalidateAdmin(fd);
}

/* ─── Plans ──────────────────────────────────────────────────────────────── */

export async function savePlan(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await assertRole("ADMIN");
  const schema = z.object({
    id: z.string(),
    nameAr: z.string().trim().min(1).max(60),
    nameEn: z.string().trim().min(1).max(60),
    taglineAr: z.string().trim().max(160),
    taglineEn: z.string().trim().max(160),
    featuresAr: z.string().max(2000),
    featuresEn: z.string().max(2000),
    priceMonthly: z.string(),
    priceQuarterly: z.string(),
    priceYearly: z.string(),
    recommended: z.boolean(),
    active: z.boolean(),
  });
  const p = schema.safeParse({
    id: fd.get("id"),
    nameAr: fd.get("nameAr"),
    nameEn: fd.get("nameEn"),
    taglineAr: fd.get("taglineAr") ?? "",
    taglineEn: fd.get("taglineEn") ?? "",
    featuresAr: fd.get("featuresAr") ?? "",
    featuresEn: fd.get("featuresEn") ?? "",
    priceMonthly: fd.get("priceMonthly"),
    priceQuarterly: fd.get("priceQuarterly"),
    priceYearly: fd.get("priceYearly"),
    recommended: fd.get("recommended") === "on",
    active: fd.get("active") === "on",
  });
  if (!p.success) return { error: "invalid" };
  const lines = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  try {
    const d = p.data;
    await db.plan.update({
      where: { id: d.id },
      data: {
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        taglineAr: d.taglineAr,
        taglineEn: d.taglineEn,
        featuresAr: lines(d.featuresAr),
        featuresEn: lines(d.featuresEn),
        priceMonthly: toMinor(d.priceMonthly, "JOD"),
        priceQuarterly: toMinor(d.priceQuarterly, "JOD"),
        priceYearly: toMinor(d.priceYearly, "JOD"),
        recommended: d.recommended,
        active: d.active,
        isPlaceholder: false,
      },
    });
    await audit(actor.id, "plan.update", "Plan", d.id);
  } catch {
    return { error: "price" };
  }
  revalidateAdmin(fd);
  revalidatePath(`/${locale(fd)}/packages`);
  return { ok: true };
}

/* ─── Webhooks ───────────────────────────────────────────────────────────── */

export async function retryWebhook(fd: FormData): Promise<void> {
  const actor = await assertRole("ADMIN");
  const id = String(fd.get("id"));
  // Only failed events: re-applying one that already succeeded could roll state back.
  const evt = await db.webhookEvent.findUniqueOrThrow({ where: { id }, select: { processedAt: true } });
  if (evt.processedAt) return;
  const result = await processStoredEvent(id);
  await audit(actor.id, "webhook.retry", "WebhookEvent", id, { result: result.status });
  revalidateAdmin(fd);
}

/* ─── Check-in ───────────────────────────────────────────────────────────── */

export type CheckInResult = {
  result: "allowed" | "denied" | "unknown";
  name?: string | null;
  plan?: { ar: string; en: string };
  endsAt?: string | null;
};

export async function checkInMember(_prev: CheckInResult | null, fd: FormData): Promise<CheckInResult> {
  const actor = await assertRole("STAFF");
  const raw = String(fd.get("code") ?? "").trim();
  // Either the QR code from the member card, or a typed membership number (GG-00042 / 42).
  const number = parseMemberNumber(raw);
  const code = raw.startsWith("GG:") ? raw.slice(3) : raw;
  const sub = number
    ? await db.subscription.findFirst({ where: { user: { memberNumber: number } }, include: { user: true, plan: true }, orderBy: { createdAt: "desc" } })
    : /^[a-z0-9]{10,40}$/i.test(code)
      ? await db.subscription.findUnique({ where: { memberCode: code }, include: { user: true, plan: true } })
      : null;
  if (!sub) {
    // A real member (typed number) without any membership: say who it is, and deny.
    if (number) {
      const member = await db.user.findUnique({ where: { memberNumber: number }, select: { id: true, name: true, email: true } });
      if (member) {
        await db.checkIn.create({ data: { userId: member.id, allowed: false, staffId: actor.id } });
        return { result: "denied", name: member.name ?? member.email };
      }
    }
    return { result: "unknown" };
  }

  // The member may have a newer membership than the one on an old card.
  const all = await db.subscription.findMany({ where: { userId: sub.userId }, include: { plan: true } });
  const now = new Date();
  const best = all.find((s) => isMembershipActive(s, now));
  const allowed = Boolean(best);
  await db.checkIn.create({ data: { subscriptionId: (best ?? sub).id, userId: sub.userId, allowed, staffId: actor.id } });
  const shown = best ?? sub;
  return {
    result: allowed ? "allowed" : "denied",
    name: sub.user.name ?? sub.user.email,
    plan: { ar: shown.plan.nameAr, en: shown.plan.nameEn },
    endsAt: (shown.endsAt ?? shown.renewsAt)?.toISOString() ?? null,
  };
}
