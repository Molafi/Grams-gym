// Screenshots for visual checks, run by .github/workflows/screenshots.yml.
//   BASE_URL  the site to capture (default http://localhost:3000)
//   OUT       output folder (default screenshots)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const out = process.env.OUT || "screenshots";
mkdirSync(out, { recursive: true });

// SwiftShader gives headless Chromium WebGL, so the 3D scenes render too.
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const viewports = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const pages = [
  ["home", "/"],
  ["packages", "/packages"],
  ["contact", "/contact"],
  ["product", "/shop/demo-forge-whey"],
];

for (const [device, opts] of Object.entries(viewports)) {
  for (const motion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ ...opts, reducedMotion: motion });
    const page = await context.newPage();
    for (const locale of ["ar", "en"]) {
      for (const [name, path] of pages) {
        // Reduced motion shows the static logo image instead of 3D: only needed for the hero.
        if (motion === "reduce" && name !== "home") continue;
        await page.goto(`${base}/${locale}${path}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000); // idle callback + 3D fade-in + logo intro
        const tag = motion === "reduce" ? "-poster" : "";
        await page.screenshot({ path: `${out}/${name}${tag}-${locale}-${device}-top.png` });
        if (motion === "no-preference") await page.screenshot({ path: `${out}/${name}-${locale}-${device}-full.png`, fullPage: true });
        if (motion === "no-preference" && name === "packages") {
          // Back of a plan card ("See benefits" flips it).
          const flipped = await page
            .getByRole("button", { name: /See benefits|شوف المزايا/ })
            .first()
            .click({ timeout: 5000 })
            .then(() => true, () => false); // no plans on this site
          if (flipped) {
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${out}/packages-flipped-${locale}-${device}-top.png` });
          }
        }
        console.log("saved", name, locale, device, motion);
      }
    }
    await context.close();
  }
}

// The hero logo animation: frames over the first 18 s (intro turn, then the first full turn).
{
  const context = await browser.newContext(viewports.desktop);
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(`${base}/ar/`, { waitUntil: "load" });
  for (let i = 0; i < 26; i++) {
    const ms = String(Date.now() - started).padStart(5, "0");
    await page.screenshot({ path: `${out}/hero-anim-${ms}ms.png`, clip: { x: 0, y: 80, width: 760, height: 780 } });
    await page.waitForTimeout(700);
  }
  await context.close();
  console.log("saved hero animation frames");
}

await browser.close();
