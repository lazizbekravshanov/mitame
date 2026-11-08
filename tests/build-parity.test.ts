import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

// Vite 8 minifies CSS with lightningcss, and lightningcss deletes a standard
// declaration when its vendor prefixed twin follows it in the same block.
// `backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px)` minifies to
// just the webkit one, so every Vite consumer loses backdrop blur in
// production. The safe order is prefix first, standard last. This test runs
// the shipped CSS through the same minifier and asserts every standard
// property that has a prefixed twin in the source survives.

const themeFiles = readdirSync(join(root, "registry/themes"), { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".css"))
  .map((f) => join(root, "registry/themes", f));
const files = [...themeFiles, join(root, "site/src/styles/site.css")];

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/* A declaration block is innermost brace content, so selectors and at-rule
   preludes never leak in. Returns the standard properties that share a block
   with a prefixed twin, one entry per block. */
function twinPairs(css: string) {
  const pairs: { prop: string; block: string }[] = [];
  for (const m of stripComments(css).matchAll(/\{([^{}]*)\}/g)) {
    const block = m[1] ?? "";
    for (const d of block.matchAll(/(?:^|[;\s])-(?:webkit|moz|ms|o)-([a-z-]+)\s*:/g)) {
      const prop = d[1] ?? "";
      if (new RegExp(`(?:^|[;\\s])${prop}\\s*:`).test(block)) pairs.push({ prop, block });
    }
  }
  return pairs;
}

describe("prefixed declarations survive the lightningcss minify that Vite runs", () => {
  for (const file of files) {
    const name = relative(root, file);
    const css = readFileSync(file, "utf8");
    const pairs = twinPairs(css);

    it(name, () => {
      // Each block on its own, so rule merging in the minifier cannot hide a
      // dropped declaration, then the whole file as the integration check.
      for (const { prop, block } of pairs) {
        const out = transform({ filename: name, code: Buffer.from(`.probe{${block}}`), minify: true }).code.toString();
        expect(out, `${prop} dropped from: ${block.trim().split("\n").join(" ")}`).toMatch(
          new RegExp(`(?:^|[;{\\s])${prop}\\s*:`),
        );
      }
      const out = transform({ filename: name, code: Buffer.from(css), minify: true }).code.toString();
      for (const prop of new Set(pairs.map((p) => p.prop))) {
        expect(out, `${prop} missing from minified ${name}`).toMatch(new RegExp(`(?:^|[;{\\s])${prop}\\s*:`));
      }
    });
  }
});
