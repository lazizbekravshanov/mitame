# Show HN

## Title

`Show HN: Mitame – React components that wear any era, from 1997 to 2026`

## Body

I built a copy-paste React component library where the same components can render as Mac OS 8 Platinum gray, 2001 Aqua gel, or 2026 liquid glass. You switch with one attribute and your markup does not change.

Two decisions shaped it:

1. Zero runtime dependencies besides React. Dialogs use the native `<dialog>` element, menus and popovers use the Popover API and the top layer, inputs are real form inputs. Focus trapping, Escape handling and light dismiss come from the browser, so there is much less of my code to get wrong. The whole published package is 30 kB.

2. Themes are CSS only. Components expose `data-slot` hooks and state attributes, and a theme is one CSS file that styles those. Adding an era means writing CSS, not touching components. Styles live in `@layer components`, so any class a user passes wins without `!important` and there is no need for tailwind-merge.

Tokens and icons are designed in Figma and generated into CSS variables and React icon files. CI fails if the generated files drift from the Figma exports.

Things I learned that might be useful to others:

- React 19 does not patch attribute mismatches during hydration. A theme switcher that reads the saved theme while hydrating will keep a stale selection. Render the server value, then sync in an effect.
- If a trigger carries `popovertarget` before hydration, a click opens the popover with nothing to position it, so it lands in the page corner. Withhold the attribute until mounted.
- `@starting-style` plus `transition-behavior: allow-discrete` gives real enter and exit animations for top layer elements, no JS.

It is MIT. 13 components today, more eras coming.

mitame.dev
