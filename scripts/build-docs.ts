// Writes the component docs and their llms.txt index into dist/docs, so the
// npm package carries the same documents the site serves and an agent that
// installed mitame reads them from node_modules instead of fetching the web.
// They go under dist because dist is the package's generated output and is
// already shipped, while the docs/ directory at the root holds internal specs
// and launch notes that never go to npm.
//
// Run `npm run docs`. prepublishOnly runs it, so a tarball cannot ship stale.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { components } from "../site/src/data/components.ts";
import { componentMarkdown, contrastSummary, llmsTxt } from "../site/src/lib/docs-md.ts";

const SITE = "https://mitame.dev";

export function buildDocs(root: string, out: string): string[] {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const contrast = contrastSummary(root);
  const written: string[] = [];
  for (const doc of components) {
    // The example is shown the way it looks in the user's project after `add`.
    const raw = readFileSync(join(root, "site/src/components/demos", `${doc.slug}.tsx`), "utf8");
    const example = raw.replaceAll("@mitame/", "@/components/mitame/").trim();
    const body = componentMarkdown(doc, example, {
      demo: `${SITE}/docs/components/${doc.slug}`,
      all: "./llms.txt",
      index: "./llms.txt",
    });
    writeFileSync(join(out, `${doc.slug}.md`), body);
    written.push(`${doc.slug}.md`);
  }
  const index = llmsTxt({ base: SITE, componentDoc: (slug) => `./${slug}.md`, contrast, packaged: true });
  writeFileSync(join(out, "llms.txt"), index);
  written.push("llms.txt");
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  const files = buildDocs(root, join(root, "dist/docs"));
  console.log(`dist/docs: ${files.length} files`);
}
