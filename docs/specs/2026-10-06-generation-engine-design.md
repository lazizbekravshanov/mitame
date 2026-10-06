# mitame generation engine

Date: 2026-10-06
Status: design approved, not yet implemented.

## Why this exists

mitame is pivoting from a copy-paste component library into a vibe coding tool: signed-up users describe a frontend in chat, watch it build beside them, and iterate by talking to it. The library is not retired by this pivot, it becomes the engine. The 17 themes and the component registry are the only vocabulary the generator can speak, so output is on-theme and WCAG-checked by construction rather than by review.

That is the whole bet. Lovable, v0 and bolt all let a model write free-form JSX, which is why work from those tools has a recognisable sameness and why their iteration is slow and forgetful. mitame can make the vocabulary small, closed and already correct, and spend the effort on making it rich enough to be worth using.

This document specifies the **generation engine** only: the first of five sub-projects, and the one that sets the product's quality ceiling.

## The approved brief

| Question | Decision |
|---|---|
| What is the design system to the tool | The engine. The tool only generates in mitame's vocabulary. |
| Who is it for | A real product strangers use, launching **approved users only**, so abuse handling and quotas move to a later sub-project. |
| How does a user work | Chat plus live preview, with the generated source readable below it. |
| What do they walk away with | A hosted share link, and the real mitame source, downloadable at any time. |
| What is generated | Frontends only. No database, no auth, no server routes for the user's project. |
| What is a project | A page or a handful of pages, not an application. |

## Scope

**In.** A pure function: prompt, theme and optional existing document in; a validated page document and the real mitame source it compiles to, out. Runs and is tested headlessly.

**Out, and specified elsewhere.** Preview and the chat loop (sub-project 2), accounts and persistence (3), publishing and hosting (4), rate limits, moderation and cost controls (5). No UI of any kind is in scope here.

## Architecture

### The document is the source of truth

Code is a build artifact, regenerated from the document on every change. The alternative, code as truth with the model reading it back each turn, is what the rest of the category does and it is why their iteration is expensive and forgetful.

The cost is stated plainly because users will hit it: **a user cannot hand-edit generated code and keep chatting.** Editing code means ejecting. They download the source, own it, and the conversation ends there. This is consistent with mitame's existing promise, where "the files are yours" has always meant yours to take.

What it buys: switching a whole page from `aqua` to `sumi` is one field, "make the hero taller" touches one node, and nothing the user did three turns ago is silently overwritten.

### Pipeline

| Stage | Model involved | Output |
|---|---|---|
| 1. Intake | no | Prompt, current document if iterating, theme |
| 2. Plan | **yes** | A whole document (first turn) or a patch (every turn after) |
| 3. Validate | no | Accepted document, or a typed error |
| 4. Emit | no | mitame source files |
| 5. Verify | no | Contrast report and typecheck result |
| 6. Return | no | Source files plus the document |

Stages 3 to 6 contain no model. Everything after planning is deterministic and reproducible, so a defect is a failing test rather than a vibe.

## The document schema

A page is a flat, ordered list of sections. Depth is capped at two, and the only nesting is the `split` shell described below.

```json
{
  "version": 1,
  "theme": { "name": "aqua", "mode": "auto", "accentHue": null },
  "page": { "measure": "page" },
  "meta": { "title": "Kestrel", "description": "Ship on Friday." },
  "sections": [
    {
      "id": "s_7f2a",
      "type": "site-header",
      "props": {
        "brand": "Kestrel",
        "links": ["Features", "Pricing", "Docs"],
        "action": { "label": "Start free", "variant": "primary" }
      }
    },
    {
      "id": "s_91c4",
      "type": "page-hero",
      "props": {
        "eyebrow": "Public beta",
        "headline": "Ship on Friday.",
        "body": [
          { "text": "Deploy previews for every branch, " },
          { "text": "in seconds", "em": true },
          { "text": "." }
        ],
        "actions": [
          { "label": "Start free", "variant": "primary" },
          { "label": "Read the docs", "variant": "secondary" }
        ],
        "align": "center",
        "media": null
      }
    }
  ]
}
```

### Rules

