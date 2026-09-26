#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { THEMES, listItems } from "./registry.ts";
import { add, init, readConfig, DEFAULT_CONFIG, type CopyResult } from "./commands.ts";
import { serve } from "./mcp.ts";

// dist/cli/index.js -> ../../registry  (and cli/index.ts -> ../registry when run from source)
const here = dirname(fileURLToPath(import.meta.url));
const root = here.endsWith(join("dist", "cli")) ? join(here, "../../registry") : join(here, "../registry");

// Built from THEMES so the list cannot drift from what ships.
const themeHelp = ["vintage", "y2k", "now", "styles"]
  .map((group) => {
    const names = Object.entries(THEMES)
      .filter(([, path]) => path.startsWith(`${group}/`))
      .map(([name]) => (name === DEFAULT_CONFIG.theme ? `${name} (default)` : name));
    return `  ${group.padEnd(9)}${names.join("  ")}`;
  })
  .join("\n");

const HELP = `mitame: copy-paste components, any look

Usage
  npx @lazizbekio/mitame init [--dir src/components/mitame] [--theme <name>]
  npx @lazizbekio/mitame add <item...> [--overwrite]   e.g. add button select dialog
  npx @lazizbekio/mitame list                          components, hooks, icons, themes
  npx @lazizbekio/mitame mcp                           an MCP server on stdio, for coding agents

Installed as a dependency? The short form works too: npx mitame add button

Themes
${themeHelp}

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
  3. Add components: npx @lazizbekio/mitame add button card`);
    return;
  }
  if (command === "add") {
    const result = add(root, cwd, rest, { overwrite: values.overwrite });
    report(result);
    if ([...result.written, ...result.reused, ...result.skipped].some((f) => f.endsWith("blocks/blocks.css"))) {
      // The path has to be where this project installs, not the default, or the import fails.
      const dir = readConfig(cwd).dir.replace(/^src\//, "");
      console.log(`\nBlocks need their layout CSS. Import it once, next to the theme:\n  @import "./${dir}/blocks/blocks.css";`);
    }
    return;
  }
  if (command === "mcp") {
    // Speaks MCP over stdin and stdout, so nothing else may be written there.
    return serve(root, cwd);
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
