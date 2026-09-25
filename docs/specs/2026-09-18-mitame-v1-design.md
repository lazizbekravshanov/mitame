# mitame v1 design

Date: 2026-09-18
Status: six themes built. Eras: `y2k/aqua` (default), `now/liquid`, `vintage/platinum`. Styles: `styles/brutalist`, `styles/minimal`, `styles/urban`.

## What mitame is

A copy-paste React component library for the web that brings old UI back to life with cool minimalism. Every component comes in era themes, from 1984 Mac to 2026 liquid glass. People run `npx @lazizbekio/mitame add button` and the source lands in their project, so they own it and can change anything. Lighter than shadcn: zero runtime dependencies besides React.

## Decisions

| Topic | Decision |
|---|---|
| Delivery | Copy-paste CLI. The only thing on npm is the `mitame` CLI, which carries the registry inside it (works offline, no server). |
| Stack | React 19, TypeScript, Tailwind CSS v4 friendly (Tailwind is optional). |
| Themes | One set of components, many themes. A theme is a CSS file keyed by `[data-theme="<name>"]` that styles components through `data-slot` hooks. |
| Shelves | **Eras** (Vintage, Y2K, Now) are looks that existed. **Styles** (brutalist, minimal, urban) are looks that never belonged to a decade. Same theme system, one folder each: `registry/themes/styles/`. |
| Theme roadmap (done) | v1: `now/liquid`. Then `y2k/aqua` (becomes the default once it ships), `vintage/platinum`, `remix/blend`. Later: `vintage/system`, `y2k/aero`. |
| v1 components | Button, TextField, Checkbox, Switch, Slider, Select, Tabs, Menu, Dialog, Popover, Tooltip, Toast, Card. |
| Behavior | Native platform first: `<dialog>`, the Popover API (top layer, light dismiss), native checkbox/range inputs. Small in-house hooks fill gaps (positioning, roving focus, typeahead). No Radix, no Floating UI. |
| Styling | Theme CSS lives in `@layer components`. User Tailwind classes land in `@layer utilities` and always win, so no tailwind-merge is needed. `cn()` just joins class names. |
| Figma | Figma owns tokens (variables) and icons. They export to `tokens/*.json` and `icons/svg/*.svg`, and scripts generate theme CSS variables and React icon components. Code Connect / a Figma component library comes after v1. |

## Repo layout

```
registry/                 source of everything users can add
  lib/cn.ts, lib/refs.ts
  hooks/                  use-anchor-position, use-list-navigation, use-controllable, use-popover
  icons/                  generated from icons/svg
  ui/                     one file per component
  themes/base.css         structure shared by every theme (layout, sizing, states)
  themes/tailwind.css     optional Tailwind v4 bridge (@theme inline)
  themes/now/liquid.css   hand written material, @imports liquid.tokens.css
  themes/now/liquid.tokens.css   generated from tokens/liquid.json
cli/                      the `mitame` bin (init, add, list)
tokens/liquid.json        exported from Figma variables
icons/svg/                exported from Figma icon components
scripts/                  build-tokens, build-icons
playground/               local showcase of every component on a wallpaper
tests/
```

The old Vite library build from the skeleton is removed; the package ships `dist/cli` plus `registry/`.

## CLI

- `npx @lazizbekio/mitame init`: writes `mitame.json` (`{ "dir": "src/components/mitame", "theme": "liquid" }`), copies `lib/cn.ts`, `themes/base.css`, `themes/tailwind.css` and the chosen theme.
- `npx @lazizbekio/mitame add <item...>`: dependencies are not declared anywhere; the CLI follows each file's relative imports (and CSS `@import`s) through the registry, so `select` pulls `hooks/use-anchor-position`, `icons/chevron-down` and the rest automatically. Files keep the `ui/ lib/ hooks/ icons/ themes/` structure so relative imports just work. Existing files are skipped; `--overwrite` replaces only the items you named, never shared deps you may have edited.
- `npx @lazizbekio/mitame list`: prints items grouped by kind.

The user imports the CSS once: `@import "./components/mitame/themes/base.css"; @import "./components/mitame/themes/now/liquid.css";` and sets `data-theme="liquid"` on `<html>` or any subtree.

## Theme contract

Every component part has `data-slot="<component>-<part>"` and state as data attributes (`data-state`, `data-disabled`, `data-variant`, `data-size`). Themes only target those. Tokens are CSS variables prefixed `--mi-`:

- color: `bg`, `fg`, `fg-muted`, `accent`, `accent-fg`, `danger`, `success`, `warning`, `border`
- glass: `glass-tint`, `glass-tint-strong`, `glass-blur`, `glass-saturate`, `glass-highlight`, `glass-edge`, `glass-shadow`
- shape: `radius-sm`, `radius-md`, `radius-lg`, `radius-full`
- space: `space-1` to `space-8`
- type: `font-sans`, `font-mono`, `text-xs` to `text-lg`
- motion: `ease`, `duration-fast`, `duration`

Light and dark both ship; dark follows `prefers-color-scheme` unless `data-mode="light|dark"` is set.

## Component notes

