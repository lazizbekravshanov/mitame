<div align="center">

# mitame 見た目

**Old UI, brought back to life.**

Copy-paste React components that wear any era, from 2001 Aqua gel to 2026 liquid glass.
*Mitame* (見た目) is Japanese for "the way it looks". Same code, new 見た目.

[mitame.dev](https://mitame.dev) · [Components](https://mitame.dev/docs/components/button) · [Themes](https://mitame.dev/themes)

[![CI](https://github.com/lazizbekravshanov/mitame/actions/workflows/ci.yml/badge.svg)](https://github.com/lazizbekravshanov/mitame/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)

</div>

```bash
npx mitame init
npx mitame add button dialog select
```

The source lands in your project and it's yours to edit. Nothing is hidden in `node_modules`.

## Why mitame

- **You own the code.** Components are copied into your repo, not installed as a dependency.
- **Nothing to install but React.** Menus, dialogs, popovers and tooltips are built on the browser's own `<dialog>`, the Popover API and real form inputs. No Radix, no Floating UI, no tailwind-merge.
- **Every era, one API.** Change `data-theme` and the same markup goes from Aqua gel to liquid glass. Light and dark come with each theme.
- **Phones are first class.** 44px touch targets, no iOS zoom on focus, no hover stuck after a tap.
- **Designed in Figma, generated into code.** Tokens and icons come from a Figma file, so the design and the CSS can't drift apart.

## Themes

| Era | Theme | Status |
|---|---|---|
| **Y2K** · 2000 to 2012 | `aqua` — gel buttons, pinstripes, the blue ⇅ popup button, midnight dark mode | ✅ default |
| **Now** · 2025 and later | `liquid` — frosted glass, rim light, deep soft shadows | ✅ |
| **Vintage** · 1984 to 1999 | `platinum`, `system` — gray bevels and 1-bit black and white | next |
| **Y2K** | `aero` — frosted Frutiger Aero glass | planned |
| **Remix** | `blend` — old structure on new material | planned |

## Quick start

**1. Initialize.** Writes `mitame.json` and copies the helpers and theme CSS.

```bash
npx mitame init                  # aqua, the default
npx mitame init --theme liquid   # or liquid glass
```

**2. Import the styles once,** in your global CSS:

```css
@import "./components/mitame/themes/base.css";
@import "./components/mitame/themes/y2k/aqua.css";

/* Using Tailwind v4? Add the bridge for bg-mi-accent, rounded-mi-lg, ... */
@import "tailwindcss";
@import "./components/mitame/themes/tailwind.css";
```

**3. Pick the era:**

```html
<html data-theme="aqua">                    <!-- follows the device light/dark -->
<html data-theme="aqua" data-mode="light">  <!-- always light, strict 2001 -->
<html data-theme="liquid" data-mode="dark"> <!-- always dark -->
```

**4. Add components and use them:**

```bash
npx mitame add button dialog select
npx mitame list   # everything you can add
```

```tsx
import { Button } from "@/components/mitame/ui/button";

<Button variant="primary">Save</Button>;
```

`add` follows imports, so `select` also brings the hooks and icons it needs. Files you already have are kept, and `--overwrite` replaces only what you name.

## Components

Button · Card · TextField · Checkbox · Switch · Slider · Select · Tabs · Menu · Dialog · Popover · Tooltip · Toast, plus 14 icons.

Each one has a page on [mitame.dev](https://mitame.dev/docs/components/button) with a live demo you can switch between eras, the source, props and keyboard shortcuts.

## Customizing

- **Edit the file.** It's in your repo now.
- **Override with classes.** Theme styles live in `@layer components`, so any class you pass wins without `!important`.
- **Target slots.** Every part has a `data-slot` (`select-trigger`, `menu-item`, `dialog-panel`…) and state attributes (`data-state`, `data-variant`, `data-size`).
- **Change tokens.** Colors, glass, radius, spacing and motion are CSS variables:

```css
[data-theme="aqua"] {
  --mi-accent: #e8559b;
  --mi-radius-lg: 16px;
}
```

## Requirements

React 19, and Chrome/Edge 114+, Safari 17+ or Firefox 125+ (the Popover API). Tailwind is optional. Web only.

## Design source: Figma

Tokens and icons live in a Figma file (one variable collection per theme, plus an icon page) and are generated into code:

1. Pull with `scripts/figma/export.js` (through the Figma MCP or a plugin console) into `tokens/*.json` and `icons/svg/*.svg`.
2. `npm run tokens` → `registry/themes/<era>/<theme>.tokens.css`
3. `npm run icons` → `registry/icons/*.tsx`

CI fails if the generated files drift from the Figma exports.

## Develop

```bash
npm install
npm run site:dev   # the docs website, http://localhost:4321
npm run dev        # playground with every component, http://localhost:5173
npm test           # components, CLI and generators
npm run typecheck
npm run build      # builds the CLI into dist/cli
```

```
registry/   what users can add: ui/, hooks/, lib/, icons/, themes/
cli/        the mitame command (init, add, list)
site/       the docs website (Astro), deployed on Vercel
tokens/     design tokens pulled from Figma
icons/svg/  icons pulled from Figma
scripts/    token and icon generators, Figma export script
playground/ local showcase, not shipped
docs/specs/ design decisions
```

## Roadmap

- Vintage era: `platinum` and 1-bit `system`
- Page templates (sign in, pricing, dashboard) in every era
- A registry endpoint so the shadcn CLI can install mitame components
- Figma Code Connect

## License

MIT
