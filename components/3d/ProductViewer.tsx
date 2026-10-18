"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { Studio } from "./materials";
import { SupplementPack, type PackProps } from "./models";

/**
 * Full-screen draggable viewer (its own short-lived context while the modal is open):
 * limited orbit, auto-rotate, inertia (damping), no zoom/pan.
 */
export default function ProductViewer({ pack }: { pack: PackProps }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
      }}
      className="h-full w-full touch-none"
    >
      <PerspectiveCamera makeDefault position={[0, 0.3, 4.2]} fov={30} />
      <Studio resolution={256} />
      <SupplementPack {...pack} />
      <ContactShadows position={[0, -0.95, 0]} opacity={0.6} scale={4} blur={2.2} far={2} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        autoRotate
        autoRotateSpeed={1.2}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.62}
      />
    </Canvas>
  );
}
