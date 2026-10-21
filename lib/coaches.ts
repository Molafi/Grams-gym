import { site } from "@/config/site";
import type { MediaKey } from "@/config/media";

/** Coaches members can pick for personal training. Names live in messages → coaches.<key>. */
export type CoachKey = (typeof site.coaches)[number]["key"];

export const COACH_KEYS = site.coaches.map((c) => c.key) as CoachKey[];

/** Photo slot (config/media.ts, editable in /admin/media) for each coach. */
export const COACH_MEDIA: Record<CoachKey, MediaKey> = {
  ahmad: "coachAhmad",
  amr: "coachAmr",
  simon: "coachSimon",
  zaid: "coachZaid",
};

export function isCoachKey(v: unknown): v is CoachKey {
  return typeof v === "string" && (COACH_KEYS as string[]).includes(v);
}
