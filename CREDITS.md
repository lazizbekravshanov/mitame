# Credits

mitame ships its own code. Nothing in this repository is copied from another project. What follows is what mitame drew on, what that use actually is, and what licence each source carries. Every licence below was read from the project's own licence file, not from a badge.

## Colour

**[nippon-colors](https://github.com/syaning/nippon-colors)** — MIT, Copyright (c) 2016 Alex Sun.

The `sumi` theme is built on traditional Japanese colour names (dentou-iro). The eight values it uses were cross-checked against this dataset: shironeri 白練 `#FCFAF2`, sumi 墨 `#1C1C1C`, dobunezumi 溝鼠 `#4F4F48`, ai 藍 `#0D5661`, suoh 蘇芳 `#8E354A`, chitosemidori 千歳緑 `#36563C`, mirucha 海松茶 `#62592C`, kurotsurubami 黒橡 `#0B1013`, and for the seal, ginshu 銀朱 `#C73E3A` in light and araishu 洗朱 `#FB966E` in dark.

mitame does not redistribute the dataset. A colour name paired with a hex value is a fact, and nine facts are not a compilation, so no licence obligation attaches. The credit is here because the work of assembling it was real and because it should be verifiable.

Worth recording, since it is the kind of thing that gets missed: every open dataset of these colours traces back to [nipponcolors.com](http://nipponcolors.com/), which publishes no licence of its own. An MIT licence applied downstream does not create a permission upstream. That is why mitame takes a handful of values and not the file.

## Patterns

The seigaiha (青海波) in the `sumi` dialog backdrop is written from scratch in CSS, as two offset radial gradients. The wagara motifs themselves — seigaiha, asanoha, ichimatsu, kikkō — are centuries old and belong to nobody, but a particular drawing of one is a work with its own copyright, so mitame drew its own rather than take one.

Two openly licensed collections were read as background on the hard-stop gradient technique, and nothing was copied from either: **[css3patterns](https://github.com/LeaVerou/css3patterns)** (MIT, Copyright (c) 2011 Lea Verou) and **[CSS-Pattern](https://github.com/Afif13/CSS-Pattern)** (MIT, Copyright (c) 2022 Temani Afif).

Hero Patterns was considered and rejected: its repository ships no licence file, so despite what the site says, nothing is granted.

## Typefaces

mitame ships no font files. Its themes name families in a CSS stack and fall back to the system, which is not distribution and carries no obligation. The open families it names, for the record:

- **[Inter](https://github.com/rsms/inter)** — OFL-1.1, Copyright (c) 2016 The Inter Project Authors. No Reserved Font Name.
- **[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono)** — OFL-1.1, Copyright 2020 The JetBrains Mono Project Authors. No Reserved Font Name.
- **Archivo** and **Newsreader**, loaded by the docs site from Google Fonts, both OFL-1.1.

Several themes also name proprietary system faces (Chicago, Geneva, Monaco, Lucida Grande, Segoe UI, Consolas) as period-correct first choices. Those are names in a fallback stack, nothing more, and every stack ends in an open or generic family.

## Conventions mitame conforms to

- The **shadcn registry format** (`registry.json`, `registry-item.json`), MIT, so `npx shadcn@latest add` can install mitame. mitame writes its own file against the published schema.
- **[llms.txt](https://llmstxt.org)** and **AGENTS.md**, both conventions rather than code.
- The **W3C WAI-ARIA Authoring Practices** are the reference for every component's keyboard behaviour. The APG repository carries no licence, so mitame implements the patterns it describes and copies none of its text or code.

## Everything else

React is the only runtime dependency, and everything under `registry/` is mitame's own work, MIT licensed. See [LICENSE](LICENSE).
