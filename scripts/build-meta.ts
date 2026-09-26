// Generates registry/meta.json: what each component is, what props it takes and
// what keyboard it answers to, plus the blocks and themes. The docs site already
// holds all of this, but the site is not part of the npm package, so an agent
// installing mitame could only see source files and had to infer the API.
// Shipping it as data is what lets the MCP server answer questions about a
// component without the caller reading and guessing from TSX.
//
// Run `npm run meta` after changing site/src/data.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES } from "../cli/registry.ts";
import { blocks } from "../site/src/data/blocks.ts";
import { components } from "../site/src/data/components.ts";
import { THEMES as SITE_THEMES } from "../site/src/lib/theme.ts";

export interface Meta {
  version: string;
  components: {
    name: string;
    add: string;
    description: string;
    /** The platform feature it is built on. */
    native: string;
    props: { name: string; type: string; default?: string; description: string }[];
    keyboard?: [string, string][];
    notes?: string[];
  }[];
  blocks: { name: string; add: string; description: string; uses: string[] }[];
  themes: { name: string; add: string; group: string; era: string; year: string; css: string }[];
}

export function buildMeta(root: string): Meta {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
  return {
    version: pkg.version,
    components: components.map((c) => ({
      name: c.slug,
      add: c.add,
      description: c.description,
      native: c.native,
      props: c.props.map((p) => ({ name: p.name, type: p.type, ...(p.default ? { default: p.default } : {}), description: p.description })),
      ...(c.keyboard ? { keyboard: c.keyboard.map((k) => [...k] as [string, string]) } : {}),
      ...(c.notes ? { notes: [...c.notes] } : {}),
    })),
    blocks: blocks.map((b) => ({ name: b.slug, add: b.slug, description: b.description, uses: [...b.uses] })),
    themes: SITE_THEMES.map((t) => ({
      name: t.id,
      add: t.id,
      group: t.group,
      era: t.era,
      year: t.year,
      css: `themes/${THEMES[t.id]}.css`,
    })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  const out = join(root, "registry/meta.json");
  const next = `${JSON.stringify(buildMeta(root), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = readFileSync(out, "utf8");
    if (current !== next) {
      console.error("registry/meta.json is out of date. Run `npm run meta`.");
      process.exitCode = 1;
    } else console.log("registry/meta.json is up to date.");
  } else {
    writeFileSync(out, next);
    const meta = buildMeta(root);
    console.log(`wrote ${out} (${meta.components.length} components, ${meta.blocks.length} blocks, ${meta.themes.length} themes)`);
  }
}
