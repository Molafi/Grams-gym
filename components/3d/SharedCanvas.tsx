"use client";

import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, View } from "@react-three/drei";
import { useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { TIER_SETTINGS, type QualityTier } from "./quality";

/**
 * The single fixed, transparent, full-viewport canvas. Every <SceneSlot> renders a
 * drei <View> in the DOM; its contents are tunnelled here and scissored to the
 * slot's rectangle. pointer-events: none — all interaction stays in the DOM.
 */
export default function SharedCanvas({
  tier,
  active,
  onReady,
}: {
  tier: Exclude<QualityTier, "off">;
  active: boolean;
  onReady: () => void;
}) {
  const settings = TIER_SETTINGS[tier];
  const [dpr, setDpr] = useState(settings.dpr[1]);

  return (
    <Canvas
      aria-hidden
      className="!fixed inset-0 !pointer-events-none"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      frameloop={active ? "always" : "never"}
      dpr={dpr}
      gl={{ antialias: tier !== "low", alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearColor(0x000000, 0);
        onReady();
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(settings.dpr[0], +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(settings.dpr[1], +(d + 0.25).toFixed(2)))}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <View.Port />
    </Canvas>
  );
}
