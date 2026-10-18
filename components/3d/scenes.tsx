"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Float, PerspectiveCamera, Sparkles, View } from "@react-three/drei";
import { MathUtils, type Group, type PerspectiveCamera as PerspectiveCameraImpl } from "three";
import { scrollStore } from "@/components/motion/scroll-store";
import { pointerStore } from "./pointer-store";
import { TIER_SETTINGS, type QualityTier } from "./quality";
import { Studio } from "./materials";
import { Barbell, CalibrationRing, CalibrationWeight, GGMonogram, Kettlebell, OlympicPlate, SupplementPack, type PackProps } from "./models";

export type SceneProps =
  | { kind: "hero"; dir: "rtl" | "ltr" }
  | { kind: "story" }
  | { kind: "pack"; pack: PackProps; turntable?: boolean };

type Tier = Exclude<QualityTier, "off">;

/* ─── Hero: The Forged GG ──────────────────────────────────────────────── */

function HeroScene({ tier, dir }: { tier: Tier; dir: "rtl" | "ltr" }) {
  const s = TIER_SETTINGS[tier];
  const group = useRef<Group>(null);
  const cam = useRef<PerspectiveCameraImpl>(null);
  const mirror = dir === "rtl" ? -1 : 1;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const exit = scrollStore.hero;
    const t = state.clock.elapsedTime;
    // Pointer parallax (damped) + slow idle sway; exit turns the monogram edge-on.
    const targetY = pointerStore.x * 0.28 * mirror + Math.sin(t * 0.25) * 0.08 + exit * (Math.PI / 2) * mirror;
    const targetX = -pointerStore.y * 0.16 + exit * 0.15;
    g.rotation.y = MathUtils.damp(g.rotation.y, targetY, 3.2, dt);
    g.rotation.x = MathUtils.damp(g.rotation.x, targetX, 3.2, dt);
    if (cam.current) {
      cam.current.position.z = MathUtils.damp(cam.current.position.z, 6 + exit * 3.2, 4, dt);
      cam.current.position.y = MathUtils.damp(cam.current.position.y, 0.2 + exit * 0.6, 4, dt);
      cam.current.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault position={[0, 0.2, 6]} fov={32} />
      <Studio resolution={s.envRes} rimSide={mirror as 1 | -1} />
      <group ref={group}>
        <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.35} floatingRange={[-0.06, 0.06]}>
          <group scale={1.55}>
            <GGMonogram />
          </group>
        </Float>
        <CalibrationRing count={s.orbiters} radius={2.25} />
      </group>
      {s.shadows ? <ContactShadows position={[0, -1.35, 0]} opacity={0.55} scale={9} blur={2.6} far={3.5} resolution={256} color="#000000" /> : null}
      {s.sparkles > 0 ? <Sparkles count={s.sparkles} scale={[7, 3.5, 3]} size={1.6} speed={0.18} opacity={0.32} color="#ffe2c4" /> : null}
    </>
  );
}

/* ─── Each Gram Matters: weight → kettlebell → plate → barbell ─────────── */

function smoothBump(p: number, center: number, width: number) {
  const d = Math.abs(p - center) / width;
  if (d >= 1) return 0;
  const x = 1 - d;
  return x * x * (3 - 2 * x);
}

function StoryScene({ tier }: { tier: Tier }) {
  const s = TIER_SETTINGS[tier];
  // Separate named refs: indexing an array of refs during render trips the React
  // Compiler's `react-hooks/refs` rule. The array is only built inside useFrame.
  const weightRef = useRef<Group>(null);
  const kettlebellRef = useRef<Group>(null);
  const plateRef = useRef<Group>(null);
  const barbellRef = useRef<Group>(null);
  const centers = [0.08, 0.36, 0.64, 0.92];
  const baseScale = [1.2, 1.15, 1.15, 0.85];

  useFrame((state, dt) => {
    const p = scrollStore.story;
    [weightRef, kettlebellRef, plateRef, barbellRef].forEach((r, i) => {
      const g = r.current;
      if (!g) return;
      const w = i === 0 ? Math.max(smoothBump(p, centers[i]!, 0.28), p < centers[0]! ? 1 : 0) : i === 3 ? Math.max(smoothBump(p, centers[i]!, 0.28), p > centers[3]! ? 1 : 0) : smoothBump(p, centers[i]!, 0.28);
      const target = w * baseScale[i]!;
      const sc = MathUtils.damp(g.scale.x, target, 6, dt);
      g.scale.setScalar(Math.max(0.0001, sc));
      g.visible = sc > 0.01;
      g.rotation.y += dt * (0.25 + i * 0.05);
      g.position.y = Math.sin(state.clock.elapsedTime * 0.8 + i) * 0.05;
    });
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.4, 6.2]} fov={30} />
      <Studio resolution={s.envRes} />
      <group ref={weightRef}>
        <CalibrationWeight />
      </group>
      <group ref={kettlebellRef}>
        <Kettlebell />
      </group>
      <group ref={plateRef} rotation={[0.2, 0, 0]}>
        <OlympicPlate />
      </group>
      <group ref={barbellRef} rotation={[0.25, 0, 0.12]}>
        <Barbell />
      </group>
      {s.shadows ? <ContactShadows position={[0, -1.25, 0]} opacity={0.5} scale={8} blur={2.4} far={3} resolution={256} /> : null}
      {s.sparkles > 0 ? <Sparkles count={Math.round(s.sparkles * 0.6)} scale={[6, 3, 3]} size={1.4} speed={0.15} opacity={0.25} color="#ffe2c4" /> : null}
    </>
  );
}

/* ─── Supplement pack turntable ─────────────────────────────────────────── */

function PackScene({ tier, pack, turntable = true }: { tier: Tier; pack: PackProps; turntable?: boolean }) {
  const s = TIER_SETTINGS[tier];
  const g = useRef<Group>(null);
  useFrame((state, dt) => {
    if (!g.current) return;
    if (turntable) g.current.rotation.y += dt * 0.45;
    const tx = pointerStore.y * -0.08;
    g.current.rotation.x = MathUtils.damp(g.current.rotation.x, tx, 3, dt);
  });
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.25, 4.4]} fov={30} />
      <Studio resolution={s.envRes} />
      <group ref={g}>
        <SupplementPack {...pack} />
      </group>
      {s.shadows ? <ContactShadows position={[0, -0.95, 0]} opacity={0.6} scale={4} blur={2.2} far={2} resolution={256} /> : null}
    </>
  );
}

/** Default export: the DOM-side <View> that tunnels its scene into the shared canvas. */
export default function SceneView(props: SceneProps & { tier: Tier }) {
  return (
    <View className="absolute inset-0">
      {props.kind === "hero" ? <HeroScene tier={props.tier} dir={props.dir} /> : null}
      {props.kind === "story" ? <StoryScene tier={props.tier} /> : null}
      {props.kind === "pack" ? <PackScene tier={props.tier} pack={props.pack} turntable={props.turntable} /> : null}
    </View>
  );
}
