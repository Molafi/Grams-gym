import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertRole, AuthError } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { isMediaKey } from "@/config/media";

export const dynamic = "force-dynamic";

/** Vercel rejects request bodies over 4.5 MB, so stay under that. */
const MAX_BYTES = 4 * 1024 * 1024;

/** Detect the real type from the file's first bytes (never trust the browser's type). */
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

const altSchema = z.string().trim().max(200).optional();

/**
 * Admin image editing (multipart form):
 *   action=save  key, file? (replace the image), altAr?, altEn?
 *   action=reset key (go back to the default file and alt text)
 */
export async function POST(req: Request) {
  // Same-origin only (server actions get this check built in; route handlers don't).
  // Compare host names (behind a proxy, req.url can be an internal address).
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* malformed → rejected below */
    }
    if (originHost !== host) return Response.json({ error: "origin" }, { status: 403 });
  }
  let actor;
  try {
    actor = await assertRole("ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const fd = await req.formData();
  const key = String(fd.get("key") ?? "");
  if (!isMediaKey(key)) return Response.json({ error: "key" }, { status: 400 });

  if (fd.get("action") === "reset") {
    await db.mediaAsset.deleteMany({ where: { key } });
    await audit(actor.id, "media.reset", "MediaAsset", key);
    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  }

  const altAr = altSchema.safeParse(fd.get("altAr") ?? undefined);
  const altEn = altSchema.safeParse(fd.get("altEn") ?? undefined);
  if (!altAr.success || !altEn.success) return Response.json({ error: "alt" }, { status: 400 });

  const file = fd.get("file");
  let upload: { mime: string; data: Uint8Array<ArrayBuffer> } | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return Response.json({ error: "size" }, { status: 413 });
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = sniff(data);
    if (!mime) return Response.json({ error: "type" }, { status: 415 });
    upload = { mime, data };
  }

  const alt = { altAr: altAr.data || null, altEn: altEn.data || null };
  await db.mediaAsset.upsert({
    where: { key },
    create: { key, ...alt, ...(upload ?? {}), updatedBy: actor.id },
    update: { ...alt, ...(upload ?? {}), updatedBy: actor.id },
  });
  await audit(actor.id, upload ? "media.upload" : "media.alt", "MediaAsset", key, upload ? { bytes: upload.data.byteLength, mime: upload.mime } : undefined);
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
