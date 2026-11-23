"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useScene } from "./SceneProvider";
import type { SceneProps } from "./scenes";

const SceneView = dynamic(() => import("./scenes"), { ssr: false });

/** If the 3D canvas hasn't started this long after it was asked for, show the poster after all. */
const STALL_MS = 6000;

/**
 * A DOM region that may host a 3D scene. By default the poster (static art) is rendered first —
 * it is what LCP, crawlers, reduced-motion users and devices without WebGL see — and the 3D view
 * fades in over it. With `posterOnlyAsFallback`, the poster never shows while the 3D loads: only
 * where 3D can't run (reduced motion, no WebGL, data saver) or if it fails to start.
 */
export function SceneSlot({
  scene,
  poster,
  label,
  className = "",
  posterOnlyAsFallback = false,
}: {
  scene: SceneProps;
  poster: ReactNode;
  /** Text equivalent of the 3D content (WCAG). */
  label: string;
  className?: string;
  posterOnlyAsFallback?: boolean;
}) {
  const { tier, detected, register, setVisible, canvasReady } = useScene();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => register(id), [register, id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = Boolean(entry?.isIntersecting);
        setVisible(id, v);
        if (v) setMounted(true);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setVisible(id, false);
    };
  }, [id, setVisible]);

  const live = tier !== "off" && mounted;

  useEffect(() => {
    if (!posterOnlyAsFallback || !live || canvasReady) return;
    const timer = window.setTimeout(() => setStalled(true), STALL_MS);
    return () => window.clearTimeout(timer);
  }, [posterOnlyAsFallback, live, canvasReady]);

  const posterClass = posterOnlyAsFallback
    ? // Reduced motion is known from the first paint (CSS); the rest after the capability check.
      (detected && tier === "off") || (stalled && !canvasReady)
      ? "block"
      : "hidden motion-reduce:block"
    : `transition-opacity duration-[1400ms] ${live && canvasReady ? "opacity-0" : "opacity-100"}`;

  return (
    <div ref={ref} role="img" aria-label={label} className={`relative ${className}`}>
      <div className={`absolute inset-0 ${posterClass}`} aria-hidden>
        {poster}
      </div>
      {live ? <SceneView {...scene} tier={tier} /> : null}
    </div>
  );
}
