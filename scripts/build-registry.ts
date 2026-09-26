// Generates registry.json, which lets `npx shadcn@latest add lazizbekravshanov/mitame/<item>`
// install mitame components straight from the repository. No hosting, no build
// step on our side: the shadcn CLI reads this file and then the source files
// next to it. Run `npm run registry` after adding or renaming anything.
//
// Two details decide whether this works at all:
//
//  1. Every file carries an explicit `target`. mitame components import each
//     other with relative paths (`../lib/cn`), and the shadcn CLI only rewrites
//     `@/`-prefixed imports. Without a target it scatters the files by type and
//     those relative imports point at nothing.
//  2. Shared files are inlined in each item rather than listed as
//     `registryDependencies`. A bare name there resolves against shadcn's own
//     registry, not ours. The CLI skips files it has already written, so a user
//     adding a second component does not get a second copy of cn.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectFiles, listItems, resolveItem, THEMES } from "../cli/registry.ts";
import { blocks } from "../site/src/data/blocks.ts";
import { components } from "../site/src/data/components.ts";

const AUTHOR = "Lazizbek Ravshanov <https://mitame.dev>";
const HOME = "https://mitame.dev";
const DIR = "mitame";

/** The shadcn file type for a registry path. */
function fileType(path: string): string {
  if (path.startsWith("ui/")) return "registry:ui";
  if (path.startsWith("hooks/")) return "registry:hook";
  if (path.startsWith("lib/")) return "registry:lib";
  if (path.startsWith("icons/")) return "registry:component";
  if (path.startsWith("blocks/") && path.endsWith(".tsx")) return "registry:block";
  // Everything else is CSS, which the CLI only places when told exactly where.
  return "registry:file";
}

function entry(path: string) {
  return {
    path: `registry/${path}`,
    type: fileType(path),
    target: `@components/${DIR}/${path}`,
  };
}

/** What the CLI prints once the files land. It is the one message an agent reads at the right moment. */
function docsFor(kind: "ui" | "block" | "theme", name: string): string {
  const importLine =
    kind === "theme"
      ? `Import the CSS once in your global stylesheet, in this order:\n  @import "./components/${DIR}/themes/base.css";\n  @import "./components/${DIR}/themes/${THEMES[name.replace(/^theme-/, "")]}.css";\nThen set the theme on the page: <html data-theme="${name.replace(/^theme-/, "")}">.\nTailwind users: add @import "./components/${DIR}/themes/tailwind.css" after tailwindcss.`
      : `Needs a mitame theme. If you have not added one yet: npx shadcn@latest add lazizbekravshanov/mitame/theme-aqua`;
  const styling =
    kind === "theme"
      ? "Paths are relative to the stylesheet you import them from, so adjust the depth if yours is nested."
      : "Style it with the data-slot, data-variant and data-size attributes, or with the --mi-* custom properties. mitame's own CSS sits in @layer components, so your classes and Tailwind utilities already win without tailwind-merge.";
  const extra = kind === "block" ? `\nThis block also needs its layout CSS: @import "./components/${DIR}/blocks/blocks.css";` : "";
  return `${importLine}\n${styling}${extra}`;
}

export function buildRegistry(root: string) {
  const registryRoot = join(root, "registry");
  const byKind = listItems(registryRoot);
  const items: unknown[] = [];

  const docFor = (slug: string) => components.find((c) => c.slug === slug);
  for (const name of byKind["ui"] ?? []) {
    const doc = docFor(name);
    items.push({
      name,
      type: "registry:ui",
      title: doc?.name ?? name,
      description: doc?.description ?? `The mitame ${name}.`,
      author: AUTHOR,
      categories: ["mitame"],
      docs: docsFor("ui", name),
      files: collectFiles(registryRoot, [resolveItem(registryRoot, name)]).map(entry),
    });
  }

  for (const block of blocks) {
    items.push({
      name: block.slug,
      type: "registry:block",
      title: block.name,
      description: block.description,
      author: AUTHOR,
      categories: ["mitame", "block"],
      docs: docsFor("block", block.slug),
      files: collectFiles(registryRoot, [resolveItem(registryRoot, `blocks/${block.slug}`)]).map(entry),
    });
  }

  for (const [theme, path] of Object.entries(THEMES)) {
    // The Tailwind bridge ships with every theme: the docs tell users to import
    // it, so it has to be one of the files they actually get.
    const files = collectFiles(registryRoot, ["themes/base.css", "themes/tailwind.css", `themes/${path}.css`]);
    items.push({
      name: `theme-${theme}`,
      type: "registry:theme",
      title: `mitame ${theme}`,
      description: `The ${theme} look: one CSS file of tokens and component styling, keyed by data-theme="${theme}".`,
      author: AUTHOR,
      categories: ["mitame", "theme"],
      docs: docsFor("theme", `theme-${theme}`),
      files: files.map(entry),
    });
  }

  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "mitame",
    homepage: HOME,
    items,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  const out = join(root, "registry.json");
  const next = `${JSON.stringify(buildRegistry(root), null, 2)}\n`;
  const current = (() => {
    try {
      return readFileSync(out, "utf8");
    } catch {
      return "";
    }
  })();
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("registry.json is out of date. Run `npm run registry`.");
      process.exitCode = 1;
    } else {
      console.log("registry.json is up to date.");
    }
  } else {
    writeFileSync(out, next);
    console.log(`wrote ${out} (${buildRegistry(root).items.length} items)`);
  }
}
