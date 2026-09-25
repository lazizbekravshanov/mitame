// Finds a Chromium and an ffmpeg that are already on this machine, so the social
// scripts need no browser download. Playwright's cache layout changes between
// versions, hence the list of known binary paths.
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join } from "node:path";

const CACHE = join(homedir(), "Library/Caches/ms-playwright");

const CHROMIUM_PATHS = [
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
];

function newestIn(prefix, relatives) {
  if (!existsSync(CACHE)) return undefined;
  for (const dir of readdirSync(CACHE).filter((d) => d.startsWith(prefix)).sort().reverse()) {
    for (const rel of relatives) {
      const path = join(CACHE, dir, rel);
      if (existsSync(path)) return path;
    }
  }
  return undefined;
}

export function findChromium() {
  const fallback = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const found = newestIn("chromium-", CHROMIUM_PATHS) ?? (existsSync(fallback) ? fallback : undefined);
  if (!found) throw new Error("No Chromium found. Run `npx playwright install chromium`.");
  return found;
}

export function findFfmpeg() {
  const found = newestIn("ffmpeg-", ["ffmpeg-mac"]);
  if (!found) throw new Error("No ffmpeg found. Run `npx playwright install`.");
  return found;
}

const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

/** Tiny static file server for site/dist. Returns its base URL and a close(). */
export async function serveDist(dist) {
  if (!existsSync(dist)) throw new Error("Run `npm run site:build` first.");
  const server = createServer((req, res) => {
    const path = decodeURI((req.url ?? "/").split("?")[0]);
    const file = join(dist, path.endsWith("/") ? `${path}index.html` : path);
    if (!existsSync(file)) return void res.writeHead(404).end("not found");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