**No general tree.** A section may contain repeated typed *items*; a feature grid has features. Those are typed arrays inside props, never free children. A general tree rebuilds Webflow, loses the closed vocabulary, and gives the model somewhere to hide arbitrary layout.

**One exception, the `split` shell.** Exactly two named slots, each holding a list of sections, nesting capped at one level. A slot may not contain another `split`.

```json
{
  "id": "s_a1b2",
  "type": "split",
  "props": { "rail": "start", "railWidth": "narrow", "sticky": true },
  "slots": {
    "rail": [{ "id": "s_c3d4", "type": "row-list", "props": {} }],
    "main": [{ "id": "s_e5f6", "type": "content-card-grid", "props": {} }]
  }
}
```

`rail` is `"start"` or `"end"`, `railWidth` is `"narrow"` or `"wide"`, and `sticky` is a boolean.

This exists because a documentation home page is defined by having a rail beside content, and "two sections side by side" is not expressible in a flat list at any amount of prop richness. It is the smallest addition that covers docs rails, sidebars and split heroes while still being unable to express arbitrary layout.

**Stable ids.** Assigned on creation, never reused, never recycled after removal. Patches address `s_91c4`, never "the second section", because indices shift the moment anything is inserted and that is exactly how a tool edits the wrong thing.

**Content is structured, never markup.** Most props are plain strings. Fields that need emphasis or links take an array of runs: `{ text, em?, strong?, code?, href? }`. There is no HTML anywhere in a document, so there is no sanitiser to get wrong and nothing can carry a script tag through a headline.

**Images are references, never arbitrary URLs.** An image prop holds `{ assetId, alt, width, height }`. `alt` is required by the schema, not permitted by it. Until the asset sub-project exists, `assetId` may name a bundled placeholder set. A document may never carry a remote URL, which keeps the generator from hotlinking and keeps the emitted source self-contained.

**Versioning from the first document ever written.** Every document carries `version`. The loader migrates forward on read and the stored original is never mutated in place. Stored documents outlive schemas; this is the thing every comparable system reports regretting.

**Appearance is named, never specified.** No CSS, no class names, no style objects, no hex values. The entire surface is four fields:

| Field | Values |
|---|---|
| `theme.name` | one of the 17 theme ids |
| `theme.mode` | `"light"`, `"dark"`, or `"auto"` to follow the device |
| `theme.accentHue` | `null` to keep the theme's own accent, otherwise one of the precomputed hue steps under Theme surface |
| `page.measure` | `"narrow"` or `"page"` |

If it cannot be said as a section type or a typed prop, it cannot be said.

### Patch operations

Iteration emits patches, not documents. The operation set is closed:

```
setProp(sectionId, path, value)
insertSection(type, props, position)        // position: "start" | { afterId }
moveSection(sectionId, position)
removeSection(sectionId)
setTheme({ name?, mode?, accentHue? })
setPage({ measure? })
```

`setProp`'s `path` is not a free pointer. It names a prop on that section's own schema, optionally followed by an array index and one further key, so `headline` and `features.2.title` are legal and nothing deeper is. The validator resolves it against the section type's schema, so a path that type does not declare is rejected rather than quietly creating a field.

JSON Patch was rejected: arbitrary paths reintroduce exactly the freedom the architecture removes. These operations are validatable, map onto what users actually say, and make an undo stack nearly free.

`setPage` is the one operation beyond the five agreed during design. It follows directly from `page.measure`: without it, measure could be set when a page is created and never changed afterwards.

## The section vocabulary

Nineteen sections plus the `split` shell. Chosen for coverage across realistic page briefs rather than for ease of build.

