"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { scrollStore } from "./scroll-store";

/** Lenis smooth scroll — disabled for reduced motion and inside [data-lenis-prevent] areas. */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      scrollStore.velocity += (lenis.velocity - scrollStore.velocity) * 0.1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}
