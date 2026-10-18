"use client";

import { Environment, Lightformer } from "@react-three/drei";

/** Brushed silver — anisotropic, clearcoated. */
export function BrushedSilver({ color = "#cfd3d9" }: { color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={1}
      roughness={0.32}
      anisotropy={0.65}
      anisotropyRotation={Math.PI / 2}
      clearcoat={0.35}
      clearcoatRoughness={0.25}
      envMapIntensity={1.15}
    />
  );
}

export function Chrome() {
  return <meshPhysicalMaterial color="#e8eaed" metalness={1} roughness={0.12} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={1.3} />;
}

export function BlackSteel() {
  return <meshPhysicalMaterial color="#16181d" metalness={0.85} roughness={0.42} clearcoat={0.4} clearcoatRoughness={0.4} envMapIntensity={0.9} />;
}

/**
 * Studio: custom Lightformer strips (no HDR download — CSP-friendly), deep-navy
 * fill like the gym wall, and the signature warm orange rim.
 */
export function Studio({ resolution = 128, rimSide = 1 }: { resolution?: number; rimSide?: 1 | -1 }) {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[3, 4, 5]} intensity={0.6} color="#ffffff" />
      {/* Signature ember rim light */}
      <pointLight position={[rimSide * -3.2, 0.6, -2.2]} intensity={28} distance={10} color="#ff7d09" />
      <pointLight position={[rimSide * 3.5, -1.2, -1.5]} intensity={6} distance={9} color="#0b2a4a" />
      <Environment resolution={resolution} frames={1}>
        <color attach="background" args={["#05070b"]} />
        <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 4, 2]} rotation-x={Math.PI / 2} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#dfe6ee" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 0.6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#dfe6ee" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 0.6, 1]} />
        <Lightformer form="rect" intensity={3.2} color="#ff7d09" position={[rimSide * -4, 0, -4]} scale={[1.2, 6, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#2b5b8c" position={[0, -3, -5]} scale={6} />
      </Environment>
    </>
  );
}