- **Button**: variants `primary | secondary | ghost | danger`, sizes `sm | md | lg`. Native `<button>`, `type="button"` by default.
- **TextField**: label, description, error, optional leading icon; wires `aria-describedby` and `aria-invalid`.
- **Checkbox**: native input (supports `indeterminate`), custom visual.
- **Switch**: native checkbox with `role="switch"`.
- **Slider**: native range input, fill via a `--mi-slider-fill` custom property.
- **Select**: button + listbox in a popover. Keyboard: arrows, Home/End, typeahead, Enter/Space, Escape. Hidden input for forms. Controlled or uncontrolled.
- **Tabs**: segmented control style; roving focus, arrows move and activate.
- **Menu**: trigger + popover dropdown, `menuitem` roles, roving focus, typeahead, closes on select.
- **Dialog**: native `<dialog>` with `showModal()`; Escape and backdrop click close; returns focus.
- **Popover**: Popover API, positioned by `useAnchorPosition` (flip + shift inside viewport).
- **Tooltip**: `popover="manual"`, opened on hover (after a delay) and focus (right away), closed on leave, blur and Escape.
- **Toast**: `toast()` function plus `<Toaster />` region (`aria-live="polite"`), auto dismiss, pause on hover.
- **Card**: the glass surface, with header, title, description, body, footer parts.

## Aqua (y2k/aqua)

Gel material on buttons, select, tabs, checkbox and switch (a gloss layer, a bottom glow and a `--mi-tone` color, so one rule recolors any gel). Pinstripes under frosted glass on cards, dialogs and popovers. Select gets the blue ⇅ popup cap from CSS (the component's chevron is hidden). Pale yellow help tag tooltips, smoky dark toasts, a red gel close light on dialogs, blue glow focus ring. Dark mode is "midnight aqua" (graphite gel, dimmer pinstripes, same blue); `data-mode="light"` gives strict 2001 light only. Tokens: Figma collection `aqua` with Light and Dark modes, same names as `liquid` (a test enforces the contract).

## Platinum (vintage/platinum)

Mac OS 8 and 9: flat gray, 1px black outlines, raised (`--mi-raised`) and sunken (`--mi-sunken`) bevels instead of shadows, a hard 2px drop shadow, square corners everywhere (all radius tokens are 0) and `transition: none` (both motion tokens are 0). Select gets a black triangle, Tabs become file folder tabs on a panel edge, the switch is a sunken track with a raised square thumb, tooltips are Balloon Help yellow. Dark mode is "graphite". Tokens: Figma collection `platinum`, Light and Graphite modes.

## Server rendering

Two rules the components and the site follow, both learned from real bugs:

- **Triggers withhold `popoverTarget` until mounted** (`hooks/use-mounted.ts`). Before hydration the browser would happily open the popover through the native invoker, unpositioned in the page corner, because the positioning hook had not run yet.
- **Anything reading browser state renders the server value first.** React 19 does not patch attribute mismatches during hydration ("this won't be patched up"), so a theme switcher that read `data-theme` during hydration kept a stale selection. The site's `useTheme` returns a fixed default and syncs in an effect.

## Styles (styles/brutalist, styles/minimal, styles/urban)

- **brutalist**: 3px outlines, 4 to 6px hard offset shadows, radius 0 everywhere, flat accent fills, uppercase labels. Pressing a button translates it into its own shadow. Danger toasts flip the whole surface to the danger color.
- **minimal**: hairline borders, no shadows except a faint lift on floating surfaces, inputs are an underline, tabs are an underline, the accent is the ink color itself. Motion is a short fade, nothing moves.
- **urban**: near black surfaces with a scanline grain, one acid accent (`#BEFF00`) that also glows on primary buttons and the checked switch, heavy uppercase type, mono sticker labels. Light mode is the daylight version of the same kit.

`brutalist` and `urban` name Archivo as their font, `minimal` names Inter. Themes only suggest a family through `--mi-font-sans`; loading it is the user's job.

## Blocks

Whole pages (`registry/blocks/`): `sign-in`, `pricing`, `dashboard`. Each is one default-exported component built only from mitame components, with layout in a shared `blocks.css` that uses tokens only, so blocks need no utility framework. `npx @lazizbekio/mitame add dashboard` pulls the block, `blocks.css` and every component, hook and icon it imports.

`blocks.css` repeats the `@layer theme, base, components, utilities;` statement from `base.css`, because a block imports it from TypeScript and a bundler can inject it first. Whichever stylesheet names the layers first sets their order for the page, and without this a reset like Tailwind preflight outranks the theme layer. A test enforces it for every CSS file reachable from code.

## Mobile and touch

- `@media (pointer: coarse)`: 44px hit areas (an invisible `::after` on small controls, real min-heights on list items, fields, checkboxes, switches), 16px field text so iOS does not zoom, bigger slider thumb.
- `:hover` styles live inside `@media (hover: hover)`. Menu and listbox items take focus on mouse move (`lib/pointer-focus.ts`), so `:focus` is the single highlight for mouse and keyboard.
- Tooltip: mouse hover, keyboard focus (`:focus-visible` only, so taps do not open it), touch long press (500ms) that hides 1.5s after release.
- Dialog locks page scroll (`:root:has(dialog[open])`); toasts go full width under 480px; dialog footers stack.

## Browser support

Chrome/Edge 114+, Safari 17+, Firefox 125+ (Popover API baseline). Animations use `@starting-style` and degrade to instant.

## Icons (v1)

check, chevron-down, chevron-up, chevron-right, close, plus, minus, search, more, info, success, warning, error, dot. 16px grid, 1.5px strokes, round caps, `currentColor`.

## Testing

Vitest + Testing Library in jsdom for behavior and a11y wiring of every component; unit tests for the CLI (dependency resolution, copying, skip/overwrite) and the token/icon generators. jsdom lacks the Popover API and `showModal`, so tests stub those. Visual check in the playground in a real browser.

## Out of scope for v1

Other themes, Code Connect, desktop app patterns (right click context menus, keyboard shortcut hints, windows, menu bars, docks; mitame is web only), a docs website, RTL polish, form library integrations, nesting different themes inside each other (selectors are scoped with `:where([data-theme])` today; `@scope` can fence themes later).
