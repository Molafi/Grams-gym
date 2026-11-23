"use client";

import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Float, PerspectiveCamera, Sparkles, View } from "@react-three/drei";
import { MathUtils, type Group, type PerspectiveCamera as PerspectiveCameraImpl, type PointLight } from "three";
import { scrollStore } from "@/components/motion/scroll-store";
import { pointerStore } from "./pointer-store";
import { TIER_SETTINGS, type QualityTier } from "./quality";
import { Studio } from "./materials";
import { Barbell, CalibrationRing, CalibrationWeight, Kettlebell, OlympicPlate, SupplementPack, type PackProps } from "./models";
import { LogoModel } from "./LogoModel";

export type SceneProps =
  | { kind: "hero"; dir: "rtl" | "ltr"; logoSrc: string | null }
  | { kind: "story" }
  | { kind: "pack"; pack: PackProps; turntable?: boolean };

type Tier = Exclude<QualityTier, "off">;

/* ─── Hero: the GRAMS GYM logo ─────────────────────────────────────────── */

/** Intro: the logo turns in from its back and grows into place. */
const INTRO_S = 1.8;
/** Then a full turn every SPIN_EVERY_S seconds, lasting SPIN_S. */
const SPIN_EVERY_S = 9;
const SPIN_S = 1.6;
const LOGO_WIDTH = 3.1;

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
/** Overshoots a little before settling, so the logo lands with a bounce. */
const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

function HeroScene({ tier, dir, logoSrc }: { tier: Tier; dir: "rtl" | "ltr"; logoSrc: string | null }) {
  const s = TIER_SETTINGS[tier];
  const group = useRef<Group>(null);
  const logo = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const sweep = useRef<PointLight>(null);
  const cam = useRef<PerspectiveCameraImpl>(null);
  const ready = useRef(false);
  const readyAt = useRef<number | null>(null);
  const onReady = useCallback(() => {
    ready.current = true;
  }, []);
  const mirror = dir === "rtl" ? -1 : 1;

  useFrame((state, dt) => {
    const g = group.current;
    const l = logo.current;
    if (!g || !l) return;
    const exit = scrollStore.hero;
    const t = state.clock.elapsedTime;
    if (ready.current && readyAt.current === null) readyAt.current = t;
    const since = readyAt.current === null ? 0 : t - readyAt.current;
    const started = readyAt.current !== null;

    // Whole stage: pointer parallax (damped) + idle sway; scrolling away turns it edge-on.
    const targetY = pointerStore.x * 0.3 * mirror + Math.sin(t * 0.35) * 0.14 + exit * (Math.PI / 2) * mirror;
    const targetX = -pointerStore.y * 0.18 + Math.sin(t * 0.5) * 0.04 + exit * 0.15;
    g.rotation.y = MathUtils.damp(g.rotation.y, targetY, 3.2, dt);
    g.rotation.x = MathUtils.damp(g.rotation.x, targetX, 3.2, dt);

    // The logo itself: turns in from its back with a bounce, then a full turn (with a small
    // hop) every few seconds. A turn of 2π ends exactly where it started, so there's no jump.
    const intro = started ? Math.min(1, since / INTRO_S) : 0;
    const cycle = since - INTRO_S;
    const phase = cycle > 0 ? cycle % SPIN_EVERY_S : 0;
    const spinStart = SPIN_EVERY_S - SPIN_S;
    const spin = cycle > 0 && phase > spinStart ? easeInOutCubic((phase - spinStart) / SPIN_S) : 0;
    l.rotation.y = ((1 - easeOutBack(intro)) * Math.PI + spin * Math.PI * 2) * mirror;
    const grow = started ? easeOutCubic(Math.min(1, since / 1.2)) : 0;
    l.scale.setScalar(0.6 + 0.4 * grow);
    l.position.y = (grow - 1) * 0.35 + Math.sin(spin * Math.PI) * 0.16;
    if (ring.current) ring.current.scale.setScalar(Math.max(0.0001, started ? easeOutCubic(Math.min(1, since / 1.6)) : 0));

    // A light that drifts across the front, so highlights move over the logo.
    sweep.current?.position.set(Math.sin(t * 0.7) * 3.4 * mirror, 1.1 + Math.cos(t * 0.45) * 0.9, 3.2);

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
      <pointLight ref={sweep} position={[0, 1.1, 3.2]} intensity={10} distance={9} color="#ffffff" />
      <group ref={group}>
        <Float speed={1.5} rotationIntensity={0.25} floatIntensity={0.6} floatingRange={[-0.1, 0.1]}>
          <group ref={logo}>
            <LogoModel src={logoSrc} width={LOGO_WIDTH} onReady={onReady} />
          </group>
        </Float>
        <group ref={ring}>
          <CalibrationRing count={s.orbiters} radius={2.25} />
        </group>
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
      {props.kind === "hero" ? <HeroScene tier={props.tier} dir={props.dir} logoSrc={props.logoSrc} /> : null}
      {props.kind === "story" ? <StoryScene tier={props.tier} /> : null}
      {props.kind === "pack" ? <PackScene tier={props.tier} pack={props.pack} turntable={props.turntable} /> : null}
    </View>
  );
}
