import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string | null, meta?: Prisma.InputJsonValue) {
  try {
    await db.auditLog.create({ data: { actorId, action, entity, entityId: entityId ?? null, meta } });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
