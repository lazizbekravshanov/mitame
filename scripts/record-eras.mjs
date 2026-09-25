// Records the era switch on the landing page as a looping GIF (and a webm) for
// launch posts. Usage: npm run clip
//
// Playwright's bundled ffmpeg only speaks webm, so the shareable file is a GIF
// built from real screenshots. For an mp4, install ffmpeg (`brew install ffmpeg`)
// and run: ffmpeg -i site/public/social/eras.webm -pix_fmt yuv420p eras.mp4
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import gifenc from "gifenc";
import { chromium } from "playwright-core";
import UPNG from "upng-js";
import { findChromium, serveDist } from "./lib/browser.mjs";

const { GIFEncoder, applyPalette, quantize } = gifenc;

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const out = join(root, "site/public/social");
const tmp = join(root, "node_modules/.cache/clip");

const SIZE = { width: 1000, height: 600 };
const ERAS = ["Vintage", "Y2K", "Now"];
const HOLD_MS = 1400;

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

const { base, close } = await serveDist(join(root, "site/dist"));
const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: SIZE } });
const page = await context.newPage();

await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
/** Keep the era chips and the live screen under them in frame. */
const frameShot = () =>
  page.evaluate(() => {
    const el = document.querySelector('[aria-label="Era"]');
    if (!el) return;
    // Instant, not smooth: the page sets scroll-behavior: smooth for humans.
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 96, behavior: "instant" });
  });

await frameShot();
await page.waitForTimeout(600);

const frames = [];
for (const era of [...ERAS, ...ERAS]) {
  await page.getByRole("button", { name: new RegExp(era, "i") }).first().click();
  await page.waitForTimeout(600); // let the theme's own transitions finish
  await frameShot();
  frames.push(await page.screenshot({ type: "png" }));
  await page.waitForTimeout(200);
}

await context.close();
await browser.close();
close();

// webm straight from Playwright, for anywhere that takes video
const webm = readdirSync(tmp).find((f) => f.endsWith(".webm"));
if (webm) renameSync(join(tmp, webm), join(out, "eras.webm"));

// GIF from the captured frames: one palette per frame keeps the gradients clean
const gif = GIFEncoder();
for (const png of frames) {
  const image = UPNG.decode(png);
  const { width, height } = image;
  const rgba = new Uint8Array(UPNG.toRGBA8(image)[0]);
  const palette = quantize(rgba, 256);
  gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay: HOLD_MS });
}
gif.finish();
writeFileSync(join(out, "eras.gif"), Buffer.from(gif.bytes()));

console.log(`wrote site/public/social/eras.gif (${frames.length} frames, ${SIZE.width}x${SIZE.height}) and eras.webm`);
