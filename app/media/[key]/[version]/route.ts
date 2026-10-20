import { db } from "@/lib/db";
import { isMediaKey } from "@/config/media";

/**
 * Serves images uploaded in /admin/media. URLs carry a version (see lib/media.ts mediaUrl),
 * so responses are immutable and cached by browsers and the image optimizer.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string; version: string }> }) {
  const { key } = await params;
  if (!isMediaKey(key)) return new Response("Not found", { status: 404 });
  const asset = await db.mediaAsset.findUnique({ where: { key }, select: { mime: true, data: true } });
  if (!asset?.data || !asset.mime) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
