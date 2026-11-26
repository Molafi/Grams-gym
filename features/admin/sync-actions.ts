"use server";

import { revalidatePath } from "next/cache";
import { assertRole, AuthError } from "@/lib/auth/guards";
import { syncMembersFromMirror } from "./legacy-sync";

export type SyncNowState = {
  ok?: boolean;
  error?: "readOnly" | "noMirror" | "failed";
  created?: number;
  updated?: number;
  periods?: number;
  conflicts?: number;
};

/** "Update members now" in /admin/import: the same step the sync agent triggers after each change. */
export async function syncMembersNow(_prev: SyncNowState, fd: FormData): Promise<SyncNowState> {
  let actorId: string;
  try {
    actorId = (await assertRole("ADMIN")).id;
  } catch (e) {
    if (e instanceof AuthError) return { error: "readOnly" };
    throw e;
  }
  try {
    const result = await syncMembersFromMirror(actorId);
    if (!result.ok) return { error: "noMirror" };
    revalidatePath(`/${fd.get("locale") === "en" ? "en" : "ar"}/admin`, "layout");
    const s = result.summary;
    return { ok: true, created: s.membersCreated, updated: s.membersUpdated, periods: s.subscriptionsCreated, conflicts: s.conflicts.length };
  } catch (e) {
    console.error("[sync] update members now", e);
    return { error: "failed" };
  }
}
