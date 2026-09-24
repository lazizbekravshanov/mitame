# mitame 見た目

Old UI, brought back to life with cool minimalism.

*mitame* (見た目) is Japanese for "the way it looks". Same code, new 見た目.

mitame is a copy-paste React component library for the web with **era themes**. You run one command, the component's source lands in your project, and it's yours to change. No runtime dependencies besides React: menus, dialogs, popovers and tooltips are built on the browser's own `<dialog>` and Popover API.

| Era | Themes | Status |
|---|---|---|
| **Y2K** (2000 to 2012) | `aqua` ⭐ default (gel, pinstripes, midnight dark mode) | ✅ |
| **Y2K** (2000 to 2012) | `aero` | next |
| **Now** (2025+) | `liquid` (liquid glass) | ✅ |
| **Vintage** (1984 to 1999) | `platinum`, `system` | planned |
| **Remix** | `blend` (old structure, new glass) | planned |

## Quick start

```bash
npx mitame init             # writes mitame.json, copies cn + theme css (aqua)
npx mitame init --theme liquid
npx mitame add button card dialog
npx mitame list             # everything you can add
```

Then import the styles once and pick a theme:

```css
@import "./components/mitame/themes/base.css";
@import "./components/mitame/themes/y2k/aqua.css";
/* Tailwind v4? also: @import "./components/mitame/themes/tailwind.css"; */
```

```html
<html data-theme="aqua">                   <!-- follows the OS light/dark -->
<html data-theme="aqua" data-mode="light">  <!-- strict 2001: always light -->
<html data-theme="liquid" data-mode="dark">
```

```tsx
import { Button } from "@/components/mitame/ui/button";

<Button variant="primary">Save</Button>
```

## Components (v1)

Button · TextField · Checkbox · Switch · Slider · Select · Tabs · Menu · Dialog · Popover · Tooltip · Toast · Card, plus 14 icons.

## Mobile and touch

Built for phones as much as laptops:

- **44px touch targets** on touch screens. Controls keep their look; an invisible hit area grows around small buttons, tabs and close buttons. List items, fields, checkboxes and switches grow to 44px.
- **No iOS zoom on focus**: fields use 16px text on touch devices.
- **Hover effects only on real pointers**, so taps never leave a button stuck in its hover state.
- **Tooltips**: hover (mouse), keyboard focus, or long press (touch). Don't put anything only in a tooltip.
- Dialogs lock page scroll; toasts span the screen on phones; menus and lists don't scroll the page behind them.

## Browser support

Chrome and Edge 114+, Safari 17+, Firefox 125+ (all released by spring 2024). mitame relies on the Popover API and `<dialog>`; open/close animations use `@starting-style` and simply skip on browsers without it.

## Customizing

- **Edit the file.** It's in your repo now.
- **Override with classes.** Theme styles live in `@layer components`, so any class you pass (Tailwind or your own) wins. No tailwind-merge needed.
- **Target slots.** Every part has a `data-slot` (`select-trigger`, `menu-item`, `dialog-panel`…) and state attributes (`data-state`, `data-variant`, `data-size`), so you can restyle from CSS.
- **Change tokens.** Colors, glass, radius and spacing are CSS variables (`--mi-accent`, `--mi-glass-blur`…).

## Design source: Figma

Tokens and icons are designed in the [mitame Figma file](https://www.figma.com/design/8SPBcOobbk0U7U0uV01I2C) (one variable collection per theme: `aqua`, `liquid`; page `Icons`) and generated into code:

1. Pull with `scripts/figma/export.js` (via the Figma MCP or a plugin console) into `tokens/*.json` and `icons/svg/*.svg`.
2. `npm run tokens` → `registry/themes/<era>/<theme>.tokens.css`
3. `npm run icons` → `registry/icons/*.tsx`

## Develop

```bash
npm install
npm run site:dev   # the docs website, http://localhost:4321
npm run dev        # playground with every component, http://localhost:5173
npm test           # vitest: components, CLI, generators
npm run typecheck
npm run build      # builds the CLI into dist/cli
```

```
registry/   what users can add: ui/, hooks/, lib/, icons/, themes/
cli/        the mitame command (init, add, list)
tokens/     design tokens pulled from Figma
icons/svg/  icons pulled from Figma
scripts/    token + icon generators, Figma export script
site/       the docs website (Astro), deployed on Vercel
playground/ local showcase, not shipped
docs/specs/ design decisions
```

## License

MIT
