import type { APIRoute } from "astro";
import { blocks } from "../data/blocks";
import { components } from "../data/components";
import { THEMES } from "../lib/theme";

// A plain text map of mitame for AI coding tools (https://llmstxt.org).
// Everything here is generated from the same data the site renders, so it
// cannot drift from what actually ships.
export const GET: APIRoute = ({ site }) => {
  const base = site ? site.href.replace(/\/$/, "") : "";
  const eras = THEMES.filter((t) => t.group === "Eras");
  const styles = THEMES.filter((t) => t.group === "Styles");
  const body = `# mitame (見た目)

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

${components.map((c) => `- [${c.name}](${base}/docs/components/${c.slug}.md): ${c.description} Built on ${c.native}. Add with \`npx @lazizbekio/mitame add ${c.add}\`.`).join("\n")}

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
- Colours are checked against WCAG AA in both modes on every build, measured from the CSS as it ships.

## For coding agents

- \`npx @lazizbekio/mitame mcp\` runs an MCP server on stdio: list_items, get_item (source plus props and keyboard), add_items, init_project, get_theme.
- Every component page has a markdown twin at \`/docs/components/<name>.md\`, which is what these links point at.
- [AGENTS.md](https://github.com/lazizbekravshanov/mitame/blob/main/AGENTS.md): the repository's own conventions, for working on mitame rather than with it.

## Optional

- [Repository](https://github.com/lazizbekravshanov/mitame): MIT licensed. registry.json at the root works with \`npx shadcn@latest add lazizbekravshanov/mitame/<item>\`.
- [Themes](${base}/themes): all ${THEMES.length} looks with live previews.
- [Blocks](${base}/blocks): whole pages built from the same components.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
