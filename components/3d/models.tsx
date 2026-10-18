"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  CanvasTexture,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Shape,
  SRGBColorSpace,
  Vector2,
} from "three";
import { ggLetters } from "@/lib/gg-geometry";
import { BlackSteel, BrushedSilver, Chrome } from "./materials";
import { drawLabel, type LabelData } from "./label";

/* ─── GG monogram ───────────────────────────────────────────────────────── */

export function GGMonogram() {
  const geometry = useMemo(() => {
    const shapes = ggLetters().map((pts) => {
      const s = new Shape();
      pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
      s.closePath();
      return s;
    });
    const g = new ExtrudeGeometry(shapes, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.018,
      bevelSegments: 4,
      curveSegments: 1,
    });
    g.center();
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <BrushedSilver />
    </mesh>
  );
}

/* ─── Calibration weights (the "every gram" orbit) ─────────────────────── */

const weightProfile = [
  new Vector2(0, 0),
  new Vector2(0.5, 0),
  new Vector2(0.52, 0.04),
  new Vector2(0.52, 0.62),
  new Vector2(0.44, 0.7),
  new Vector2(0.2, 0.74),
  new Vector2(0.2, 0.86),
  new Vector2(0.3, 0.92),
  new Vector2(0.3, 1.02),
  new Vector2(0, 1.06),
];

export function CalibrationWeight(props: ThreeElements["group"]) {
  const geometry = useMemo(() => new LatheGeometry(weightProfile, 48), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group {...props}>
      <mesh geometry={geometry} position={[0, -0.53, 0]}>
        <Chrome />
      </mesh>
    </group>
  );
}

export function CalibrationRing({ count = 12, radius = 2.3 }: { count?: number; radius?: number }) {
  const ref = useRef<Group>(null);
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const s = 0.07 + ((i * 37) % 5) * 0.018;
        return { a, s, y: Math.sin(i * 1.7) * 0.35 };
      }),
    [count],
  );
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.12;
  });
  return (
    <group ref={ref} rotation={[0.32, 0, 0.08]}>
      {items.map((it, i) => (
        <CalibrationWeight key={i} position={[Math.cos(it.a) * radius, it.y, Math.sin(it.a) * radius]} scale={it.s * 2.2} />
      ))}
    </group>
  );
}

/* ─── Kettlebell / Plate / Barbell (story) ─────────────────────────────── */

export function Kettlebell(props: ThreeElements["group"]) {
  return (
    <group {...props}>
      <mesh position={[0, -0.15, 0]} scale={[1, 0.92, 1]}>
        <sphereGeometry args={[0.62, 64, 48]} />
        <BlackSteel />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, -0.075 * Math.PI]}>
        <torusGeometry args={[0.36, 0.075, 24, 64, Math.PI * 1.15]} />
        <BlackSteel />
      </mesh>
      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 48]} />
        <BlackSteel />
      </mesh>
    </group>
  );
}

const plateProfile = [
  new Vector2(0.14, -0.09),
  new Vector2(0.98, -0.09),
  new Vector2(1.0, -0.06),
  new Vector2(1.0, 0.06),
  new Vector2(0.98, 0.09),
  new Vector2(0.88, 0.09),
  new Vector2(0.84, 0.05),
  new Vector2(0.34, 0.05),
  new Vector2(0.3, 0.09),
  new Vector2(0.14, 0.09),
];

export function OlympicPlate(props: ThreeElements["group"]) {
  const geometry = useMemo(() => new LatheGeometry(plateProfile, 96), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group {...props}>
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
        <BlackSteel />
      </mesh>
      {/* chrome hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 48, 1, true]} />
        <Chrome />
      </mesh>
      {/* ember ring — the brand accent */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0.052]}>
        <ringGeometry args={[0.86, 0.875, 128]} />
        <meshBasicMaterial color="#ff7d09" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Barbell(props: ThreeElements["group"]) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 4.2, 24]} />
        <Chrome />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.55, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.8, 32]} />
            <Chrome />
          </mesh>
          <OlympicPlate rotation={[0, Math.PI / 2, 0]} position={[side * -0.22, 0, 0]} scale={0.62} />
          <OlympicPlate rotation={[0, Math.PI / 2, 0]} position={[side * -0.05, 0, 0]} scale={0.62} />
        </group>
      ))}
    </group>
  );
}

/* ─── Supplement packs with procedural CanvasTexture labels ────────────── */

export type PackProps = LabelData & { shape: "tub" | "shaker" | "box"; glbUrl?: string | null };

function useLabelTexture(d: LabelData) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    drawLabel(canvas, d);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [d]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function GlbPack({ url }: { url: string }) {
  // Draco decoder served locally from /draco/ (CSP: no third-party CDNs).
  const { scene } = useGLTF(url, "/draco/");
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clone} />;
}

export function SupplementPack({ glbUrl, shape, ...label }: PackProps) {
  // Re-draw the label only when its data changes by value.
  const labelKey = JSON.stringify(label);
  const data = useMemo(() => JSON.parse(labelKey) as LabelData, [labelKey]);
  const texture = useLabelTexture(data);

  if (glbUrl) return <GlbPack url={glbUrl} />;

  if (shape === "box") {
    return (
      <group>
        <mesh castShadow>
          <boxGeometry args={[1.1, 1.45, 0.42]} />
          <meshPhysicalMaterial attach="material-0" color={label.labelColor} roughness={0.5} />
          <meshPhysicalMaterial attach="material-1" color={label.labelColor} roughness={0.5} />
          <meshPhysicalMaterial attach="material-2" color={label.accentColor} roughness={0.5} />
          <meshPhysicalMaterial attach="material-3" color={label.labelColor} roughness={0.5} />
          <meshPhysicalMaterial attach="material-4" map={texture} roughness={0.38} clearcoat={0.6} clearcoatRoughness={0.3} />
          <meshPhysicalMaterial attach="material-5" color={label.labelColor} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  if (shape === "shaker") {
    return (
      <group>
        <mesh castShadow position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.44, 0.38, 1.5, 64, 1, false]} />
          <meshPhysicalMaterial color="#0d0f13" roughness={0.18} transmission={0.25} thickness={0.4} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.425, 0.405, 0.62, 64, 1, true]} />
          <meshPhysicalMaterial map={texture} roughness={0.35} clearcoat={0.8} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 0.16, 64]} />
          <meshPhysicalMaterial color={label.accentColor} roughness={0.35} clearcoat={0.6} />
        </mesh>
        <mesh position={[0.18, 0.92, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.14, 32]} />
          <meshPhysicalMaterial color="#0d0f13" roughness={0.4} />
        </mesh>
      </group>
    );
  }

  // tub
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.66, 0.62, 1.3, 96, 1, true]} />
        <meshPhysicalMaterial map={texture} roughness={0.36} clearcoat={0.7} clearcoatRoughness={0.25} />
      </mesh>
      <mesh position={[0, -0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.62, 64]} />
        <meshStandardMaterial color={label.labelColor} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[0.69, 0.69, 0.2, 96]} />
        <meshPhysicalMaterial color={label.accentColor === "#07080A" ? "#14171d" : "#0e1014"} roughness={0.3} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.645, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.675, 0.012, 12, 96]} />
        <meshBasicMaterial color={label.accentColor} toneMapped={false} />
      </mesh>
    </group>
  );
}
