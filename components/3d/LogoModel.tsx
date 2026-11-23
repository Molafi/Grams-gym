"use client";

import { useEffect, useState } from "react";
import { GGMonogram } from "./models";
import { loadLogo, type LogoBuild } from "./logo-model";

/** Width of the drawn GG monogram (lib/gg-geometry.ts) in model units. */
const GG_WIDTH = 2.12;

/** The built logo; undefined while it loads, null when there's no usable logo image. */
function useLogo(src: string | null): LogoBuild | null | undefined {
  const [loaded, setLoaded] = useState<{ src: string; build: LogoBuild | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    void loadLogo(src).then((build) => {
      if (alive) setLoaded({ src, build });
    });
    return () => {
      alive = false;
    };
  }, [src]);
  if (!src) return null;
  return loaded?.src === src ? loaded.build : undefined;
}

/**
 * The GRAMS GYM logo in 3D, `width` units wide, made from the logo image (the `logo` slot in
 * /admin/media, so a new upload changes it too): the artwork on the front, solid sides, a white
 * back. Falls back to the drawn GG monogram if the image can't be cut out.
 */
export function LogoModel({ src, width, onReady }: { src: string | null; width: number; onReady?: () => void }) {
  const logo = useLogo(src);
  useEffect(() => {
    if (logo !== undefined) onReady?.();
  }, [logo, onReady]);

  if (logo === undefined) return null;
  if (logo === null) {
    return (
      <group scale={width / GG_WIDTH}>
        <GGMonogram />
      </group>
    );
  }
  return (
    <mesh geometry={logo.geometry} scale={width / logo.width} castShadow>
      {/* Front: the artwork. Unlit glow keeps the white parts pure white (#fff), the arms dark. */}
      <meshPhysicalMaterial
        attach="material-0"
        map={logo.texture}
        emissiveMap={logo.texture}
        emissive="#ffffff"
        emissiveIntensity={0.75}
        roughness={0.3}
        clearcoat={1}
        clearcoatRoughness={0.12}
        toneMapped={false}
      />
      {/* Sides: the colour of their edge, mostly lit, so the thickness reads. */}
      <meshPhysicalMaterial
        attach="material-1"
        map={logo.texture}
        emissiveMap={logo.texture}
        emissive="#ffffff"
        emissiveIntensity={0.28}
        roughness={0.4}
        clearcoat={0.6}
        clearcoatRoughness={0.2}
        toneMapped={false}
      />
      {/* Back: plain white, seen while the logo turns. */}
      <meshPhysicalMaterial
        attach="material-2"
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.5}
        roughness={0.35}
        clearcoat={1}
        clearcoatRoughness={0.15}
        toneMapped={false}
      />
    </mesh>
  );
}
