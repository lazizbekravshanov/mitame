// The markdown docs and the llms.txt index, rendered once for two readers. The
// site serves them at /docs/components/<name>.md and /llms.txt, and the npm
// package ships the same documents in dist/docs, so an agent that installed
// mitame reads them from node_modules instead of fetching the site. One
// renderer, because two copies of this prose would drift apart.
//
// Imports carry .ts extensions so node can run this directly from a script,
// the way scripts/build-meta.ts already imports this directory.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { checkAll } from "../../../scripts/contrast.ts";
import { blocks } from "../data/blocks.ts";
import { components, type ComponentDoc } from "../data/components.ts";
import { THEMES } from "./theme.ts";

export interface ContrastSummary {
  pass: number;
  total: number;
}

/** What the contrast checker enforces right now, measured from the shipped CSS, so the docs claim the current number instead of a remembered one. */
export function contrastSummary(root: string): ContrastSummary {
  const enforced = checkAll(root).filter((c) => !c.advisory);
  return { pass: enforced.filter((c) => c.passes).length, total: enforced.length };
}

/** The repo root from wherever the build happens to run, because the site build and the docs script start in different directories. */
export function findRoot(from: string): string {
  let dir = resolve(from);
  while (!existsSync(join(dir, "registry/themes/base.css"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error(`Not inside the mitame repository: ${from}`);
    dir = up;
  }
  return dir;
}

export interface DocLinks {
  /** The live demo page on the site. */
  demo: string;
  /** The list of every component. */
  all: string;
  /** The llms.txt index. */
  index: string;
}

const cell = (text: string) => text.replaceAll("|", "\\|");

export function componentMarkdown(doc: ComponentDoc, example: string, links: DocLinks): string {
  return `# ${doc.name}

${doc.description} Built on \`${doc.native}\`.

## Install

\`\`\`bash
npx @lazizbekio/mitame add ${doc.add}
\`\`\`

This copies the source into your project. There is no package to import from and no runtime dependency to add. The CSS has to be imported once for any of it to look like anything:

\`\`\`css
@import "./components/mitame/themes/base.css";
@import "./components/mitame/themes/y2k/aqua.css";
\`\`\`

Then set the theme on a root element: \`<html data-theme="aqua">\`.

## Usage

\`\`\`tsx
${example}
\`\`\`

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
${doc.props.map((p) => `| \`${cell(p.name)}\` | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ""} | ${cell(p.description)} |`).join("\n")}
${
  doc.keyboard?.length
    ? `
## Keyboard

| Key | Does |
| --- | --- |
${doc.keyboard.map(([key, does]) => `| ${cell(key)} | ${cell(does)} |`).join("\n")}
`
    : ""
}${
    doc.notes?.length
      ? `
## Notes

${doc.notes.map((n) => `- ${n}`).join("\n")}
`
      : ""
  }
## Styling

Every part carries a \`data-slot\`, and stateful parts carry \`data-state\`, \`data-variant\` or \`data-size\`. Style through those, or through the \`--mi-*\` custom properties. mitame's CSS sits in \`@layer components\`, so your own classes and Tailwind utilities already win. Do not add \`tailwind-merge\`.

---

[${doc.name} with its live demo](${links.demo}) · [All components](${links.all}) · [llms.txt](${links.index})
`;
}

export interface LlmsOptions {
  /** The site origin, like https://mitame.dev, or "" while SITE_URL is unset. */
  base: string;
  /** Where the reader finds a component's markdown doc. */
  componentDoc: (slug: string) => string;
  /** The checker's result at build time, so the claim cannot rot. */
  contrast: ContrastSummary;
  /** True for the copy that ships inside the npm package next to the docs. */
  packaged?: boolean;
}

