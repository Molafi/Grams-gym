"use client";

export type QualityTier = "off" | "low" | "medium" | "high";

export const TIER_SETTINGS: Record<Exclude<QualityTier, "off">, { dpr: [number, number]; shadows: boolean; sparkles: number; orbiters: number; envRes: number }> = {
  low: { dpr: [1, 1.25], shadows: false, sparkles: 0, orbiters: 8, envRes: 64 },
  medium: { dpr: [1, 1.5], shadows: true, sparkles: 40, orbiters: 12, envRes: 128 },
  high: { dpr: [1, 1.75], shadows: true, sparkles: 80, orbiters: 16, envRes: 256 },
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Pick a tier from device capability. Reduced motion or no WebGL → static posters. */
export function detectTier(): QualityTier {
  if (typeof window === "undefined") return "off";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
  if (!hasWebGL()) return "off";
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("quality");
  if (forced === "off" || forced === "low" || forced === "medium" || forced === "high") return forced;

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "off";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (coarse || cores <= 4 || mem <= 4) return "low";
  if (cores >= 8 && mem >= 8) return "high";
  return "medium";
}
