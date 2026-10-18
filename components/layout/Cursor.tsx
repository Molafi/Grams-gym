"use client";

import { useEffect, useRef } from "react";

/** Soft custom cursor — desktop + fine pointer only, hidden for reduced motion. Native cursor stays visible. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!fine || reduce || !el) return;
    let x = -100,
      y = -100,
      cx = -100,
      cy = -100,
      scale = 1,
      targetScale = 1,
      raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const target = e.target as Element | null;
      targetScale = target?.closest("a,button,[role=button],input,select,textarea,label") ? 2.4 : 1;
    };
    const loop = () => {
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      scale += (targetScale - scale) * 0.15;
      el.style.transform = `translate3d(${cx - 6}px, ${cy - 6}px, 0) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };
    el.style.opacity = "1";
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  return (
    // Physical `left-0` on purpose: pointer coordinates are physical in both LTR and RTL.
    <div
      ref={ref}
      aria-hidden
      className="cursor-dot pointer-events-none fixed left-0 top-0 z-[90] h-3 w-3 rounded-full border border-ember/70 bg-ember/20 opacity-0 mix-blend-screen transition-opacity duration-500"
    />
  );
}