| Section | Exists today | Notes |
|---|---|---|
| `site-header` | partial | In `landing.tsx`, hardcoded. Needs props and an href path, not only a dialog trigger. |
| `site-footer` | **no** | Absent from the library entirely. Needed by nearly every brief. |
| `page-hero` | partial | Centered only. Needs `align`, and `media` accepting an image or a code block. |
| `prose` | **no** | Long-form text. Blog posts, about pages, docs bodies. |
| `feature-grid` | partial | Needs `columns` as a prop; today it is `auto-fit` only. |
| `content-card-grid` | **no** | Cards whose primary element is an image. Blog indexes, work, topics. |
| `media-grid` | **no** | Requires the `Image` primitive. |
| `person-grid` | **no** | Speakers and teams. Requires `Image`, with a monogram fallback. |
| `logo-wall` | yes | Wordmarks in type, deliberately not images. |
| `stat-band` | yes | From `landing.tsx`. |
| `quote` | yes | Single quote today; needs a multi-quote variant. |
| `pricing-tiers` | yes | `pricing.tsx` already exposes a props interface. |
| `comparison-matrix` | **no** | Feature-by-feature table with products as columns. |
| `disclosure-list` | **no** | FAQ. No disclosure component exists. |
| `row-list` | partial | Exists inside `settings.tsx` as toggle rows; needs generalising. |
| `timeline` | **no** | Experience, changelog, schedule. |
| `code-block` | **no** | Also admissible as `page-hero.media`. |
| `form-panel` | partial | `sign-in.tsx` is close; needs arbitrary fields. |
| `cta-band` | yes | From `landing.tsx`. |
| `split` | **no** | The shell. |

**Deferred to v2, with reasons:** `gallery` with lightbox (interaction, not layout), `pagination` (needs multi-page projects), `tab-set` (a page-level tab is a routing question), `countdown` and `location-card` (single-brief long tail), `toc-aside` (derivable from `prose` headings later).

### The library prerequisite

The engine's first dependency is library work, not model work. Before the generator has anything worth saying, mitame needs:

1. An `Image` primitive owning aspect ratio, object fit, loading and decoding defaults, and a required `alt`. This is the single largest gap and it unlocks `media-grid`, `content-card-grid`, `person-grid` and `page-hero.media`.
2. Six new components: footer, prose, code-block, comparison-matrix, disclosure-list, timeline.
3. A props layer across the existing blocks. Today only two of seven expose a props interface; alignment is baked into class names and every grid is `repeat(auto-fit, minmax(Npx, 1fr))` with no `columns` prop. The sections above cannot be parameterised until this exists.
4. More icons. Fourteen exist, and the landing feature grid already stretches them.
5. The `split` shell itself, which is layout rather than a component: a two-slot container implementing the rail position, widths and sticky behaviour above.

Each of these lands through mitame's existing pipeline: tokens in Figma, generated token CSS, the contrast checker gating CI.

## Theme surface

A document may name four things about appearance: `theme.name`, `theme.mode`, `theme.accentHue` and `page.measure`. Nothing else.

### Accent hue rotation, verified

A user saying "make it more purple" is answerable without voiding the WCAG guarantee, and the method matters:

- Rotating accent hue at constant **oklab lightness** is **not** safe. Nine of 17 themes survive all 12 hue steps; `liquid` and `neon` survive only three, because oklab lightness and WCAG relative luminance weight channels differently and rotating toward blue drops luminance hard.
- Rotating hue while re-solving lightness so that **WCAG relative luminance is unchanged** passes **204 of 204** combinations: all 17 themes, both modes, all 12 hue steps. `contrast()` is a pure function of luminance, so every direct use of the accent keeps its exact ratio. Solving inside the sRGB clamp makes the result gamut-safe by construction, at the cost of chroma at extreme hues.

Implementation: precompute a table of accepted hues per theme at build time, so "more purple" is a lookup and the guarantee is a build artifact rather than a runtime promise. On failure, reduce chroma and retry; never adjust luminance. Treat `(accent, accent-fg)` as one atom.

Two limits to state in product copy: tokens that hardcode accent-adjacent values (`neon`'s `glass/edge`, `aqua`'s toast icon tints and tooltip) do not follow the rotation, and the model never emits a colour. It names a direction and the system picks.

Per-section theme overrides remain reserved in the schema and rejected by the validator.

## Validation

Four layers, in order, all before anything renders:

1. **Schema.** Shape, required fields, types. A hallucinated prop is a caught error.
2. **Vocabulary.** Section type exists, props belong to that type, enum values are in range, `split` nesting is not exceeded, no reserved field is populated.
3. **Referential.** Every id unique, every patch target resolves, no cycle, `assetId` resolves.
4. **Semantic.** Required `alt` is non-empty and not a filename, headings are not empty, an action has a label.

