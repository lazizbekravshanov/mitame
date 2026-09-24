#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { THEMES, listItems } from "./registry.ts";
import { add, init, type CopyResult } from "./commands.ts";

// dist/cli/index.js -> ../../registry  (and cli/index.ts -> ../registry when run from source)
const here = dirname(fileURLToPath(import.meta.url));
const root = here.endsWith(join("dist", "cli")) ? join(here, "../../registry") : join(here, "../registry");

const HELP = `mitame: copy-paste components with era themes

Usage
  npx mitame init [--dir src/components/mitame] [--theme aqua|liquid|platinum]
  npx mitame add <item...> [--overwrite]      e.g. add button select dialog
  npx mitame list

Files land in your project and are yours to edit. Existing files are
skipped unless you pass --overwrite.`;

function report(r: CopyResult) {
  for (const f of r.written) console.log(`  + ${f}`);
  for (const f of r.skipped) console.log(`  = ${f} (exists, kept yours)`);
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      theme: { type: "string" },
      overwrite: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...rest] = positionals;
  const cwd = process.cwd();

  if (values.help || !command) return console.log(HELP);
  if (command === "init") {
    const r = init(root, cwd, { dir: values.dir, theme: values.theme, overwrite: values.overwrite });
    console.log(`mitame ready in ${r.config.dir} (theme: ${r.config.theme})`);
    report(r);
    console.log(`
Next:
  1. Import the styles once, e.g. in your global CSS:
       @import "./${r.config.dir.replace(/^src\//, "")}/themes/base.css";
       @import "./${r.config.dir.replace(/^src\//, "")}/themes/${THEMES[r.config.theme]}.css";
     (Tailwind users: also @import ".../themes/tailwind.css" after tailwindcss.)
  2. Set the theme: <html data-theme="${r.config.theme}">
  3. Add components: npx mitame add button card`);
    return;
  }
  if (command === "add") {
    report(add(root, cwd, rest, { overwrite: values.overwrite }));
    return;
  }
  if (command === "list") {
    for (const [kind, items] of Object.entries(listItems(root))) console.log(`${kind}\n  ${items.join("  ")}\n`);
    return;
  }
  console.error(`Unknown command "${command}".\n\n${HELP}`);
  process.exitCode = 1;
}

try {
  main();
} catch (e) {
  console.error(`mitame: ${(e as Error).message}`);
  process.exitCode = 1;
}