// A plain text map of mitame for AI coding tools (https://llmstxt.org).
// Everything here is generated from the same data the site renders, so it
// cannot drift from what actually ships.
export function llmsTxt({ base, componentDoc, contrast, packaged }: LlmsOptions): string {
  const eras = THEMES.filter((t) => t.group === "Eras");
  const styles = THEMES.filter((t) => t.group === "Styles");
  const twins = packaged
    ? `- The component links above are markdown files shipped next to this index. The site mirrors them at \`${base}/docs/components/<name>.md\`.`
    : `- Every component page has a markdown twin at \`/docs/components/<name>.md\`, which is what these links point at.`;
  return `# mitame (見た目)

> "The way it looks" in Japanese. Copy-paste React 19 components with ${THEMES.length} themes, from a 1984 bitmap Mac to 2026 liquid glass. Built on the native <dialog>, the Popover API and real form inputs. No runtime dependencies besides React. Tailwind optional. Web only.

The components are not imported from a package. A CLI copies the source into the project and the files belong to whoever copied them.

## Install

- \`npx @lazizbekio/mitame init\` writes mitame.json and copies the helpers, base CSS and one theme. \`--theme <name>\` picks the theme, \`--dir <path>\` the destination (default src/components/mitame).
- \`npx @lazizbekio/mitame add <name...>\` copies a component and everything it imports.
- \`npx @lazizbekio/mitame list\` prints every component, block, hook, icon and theme.
- Through the shadcn CLI instead, in a project that already has components.json: \`npx shadcn@latest add lazizbekravshanov/mitame/button\` and \`npx shadcn@latest add lazizbekravshanov/mitame/theme-aqua\`.
- Import the CSS once, in this order: themes/base.css, then the theme's own file. Set the theme with <html data-theme="aqua">, and force a mode with data-mode="light" or "dark".
- Imports look like: import { Button } from "@/components/mitame/ui/button"

## Components

${components.map((c) => `- [${c.name}](${componentDoc(c.slug)}): ${c.description} Built on ${c.native}. Add with \`npx @lazizbekio/mitame add ${c.add}\`.`).join("\n")}

## Blocks

${blocks.map((b) => `- [${b.name}](${base}/blocks#${b.slug}): ${b.description} Uses ${b.uses.join(", ")}. Add with \`npx @lazizbekio/mitame add ${b.slug}\`.`).join("\n")}

## Themes

Each theme is one CSS file keyed by data-theme, with its tokens in a generated sibling. Every theme carries light and dark.

- Eras: ${eras.map((t) => `${t.id} (${t.era}, ${t.year})`).join(", ")}
- Styles: ${styles.map((t) => `${t.id} (${t.era})`).join(", ")}

## Rules that are easy to get wrong

- There is no npm install step and no package to import from. \`add\` copies source into the project and the project owns it.
- The CSS has to be imported once or every component renders unstyled. base.css first, then exactly one theme file.
- The \`@/\` alias is not configured by mitame. Either map \`"@/*": ["./src/*"]\` in tsconfig, or import with relative paths.
- Blocks need their layout CSS as well: \`@import "./components/mitame/blocks/blocks.css";\`

## Styling

- [Theming](${base}/docs/theming): --mi-* custom properties hold the tokens. Every part carries a data-slot, and stateful parts carry data-state, data-variant or data-size. Style through those.
- mitame's CSS lives in @layer components, so your own classes and Tailwind utilities win without tailwind-merge and without !important.
- Contrast is measured from the CSS as it ships, on every build: ${contrast.pass} of ${contrast.total} colour pairs pass across all ${THEMES.length} themes in light and dark, at WCAG AA for text and 3:1 for control boundaries.

## For coding agents

- \`npx @lazizbekio/mitame mcp\` runs an MCP server on stdio: list_items, get_item (source plus props and keyboard), add_items, init_project, get_theme.
${twins}
- [AGENTS.md](https://github.com/lazizbekravshanov/mitame/blob/main/AGENTS.md): the repository's own conventions, for working on mitame rather than with it.

## Optional

- [Repository](https://github.com/lazizbekravshanov/mitame): MIT licensed. registry.json at the root works with \`npx shadcn@latest add lazizbekravshanov/mitame/<item>\`.
- [Themes](${base}/themes): all ${THEMES.length} looks with live previews.
- [Blocks](${base}/blocks): whole pages built from the same components.
`;
}