A failure returns the specific error to the model once, with the offending node. A second failure is a hard error surfaced to the user, never a silent partial render.

## Error handling

| Failure | Behaviour |
|---|---|
| Model returns invalid JSON | One reprompt with the parse error, then fail. |
| Validation fails | One reprompt with the typed error and node id, then fail. |
| Patch targets a removed node | Reject the patch, return the current document unchanged, tell the user what was stale. |
| Emitter throws | Hard error. The emitter is deterministic, so this is a bug, not a condition. |
| Contrast check fails after emit | Hard error and block the result. A failure here means a theme or an override is wrong, not the document. |
| Model unavailable or over budget | Typed error distinguishing retryable from not. |

The document is never left partially applied. A patch is applied to a copy and swapped in on success.

## Testing

- **Golden documents to golden source.** A corpus of documents, each with committed expected output. The emitter is deterministic, so any diff is a real change. This is the main regression net.
- **Schema round trip.** Every golden document validates, serialises and reloads identically, and migrates forward from every earlier version.
- **Patch algebra.** Applying a patch then its inverse returns the original document. Patches against stale ids reject cleanly.
- **Contrast gate.** Every golden document, emitted in all 17 themes in both modes, passes `scripts/contrast.ts`. This is the guarantee the product is sold on, so it is tested across the whole matrix rather than sampled.
- **Vocabulary coverage.** The six stress-test briefs are committed as fixtures. Each must be expressible without abusing a section. This is the test that failed six times out of six before this design and is the reason the vocabulary grew.
- **Model-facing tests are separate.** Planning quality is evaluated with a small prompt set and human review, not asserted in CI, because it is not deterministic. Everything downstream of planning is.

## Evidence behind these decisions

Read-only research over the registry and a set of realistic page briefs. Every count below was re-verified against the repository while writing this spec:

- mitame has no mechanism for content imagery. There is **no `<img>` anywhere in the registry**, and no `background-image` or `url(` in any of the 13 components or 7 blocks. The only occurrences are decorative theme CSS: `blueprint`'s grid and `aqua`'s embedded arrow glyph.
- **Two of seven blocks** expose a props interface. Alignment and column counts are hardcoded in CSS everywhere.
- **Fourteen icons** exist in total.
- Six realistic page briefs expressed in the current vocabulary produced six verdicts of "the user would feel ignored," including a photographer's portfolio rendered entirely without images and a pricing comparison that opens with the three cards the brief explicitly rejected.
- Hue rotation at constant luminance: 204 of 204 combinations pass.

## Implementation sequence

The library work is the larger half and it gates everything else, so it is sequenced first and is the natural boundary for a separate plan.

1. **Library extension.** The `Image` primitive, the six new components, the props layer across existing blocks, more icons, the `split` shell. Each lands through the existing pipeline: Figma tokens, generated token CSS, contrast checker in CI. Nothing here depends on the engine.
2. **Schema and validator.** Types, the four validation layers, migration from version 1, the patch operations and their inverses. Pure data work, testable with no model and no renderer.
3. **Emitter.** Document to mitame source, golden-file tested. Depends on 1 and 2.
4. **Hue table.** Build-time precompute of accepted hues per theme, gated by the contrast checker.
5. **Planner.** The only stage with a model, and the only stage that is not deterministic. Built last, against a schema and emitter that are already proven.

Steps 2 to 5 are the engine proper. Step 1 is library work that stands on its own and could be planned and shipped independently.

## Open questions

1. **Asset storage.** The schema references `assetId`; where assets live and how they upload is sub-project 4's problem, but the engine needs a resolver interface now. Proposed: an interface with a bundled-placeholder implementation for v1.
2. **Multi-page projects.** The schema describes one page. If projects become multi-page, the document gains a page list and `site-header` links become real routes. Not v1, but the schema version field is what makes it addable.
3. **Which model, and where it runs.** Deliberately unspecified here. The planning stage is an interface with one implementation; the choice is a cost and latency decision for the plan, not an architecture decision.

## What this unlocks

Once this exists, sub-project 2 is a thin layer: render the emitted source in an iframe, send patches, show the document's history. The hard part, and the part that decides whether anyone wants the product, is settled here.
