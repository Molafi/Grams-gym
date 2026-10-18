"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useScene } from "./SceneProvider";
import type { SceneProps } from "./scenes";

const SceneView = dynamic(() => import("./scenes"), { ssr: false });

/**
 * A DOM region that may host a 3D scene. The poster (static art) is always
 * rendered first — it is what LCP, crawlers, reduced-motion users and devices
 * without WebGL see. The 3D view mounts later and fades in over it.
 */
export function SceneSlot({
  scene,
  poster,
  label,
  className = "",
}: {
  scene: SceneProps;
  poster: ReactNode;
  /** Text equivalent of the 3D content (WCAG). */
  label: string;
  className?: string;
}) {
  const { tier, register, setVisible, canvasReady } = useScene();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

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

  return (
    <div ref={ref} role="img" aria-label={label} className={`relative ${className}`}>
      <div className={`absolute inset-0 transition-opacity duration-[1400ms] ${live && canvasReady ? "opacity-0" : "opacity-100"}`} aria-hidden>
        {poster}
      </div>
      {tier !== "off" && mounted ? <SceneView {...scene} tier={tier} /> : null}
    </div>
  );
}
