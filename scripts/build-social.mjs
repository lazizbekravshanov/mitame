// Renders the social images from the real site, so they can never drift from
// the components. Usage: npm run social
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { findChromium, serveDist } from "./lib/browser.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const out = join(root, "site/public/social");

// The gallery covers every theme, read from the metadata the package ships so a
// new look gets a picture without anyone remembering to add it here.
const themes = JSON.parse(readFileSync(join(root, "registry/meta.json"), "utf8")).themes.map((t) => t.name);

const SHOTS = [
  { url: "/og/card/aqua/", file: "og.png", w: 1200, h: 630 },
  { url: "/og/card/liquid/", file: "og-liquid.png", w: 1200, h: 630 },
  { url: "/og/card/platinum/", file: "og-platinum.png", w: 1200, h: 630 },
  { url: "/og/card/terminal/", file: "og-terminal.png", w: 1200, h: 630 },
  { url: "/og/card/paper/", file: "og-paper.png", w: 1200, h: 630 },
  ...themes.map((name, i) => ({ url: `/og/gallery/${name}/`, file: `gallery-${i + 1}-${name}.png`, w: 1270, h: 760 })),
  { url: "/og/block/urban/", file: "block-dashboard-urban.png", w: 1270, h: 760 },
  { url: "/og/block/brutalist/", file: "block-dashboard-brutalist.png", w: 1270, h: 760 },
  { url: "/og/block/aqua/", file: "block-dashboard-aqua.png", w: 1270, h: 760 },
];

mkdirSync(out, { recursive: true });
const { base, close } = await serveDist(join(root, "site/dist"));
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  for (const shot of SHOTS) {
    // deviceScaleFactor 2 keeps them sharp on retina and on Product Hunt.
    const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h }, deviceScaleFactor: 2 });
    await page.goto(base + shot.url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, shot.file) });
    await page.close();
    console.log(`${shot.file}  ${shot.w}x${shot.h} @2x`);
  }
} finally {
  await browser.close();
  close();
}
console.log(`\nWrote ${SHOTS.length} images to site/public/social/`);
