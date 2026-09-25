# Reddit

## r/reactjs

**Title:** I built a copy-paste React component library with era themes: Mac OS 8, 2001 Aqua, and 2026 liquid glass

**Body:**

Every app I loved as a kid looked better than what I build today, so I made mitame: copy-paste React components where the same code can wear any era.

Three themes ship now:
- Vintage platinum (Mac OS 8/9 gray, bevels, square corners)
- Y2K aqua (gel buttons, pinstripes, the blue popup arrows)
- Now liquid (frosted glass, rim light)

You change `data-theme` and everything restyles. The markup never changes.

Technically the part that may interest this sub: there are no runtime dependencies besides React. Dialog is the native `<dialog>`, Menu, Select, Popover and Tooltip use the Popover API and the browser's top layer, and every input is a real form input. That means focus trapping, Escape, light dismiss and keyboard behavior come from the platform instead of from my code.

Two React 19 gotchas I hit while building it, in case they save someone time:
- React 19 will not patch attribute mismatches during hydration ("this won't be patched up"), so anything reading localStorage or the DOM during render keeps a stale value in the DOM. Render the server value, sync in an effect.
- If a button has `popovertarget` in server HTML, clicking it before hydration opens the popover unpositioned, because your positioning hook has not run. Withhold the attribute until mounted.

Components are copied into your project with `npx @lazizbekio/mitame add dialog`, so you own and can edit the source. MIT, React 19.

mitame.dev

Happy to answer anything about the theming approach, and I am curious which era people want next. 1-bit black and white is what I am leaning toward.

## r/webdev

Same as above, but swap the React 19 gotchas section for this:

Everything is CSS-driven: components expose `data-slot` hooks and state attributes, and a theme is a single CSS file that styles them. Adding an era means writing CSS, not touching components. Tokens live in Figma and are generated into CSS variables, so design and code cannot drift.
