"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { flatten, LOCKED_NAMESPACES, namespaceOf, samePlaceholders } from "@/lib/content-keys";
import { BUSINESS_FIELDS, businessDefaults } from "@/lib/business";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export type ContentState = { ok?: boolean; saved?: number; error?: "invalid"; badKeys?: string[] };

const DEFAULTS = { ar: flatten(ar), en: flatten(en) } as const;
const MAX_LEN = 4000;

/**
 * Saves the text fields of one section. Fields are named `ar:<key>` / `en:<key>`.
 * A value equal to the default removes the edit. A value that drops or adds a
 * placeholder ({days}, <terms>…) is rejected, because the page would fail to render.
 */
export async function saveContent(_prev: ContentState, fd: FormData): Promise<ContentState> {
  const actor = await assertRole("ADMIN");
  const ns = String(fd.get("ns") ?? "");
  if (!ns || LOCKED_NAMESPACES.has(ns)) return { error: "invalid" };

  const badKeys: string[] = [];
  const upserts: { locale: "ar" | "en"; key: string; value: string }[] = [];
  const deletes: { locale: "ar" | "en"; key: string }[] = [];

  for (const [name, raw] of fd.entries()) {
    const m = /^(ar|en):(.+)$/.exec(name);
    if (!m || typeof raw !== "string") continue;
    const locale = m[1] as "ar" | "en";
    const key = m[2]!;
    const def = DEFAULTS[locale][key];
    if (def === undefined || namespaceOf(key) !== ns) continue;
    const value = raw.replace(/\r\n/g, "\n");
    if (value.trim() === "" || value === def) {
      deletes.push({ locale, key });
      continue;
    }
    if (value.length > MAX_LEN || !samePlaceholders(def, value)) {
      badKeys.push(`${locale}:${key}`);
      continue;
    }
    upserts.push({ locale, key, value });
  }
  if (badKeys.length) return { error: "invalid", badKeys };

  await db.$transaction([
    ...deletes.map((d) => db.contentOverride.deleteMany({ where: d })),
    ...upserts.map((u) =>
      db.contentOverride.upsert({
        where: { locale_key: { locale: u.locale, key: u.key } },
        create: { ...u, updatedBy: actor.id },
        update: { value: u.value, updatedBy: actor.id },
      }),
    ),
  ]);
  await audit(actor.id, "content.update", "ContentOverride", ns, { changed: upserts.length, reset: deletes.length });
  revalidatePath("/", "layout");
  return { ok: true, saved: upserts.length };
}

/** Business facts (phone, address, hours labels, WhatsApp message). */
export async function saveBusiness(_prev: ContentState, fd: FormData): Promise<ContentState> {
  const actor = await assertRole("ADMIN");
  const defaults = businessDefaults();
  const badKeys: string[] = [];
  const ops = [];
  for (const { key } of BUSINESS_FIELDS) {
    const raw = fd.get(key);
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value.length > 300) {
      badKeys.push(key);
      continue;
    }
    if (key === "phoneDisplay" && value && !/^[+0-9 ()-]{7,20}$/.test(value)) {
      badKeys.push(key);
      continue;
    }
    ops.push(
      value === "" || value === defaults[key]
        ? db.siteSetting.deleteMany({ where: { key } })
        : db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    );
  }
  if (badKeys.length) return { error: "invalid", badKeys };
  await db.$transaction(ops);
  await audit(actor.id, "business.update", "SiteSetting", null);
  revalidatePath("/", "layout");
  return { ok: true };
}
