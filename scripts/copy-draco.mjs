// Copies the Draco decoder that ships with `three` into public/draco/ so compressed .glb
// product models load from our own origin (the CSP allows no third-party CDNs).
// Runs on `npm install` (postinstall). Safe to run repeatedly.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "three", "examples", "jsm", "libs", "draco", "gltf");
const dest = join(root, "public", "draco");

if (!existsSync(src)) {
  console.warn(`[copy-draco] ${src} not found; skipping (compressed .glb models won't load)`);
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => /^draco_(decoder|wasm_wrapper)\.(js|wasm)$/.test(f));
for (const f of files) copyFileSync(join(src, f), join(dest, f));
console.log(`[copy-draco] copied ${files.join(", ")} → public/draco/`);
