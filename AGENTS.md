# Working on mitame

mitame (見た目, "the way it looks") is a copy-paste React component library. Users do not install a package and import from it: they run a CLI that copies the source into their project, and from then on the files are theirs. Everything below follows from that.

## What the project is

- 13 components in `registry/ui`, 3 page blocks in `registry/blocks`, 11 themes in `registry/themes`.
- No runtime dependencies besides React. Dialogs use the native `<dialog>`, menus and popovers use the Popover API, form controls are real form controls. If a feature needs a dependency, that is a reason to think harder, not to add one.
- The code a user copies is the documentation. Write it the way you would want to read it in someone else's repository.

## Run these before you claim anything works

```bash
npx tsc --noEmit        # types
npx vitest run          # 85 tests, including the contrast checker
npm run site:build      # the docs site, 48 pages
```

`npm test` runs the contrast checker as a test, so a theme change that fails WCAG AA fails the build. `node scripts/contrast.ts` prints the same report with sources, and `--all` adds the values it could not resolve.

## The layering contract

`registry/themes/base.css` owns structure: layout, sizing, states, touch targets. A theme owns material: colour, glass, shadows, motion. When a theme sets a height or a padding, that is usually a bug, because the next theme will not.

Everything sits in `@layer components`, so a user's own classes and any Tailwind utility win without `!important` and without `tailwind-merge`. A stylesheet that a component can import must declare the layer order itself (`@layer theme, base, components, utilities;`), because it can be injected before `base.css` and whichever stylesheet loads first decides the order. There is a test for that.

Themes use `:where([data-theme="x"])`, which has zero specificity, so base wins ties. Where base has to win outright (touch targets), its selectors are prefixed with `[data-theme]`.

## Generated files

Do not hand-edit these. Change the source and run the generator:

| Generated | From | Command |
|---|---|---|
| `registry/themes/**/*.tokens.css` | `tokens/*.json` (designed in Figma) | `npm run tokens` |
| `registry/icons/*.tsx` | `icons/svg/*.svg` | `npm run icons` |
| `registry.json` | the registry itself | `npm run registry` |

Each has a test that fails when the committed output drifts from its source.

## Colour

Token values come from Figma, so a colour fix belongs in `tokens/<theme>.json`, not in the CSS, unless what is wrong is the CSS (a gloss over a label, an ink that should not be that token at all).

Before changing a colour to satisfy the contrast checker, read what the checker is actually measuring. It reads the shipped CSS and reports the rule behind every pair. A status token used as a flat fill with black ink is not body text, and darkening it to satisfy a pair the theme never paints damages the design for nothing. That mistake has already been made once here.

## Components

- Spread `{...props}` **before** your own handlers, then call the caller's handler first and respect `e.defaultPrevented`. Props spread after a handler silently replace it.
- Every interactive part gets a `data-slot`, and stateful parts get `data-state`, `data-variant` or `data-size`. Themes and users style through those, never through class names.
- Keyboard behaviour follows the ARIA Authoring Practices pattern for that widget. A control that takes focus needs a visible focus indicator: `outline: none` with nothing in its place is a bug, in every theme.
- Server rendering matters: the docs site renders every component on the server. Anything that reads the DOM or depends on `useId` wiring must be gated on mount, and a hydration mismatch is a defect, not a warning.

## House style

Plain, simple prose in comments and docs. No dashes as punctuation. A comment says why, not what. Match the density of the file you are in, and do not reformat lines you did not change.

## Using mitame from another project

```bash
npx @lazizbekio/mitame init          # config plus base CSS and a theme
npx @lazizbekio/mitame add button    # a component and everything it imports
npx @lazizbekio/mitame list          # everything available
```

Or through the shadcn CLI, which reads `registry.json` from this repository:

```bash
npx shadcn@latest add lazizbekravshanov/mitame/button
npx shadcn@latest add lazizbekravshanov/mitame/theme-aqua
```

That path needs an existing `components.json` in the target project. `https://mitame.dev/llms.txt` is the machine-readable index of the docs.
