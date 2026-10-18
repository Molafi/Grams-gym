#!/usr/bin/env node
/**
 * Generates static poster images of the 3D scenes (used for reduced-motion /
 * no-WebGL / LCP). Run against a running dev or prod server:
 *
 *   npm run dev            # in another terminal
 *   npm run posters        # writes public/posters/*.png
 *
 * Then convert to AVIF/WebP (e.g. `npx @squoosh/cli --avif {} public/posters/*.png`)
 * and reference them from the poster components (components/home/HeroStage.tsx,
 * StorySection.tsx). The current posters are SVG art and work without this step.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.POSTER_BASE_URL ?? "http://localhost:3000";
const out = new URL("../public/posters/", import.meta.url);
await mkdir(out, { recursive: true });

const shots = [
  { name: "hero-ar", url: "/ar?quality=high", selector: "section [role=img]" },
  { name: "hero-en", url: "/en?quality=high", selector: "section [role=img]" },
  { name: "story", url: "/en?quality=high#story", selector: "#story [role=img]" },
];

const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const s of shots) {
  await page.goto(base + s.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // canvas mounts after idle; let the environment render
  const el = page.locator(s.selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await el.screenshot({ path: new URL(`${s.name}.png`, out).pathname, omitBackground: true });
  console.log("✓", s.name);
}
await browser.close();
