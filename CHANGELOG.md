# Changelog

## 0.2.0

This release makes the npm package carry what a coding agent actually needs, and lands a round of accessibility fixes found by building real apps with mitame.

In the package

- Markdown docs for every component, plus an llms.txt index, now ship inside the package at `dist/docs`. They are the same documents the site serves, so an agent working from node_modules reads them from disk instead of fetching the web or guessing from source.
- The `mcp` subcommand now ships. `.mcp.json` has advertised `npx @lazizbekio/mitame mcp` for a while, but the server landed after 0.1.1 was published, so the npm package did not have it. Now it does.
- The contrast claim in llms.txt states the measured numbers from the checker at build time, scoped to what it checks, instead of a sentence that could quietly go stale.
- This changelog, so the next bump explains itself.

Fixes in this release

- A toast fired while a modal dialog is open now lands inside the dialog, so it is never inert and can always be dismissed.
- The select trigger announces its label together with the chosen value, so the accessible name no longer erases what is selected.
- Slots that set a width plus padding now size border-box, and the switch and checkbox draw correctly in Windows forced colors mode.
- Themes that paint focus as a ring keep a visible outline in forced colors, where rings do not survive.
- The contrast checker now measures switch and form control boundaries at 3:1 per WCAG 1.4.11, and the themes that failed are fixed.
- Webkit prefixed properties sit before their standard form, so the CSS minifier keeps both.

Landed on main since 0.1.1 shipped

- Focus and contrast fixes across every theme, checked in CI against what the CSS really paints, including focused rows and the gel themes.
- The minimal theme is retired. If you want quiet, sumi is the one.
