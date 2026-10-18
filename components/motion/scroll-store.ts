"use client";

/**
 * Tiny mutable store shared between DOM scroll observers and 3D scenes.
 * Scenes read it inside useFrame (no React re-renders on scroll).
 */
export const scrollStore = {
  /** 0 → hero fully visible, 1 → hero fully scrolled away */
  hero: 0,
  /** 0 → 1 progress through the pinned "Each Gram Matters" section */
  story: 0,
  /** page scroll velocity (px/frame, smoothed) */
  velocity: 0,
};

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Progress of an element scrolling through the viewport (0 at top-aligned, 1 when it has fully passed). */
export function elementProgress(el: HTMLElement, mode: "exit" | "pinned"): number {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  if (mode === "exit") return clamp01(-r.top / Math.max(1, r.height));
  // pinned: section taller than viewport, progress while its top passes from 0 to -(height - vh)
  return clamp01(-r.top / Math.max(1, r.height - vh));
}
