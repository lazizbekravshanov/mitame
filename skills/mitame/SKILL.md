---
name: mitame
description: Use when adding, styling or theming UI with mitame (見た目), the copy-paste React component library, or when a project contains mitame.json or a components/mitame directory. Covers installing components, the CSS import order, the data-slot styling contract and the 18 themes.
---

# mitame

mitame is copy-paste, not a package. A CLI writes source files into the project and the project owns them from then on. There is nothing to import from `node_modules`, no runtime dependency to add, and no version to keep in step.

That single fact is what agents get wrong, so check it first: if the project has a `mitame.json`, the components are already somewhere like `src/components/mitame`, and the import is a path into the project, not a package name.

## Installing

```bash
npx @lazizbekio/mitame init                 # writes mitame.json, base CSS, one theme
npx @lazizbekio/mitame init --theme sumi    # pick the theme up front
npx @lazizbekio/mitame add button dialog    # a component and everything it imports
npx @lazizbekio/mitame list                 # every component, block, hook, icon, theme
```

`add` follows imports, so asking for `select` also brings the hooks and icons it needs. Files that already exist are kept, and `--overwrite` replaces only what you named, never a shared helper the user may have edited.

In a project that already uses the shadcn CLI, `npx shadcn@latest add lazizbekravshanov/mitame/button` installs into the same tree.

If the mitame MCP server is connected, prefer its tools: `list_items`, `get_item` (source plus props and keyboard), `add_items`, `init_project`, `get_theme`. `get_item` returns the real file, which is always better than recalling an API.

## The three rules that break a project when missed

**1. Import the CSS once, in order.** In the global stylesheet, base first and then exactly one theme:

```css
@import "./components/mitame/themes/base.css";
@import "./components/mitame/themes/y2k/aqua.css";
```

Without it every component renders as unstyled HTML. Paths are relative to the stylesheet doing the importing, so adjust the depth if it is nested. With Tailwind, add `@import "./components/mitame/themes/tailwind.css";` after `tailwindcss` to get `bg-mi-accent` and friends.

**2. Turn the theme on.** `<html data-theme="aqua">`. Add `data-mode="light"` or `data-mode="dark"` to force a mode; leave it off to follow the device.

**3. The `@/` alias is the project's job.** mitame never edits `tsconfig.json`. Either the project already maps `"@/*": ["./src/*"]`, or import with relative paths.

## Styling

Style through attributes and custom properties, never by guessing class names:

- `data-slot` names every part: `[data-slot="dialog-panel"]`, `[data-slot="field-input"]`, `[data-slot="toast-action"]`.
- `data-variant`, `data-size` and `data-state` carry the state: `[data-state="active"]`, `[data-variant="danger"]`.
- `--mi-*` custom properties hold the tokens: `--mi-accent`, `--mi-fg-muted`, `--mi-space-4`, `--mi-radius-lg`.

mitame's own CSS lives in `@layer components`, so a plain class or a Tailwind utility on a component already wins with no `!important`. **Do not add `tailwind-merge`.** It solves a problem this library does not have.

To restyle one component everywhere, write a rule against its slot. To restyle one instance, pass `className`.

## Themes

18 of them, in two shelves. Eras are looks that existed: `system` (1984), `bevel` (1995), `platinum` (1997), `aqua` (2001), `aero` (2009), `linen` (2012), `liquid` (2026). Styles are looks that are just looks: `brutalist`, `minimal`, `urban`, `paper`, `terminal`, `neon`, `sumi`, `pixel`, `clay`, `blueprint`, `notebook`.

Switching is one attribute plus one import. Every component works in every theme, because a theme only supplies material and never structure.

## When changing mitame's own source

The files belong to the project, so editing them is expected and fine. Two things to keep:

- Keep the `data-slot` attributes. They are what the theme CSS targets, and removing one silently unstyles that part.
- Components spread `{...props}` before their own handlers and respect `e.defaultPrevented`, so a caller can add behaviour without replacing it. Keep that order when editing.

## Accessibility

Every component follows the ARIA Authoring Practices pattern for its widget, and the themes are checked against WCAG AA in both modes on every build. Two things to preserve when editing: a control that takes focus needs a visible focus indicator, and state must never be carried by colour alone.

## Where the rest is

- `https://mitame.dev/llms.txt` is the machine readable index of the docs.
- `https://mitame.dev/docs/components/<name>.md` is a plain markdown version of any component page.
- `registry/meta.json` in the package holds every component's props and keyboard map as data.
