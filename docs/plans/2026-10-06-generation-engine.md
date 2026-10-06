# mitame Generation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure function at the heart of mitame's vibe coding tool: a prompt and a theme in, a validated page document and real mitame source out, with no UI, no accounts and no hosting.

**Architecture:** A constrained JSON document is the source of truth and code is a build artifact regenerated from it. Six stages run in order, and only one of them involves a model: Intake, Plan (model), Validate, Emit, Verify, Return. Everything after planning is deterministic, so a defect is a failing test rather than a vibe. Appearance is named, never specified: the document may say a theme, a mode, an accent direction and a measure, and nothing else.

**Tech Stack:** TypeScript 7 with no new runtime dependencies, run as plain `node path/to/file.ts` on Node's native type stripping. Vitest 5 in jsdom. React 19 for the emitted output. The existing `scripts/contrast.ts` is the correctness gate.

**Spec:** [docs/specs/2026-10-06-generation-engine-design.md](../specs/2026-10-06-generation-engine-design.md)

## Scope

This plan covers steps 2 to 5 of the spec's implementation sequence: schema, validator, emitter, hue table, planner. Step 1, the library extension, is a separate plan.

Three section components are extracted here rather than there, because the engine cannot be proven end to end without something real to emit. `page-hero`, `feature-grid` and `cta-band` make a minimal landing page and between them exercise every prop kind: a plain string, a content-run array, an array of typed items, and an actions array. The library plan follows the identical pattern for the remaining sixteen.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the repository.

- **Node:** `package.json` `engines.node` is `">=20"`, `.nvmrc` is `24`. CI uses `node-version-file: .nvmrc`.
- **Module system:** ESM only. `package.json` has `"type": "module"`. There is no CJS in source.
- **How TypeScript runs:** plain `node` on the `.ts` file, relying on Node's native type stripping. There is no tsx, no ts-node, no `--import` loader. Example from `package.json`: `"meta": "node scripts/build-meta.ts"`.
- **Zero runtime dependencies besides React.** `package.json` has no `dependencies` and no `peerDependencies`. React 19.3.0 and react-dom 19.3.0 are devDependencies.
- **Do not import `zod`.** It physically resolves at `node_modules/zod` (4.6.5) because Astro depends on it, and it would typecheck locally and pass CI. It is an undeclared transitive dependency that disappears the moment Astro is bumped or dropped. The validator is hand written. The same applies to `ajv`, `valibot` and `typebox`, which are not installed at all.
- **Import extensions, and this one bites:** `engine/` and `scripts/` must use **explicit `.ts`** in relative import specifiers, because plain `node` resolves them natively and fails on extensionless paths. `tests/` and `registry/` use **extensionless** specifiers, because Vite resolves those. Proof: `node --input-type=module -e 'import { THEMES } from "/Users/kali/pet/mitame/scripts/build-tokens"'` fails with `ERR_MODULE_NOT_FOUND`; adding `.ts` succeeds.
- **tsconfig.json compilerOptions:** `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`, `verbatimModuleSyntax: true`, `allowImportingTsExtensions: true`, `noEmit: true`. The only path alias is `"@mitame/*": ["./registry/*"]`. There is no `@/` alias.
  - `verbatimModuleSyntax` means a type-only import **must** be written `import type { X } from "./y.ts";`.
  - `noUncheckedIndexedAccess` means `array[0]` has type `T | undefined` and `record[key]` has type `V | undefined`. Every index access needs a guard or a `!`.
- **JSX:** automatic runtime. Registry files never write `import React`. They use named imports (`import { useState } from "react"`) and `import type { ... } from "react"`, and reference the `React.` namespace in type positions without importing it.
- **Tests:** one flat directory. `tests/<area>.test.ts`, or `.tsx` only when the file renders JSX. Vitest config lives in `vite.config.ts` under `test`: `include: ["tests/**/*.test.{ts,tsx}"]`, `root: "."`, `environment: "jsdom"`, `setupFiles: ["tests/setup.ts"]`.
  - Whole suite: `npx vitest run`
  - One file: `npx vitest run tests/engine-validate.test.ts`
  - One test by name: `npx vitest run tests/engine-validate.test.ts -t "rejects a javascript: href"`
  - Typecheck: `npx tsc --noEmit`
  - Current baseline, which must not regress: **6 test files, 114 tests, all passing**, in about 1.1s.
- **Repo root inside a test:** `const root = join(import.meta.dirname, "..");`
- **CSS custom property prefix:** `--mi-`. Token name to property: the `color` and `motion` groups drop the group (`color/accent` becomes `--mi-accent`), every other group keeps it (`glass/tint` becomes `--mi-glass-tint`).
- **Generated artifact pattern,** copied from `scripts/build-meta.ts`: a provenance comment naming the npm script, a pure exported builder taking the repo root, a main-module guard, a `--check` mode, and output formatted as `` `${JSON.stringify(x, null, 2)}\n` ``. Each generated file gets a drift test asserting the committed bytes equal a fresh build, plus a CI `git diff --exit-code` entry.
- **`engine/` ships nowhere.** `package.json` `files` is `["dist", "registry", "skills", ".claude-plugin", ".mcp.json", "AGENTS.md", "CREDITS.md"]`. Leave it alone: `engine/` is absent, so it is already excluded from the npm tarball. `registry/hues.json` does land in the tarball, which is correct and harmless, and it is invisible to `listItems` and `buildRegistry` because both only walk the directories named in `KINDS`.
- **House style:** plain, simple prose in comments and docs. **No dashes as punctuation.** A comment says why, not what. Match the density of the file you are in and do not reformat lines you did not change.
- **Error style:** the repo throws (13 `throw new Error` sites, zero `extends Error`, zero Result or Either aliases). The engine deliberately differs because it has a public API: expected failures return a discriminated result, and only genuine bugs throw. This is stated in the spec's error table and is the one place engine code does not imitate repo style.

## Review Focus

Five input classes the spec implies but never addresses. Each one gets its test in the task that owns the code, named below.

1. **A content run carrying `href: "javascript:alert(1)"` or a `data:` URL.** The spec forbids HTML and remote image URLs but says nothing about link schemes, so the emitted page would carry a working script URL. A reasonable person expects only `http:`, `https:`, `mailto:` and same-document `#` fragments to survive. → Task 7.
2. **Content runs that exist but are all whitespace.** The spec requires "headings are not empty", which a `length > 0` check on the runs array satisfies while the rendered heading is blank. A reasonable person expects a heading of three spaces to be rejected the same as an absent one. → Task 7.
3. **A document with 400 sections, or a `prose` section holding 200,000 characters.** The spec sets no bound anywhere. The emitted file would be unusable and the next turn's planner prompt would exceed its context with no useful error. A reasonable person expects a clear refusal at a stated limit. → Task 5.
4. **`alt: "作品 2.3 的細節"`, rejected by a naive "alt must not be a filename" heuristic.** The spec requires `alt` be "non-empty and not a filename". A heuristic matching a dot plus a short suffix flags legitimate non-Latin alt text containing a decimal. A reasonable person expects their language to work. → Task 7.
5. **`accentHue` set on a theme whose other tokens hardcode the accent.** Verified in the token files: `system` has eight tokens equal to its accent in each mode, `terminal` dark has six, `blueprint` dark has three, `neon` light has one. Rotating only `color/accent` leaves those stale, so the page comes out half rotated. A reasonable person expects either a coherent rotation or a refusal, never a half rotated palette. → Task 17.

---

## File Structure

### New: the engine

| File | Responsibility |
|---|---|
| `engine/document.ts` | The document types and `DOCUMENT_VERSION`. No logic. |
| `engine/vocabulary.ts` | The twenty section descriptors as runtime data: prop kinds, enums, limits, build status. The single source of truth both the validator and the model prompt read. |
| `engine/ids.ts` | Minting stable section ids. |
| `engine/errors.ts` | `DocumentError` and `EngineError`. |
| `engine/validate.ts` | The four validation layers, in order. |
| `engine/path.ts` | Resolving a `setProp` path against a section's descriptor. |
| `engine/patch.ts` | The six operations, apply and invert. |
| `engine/migrate.ts` | Forward migration by `version`. |
| `engine/assets.ts` | The `AssetResolver` interface and the bundled placeholder implementation. |
| `engine/emit.ts` | Document to emitted files. |
| `engine/hues.ts` | Reading `registry/hues.json` and resolving an accent direction to a hue step. |
| `engine/planner.ts` | The `Planner` interface and `PlanResult`. No implementation. |
| `engine/generate.ts` | The pipeline: the pure function, the error taxonomy, the one reprompt policy. |
| `engine/index.ts` | The public surface. |

### New: generated

| File | Responsibility |
|---|---|
| `scripts/build-hues.ts` | Generates the accent hue table, gated by the contrast checker. |
| `registry/hues.json` | The generated table. Committed. |

### New: section components, shared with the library plan

| File | Responsibility |
|---|---|
| `registry/blocks/sections/page-hero.tsx` | Prop driven hero. |
| `registry/blocks/sections/feature-grid.tsx` | Prop driven feature grid. |
| `registry/blocks/sections/cta-band.tsx` | Prop driven closing band. |

These live under `registry/blocks/` on purpose, and the reason is the whole correctness story. `collectFiles` auto-includes `blocks/blocks.css` for anything whose path starts with `blocks/`, `KINDS` already covers `blocks`, `listItems` already recurses into subdirectories, and most importantly `rulesFor` already reads `registry/blocks/blocks.css` when it checks every theme. So section CSS added to `blocks.css` is contrast checked across all 17 themes in both modes by the existing suite, with no new machinery. The emitter therefore never generates styling, only composition.

### Modified

| File | Change |
|---|---|
| `tsconfig.json` | Add `"engine"` to `include`. |
| `package.json` | Add `"hues": "node scripts/build-hues.ts"`. |
| `registry/blocks/blocks.css` | Add the three sections' CSS. |
| `.github/workflows/ci.yml` | Add `npm run hues` to the drift step and `registry/hues.json` to its `git diff` paths. |
| `tests/generators.test.ts` | Add the `registry/hues.json` drift assertion beside the three that exist. |

### New: tests

`tests/engine-document.test.ts`, `tests/engine-vocabulary.test.ts`, `tests/engine-validate.test.ts`, `tests/engine-patch.test.ts`, `tests/engine-emit.test.ts`, `tests/engine-hues.test.ts`, `tests/engine-generate.test.ts`, `tests/engine-sections.test.tsx`, and golden fixtures under `tests/golden/`.

---

## Task 1: The document types, and wiring `engine/` into the build

**Files:**
- Create: `engine/document.ts`
- Create: `engine/errors.ts`
- Create: `tests/engine-document.test.ts`
- Modify: `tsconfig.json` (the `include` array)

**Interfaces:**
- Consumes: nothing.
- Produces: `DOCUMENT_VERSION`, and the types `ThemeMode`, `Measure`, `ThemeRef`, `Run`, `ImageRef`, `Action`, `PropValue`, `Section`, `PageDocument` from `engine/document.ts`; `DocumentError` and `ErrorLayer` from `engine/errors.ts`. Every later task imports from these two files.

- [ ] **Step 1: Add `engine` to the tsconfig include array**

In `tsconfig.json`, the `include` array currently reads:

```json
  "include": ["registry", "cli", "scripts", "tests", "playground", "vite.config.ts", "site/src/**/*.ts", "site/src/**/*.tsx"]
```

Change it to put `engine` first, so the engine is typechecked:

```json
  "include": ["engine", "registry", "cli", "scripts", "tests", "playground", "vite.config.ts", "site/src/**/*.ts", "site/src/**/*.tsx"]
```

Do not touch `package.json` `files`. `engine/` is absent from it, so it is already excluded from the npm tarball, which is what we want.

- [ ] **Step 2: Write the failing test**

Create `tests/engine-document.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DOCUMENT_VERSION, type PageDocument } from "../engine/document";

describe("the document type", () => {
  it("round trips through JSON unchanged", () => {
    const doc: PageDocument = {
      version: DOCUMENT_VERSION,
      theme: { name: "aqua", mode: "auto", accentHue: null },
      page: { measure: "page" },
      meta: { title: "Kestrel", description: "Ship on Friday." },
      sections: [
        {
          id: "s_7f2a",
          type: "page-hero",
          props: {
            eyebrow: "Public beta",
            headline: "Ship on Friday.",
            body: [{ text: "Deploy previews, " }, { text: "in seconds", em: true }, { text: "." }],
            actions: [{ label: "Start free", variant: "primary" }],
            align: "center",
            media: null,
          },
        },
      ],
    };
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it("starts at version 1, because stored documents outlive schemas", () => {
    expect(DOCUMENT_VERSION).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine-document.test.ts`
Expected: FAIL. Vitest cannot resolve `../engine/document`.

- [ ] **Step 4: Write `engine/document.ts`**

```ts
// The page document is the source of truth for a generated page. Code is a build
// artifact regenerated from it, which is why a user who hand edits the generated
// source has to eject: there is no path back into this shape.
//
// Every stored document carries a version, from the very first one ever written,
// because stored documents outlive schemas.

export const DOCUMENT_VERSION = 1;

export type ThemeMode = "light" | "dark" | "auto";

/** How wide the page runs. Not a pixel value, because the theme owns pixels. */
export type Measure = "narrow" | "page";

export interface ThemeRef {
  name: string;
  mode: ThemeMode;
  /** An accepted hue step from registry/hues.json, or null to keep the theme's own accent. */
  accentHue: number | null;
}

/** A span of text. Documents never carry markup, so emphasis is structural. */
export interface Run {
  text: string;
  em?: boolean;
  strong?: boolean;
  code?: boolean;
  href?: string;
}

/** Images are references, never URLs, so a document cannot hotlink. */
export interface ImageRef {
  assetId: string;
  alt: string;
  width: number;
  height: number;
}

export interface Action {
  label: string;
  variant: "primary" | "secondary";
  href?: string;
}

export type PropValue =
  | string
  | number
  | boolean
  | null
  | Run[]
  | ImageRef
  | Action[]
  | PropValue[]
  | { [key: string]: PropValue };

export interface Section {
  /** Minted once, never reused for a different section. */
  id: string;
  type: string;
  props: Record<string, PropValue>;
  /** Only the split shell has slots, and a slot may not hold another split. */
  slots?: Record<string, Section[]>;
}

export interface PageDocument {
  version: number;
  theme: ThemeRef;
  page: { measure: Measure };
  meta: { title: string; description: string };
  sections: Section[];
}
```

- [ ] **Step 5: Write `engine/errors.ts`**

This file imports nothing.

```ts
// Validation reports every problem it finds rather than throwing on the first,
// because the planner gets one chance to fix its output and a single error at a
// time would waste the reprompt.

export type ErrorLayer = "shape" | "vocabulary" | "referential" | "semantic";

export interface DocumentError {
  layer: ErrorLayer;
  /** Stable, machine readable, safe to switch on. */
  code: string;
  /** Plain words, written to be handed to a model or shown to a person. */
  message: string;
  /** The section the problem is in, when it is in one. */
  sectionId?: string;
  /** The prop path inside that section, when the problem is in a prop. */
  path?: string;
}
```

- [ ] **Step 6: Run the test to verify it passes, and typecheck**

Run: `npx vitest run tests/engine-document.test.ts`
Expected: PASS, 2 tests.

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json engine/document.ts engine/errors.ts tests/engine-document.test.ts
git commit -m "Add the page document types"
```

---

## Task 2: Minting stable section ids

**Files:**
- Create: `engine/ids.ts`
- Test: `tests/engine-document.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: nothing.
- Produces: `newSectionId(taken: Set<string>, random?: () => number): string` and `SECTION_ID = /^s_[0-9a-f]{4}$/`.

Ids are addressed by patches, so they must be stable and must never be reused for a *different* section. Restoring a removed section under its own id during an undo is restoration, not reuse, and is allowed.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-document.test.ts`:

```ts
import { SECTION_ID, newSectionId } from "../engine/ids";

describe("section ids", () => {
  it("mints the documented shape", () => {
    expect(newSectionId(new Set())).toMatch(SECTION_ID);
  });

  it("never returns an id already taken", () => {
    // A random source that always offers the same value first, so the collision
    // path is exercised rather than left to chance.
    let calls = 0;
    const random = () => (calls++ < 3 ? 0.1 : 0.9);
    const taken = new Set([newSectionId(new Set(), () => 0.1)]);
    const next = newSectionId(taken, random);
    expect(taken.has(next)).toBe(false);
  });

  it("mints a thousand distinct ids", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 1000; i++) taken.add(newSectionId(taken));
    expect(taken.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-document.test.ts`
Expected: FAIL. Cannot resolve `../engine/ids`.

- [ ] **Step 3: Write `engine/ids.ts`**

```ts
// Patches address sections by id, never by index, because an index shifts the
// moment anything is inserted and that is exactly how a tool edits the wrong
// thing. Four hex digits is short enough to read in a diff and wide enough that
// a page sized document will not collide; the taken set makes collisions moot
// either way.

export const SECTION_ID = /^s_[0-9a-f]{4}$/;

export function newSectionId(taken: Set<string>, random: () => number = Math.random): string {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const id = `s_${Math.floor(random() * 0x10000).toString(16).padStart(4, "0")}`;
    if (!taken.has(id)) return id;
  }
  // 10,000 collisions in a 65,536 wide space means the random source is broken,
  // not that the space is full.
  throw new Error("newSectionId: could not find a free id");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine-document.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add engine/ids.ts tests/engine-document.test.ts
git commit -m "Mint stable section ids"
```

---

## Task 3: The section vocabulary as runtime data

**Files:**
- Create: `engine/vocabulary.ts`
- Test: `tests/engine-vocabulary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PropKind`, `PropDescriptor`, `SectionStatus`, `SectionDescriptor`, `VOCABULARY: Record<string, SectionDescriptor>`, `LIMITS`, and the helper `descriptorFor(type: string): SectionDescriptor | undefined`.

The vocabulary is runtime data, not just types, for three reasons: the validator becomes a loop over descriptors instead of twenty hand written functions, `setProp` needs a runtime schema to resolve a path against, and the model's prompt can be generated from the same object so it can never drift from what the validator accepts.

All twenty types ship now, each carrying a build status. `absent` means no component exists yet. `partial` means a component exists but does not honour every declared prop, and `unsupported` names those props. The library plan's acceptance criterion for a section is mechanical: flip `status` to `"ready"`, empty `unsupported`, add a golden document.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-vocabulary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LIMITS, VOCABULARY, descriptorFor } from "../engine/vocabulary";

describe("the vocabulary", () => {
  it("holds the nineteen sections plus the split shell", () => {
    expect(Object.keys(VOCABULARY)).toHaveLength(20);
    expect(VOCABULARY).toHaveProperty("split");
  });

  it("declares three sections ready, which is what the engine can emit today", () => {
    const ready = Object.entries(VOCABULARY)
      .filter(([, d]) => d.status === "ready")
      .map(([name]) => name)
      .sort();
    expect(ready).toEqual(["cta-band", "feature-grid", "page-hero"]);
  });

  it("leaves no unsupported props on a ready section, or the status is a lie", () => {
    for (const [name, d] of Object.entries(VOCABULARY)) {
      if (d.status === "ready") expect(d.unsupported, name).toEqual([]);
    }
  });

  it("names at least one unsupported prop on every partial section", () => {
    for (const [name, d] of Object.entries(VOCABULARY)) {
      if (d.status === "partial") expect(d.unsupported.length, name).toBeGreaterThan(0);
    }
  });

  it("only lets the split shell declare slots, and gives it exactly two", () => {
    for (const [name, d] of Object.entries(VOCABULARY)) {
      if (name === "split") expect(d.slots).toEqual(["rail", "main"]);
      else expect(d.slots, name).toBeUndefined();
    }
  });

  it("names a prop descriptor for every unsupported prop", () => {
    for (const [name, d] of Object.entries(VOCABULARY)) {
      for (const prop of d.unsupported) expect(d.props, `${name}.${prop}`).toHaveProperty(prop);
    }
  });

  it("gives every enum prop a non-empty value list", () => {
    for (const [name, d] of Object.entries(VOCABULARY)) {
      for (const [prop, desc] of Object.entries(d.props)) {
        if (desc.kind === "enum") expect(desc.values?.length, `${name}.${prop}`).toBeGreaterThan(0);
      }
    }
  });

  it("gives every items prop an item shape and a maximum", () => {
    for (const [name, d] of Object.entries(VOCABULARY)) {
      for (const [prop, desc] of Object.entries(d.props)) {
        if (desc.kind === "items") {
          expect(desc.item, `${name}.${prop}`).toBeTruthy();
          expect(desc.max, `${name}.${prop}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("looks a descriptor up by type", () => {
    expect(descriptorFor("page-hero")?.status).toBe("ready");
    expect(descriptorFor("nope")).toBeUndefined();
  });

  it("states a document size limit, because an unbounded page is unusable", () => {
    expect(LIMITS.sections).toBeGreaterThan(0);
    expect(LIMITS.textLength).toBeGreaterThan(0);
    expect(LIMITS.runsPerField).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-vocabulary.test.ts`
Expected: FAIL. Cannot resolve `../engine/vocabulary`.

- [ ] **Step 3: Write `engine/vocabulary.ts`**

```ts
// The closed vocabulary. This object is the only thing that decides what a page
// can say, and both the validator and the model's prompt read it, so the two can
// never disagree about what is legal.
//
// Every section ships here from day one, carrying a build status, because the
// vocabulary is engine work while the components are library work. A section the
// library has not built yet validates as a known type and is refused by name,
// which is a better error than "unknown section" and gives the library plan a
// checklist.

export type PropKind = "text" | "runs" | "image" | "actions" | "enum" | "boolean" | "number" | "items" | "links";

export interface PropDescriptor {
  kind: PropKind;
  required?: boolean;
  /** For kind "enum". */
  values?: readonly string[];
  /** For kind "items", the shape of a single item. */
  item?: Record<string, PropDescriptor>;
  /** For kinds "items", "actions" and "links", how many the section may hold. */
  max?: number;
}

export type SectionStatus = "ready" | "partial" | "absent";

export interface SectionDescriptor {
  status: SectionStatus;
  /** Props declared here but not yet honoured by the component. Empty when ready. */
  unsupported: readonly string[];
  props: Record<string, PropDescriptor>;
  /** Named slots. Only the split shell has them. */
  slots?: readonly string[];
}

/** Bounds the spec leaves open. A page is a page, not an application. */
export const LIMITS = {
  sections: 60,
  /** Characters in any single text or run field. */
  textLength: 5_000,
  runsPerField: 200,
  /** How deep a split may nest. One means a split may not contain a split. */
  splitDepth: 1,
} as const;

const TEXT: PropDescriptor = { kind: "text" };
const REQUIRED_TEXT: PropDescriptor = { kind: "text", required: true };
const RUNS: PropDescriptor = { kind: "runs" };
const ACTIONS: PropDescriptor = { kind: "actions", max: 3 };
const ALIGN: PropDescriptor = { kind: "enum", values: ["start", "center"] };
const COLUMNS: PropDescriptor = { kind: "enum", values: ["2", "3", "4"] };
const IMAGE: PropDescriptor = { kind: "image" };

export const VOCABULARY: Record<string, SectionDescriptor> = {
  "site-header": {
    status: "partial",
    // The block hardcodes its brand, its links and a dialog trigger.
    unsupported: ["brand", "links", "action"],
    props: { brand: REQUIRED_TEXT, links: { kind: "links", max: 6 }, action: { kind: "actions", max: 1 } },
  },
  "site-footer": {
    status: "absent",
    unsupported: ["brand", "links", "note"],
    props: { brand: TEXT, links: { kind: "links", max: 12 }, note: RUNS },
  },
  "page-hero": {
    status: "ready",
    unsupported: [],
    props: { eyebrow: TEXT, headline: REQUIRED_TEXT, body: RUNS, actions: ACTIONS, align: ALIGN, media: IMAGE },
  },
  prose: {
    status: "absent",
    unsupported: ["blocks"],
    props: {
      blocks: {
        kind: "items",
        max: 80,
        item: { kind: { kind: "enum", values: ["heading", "paragraph", "list"], required: true }, text: RUNS },
      },
    },
  },
  "feature-grid": {
    status: "ready",
    unsupported: [],
    props: {
      title: TEXT,
      lede: RUNS,
      columns: COLUMNS,
      features: { kind: "items", max: 12, item: { title: REQUIRED_TEXT, body: RUNS, icon: TEXT } },
    },
  },
  "content-card-grid": {
    status: "absent",
    unsupported: ["cards"],
    props: {
      title: TEXT,
      columns: COLUMNS,
      cards: { kind: "items", max: 24, item: { title: REQUIRED_TEXT, body: RUNS, image: IMAGE, href: TEXT } },
    },
  },
  "media-grid": {
    status: "absent",
    unsupported: ["images"],
    props: { title: TEXT, columns: COLUMNS, images: { kind: "items", max: 36, item: { image: IMAGE, caption: TEXT } } },
  },
  "person-grid": {
    status: "absent",
    unsupported: ["people"],
    props: {
      title: TEXT,
      columns: COLUMNS,
      people: { kind: "items", max: 36, item: { name: REQUIRED_TEXT, role: TEXT, image: IMAGE, bio: RUNS } },
    },
  },
  "logo-wall": {
    status: "partial",
    unsupported: ["label", "names"],
    props: { label: TEXT, names: { kind: "links", max: 12 } },
  },
  "stat-band": {
    status: "partial",
    unsupported: ["label", "stats"],
    props: { label: TEXT, stats: { kind: "items", max: 6, item: { value: REQUIRED_TEXT, label: REQUIRED_TEXT } } },
  },
  quote: {
    status: "partial",
    unsupported: ["quotes"],
    props: { quotes: { kind: "items", max: 6, item: { text: RUNS, name: TEXT, role: TEXT } } },
  },
  "pricing-tiers": {
    status: "partial",
    unsupported: ["tiers"],
    props: {
      title: TEXT,
      lede: RUNS,
      tiers: {
        kind: "items",
        max: 4,
        item: { name: REQUIRED_TEXT, price: TEXT, note: TEXT, features: { kind: "links", max: 12 }, action: ACTIONS, featured: { kind: "boolean" } },
      },
    },
  },
  "comparison-matrix": {
    status: "absent",
    unsupported: ["columns", "rows"],
    props: {
      title: TEXT,
      columns: { kind: "links", max: 5 },
      rows: { kind: "items", max: 40, item: { label: REQUIRED_TEXT, values: { kind: "links", max: 5 } } },
    },
  },
  "disclosure-list": {
    status: "absent",
    unsupported: ["entries"],
    props: { title: TEXT, entries: { kind: "items", max: 40, item: { question: REQUIRED_TEXT, answer: RUNS } } },
  },
  "row-list": {
    status: "partial",
    unsupported: ["rows"],
    props: { title: TEXT, rows: { kind: "items", max: 40, item: { label: REQUIRED_TEXT, note: RUNS, value: TEXT } } },
  },
  timeline: {
    status: "absent",
    unsupported: ["entries"],
    props: { title: TEXT, entries: { kind: "items", max: 40, item: { when: REQUIRED_TEXT, title: REQUIRED_TEXT, body: RUNS } } },
  },
  "code-block": {
    status: "absent",
    unsupported: ["code", "language", "caption"],
    props: { code: REQUIRED_TEXT, language: TEXT, caption: TEXT },
  },
  "form-panel": {
    status: "partial",
    unsupported: ["fields", "action"],
    props: {
      title: TEXT,
      lede: RUNS,
      fields: {
        kind: "items",
        max: 12,
        item: { label: REQUIRED_TEXT, name: REQUIRED_TEXT, type: { kind: "enum", values: ["text", "email", "password", "checkbox"] }, required: { kind: "boolean" } },
      },
      action: { kind: "actions", max: 1 },
    },
  },
  "cta-band": {
    status: "ready",
    unsupported: [],
    props: { title: REQUIRED_TEXT, body: RUNS, actions: ACTIONS },
  },
  split: {
    status: "absent",
    unsupported: ["rail", "railWidth", "sticky"],
    props: {
      rail: { kind: "enum", values: ["start", "end"] },
      railWidth: { kind: "enum", values: ["narrow", "wide"] },
      sticky: { kind: "boolean" },
    },
    slots: ["rail", "main"],
  },
};

export function descriptorFor(type: string): SectionDescriptor | undefined {
  return Object.prototype.hasOwnProperty.call(VOCABULARY, type) ? VOCABULARY[type] : undefined;
}
```

- [ ] **Step 4: Commit the six stress briefs as a fixture**

The vocabulary grew from nineteen sections because six realistic page briefs were
each expressed in the old eight and each came back "the user would feel ignored".
That is the test the vocabulary exists to pass, so the briefs are committed rather
than remembered. Expressibility is a vocabulary property, so it is testable now
even though sixteen of the sections are not built yet.

Create `tests/golden/briefs.json`:

```json
{
  "briefs": [
    {
      "name": "a photographer's portfolio",
      "needs": ["site-header", "page-hero", "media-grid", "content-card-grid", "site-footer"]
    },
    {
      "name": "a pricing page that compares three products feature by feature",
      "needs": ["site-header", "page-hero", "comparison-matrix", "pricing-tiers", "disclosure-list", "cta-band"]
    },
    {
      "name": "a documentation home with a rail beside the content",
      "needs": ["site-header", "split", "row-list", "prose", "code-block"]
    },
    {
      "name": "a conference page with speakers and a schedule",
      "needs": ["site-header", "page-hero", "person-grid", "timeline", "logo-wall", "form-panel"]
    },
    {
      "name": "a changelog",
      "needs": ["site-header", "prose", "timeline", "code-block", "site-footer"]
    },
    {
      "name": "a support page",
      "needs": ["site-header", "page-hero", "disclosure-list", "row-list", "form-panel", "site-footer"]
    }
  ]
}
```

- [ ] **Step 5: Write the coverage test**

Append to `tests/engine-vocabulary.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const briefs = JSON.parse(readFileSync(join(import.meta.dirname, "golden/briefs.json"), "utf8")) as {
  briefs: { name: string; needs: string[] }[];
};

describe("the six briefs the vocabulary grew from", () => {
  it("there are six, so this is the set that drove the design", () => {
    expect(briefs.briefs).toHaveLength(6);
  });

  it.each(briefs.briefs.map((b) => [b.name, b.needs] as const))("%s is expressible: every section it needs exists", (_name, needs) => {
    for (const type of needs) expect(Object.keys(VOCABULARY)).toContain(type);
  });

  it("uses no section the vocabulary does not declare, in any brief", () => {
    const used = new Set(briefs.briefs.flatMap((b) => b.needs));
    expect([...used].filter((t) => !(t in VOCABULARY))).toEqual([]);
  });

  it("between them reach most of the vocabulary, or the vocabulary is padded", () => {
    const used = new Set(briefs.briefs.flatMap((b) => b.needs));
    expect(used.size).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/engine-vocabulary.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 7: Commit**

```bash
git add engine/vocabulary.ts tests/engine-vocabulary.test.ts tests/golden/briefs.json
git commit -m "Declare the section vocabulary as runtime data"
```

---

## Task 4: Validation layer 1, shape

**Files:**
- Create: `engine/validate.ts`
- Test: `tests/engine-validate.test.ts`

**Interfaces:**
- Consumes: `PageDocument`, `Section`, `PropValue` from `engine/document.ts`; `DocumentError` from `engine/errors.ts`; `VOCABULARY`, `LIMITS`, `descriptorFor` from `engine/vocabulary.ts`.
- Produces: `validate(input: unknown): ValidateResult`, where `ValidateResult = { ok: true; document: PageDocument } | { ok: false; errors: DocumentError[] }`. Also the layer functions `checkShape(input: unknown): DocumentError[]`, exported so each layer can be tested on its own.

The four layers run in order and stop at the first layer that reports anything, because a shape error makes every later layer's reading of the document meaningless. Within a layer, every problem is collected.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DOCUMENT_VERSION, type PageDocument } from "../engine/document";
import { checkShape, validate } from "../engine/validate";

/** A document that passes every layer, so a test can break exactly one thing. */
export function good(): PageDocument {
  return {
    version: DOCUMENT_VERSION,
    theme: { name: "aqua", mode: "auto", accentHue: null },
    page: { measure: "page" },
    meta: { title: "Kestrel", description: "Ship on Friday." },
    sections: [
      {
        id: "s_7f2a",
        type: "page-hero",
        props: { headline: "Ship on Friday.", body: [{ text: "Quiet weekends." }], actions: [{ label: "Start free", variant: "primary" }] },
      },
      { id: "s_91c4", type: "cta-band", props: { title: "Put your next deploy on watch" } },
    ],
  };
}

const codes = (errors: { code: string }[]) => errors.map((e) => e.code).sort();

describe("layer 1, shape", () => {
  it("accepts a well formed document", () => {
    expect(checkShape(good())).toEqual([]);
    const result = validate(good());
    expect(result.ok).toBe(true);
  });

  it.each([null, undefined, 42, "a document", [], true])("rejects %p, which is not an object", (input) => {
    expect(codes(checkShape(input))).toContain("not-an-object");
  });

  it("rejects a missing version", () => {
    const doc = good() as Record<string, unknown>;
    delete doc.version;
    expect(codes(checkShape(doc))).toContain("missing-version");
  });

  it("rejects a version it does not know", () => {
    expect(codes(checkShape({ ...good(), version: 99 }))).toContain("unknown-version");
  });

  it("rejects a missing theme, page, meta or sections", () => {
    for (const key of ["theme", "page", "meta", "sections"]) {
      const doc = good() as Record<string, unknown>;
      delete doc[key];
      expect(codes(checkShape(doc)), key).toContain("missing-field");
    }
  });

  it("rejects a theme mode outside the three it allows", () => {
    const doc = good();
    doc.theme.mode = "sepia" as never;
    expect(codes(checkShape(doc))).toContain("bad-enum");
  });

  it("rejects a measure outside the two it allows", () => {
    const doc = good();
    doc.page.measure = "wide" as never;
    expect(codes(checkShape(doc))).toContain("bad-enum");
  });

  it("rejects a section that is not an object, or has no id or type", () => {
    expect(codes(checkShape({ ...good(), sections: ["nope"] }))).toContain("bad-section");
    expect(codes(checkShape({ ...good(), sections: [{ type: "page-hero", props: {} }] }))).toContain("missing-field");
    expect(codes(checkShape({ ...good(), sections: [{ id: "s_0001", props: {} }] }))).toContain("missing-field");
  });

  it("rejects an id that is not the minted shape", () => {
    const doc = good();
    doc.sections[0]!.id = "section-one";
    expect(codes(checkShape(doc))).toContain("bad-id");
  });

  it("names the section and the path it is complaining about", () => {
    const doc = good();
    doc.sections[0]!.props.headline = 42 as never;
    const result = validate(doc);
    expect(result.ok).toBe(false);
    const error = result.ok ? undefined : result.errors[0];
    expect(error?.sectionId).toBe("s_7f2a");
    expect(error?.path).toBe("headline");
  });

  it("collects every shape problem rather than stopping at the first", () => {
    const doc = good() as Record<string, unknown>;
    delete doc.meta;
    delete doc.page;
    expect(checkShape(doc).length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-validate.test.ts`
Expected: FAIL. Cannot resolve `../engine/validate`.

- [ ] **Step 3: Write `engine/validate.ts` with layer 1 only**

```ts
// Four layers, in order. A shape failure makes every later layer's reading of the
// document meaningless, so the layers short circuit between themselves while
// collecting everything they can inside one layer. The planner gets a single
// reprompt, so handing it one error at a time would waste it.

import { DOCUMENT_VERSION, type PageDocument, type Section } from "./document.ts";
import type { DocumentError } from "./errors.ts";
import { LIMITS, descriptorFor } from "./vocabulary.ts";

export type ValidateResult = { ok: true; document: PageDocument } | { ok: false; errors: DocumentError[] };

const MODES = ["light", "dark", "auto"];
const MEASURES = ["narrow", "page"];
const ID = /^s_[0-9a-f]{4}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function checkShape(input: unknown): DocumentError[] {
  const errors: DocumentError[] = [];
  const bad = (code: string, message: string, extra: Partial<DocumentError> = {}) =>
    errors.push({ layer: "shape", code, message, ...extra });

  if (!isObject(input)) {
    bad("not-an-object", "A document must be a JSON object.");
    return errors;
  }

  if (!("version" in input)) bad("missing-version", "A document must carry a version.");
  else if (input.version !== DOCUMENT_VERSION) bad("unknown-version", `Version ${String(input.version)} is not a version this engine knows. The current version is ${DOCUMENT_VERSION}.`);

  for (const field of ["theme", "page", "meta", "sections"]) {
    if (!(field in input)) bad("missing-field", `A document must carry "${field}".`, { path: field });
  }

  if (isObject(input.theme)) {
    const theme = input.theme;
    if (typeof theme.name !== "string" || theme.name === "") bad("missing-field", "theme.name must be a theme id.", { path: "theme.name" });
    if (typeof theme.mode !== "string" || !MODES.includes(theme.mode)) bad("bad-enum", `theme.mode must be one of ${MODES.join(", ")}.`, { path: "theme.mode" });
    if (!(theme.accentHue === null || typeof theme.accentHue === "number")) bad("bad-type", "theme.accentHue must be a number or null.", { path: "theme.accentHue" });
  } else if ("theme" in input) bad("bad-type", "theme must be an object.", { path: "theme" });

  if (isObject(input.page)) {
    if (typeof input.page.measure !== "string" || !MEASURES.includes(input.page.measure)) bad("bad-enum", `page.measure must be one of ${MEASURES.join(", ")}.`, { path: "page.measure" });
  } else if ("page" in input) bad("bad-type", "page must be an object.", { path: "page" });

  if (isObject(input.meta)) {
    for (const field of ["title", "description"]) {
      if (typeof input.meta[field] !== "string") bad("bad-type", `meta.${field} must be a string.`, { path: `meta.${field}` });
    }
  } else if ("meta" in input) bad("bad-type", "meta must be an object.", { path: "meta" });

  if (Array.isArray(input.sections)) {
    if (input.sections.length > LIMITS.sections) {
      bad("too-many-sections", `A page may hold at most ${LIMITS.sections} sections, and this one has ${input.sections.length}.`);
    }
    input.sections.forEach((section, index) => errors.push(...shapeOfSection(section, index)));
  } else if ("sections" in input) bad("bad-type", "sections must be an array.", { path: "sections" });

  return errors;
}

function shapeOfSection(section: unknown, index: number): DocumentError[] {
  const errors: DocumentError[] = [];
  if (!isObject(section)) {
    return [{ layer: "shape", code: "bad-section", message: `sections[${index}] must be an object.`, path: `sections.${index}` }];
  }
  const id = typeof section.id === "string" ? section.id : undefined;
  const bad = (code: string, message: string, path?: string) =>
    errors.push({ layer: "shape", code, message, ...(id ? { sectionId: id } : {}), ...(path ? { path } : {}) });

  if (typeof section.id !== "string") bad("missing-field", `sections[${index}] must carry an id.`, "id");
  else if (!ID.test(section.id)) bad("bad-id", `"${section.id}" is not a section id. Ids look like s_7f2a.`, "id");
  if (typeof section.type !== "string") bad("missing-field", `sections[${index}] must carry a type.`, "type");
  if (!isObject(section.props)) bad("bad-type", `sections[${index}].props must be an object.`, "props");

  // Prop values are checked against the descriptor in layer 2, which knows what
  // each prop is for. Here we only insist the container is the right kind.
  if (typeof section.type === "string" && isObject(section.props)) {
    const descriptor = descriptorFor(section.type);
    if (descriptor) {
      for (const [prop, value] of Object.entries(section.props)) {
        const kind = descriptor.props[prop]?.kind;
        if (kind === "text" && !(value === null || typeof value === "string")) bad("bad-type", `${prop} must be a string.`, prop);
        if (kind === "number" && !(value === null || typeof value === "number")) bad("bad-type", `${prop} must be a number.`, prop);
        if (kind === "boolean" && !(value === null || typeof value === "boolean")) bad("bad-type", `${prop} must be true or false.`, prop);
        if ((kind === "runs" || kind === "items" || kind === "actions" || kind === "links") && !(value === null || Array.isArray(value))) bad("bad-type", `${prop} must be an array.`, prop);
        if (kind === "image" && !(value === null || isObject(value))) bad("bad-type", `${prop} must be an image reference or null.`, prop);
      }
    }
  }

  if ("slots" in section && section.slots !== undefined && !isObject(section.slots)) bad("bad-type", `sections[${index}].slots must be an object.`, "slots");
  return errors;
}

export function validate(input: unknown): ValidateResult {
  const shape = checkShape(input);
  if (shape.length) return { ok: false, errors: shape };
  return { ok: true, document: input as PageDocument };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine-validate.test.ts`
Expected: PASS. Layer 1's tests pass. `validate` currently returns ok for anything shaped right, which the later tasks tighten.

- [ ] **Step 5: Commit**

```bash
git add engine/validate.ts tests/engine-validate.test.ts
git commit -m "Validate document shape"
```

---

## Task 5: Validation layer 2, vocabulary, build status and limits

**Files:**
- Modify: `engine/validate.ts` (add `checkVocabulary`, wire it into `validate`)
- Test: `tests/engine-validate.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: layer 1's helpers, `VOCABULARY`, `LIMITS`, `descriptorFor`.
- Produces: `checkVocabulary(document: PageDocument): DocumentError[]`.

This layer is where the build status earns its place, and where **Review Focus 3** is pinned: an unbounded document is refused at a stated limit rather than producing an unusable file.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-validate.test.ts`:

```ts
import { checkVocabulary } from "../engine/validate";
import { LIMITS } from "../engine/vocabulary";

describe("layer 2, vocabulary and build status", () => {
  it("accepts a document using only ready sections", () => {
    expect(checkVocabulary(good())).toEqual([]);
  });

  it("rejects a section type that is not in the vocabulary", () => {
    const doc = good();
    doc.sections[0]!.type = "carousel";
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("unknown-section");
    expect(error?.message).toContain("carousel");
  });

  it("rejects a known section the library has not built yet, and says so by name", () => {
    const doc = good();
    doc.sections[0] = { id: "s_0001", type: "timeline", props: { entries: [] } };
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("section-not-built");
    expect(error?.message).toContain("timeline");
  });

  it("rejects a prop a partial section does not honour yet, and names the prop", () => {
    const doc = good();
    doc.sections[0] = { id: "s_0001", type: "logo-wall", props: { label: "Watching deploys at" } };
    const [error] = checkVocabulary(doc);
    // logo-wall is partial, so the type itself is refused before its props are.
    expect(error?.code).toBe("section-not-built");
  });

  it("rejects a prop the descriptor does not declare", () => {
    const doc = good();
    doc.sections[0]!.props.subtitle = "nope";
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("unknown-prop");
    expect(error?.path).toBe("subtitle");
  });

  it("rejects a missing required prop", () => {
    const doc = good();
    delete doc.sections[0]!.props.headline;
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("missing-prop");
    expect(error?.path).toBe("headline");
  });

  it("rejects an enum value outside the descriptor's list", () => {
    const doc = good();
    doc.sections[0]!.props.align = "justify";
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("bad-enum");
    expect(error?.path).toBe("align");
  });

  it("rejects more items than the descriptor allows", () => {
    const doc = good();
    doc.sections[0]!.props.actions = Array.from({ length: 9 }, () => ({ label: "Go", variant: "primary" as const }));
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("too-many-items");
  });

  it("rejects an action variant it does not know", () => {
    const doc = good();
    doc.sections[0]!.props.actions = [{ label: "Go", variant: "danger" } as never];
    expect(checkVocabulary(doc).map((e) => e.code)).toContain("bad-enum");
  });

  it("rejects slots on a section that declares none", () => {
    const doc = good();
    doc.sections[0]!.slots = { rail: [] };
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("unexpected-slots");
  });

  it("rejects a reserved per-section theme override", () => {
    const doc = good();
    doc.sections[0]!.props.theme = "sumi";
    expect(checkVocabulary(doc).map((e) => e.code)).toContain("unknown-prop");
  });

  // Review Focus 3: the spec sets no bound anywhere, so a 400 section document
  // would emit an unusable file and blow the next planner prompt's context.
  it("rejects more sections than the stated limit", () => {
    const doc = good();
    doc.sections = Array.from({ length: LIMITS.sections + 1 }, (_, i) => ({
      id: `s_${i.toString(16).padStart(4, "0")}`,
      type: "cta-band",
      props: { title: "Go" },
    }));
    const result = validate(doc);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((e) => e.code)).toContain("too-many-sections");
  });

  it("rejects a text prop longer than the stated limit", () => {
    const doc = good();
    doc.sections[0]!.props.headline = "x".repeat(LIMITS.textLength + 1);
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("text-too-long");
  });

  it("rejects more runs in one field than the stated limit", () => {
    const doc = good();
    doc.sections[0]!.props.body = Array.from({ length: LIMITS.runsPerField + 1 }, () => ({ text: "x" }));
    const [error] = checkVocabulary(doc);
    expect(error?.code).toBe("too-many-runs");
  });

  it("runs after layer 1, so a shape error hides a vocabulary error", () => {
    const doc = good() as Record<string, unknown>;
    delete doc.meta;
    (doc.sections as { type: string }[])[0]!.type = "carousel";
    const result = validate(doc);
    expect(result.ok).toBe(false);
    const layers = result.ok ? [] : [...new Set(result.errors.map((e) => e.layer))];
    expect(layers).toEqual(["shape"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-validate.test.ts -t "layer 2"`
Expected: FAIL. `checkVocabulary` is not exported.

- [ ] **Step 3: Add `checkVocabulary` to `engine/validate.ts`**

Insert above the existing `validate` function:

```ts
/** Layer 2. The type exists, the library has built it, and the props are legal. */
export function checkVocabulary(document: PageDocument): DocumentError[] {
  const errors: DocumentError[] = [];
  const walk = (sections: Section[], depth: number) => {
    for (const section of sections) errors.push(...vocabularyOfSection(section, depth, walk));
  };
  walk(document.sections, 0);
  return errors;
}

function vocabularyOfSection(section: Section, depth: number, walk: (s: Section[], d: number) => void): DocumentError[] {
  const errors: DocumentError[] = [];
  const bad = (code: string, message: string, path?: string) =>
    errors.push({ layer: "vocabulary", code, message, sectionId: section.id, ...(path ? { path } : {}) });

  const descriptor = descriptorFor(section.type);
  if (!descriptor) {
    bad("unknown-section", `"${section.type}" is not a section type. The vocabulary is closed, so there is no way to add one from a document.`);
    return errors;
  }
  if (descriptor.status !== "ready") {
    bad("section-not-built", `"${section.type}" is in the vocabulary but the component is not built yet, so it cannot be emitted.`);
    return errors;
  }
  for (const prop of descriptor.unsupported) {
    if (prop in section.props) bad("prop-not-built", `"${section.type}" does not honour "${prop}" yet.`, prop);
  }

  for (const [prop, value] of Object.entries(section.props)) {
    const desc = descriptor.props[prop];
    if (!desc) {
      bad("unknown-prop", `"${section.type}" has no prop "${prop}". A per section theme override is reserved and not available.`, prop);
      continue;
    }
    errors.push(...checkValue(section.id, prop, value, desc));
  }
  for (const [prop, desc] of Object.entries(descriptor.props)) {
    if (desc.required && (section.props[prop] === undefined || section.props[prop] === null)) {
      bad("missing-prop", `"${section.type}" needs "${prop}".`, prop);
    }
  }

  if (section.slots) {
    if (!descriptor.slots) bad("unexpected-slots", `"${section.type}" has no slots.`, "slots");
    else {
      if (depth >= LIMITS.splitDepth) bad("split-too-deep", `A split may not contain another split.`, "slots");
      for (const name of Object.keys(section.slots)) {
        if (!descriptor.slots.includes(name)) bad("unknown-slot", `"${section.type}" has no slot "${name}".`, `slots.${name}`);
      }
      for (const name of descriptor.slots) walk(section.slots[name] ?? [], depth + 1);
    }
  }
  return errors;
}

const ACTION_VARIANTS = ["primary", "secondary"];

function checkValue(sectionId: string, path: string, value: unknown, desc: PropDescriptor): DocumentError[] {
  const errors: DocumentError[] = [];
  const bad = (code: string, message: string) => errors.push({ layer: "vocabulary", code, message, sectionId, path });
  if (value === null || value === undefined) return errors;

  switch (desc.kind) {
    case "text":
      if (typeof value === "string" && value.length > LIMITS.textLength) bad("text-too-long", `A text field may hold at most ${LIMITS.textLength} characters.`);
      break;
    case "enum":
      if (!desc.values?.includes(String(value))) bad("bad-enum", `"${String(value)}" is not one of ${desc.values?.join(", ")}.`);
      break;
    case "runs":
      if (Array.isArray(value)) {
        if (value.length > LIMITS.runsPerField) bad("too-many-runs", `A text field may hold at most ${LIMITS.runsPerField} runs.`);
        for (const run of value) {
          if (!isObject(run) || typeof run.text !== "string") bad("bad-run", "Every run needs a text string.");
          else if (run.text.length > LIMITS.textLength) bad("text-too-long", `A run may hold at most ${LIMITS.textLength} characters.`);
        }
      }
      break;
    case "actions":
      if (Array.isArray(value)) {
        if (desc.max !== undefined && value.length > desc.max) bad("too-many-items", `At most ${desc.max} actions.`);
        for (const action of value) {
          if (!isObject(action) || typeof action.label !== "string" || action.label === "") bad("bad-action", "Every action needs a label.");
          else if (!ACTION_VARIANTS.includes(String(action.variant))) bad("bad-enum", `An action variant must be one of ${ACTION_VARIANTS.join(", ")}.`);
        }
      }
      break;
    case "links":
      if (Array.isArray(value)) {
        if (desc.max !== undefined && value.length > desc.max) bad("too-many-items", `At most ${desc.max} entries.`);
        for (const entry of value) if (typeof entry !== "string") bad("bad-type", "Every entry must be a string.");
      }
      break;
    case "items":
      if (Array.isArray(value)) {
        if (desc.max !== undefined && value.length > desc.max) bad("too-many-items", `At most ${desc.max} items.`);
        value.forEach((item, index) => {
          if (!isObject(item)) {
            bad("bad-item", `Item ${index} must be an object.`);
            return;
          }
          for (const [key, value_] of Object.entries(item)) {
            const inner = desc.item?.[key];
            if (!inner) errors.push({ layer: "vocabulary", code: "unknown-prop", message: `An item has no field "${key}".`, sectionId, path: `${path}.${index}.${key}` });
            else errors.push(...checkValue(sectionId, `${path}.${index}.${key}`, value_, inner));
          }
          for (const [key, inner] of Object.entries(desc.item ?? {})) {
            if (inner.required && (item[key] === undefined || item[key] === null)) {
              errors.push({ layer: "vocabulary", code: "missing-prop", message: `An item needs "${key}".`, sectionId, path: `${path}.${index}.${key}` });
            }
          }
        });
      }
      break;
    case "image":
      if (isObject(value)) {
        if (typeof value.assetId !== "string" || value.assetId === "") bad("bad-image", "An image needs an assetId.");
        if (typeof value.alt !== "string") bad("missing-alt", "An image needs alt text. The schema requires it rather than permitting it.");
      }
      break;
    case "boolean":
    case "number":
      break;
  }
  return errors;
}
```

Add `PropDescriptor` to the vocabulary import at the top of the file:

```ts
import { LIMITS, type PropDescriptor, descriptorFor } from "./vocabulary.ts";
```

- [ ] **Step 4: Wire layer 2 into `validate`**

Replace the body of `validate`:

```ts
export function validate(input: unknown): ValidateResult {
  const shape = checkShape(input);
  if (shape.length) return { ok: false, errors: shape };
  const document = input as PageDocument;

  const vocabulary = checkVocabulary(document);
  if (vocabulary.length) return { ok: false, errors: vocabulary };

  return { ok: true, document };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/engine-validate.test.ts`
Expected: PASS, every layer 1 and layer 2 test.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add engine/validate.ts tests/engine-validate.test.ts
git commit -m "Validate the vocabulary, build status and document limits"
```

---

## Task 6: Validation layer 3, referential

**Files:**
- Modify: `engine/validate.ts` (add `checkReferential`, wire it in)
- Test: `tests/engine-validate.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: layer 1 and 2.
- Produces: `checkReferential(document: PageDocument, assets?: AssetNames): DocumentError[]`, where `AssetNames = { has(assetId: string): boolean }`. The parameter is optional so this layer can be tested without an asset store; Task 11 supplies the real resolver.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-validate.test.ts`:

```ts
import { checkReferential } from "../engine/validate";

describe("layer 3, referential", () => {
  it("accepts a document whose ids are unique", () => {
    expect(checkReferential(good())).toEqual([]);
  });

  it("rejects two sections sharing an id", () => {
    const doc = good();
    doc.sections[1]!.id = doc.sections[0]!.id;
    const [error] = checkReferential(doc);
    expect(error?.code).toBe("duplicate-id");
    expect(error?.sectionId).toBe("s_7f2a");
  });

  it("rejects an id reused between a slot and the top level", () => {
    const doc = good();
    doc.sections.push({
      id: "s_aaaa",
      type: "split",
      props: {},
      slots: { rail: [{ id: "s_7f2a", type: "cta-band", props: { title: "Go" } }], main: [] },
    });
    expect(checkReferential(doc).map((e) => e.code)).toContain("duplicate-id");
  });

  it("rejects an image whose assetId the store does not hold", () => {
    const doc = good();
    doc.sections[0]!.props.media = { assetId: "missing", alt: "A deploy graph", width: 800, height: 600 };
    const [error] = checkReferential(doc, { has: () => false });
    expect(error?.code).toBe("unknown-asset");
    expect(error?.path).toBe("media");
  });

  it("accepts an image whose assetId the store does hold", () => {
    const doc = good();
    doc.sections[0]!.props.media = { assetId: "placeholder-wide", alt: "A deploy graph", width: 800, height: 600 };
    expect(checkReferential(doc, { has: () => true })).toEqual([]);
  });

  it("skips the asset check when no store is given, so the layer is testable alone", () => {
    const doc = good();
    doc.sections[0]!.props.media = { assetId: "whatever", alt: "A deploy graph", width: 800, height: 600 };
    expect(checkReferential(doc)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-validate.test.ts -t "layer 3"`
Expected: FAIL. `checkReferential` is not exported.

- [ ] **Step 3: Add `checkReferential` to `engine/validate.ts`**

```ts
/** What layer 3 needs of an asset store, which is only whether an id exists. */
export interface AssetNames {
  has(assetId: string): boolean;
}

/** Layer 3. Ids are unique across the whole document and every reference resolves. */
export function checkReferential(document: PageDocument, assets?: AssetNames): DocumentError[] {
  const errors: DocumentError[] = [];
  const seen = new Set<string>();

  const walk = (sections: Section[]) => {
    for (const section of sections) {
      if (seen.has(section.id)) {
        errors.push({ layer: "referential", code: "duplicate-id", message: `Two sections share the id "${section.id}". Ids address patches, so they must be unique.`, sectionId: section.id });
      }
      seen.add(section.id);

      if (assets) {
        for (const [prop, value] of Object.entries(section.props)) {
          for (const image of imagesIn(value)) {
            if (!assets.has(image.assetId)) {
              errors.push({ layer: "referential", code: "unknown-asset", message: `No asset named "${image.assetId}".`, sectionId: section.id, path: prop });
            }
          }
        }
      }
      for (const slot of Object.values(section.slots ?? {})) walk(slot);
    }
  };
  walk(document.sections);
  return errors;
}

/** Images sit directly on a prop or inside an item, so both are worth finding. */
function imagesIn(value: unknown): { assetId: string }[] {
  if (isObject(value) && typeof value.assetId === "string") return [{ assetId: value.assetId }];
  if (Array.isArray(value)) return value.flatMap(imagesIn);
  if (isObject(value)) return Object.values(value).flatMap(imagesIn);
  return [];
}
```

- [ ] **Step 4: Wire layer 3 into `validate`**

`validate` gains an options parameter. Replace it:

```ts
export interface ValidateOptions {
  assets?: AssetNames;
}

export function validate(input: unknown, options: ValidateOptions = {}): ValidateResult {
  const shape = checkShape(input);
  if (shape.length) return { ok: false, errors: shape };
  const document = input as PageDocument;

  const vocabulary = checkVocabulary(document);
  if (vocabulary.length) return { ok: false, errors: vocabulary };

  const referential = checkReferential(document, options.assets);
  if (referential.length) return { ok: false, errors: referential };

  return { ok: true, document };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/engine-validate.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/validate.ts tests/engine-validate.test.ts
git commit -m "Validate ids and asset references"
```

---

## Task 7: Validation layer 4, semantic

**Files:**
- Modify: `engine/validate.ts` (add `checkSemantic`, wire it in)
- Test: `tests/engine-validate.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: layers 1 to 3.
- Produces: `checkSemantic(document: PageDocument): DocumentError[]`, and `SAFE_SCHEMES`.

This layer holds three of the five Review Focus items, and they are the reason it exists as its own layer rather than being folded into layer 2. Layer 2 asks whether a value is the right kind. Layer 4 asks whether it is any good.

**Review Focus 1, link schemes.** The spec forbids HTML and remote image URLs and then says nothing about `href`, so `javascript:alert(1)` would reach the emitted page as a working script URL. Only `http:`, `https:`, `mailto:` and same-document `#` fragments survive.

**Review Focus 2, whitespace content.** "Headings are not empty" is satisfied by a runs array of length one holding three spaces. The check is on rendered text, not on array length.

**Review Focus 4, the alt heuristic.** "Alt is not a filename" must not reject `作品 2.3 的細節`. The heuristic matches a known image extension at the end of an otherwise unbroken token, not merely the presence of a dot.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-validate.test.ts`:

```ts
import { SAFE_SCHEMES, checkSemantic } from "../engine/validate";

describe("layer 4, semantic", () => {
  it("accepts a document whose content says something", () => {
    expect(checkSemantic(good())).toEqual([]);
  });

  // Review Focus 1: the spec forbids HTML and remote image URLs but never
  // constrains href, so a script URL would reach the emitted page intact.
  it.each(["javascript:alert(1)", "JavaScript:alert(1)", "  javascript:alert(1)", "data:text/html;base64,x", "vbscript:x", "file:///etc/passwd"])(
    "rejects the href %p",
    (href) => {
      const doc = good();
      doc.sections[0]!.props.body = [{ text: "Read the docs", href }];
      const [error] = checkSemantic(doc);
      expect(error?.code).toBe("unsafe-href");
    },
  );

  it.each(["https://example.com", "http://example.com", "mailto:hi@example.com", "#features", "/docs", "./docs"])(
    "accepts the href %p",
    (href) => {
      const doc = good();
      doc.sections[0]!.props.body = [{ text: "Read the docs", href }];
      expect(checkSemantic(doc)).toEqual([]);
    },
  );

  it("applies the same rule to an action href", () => {
    const doc = good();
    doc.sections[0]!.props.actions = [{ label: "Go", variant: "primary", href: "javascript:alert(1)" }];
    expect(checkSemantic(doc).map((e) => e.code)).toContain("unsafe-href");
  });

  it("names the schemes it allows, so the message is actionable", () => {
    expect(SAFE_SCHEMES).toEqual(["http:", "https:", "mailto:"]);
  });

  // Review Focus 2: an array length check passes while the rendered heading is blank.
  it.each(["   ", "\t", "\n", " ", "​"])("rejects a heading that renders as blank from %p", (text) => {
    const doc = good();
    doc.sections[0]!.props.headline = text;
    const [error] = checkSemantic(doc);
    expect(error?.code).toBe("empty-text");
  });

  it("rejects runs that are present but render as blank", () => {
    const doc = good();
    doc.sections[0]!.props.body = [{ text: "  " }, { text: "\t" }];
    const [error] = checkSemantic(doc);
    expect(error?.code).toBe("empty-text");
  });

  it("accepts runs whose whitespace sits between words", () => {
    const doc = good();
    doc.sections[0]!.props.body = [{ text: "Deploy previews, " }, { text: "in seconds", em: true }];
    expect(checkSemantic(doc)).toEqual([]);
  });

  it("rejects an action whose label renders as blank", () => {
    const doc = good();
    doc.sections[0]!.props.actions = [{ label: " ", variant: "primary" }];
    expect(checkSemantic(doc).map((e) => e.code)).toContain("empty-text");
  });

  it("rejects alt text that is really a filename", () => {
    const doc = good();
    for (const alt of ["hero.png", "IMG_2831.JPG", "screenshot-final-v2.webp"]) {
      doc.sections[0]!.props.media = { assetId: "a", alt, width: 8, height: 6 };
      expect(checkSemantic(doc).map((e) => e.code), alt).toContain("alt-is-a-filename");
    }
  });

  it("rejects alt text that is blank", () => {
    const doc = good();
    doc.sections[0]!.props.media = { assetId: "a", alt: "   ", width: 8, height: 6 };
    expect(checkSemantic(doc).map((e) => e.code)).toContain("empty-text");
  });

  // Review Focus 4: a naive dot-plus-suffix heuristic rejects legitimate
  // non-Latin alt text that happens to contain a decimal.
  it.each([
    "作品 2.3 的細節",
    "Figura 2.3 del montaje",
    "تفاصيل الشكل 2.3",
    "The 3.5 inch floppy drive, open",
    "v1.2 of the dashboard, showing the deploy list",
  ])("accepts the alt text %p", (alt) => {
    const doc = good();
    doc.sections[0]!.props.media = { assetId: "a", alt, width: 8, height: 6 };
    expect(checkSemantic(doc)).toEqual([]);
  });

  it("checks content inside items, not just top level props", () => {
    const doc = good();
    doc.sections[0] = {
      id: "s_0001",
      type: "feature-grid",
      props: { features: [{ title: "Searchable", body: [{ text: "x", href: "javascript:alert(1)" }] }] },
    };
    expect(checkSemantic(doc).map((e) => e.code)).toContain("unsafe-href");
  });

  it("runs last, so a referential error hides a semantic one", () => {
    const doc = good();
    doc.sections[1]!.id = doc.sections[0]!.id;
    doc.sections[0]!.props.headline = "   ";
    const result = validate(doc);
    const layers = result.ok ? [] : [...new Set(result.errors.map((e) => e.layer))];
    expect(layers).toEqual(["referential"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-validate.test.ts -t "layer 4"`
Expected: FAIL. `checkSemantic` is not exported.

- [ ] **Step 3: Add `checkSemantic` to `engine/validate.ts`**

```ts
/** Schemes an href may use. A document that wants anything else is refused. */
export const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

// A filename is a single unbroken token ending in a known image extension. The
// test is deliberately narrow: alt text in any language may contain a dot, and
// "Figura 2.3 del montaje" is a real description, not a filename.
const FILENAME = /^\S+\.(png|jpe?g|gif|webp|avif|svg|heic|bmp|tiff?)$/i;

/** Zero width and non-breaking space render as nothing, so they are not content. */
const BLANK = /^[\s ​-‍﻿]*$/;

/** Layer 4. The content says something, and nothing in it is dangerous. */
export function checkSemantic(document: PageDocument): DocumentError[] {
  const errors: DocumentError[] = [];

  const walk = (sections: Section[]) => {
    for (const section of sections) {
      const descriptor = descriptorFor(section.type);
      for (const [prop, value] of Object.entries(section.props)) {
        semanticOfValue(section.id, prop, value, descriptor?.props[prop], errors);
      }
      for (const slot of Object.values(section.slots ?? {})) walk(slot);
    }
  };
  walk(document.sections);
  return errors;
}

function semanticOfValue(sectionId: string, path: string, value: unknown, desc: PropDescriptor | undefined, errors: DocumentError[]): void {
  const bad = (code: string, message: string) => errors.push({ layer: "semantic", code, message, sectionId, path });
  if (value === null || value === undefined) return;

  if (desc?.kind === "text" && typeof value === "string") {
    if (BLANK.test(value)) bad("empty-text", `"${path}" is present but renders as nothing.`);
    return;
  }

  if (desc?.kind === "runs" && Array.isArray(value)) {
    const rendered = value.map((r) => (isObject(r) && typeof r.text === "string" ? r.text : "")).join("");
    if (BLANK.test(rendered)) bad("empty-text", `"${path}" has runs but renders as nothing.`);
    for (const run of value) if (isObject(run) && typeof run.href === "string") checkHref(sectionId, path, run.href, errors);
    return;
  }

  if (desc?.kind === "actions" && Array.isArray(value)) {
    for (const action of value) {
      if (!isObject(action)) continue;
      if (typeof action.label === "string" && BLANK.test(action.label)) bad("empty-text", `An action in "${path}" has a label that renders as nothing.`);
      if (typeof action.href === "string") checkHref(sectionId, path, action.href, errors);
    }
    return;
  }

  if (desc?.kind === "image" && isObject(value)) {
    const alt = typeof value.alt === "string" ? value.alt : "";
    if (BLANK.test(alt)) bad("empty-text", `The image in "${path}" needs alt text that says something.`);
    else if (FILENAME.test(alt.trim())) bad("alt-is-a-filename", `"${alt}" is a filename, not a description of the image.`);
    return;
  }

  if (desc?.kind === "items" && Array.isArray(value)) {
    value.forEach((item, index) => {
      if (!isObject(item)) return;
      for (const [key, inner] of Object.entries(item)) {
        semanticOfValue(sectionId, `${path}.${index}.${key}`, inner, desc.item?.[key], errors);
      }
    });
  }
}

function checkHref(sectionId: string, path: string, href: string, errors: DocumentError[]): void {
  const trimmed = href.trim();
  // A same-document fragment and a relative path carry no scheme, so they are safe
  // without parsing. Anything with a scheme has to be on the list.
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return;
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(trimmed)?.[1]?.toLowerCase();
  if (!scheme) return;
  if (!SAFE_SCHEMES.includes(scheme)) {
    errors.push({
      layer: "semantic",
      code: "unsafe-href",
      message: `"${trimmed}" uses the scheme "${scheme}", and a link may only use ${SAFE_SCHEMES.join(", ")} or a same document fragment.`,
      sectionId,
      path,
    });
  }
}
```

- [ ] **Step 4: Wire layer 4 into `validate`**

Add before the final `return`:

```ts
  const semantic = checkSemantic(document);
  if (semantic.length) return { ok: false, errors: semantic };
```

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `npx vitest run tests/engine-validate.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS. The 114 existing tests still pass, plus the engine's.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add engine/validate.ts tests/engine-validate.test.ts
git commit -m "Validate content, link schemes and alt text"
```

---

## Task 8: Resolving a `setProp` path against a descriptor

**Files:**
- Create: `engine/path.ts`
- Test: `tests/engine-patch.test.ts`

**Interfaces:**
- Consumes: `PropValue`, `Section` from `engine/document.ts`; `PropDescriptor`, `SectionDescriptor` from `engine/vocabulary.ts`.
- Produces: `parsePath(path: string): PathStep[] | null`, `PathStep = { key: string } | { index: number }`, and `resolvePath(descriptor: SectionDescriptor, path: string): PropDescriptor | null`, and `setAtPath(props: Record<string, PropValue>, path: string, value: PropValue): Record<string, PropValue>`.

This is the subtle one. JSON Patch was rejected because arbitrary paths reintroduce exactly the freedom the architecture removes, so `path` is not a free pointer. It names a prop on the section's own descriptor, optionally followed by an array index and one further key. `headline` and `features.2.title` are legal; `features.2.title.0.deep` is not, and neither is a path the descriptor does not declare. `setAtPath` never mutates its input.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-patch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PropValue } from "../engine/document";
import { parsePath, resolvePath, setAtPath } from "../engine/path";
import { VOCABULARY } from "../engine/vocabulary";

const hero = VOCABULARY["page-hero"]!;
const grid = VOCABULARY["feature-grid"]!;

describe("setProp paths", () => {
  it("parses a bare prop", () => {
    expect(parsePath("headline")).toEqual([{ key: "headline" }]);
  });

  it("parses a prop, an index and one further key", () => {
    expect(parsePath("features.2.title")).toEqual([{ key: "features" }, { index: 2 }, { key: "title" }]);
  });

  it.each(["", ".", "a..b", "features.2.title.0", "features.2.title.extra", "features.-1.title", "features.1.5.title", "__proto__", "constructor.prototype", "features.2.__proto__"])(
    "refuses the path %p",
    (path) => {
      expect(parsePath(path)).toBeNull();
    },
  );

  it("resolves a bare prop to its descriptor", () => {
    expect(resolvePath(hero, "headline")?.kind).toBe("text");
  });

  it("resolves a path into an item", () => {
    expect(resolvePath(grid, "features.0.title")?.kind).toBe("text");
    expect(resolvePath(grid, "features.0.body")?.kind).toBe("runs");
  });

  it("refuses a prop the descriptor does not declare, rather than creating a field", () => {
    expect(resolvePath(hero, "subtitle")).toBeNull();
    expect(resolvePath(grid, "features.0.nope")).toBeNull();
  });

  it("refuses an index into a prop that is not a list", () => {
    expect(resolvePath(hero, "headline.0.text")).toBeNull();
  });

  it("sets a bare prop without mutating the input", () => {
    const props: Record<string, PropValue> = { headline: "Old" };
    const next = setAtPath(props, "headline", "New");
    expect(next.headline).toBe("New");
    expect(props.headline).toBe("Old");
  });

  it("sets a field inside an item without mutating the input", () => {
    const props: Record<string, PropValue> = { features: [{ title: "A" }, { title: "B" }] };
    const next = setAtPath(props, "features.1.title", "Z");
    expect(next.features).toEqual([{ title: "A" }, { title: "Z" }]);
    expect(props.features).toEqual([{ title: "A" }, { title: "B" }]);
  });

  it("appends when the index is one past the end, so a patch can add an item", () => {
    const props: Record<string, PropValue> = { features: [{ title: "A" }] };
    expect(setAtPath(props, "features.1.title", "B").features).toEqual([{ title: "A" }, { title: "B" }]);
  });

  it("throws on an index further past the end, rather than leaving a hole", () => {
    expect(() => setAtPath({ features: [] }, "features.4.title", "B")).toThrow(/out of range/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-patch.test.ts`
Expected: FAIL. Cannot resolve `../engine/path`.

- [ ] **Step 3: Write `engine/path.ts`**

```ts
// A setProp path is not a JSON pointer. It names a prop on the section's own
// descriptor, optionally an index into a list, and optionally one field inside
// that item. Nothing deeper, because a free pointer would hand back exactly the
// freedom the closed vocabulary exists to remove.

import type { PropValue } from "./document.ts";
import type { PropDescriptor, SectionDescriptor } from "./vocabulary.ts";

export type PathStep = { key: string } | { index: number };

/** Keys that would reach the prototype chain rather than the document. */
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export function parsePath(path: string): PathStep[] | null {
  if (path === "") return null;
  const parts = path.split(".");
  if (parts.length > 3) return null;
  if (parts.some((p) => p === "")) return null;

  const [first, second, third] = parts;
  if (first === undefined || !isKey(first)) return null;
  if (second === undefined) return [{ key: first }];

  const index = Number(second);
  if (!Number.isInteger(index) || index < 0 || String(index) !== second) return null;
  if (third === undefined) return [{ key: first }, { index }];
  if (!isKey(third)) return null;
  return [{ key: first }, { index }, { key: third }];
}

const isKey = (s: string) => /^[A-Za-z][A-Za-z0-9]*$/.test(s) && !FORBIDDEN.has(s);

export function resolvePath(descriptor: SectionDescriptor, path: string): PropDescriptor | null {
  const steps = parsePath(path);
  if (!steps) return null;
  const first = steps[0];
  if (!first || !("key" in first)) return null;
  const prop = descriptor.props[first.key];
  if (!prop) return null;
  if (steps.length === 1) return prop;

  // An index only means something on a list.
  if (prop.kind !== "items" && prop.kind !== "actions" && prop.kind !== "links" && prop.kind !== "runs") return null;
  if (steps.length === 2) return prop;

  const third = steps[2];
  if (!third || !("key" in third)) return null;
  return prop.item?.[third.key] ?? null;
}

export function setAtPath(props: Record<string, PropValue>, path: string, value: PropValue): Record<string, PropValue> {
  const steps = parsePath(path);
  if (!steps) throw new Error(`setAtPath: "${path}" is not a settable path`);
  const first = steps[0];
  if (!first || !("key" in first)) throw new Error(`setAtPath: "${path}" is not a settable path`);

  const next = { ...props };
  if (steps.length === 1) {
    next[first.key] = value;
    return next;
  }

  const second = steps[1];
  if (!second || !("index" in second)) throw new Error(`setAtPath: "${path}" is not a settable path`);
  const list = Array.isArray(next[first.key]) ? [...(next[first.key] as PropValue[])] : [];
  if (second.index > list.length) throw new Error(`setAtPath: index ${second.index} is out of range for "${first.key}", which holds ${list.length}`);

  if (steps.length === 2) {
    list[second.index] = value;
  } else {
    const third = steps[2];
    if (!third || !("key" in third)) throw new Error(`setAtPath: "${path}" is not a settable path`);
    const item = list[second.index];
    const base = item !== undefined && typeof item === "object" && item !== null && !Array.isArray(item) ? item : {};
    list[second.index] = { ...(base as Record<string, PropValue>), [third.key]: value };
  }
  next[first.key] = list;
  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine-patch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/path.ts tests/engine-patch.test.ts
git commit -m "Resolve a setProp path against its section descriptor"
```

---

## Task 9: The six patch operations, apply and invert

**Files:**
- Create: `engine/patch.ts`
- Test: `tests/engine-patch.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `PageDocument`, `Section`, `PropValue`, `ThemeRef`, `Measure` from `engine/document.ts`; `DocumentError` from `engine/errors.ts`; `newSectionId` from `engine/ids.ts`; `setAtPath`, `resolvePath` from `engine/path.ts`; `descriptorFor` from `engine/vocabulary.ts`; `validate` from `engine/validate.ts`.
- Produces: `Position`, `Op`, and `applyPatch(document: PageDocument, ops: Op[]): PatchResult`, where `PatchResult = { ok: true; document: PageDocument; inverse: Op[] } | { ok: false; errors: DocumentError[] }`.

A patch is applied to a copy and swapped in on success, so a document is never left partly applied. The inverse is returned rather than stored, which makes an undo stack nearly free.

One subtlety worth stating in code: ids are never reused for a *different* section, but an inverse restoring a removed section brings back its own id. That is restoration, not reuse, which is why `insertSection` accepts an optional `id`.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-patch.test.ts`:

```ts
import { DOCUMENT_VERSION, type PageDocument } from "../engine/document";
import { applyPatch, type Op } from "../engine/patch";

function doc(): PageDocument {
  return {
    version: DOCUMENT_VERSION,
    theme: { name: "aqua", mode: "auto", accentHue: null },
    page: { measure: "page" },
    meta: { title: "Kestrel", description: "Ship on Friday." },
    sections: [
      { id: "s_0001", type: "page-hero", props: { headline: "One" } },
      { id: "s_0002", type: "feature-grid", props: { features: [{ title: "A" }, { title: "B" }] } },
      { id: "s_0003", type: "cta-band", props: { title: "Three" } },
    ],
  };
}

const ids = (d: PageDocument) => d.sections.map((s) => s.id);
const ok = (r: ReturnType<typeof applyPatch>) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.errors)}`);
  return r;
};

describe("patch operations", () => {
  it("sets a prop", () => {
    const r = ok(applyPatch(doc(), [{ op: "setProp", sectionId: "s_0001", path: "headline", value: "Two" }]));
    expect(r.document.sections[0]!.props.headline).toBe("Two");
  });

  it("leaves the input document untouched", () => {
    const before = doc();
    applyPatch(before, [{ op: "setProp", sectionId: "s_0001", path: "headline", value: "Two" }]);
    expect(before.sections[0]!.props.headline).toBe("One");
  });

  it("inserts at the start and after a named section", () => {
    const start = ok(applyPatch(doc(), [{ op: "insertSection", type: "cta-band", props: { title: "New" }, position: "start" }]));
    expect(start.document.sections[0]!.type).toBe("cta-band");
    const after = ok(applyPatch(doc(), [{ op: "insertSection", type: "cta-band", props: { title: "New" }, position: { afterId: "s_0001" } }]));
    expect(ids(after.document)[1]).not.toBe("s_0002");
    expect(ids(after.document)).toHaveLength(4);
  });

  it("mints an id that is not already taken", () => {
    const r = ok(applyPatch(doc(), [{ op: "insertSection", type: "cta-band", props: { title: "New" }, position: "start" }]));
    const minted = r.document.sections[0]!.id;
    expect(["s_0001", "s_0002", "s_0003"]).not.toContain(minted);
  });

  it("moves a section", () => {
    const r = ok(applyPatch(doc(), [{ op: "moveSection", sectionId: "s_0003", position: "start" }]));
    expect(ids(r.document)).toEqual(["s_0003", "s_0001", "s_0002"]);
  });

  it("removes a section", () => {
    const r = ok(applyPatch(doc(), [{ op: "removeSection", sectionId: "s_0002" }]));
    expect(ids(r.document)).toEqual(["s_0001", "s_0003"]);
  });

  it("sets the theme and the page without replacing the whole object", () => {
    const r = ok(applyPatch(doc(), [{ op: "setTheme", theme: { name: "sumi" } }, { op: "setPage", page: { measure: "narrow" } }]));
    expect(r.document.theme).toEqual({ name: "sumi", mode: "auto", accentHue: null });
    expect(r.document.page.measure).toBe("narrow");
  });

  it("applies several operations in order", () => {
    const r = ok(applyPatch(doc(), [{ op: "removeSection", sectionId: "s_0001" }, { op: "moveSection", sectionId: "s_0003", position: "start" }]));
    expect(ids(r.document)).toEqual(["s_0003", "s_0002"]);
  });

  it.each([
    [{ op: "setProp", sectionId: "s_9999", path: "headline", value: "x" }, "stale-target"],
    [{ op: "moveSection", sectionId: "s_9999", position: "start" }, "stale-target"],
    [{ op: "removeSection", sectionId: "s_9999" }, "stale-target"],
    [{ op: "insertSection", type: "cta-band", props: { title: "x" }, position: { afterId: "s_9999" } }, "stale-target"],
    [{ op: "setProp", sectionId: "s_0001", path: "nope", value: "x" }, "unknown-prop"],
    [{ op: "setProp", sectionId: "s_0001", path: "headline.0.x", value: "x" }, "unknown-prop"],
    [{ op: "insertSection", type: "carousel", props: {}, position: "start" }, "unknown-section"],
    [{ op: "insertSection", type: "timeline", props: { entries: [] }, position: "start" }, "section-not-built"],
  ] as [Op, string][])("rejects %j with code %s", (op, code) => {
    const r = applyPatch(doc(), [op]);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toContain(code);
  });

  it("leaves the document unchanged when any operation in the patch fails", () => {
    const before = doc();
    const r = applyPatch(before, [
      { op: "setProp", sectionId: "s_0001", path: "headline", value: "Two" },
      { op: "removeSection", sectionId: "s_9999" },
    ]);
    expect(r.ok).toBe(false);
    expect(before.sections[0]!.props.headline).toBe("One");
  });

  it("refuses a patch whose result would not validate", () => {
    const r = applyPatch(doc(), [{ op: "setProp", sectionId: "s_0001", path: "align", value: "justify" }]);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toContain("bad-enum");
  });
});

describe("patch inverses", () => {
  const roundTrip = (ops: Op[]) => {
    const before = doc();
    const forward = ok(applyPatch(before, ops));
    const back = ok(applyPatch(forward.document, forward.inverse));
    return back.document;
  };

  it.each([
    [[{ op: "setProp", sectionId: "s_0001", path: "headline", value: "Two" }]],
    [[{ op: "setProp", sectionId: "s_0002", path: "features.0.title", value: "Z" }]],
    [[{ op: "insertSection", type: "cta-band", props: { title: "New" }, position: "start" }]],
    [[{ op: "insertSection", type: "cta-band", props: { title: "New" }, position: { afterId: "s_0002" } }]],
    [[{ op: "moveSection", sectionId: "s_0003", position: "start" }]],
    [[{ op: "moveSection", sectionId: "s_0001", position: { afterId: "s_0003" } }]],
    [[{ op: "removeSection", sectionId: "s_0002" }]],
    [[{ op: "removeSection", sectionId: "s_0001" }]],
    [[{ op: "setTheme", theme: { name: "sumi", accentHue: 120 } }]],
    [[{ op: "setPage", page: { measure: "narrow" } }]],
    [[{ op: "removeSection", sectionId: "s_0001" }, { op: "moveSection", sectionId: "s_0003", position: "start" }]],
  ] as [Op[]][])("applying %j then its inverse returns the original", (ops) => {
    expect(roundTrip(ops)).toEqual(doc());
  });

  it("restores a removed section under its own id, which is restoration and not reuse", () => {
    const forward = ok(applyPatch(doc(), [{ op: "removeSection", sectionId: "s_0002" }]));
    const back = ok(applyPatch(forward.document, forward.inverse));
    expect(ids(back.document)).toEqual(["s_0001", "s_0002", "s_0003"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-patch.test.ts -t "patch operations"`
Expected: FAIL. Cannot resolve `../engine/patch`.

- [ ] **Step 3: Write `engine/patch.ts`**

```ts
// Iteration emits patches, not whole documents, so a user who changed one
// headline does not have everything else rewritten underneath them. The operation
// set is closed on purpose: six operations are validatable, map onto what people
// actually say, and make an undo stack nearly free.

import type { Measure, PageDocument, PropValue, Section, ThemeRef } from "./document.ts";
import type { DocumentError } from "./errors.ts";
import { newSectionId } from "./ids.ts";
import { resolvePath, setAtPath } from "./path.ts";
import { validate } from "./validate.ts";
import { descriptorFor } from "./vocabulary.ts";

export type Position = "start" | { afterId: string };

export type Op =
  | { op: "setProp"; sectionId: string; path: string; value: PropValue }
  /** `id` is set only by an inverse, which restores a section under its own id. */
  | { op: "insertSection"; type: string; props: Record<string, PropValue>; position: Position; id?: string; slots?: Record<string, Section[]> }
  | { op: "moveSection"; sectionId: string; position: Position }
  | { op: "removeSection"; sectionId: string }
  | { op: "setTheme"; theme: Partial<ThemeRef> }
  | { op: "setPage"; page: Partial<{ measure: Measure }> };

export type PatchResult =
  | { ok: true; document: PageDocument; inverse: Op[] }
  | { ok: false; errors: DocumentError[] };

const stale = (what: string): DocumentError => ({
  layer: "referential",
  code: "stale-target",
  message: `There is no section "${what}" any more. It was probably removed since this patch was planned.`,
});

/** Where a section sits now, expressed as a Position, so a move can be undone. */
function positionOf(sections: Section[], index: number): Position {
  const previous = sections[index - 1];
  return previous ? { afterId: previous.id } : "start";
}

function indexFor(sections: Section[], position: Position): number | null {
  if (position === "start") return 0;
  const at = sections.findIndex((s) => s.id === position.afterId);
  return at === -1 ? null : at + 1;
}

export function applyPatch(document: PageDocument, ops: Op[]): PatchResult {
  // Applied to a copy and swapped in on success, so a failure halfway through a
  // patch leaves the caller's document exactly as it was.
  let next: PageDocument = structuredClone(document);
  const inverse: Op[] = [];
  const errors: DocumentError[] = [];

  for (const op of ops) {
    const taken = new Set(allSections(next).map((s) => s.id));

    if (op.op === "setProp") {
      const section = allSections(next).find((s) => s.id === op.sectionId);
      if (!section) { errors.push(stale(op.sectionId)); break; }
      const descriptor = descriptorFor(section.type);
      if (!descriptor || !resolvePath(descriptor, op.path)) {
        errors.push({ layer: "vocabulary", code: "unknown-prop", message: `"${section.type}" has no settable path "${op.path}".`, sectionId: section.id, path: op.path });
        break;
      }
      const before = readAtPath(section.props, op.path);
      section.props = setAtPath(section.props, op.path, op.value);
      inverse.unshift({ op: "setProp", sectionId: op.sectionId, path: op.path, value: before });
      continue;
    }

    if (op.op === "insertSection") {
      const descriptor = descriptorFor(op.type);
      if (!descriptor) { errors.push({ layer: "vocabulary", code: "unknown-section", message: `"${op.type}" is not a section type.` }); break; }
      if (descriptor.status !== "ready") { errors.push({ layer: "vocabulary", code: "section-not-built", message: `"${op.type}" is in the vocabulary but is not built yet.` }); break; }
      const at = indexFor(next.sections, op.position);
      if (at === null) { errors.push(stale(typeof op.position === "string" ? op.position : op.position.afterId)); break; }
      const id = op.id ?? newSectionId(taken);
      next.sections.splice(at, 0, { id, type: op.type, props: op.props, ...(op.slots ? { slots: op.slots } : {}) });
      inverse.unshift({ op: "removeSection", sectionId: id });
      continue;
    }

    if (op.op === "moveSection") {
      const from = next.sections.findIndex((s) => s.id === op.sectionId);
      if (from === -1) { errors.push(stale(op.sectionId)); break; }
      const home = positionOf(next.sections, from);
      const [section] = next.sections.splice(from, 1);
      const at = indexFor(next.sections, op.position);
      if (at === null || !section) { errors.push(stale(typeof op.position === "string" ? op.position : op.position.afterId)); break; }
      next.sections.splice(at, 0, section);
      inverse.unshift({ op: "moveSection", sectionId: op.sectionId, position: home });
      continue;
    }

    if (op.op === "removeSection") {
      const at = next.sections.findIndex((s) => s.id === op.sectionId);
      if (at === -1) { errors.push(stale(op.sectionId)); break; }
      const home = positionOf(next.sections, at);
      const [section] = next.sections.splice(at, 1);
      if (!section) { errors.push(stale(op.sectionId)); break; }
      inverse.unshift({ op: "insertSection", type: section.type, props: section.props, position: home, id: section.id, ...(section.slots ? { slots: section.slots } : {}) });
      continue;
    }

    if (op.op === "setTheme") {
      const before: Partial<ThemeRef> = {};
      for (const key of Object.keys(op.theme) as (keyof ThemeRef)[]) Object.assign(before, { [key]: next.theme[key] });
      next.theme = { ...next.theme, ...op.theme };
      inverse.unshift({ op: "setTheme", theme: before });
      continue;
    }

    // setPage. Exhaustive over Op, so TypeScript narrows this to the last case.
    const before = { measure: next.page.measure };
    next.page = { ...next.page, ...op.page };
    inverse.unshift({ op: "setPage", page: before });
  }

  if (errors.length) return { ok: false, errors };

  // A patch that produces an invalid document is refused as a whole, so the
  // caller never has to hold a document that would not emit.
  const checked = validate(next);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  return { ok: true, document: checked.document, inverse };
}

function allSections(document: PageDocument): Section[] {
  const out: Section[] = [];
  const walk = (sections: Section[]) => {
    for (const section of sections) {
      out.push(section);
      for (const slot of Object.values(section.slots ?? {})) walk(slot);
    }
  };
  walk(document.sections);
  return out;
}

/** The value a setProp is about to overwrite, so the inverse can put it back. */
function readAtPath(props: Record<string, PropValue>, path: string): PropValue {
  const parts = path.split(".");
  let current: unknown = props;
  for (const part of parts) {
    if (Array.isArray(current)) current = current[Number(part)];
    else if (current && typeof current === "object") current = (current as Record<string, unknown>)[part];
    else return null;
  }
  return (current ?? null) as PropValue;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/engine-patch.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add engine/patch.ts tests/engine-patch.test.ts
git commit -m "Apply and invert the six patch operations"
```

---

## Task 10: Forward migration by version

**Files:**
- Create: `engine/migrate.ts`
- Test: `tests/engine-document.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `DOCUMENT_VERSION` from `engine/document.ts`; `DocumentError` from `engine/errors.ts`.
- Produces: `migrate(input: unknown): { ok: true; document: unknown } | { ok: false; error: DocumentError }`.

There is one version today, so `migrate` is nearly empty. It exists now rather than later because the stored original must never be mutated in place, and that rule is cheaper to establish while there is nothing to migrate than to retrofit once there is.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-document.test.ts`:

```ts
import { migrate } from "../engine/migrate";

describe("migration", () => {
  it("passes a current document through unchanged", () => {
    const input = { version: DOCUMENT_VERSION, sections: [] };
    const result = migrate(input);
    expect(result.ok).toBe(true);
    expect(result.ok ? result.document : null).toEqual(input);
  });

  it("never mutates the stored original", () => {
    const input = { version: DOCUMENT_VERSION, sections: [{ id: "s_0001" }] };
    const copy = structuredClone(input);
    migrate(input);
    expect(input).toEqual(copy);
  });

  it("refuses a version from the future, because it cannot know what changed", () => {
    const result = migrate({ version: DOCUMENT_VERSION + 1 });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("version-from-the-future");
  });

  it("refuses something with no version at all", () => {
    expect(migrate({}).ok).toBe(false);
    expect(migrate(null).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-document.test.ts -t "migration"`
Expected: FAIL. Cannot resolve `../engine/migrate`.

- [ ] **Step 3: Write `engine/migrate.ts`**

```ts
// There is one version today, so this is nearly empty. It exists anyway, because
// the rule it enforces is cheap to establish now and expensive to retrofit: the
// stored original is never mutated in place, so a migration that turns out to be
// wrong has not already destroyed the document it was reading.

import { DOCUMENT_VERSION } from "./document.ts";
import type { DocumentError } from "./errors.ts";

export type MigrateResult = { ok: true; document: unknown } | { ok: false; error: DocumentError };

/** One entry per version, each taking the shape at N and returning the shape at N+1. */
const STEPS: Record<number, (document: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(input: unknown): MigrateResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: { layer: "shape", code: "not-an-object", message: "A stored document must be a JSON object." } };
  }
  const version = (input as Record<string, unknown>).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: { layer: "shape", code: "missing-version", message: "A stored document must carry an integer version." } };
  }
  if (version > DOCUMENT_VERSION) {
    return {
      ok: false,
      error: { layer: "shape", code: "version-from-the-future", message: `This document is version ${version} and this engine knows up to ${DOCUMENT_VERSION}. It was written by a newer build.` },
    };
  }

  let document = structuredClone(input) as Record<string, unknown>;
  for (let at = version; at < DOCUMENT_VERSION; at++) {
    const step = STEPS[at];
    if (!step) {
      return { ok: false, error: { layer: "shape", code: "no-migration", message: `No migration from version ${at} to ${at + 1}.` } };
    }
    document = step(document);
    document.version = at + 1;
  }
  return { ok: true, document };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine-document.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/migrate.ts tests/engine-document.test.ts
git commit -m "Migrate stored documents forward by version"
```

---

## Task 11: The asset resolver and its bundled placeholders

**Files:**
- Create: `engine/assets.ts`
- Test: `tests/engine-emit.test.ts`

**Interfaces:**
- Consumes: nothing from the engine.
- Produces: `Asset = { id: string; src: string; width: number; height: number }`, `AssetResolver` with `has(id: string): boolean` and `get(id: string): Asset | undefined`, `PLACEHOLDERS: Asset[]`, and `placeholderAssets(): AssetResolver`.

Where assets really live is sub-project 4's problem. The engine needs the interface now, with one implementation, so the emitter and layer 3 can be finished and tested. A placeholder is an inline SVG data URI, which keeps the emitted output self-contained and means a document can never reach a remote host.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-emit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PLACEHOLDERS, placeholderAssets } from "../engine/assets";

describe("the placeholder asset store", () => {
  it("offers a few shapes, so a document can pick a sensible aspect", () => {
    expect(PLACEHOLDERS.length).toBeGreaterThanOrEqual(3);
    const aspects = new Set(PLACEHOLDERS.map((a) => (a.width / a.height).toFixed(2)));
    expect(aspects.size).toBeGreaterThanOrEqual(3);
  });

  it("answers has and get for every placeholder it ships", () => {
    const assets = placeholderAssets();
    for (const a of PLACEHOLDERS) {
      expect(assets.has(a.id)).toBe(true);
      expect(assets.get(a.id)?.width).toBe(a.width);
    }
  });

  it("does not answer for an id it does not hold", () => {
    const assets = placeholderAssets();
    expect(assets.has("nope")).toBe(false);
    expect(assets.get("nope")).toBeUndefined();
  });

  it("holds no remote URL, so emitted output cannot hotlink", () => {
    for (const a of PLACEHOLDERS) {
      expect(a.src.startsWith("data:image/svg+xml,")).toBe(true);
      expect(a.src).not.toMatch(/https?:\/\//);
    }
  });

  it("gives every placeholder a src that survives being put in an attribute", () => {
    for (const a of PLACEHOLDERS) {
      expect(a.src).not.toContain('"');
      expect(a.src).not.toContain("<");
      expect(a.src).not.toContain(">");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-emit.test.ts`
Expected: FAIL. Cannot resolve `../engine/assets`.

- [ ] **Step 3: Write `engine/assets.ts`**

```ts
// Where assets really live belongs to the publishing sub-project. The engine needs
// the interface now so the emitter and the referential checks can be finished, and
// one implementation so the tests have something real to resolve against.
//
// A placeholder is an inline SVG data URI rather than a file on a host, which keeps
// emitted output self contained and means no document can reach a remote server.

export interface Asset {
  id: string;
  /** A data URI, already percent encoded and safe inside an attribute. */
  src: string;
  width: number;
  height: number;
}

export interface AssetResolver {
  has(id: string): boolean;
  get(id: string): Asset | undefined;
}

/** A flat grey panel at a given size, encoded so it can sit in an attribute. */
function panel(width: number, height: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'><rect width='${width}' height='${height}' fill='%23d8d8d8'/></svg>`;
  return `data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22").replace(/#/g, "%23")}`;
}

export const PLACEHOLDERS: Asset[] = [
  { id: "placeholder-wide", src: panel(1600, 900), width: 1600, height: 900 },
  { id: "placeholder-square", src: panel(1000, 1000), width: 1000, height: 1000 },
  { id: "placeholder-portrait", src: panel(900, 1200), width: 900, height: 1200 },
  { id: "placeholder-banner", src: panel(2000, 600), width: 2000, height: 600 },
];

export function placeholderAssets(): AssetResolver {
  const byId = new Map(PLACEHOLDERS.map((a) => [a.id, a]));
  return { has: (id) => byId.has(id), get: (id) => byId.get(id) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine-emit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/assets.ts tests/engine-emit.test.ts
git commit -m "Add the asset resolver and its bundled placeholders"
```

---

## Task 12: The runs renderer, and widening the block CSS to section class names

**Files:**
- Create: `registry/blocks/sections/runs.tsx`
- Modify: `registry/blocks/blocks.css` (widen selectors, add no declarations)
- Test: `tests/engine-sections.test.tsx`

**Interfaces:**
- Consumes: nothing. **Registry code must not import from `engine/`.** The registry is source a user copies and owns; a dependency on the engine would break that promise and the packed tarball. So `runs.tsx` declares its own `Run` type, and Task 13's components declare their own props. The engine's document types and the registry's prop types are kept compatible by a test, not by a shared import.
- Produces: `Runs` (a component taking `{ runs?: Run[] }`) and the `Run` type, both from `registry/blocks/sections/runs.tsx`, with extensionless relative imports as the rest of `registry/` uses.

**Why the CSS changes this way.** The emitted page must never carry generated styling, because generated CSS would be unchecked CSS and the whole product promise is that output is WCAG AA in every theme. `rulesFor` already reads `registry/blocks/blocks.css` when it checks all 17 themes, so CSS that lives there is checked for free. The three extracted sections therefore reuse the declarations the shipped landing block already uses, by widening its selectors with `:is()` rather than adding new ones. `parseRules` expands `:is()`, so the checker sees and checks both names. No new declaration means no new contrast pair and no new risk.

- [ ] **Step 1: Find the classes to widen**

Run: `grep -n "mi-landing" registry/blocks/blocks.css`

The sections in Task 13 use exactly these ten classes. Note each one's current selector text:

```
mi-landing-inner      mi-landing-eyebrow    mi-landing-headline
mi-landing-sub        mi-landing-actions    mi-landing-head
mi-landing-grid       mi-landing-feature-icon
mi-landing-cta-panel  mi-landing-cta-title
```

`mi-landing-hero`, `mi-landing-features` and `mi-landing-cta` are used verbatim by the components, so they are not widened. Only the inner classes get a section twin.

- [ ] **Step 2: Write the failing test**

Create `tests/engine-sections.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const blocksCss = () => readFileSync(join(root, "registry/blocks/blocks.css"), "utf8");

/** Every class the extracted sections put in their markup. */
export const SECTION_CLASSES = [
  "mi-section-inner",
  "mi-section-eyebrow",
  "mi-section-headline",
  "mi-section-sub",
  "mi-section-actions",
  "mi-section-head",
  "mi-section-grid",
  "mi-section-feature-icon",
  "mi-section-cta-panel",
  "mi-section-cta-title",
];

describe("the section class names", () => {
  it.each(SECTION_CLASSES)("%s is styled by blocks.css", (name) => {
    expect(blocksCss()).toContain(`.${name}`);
  });

  it("adds no new declaration block, only widens existing selectors", () => {
    // Every section class must appear inside an :is() beside its landing twin, so
    // the two share one declaration block. A section class that owns its own block
    // would be unchecked CSS, which is exactly what we are avoiding.
    const css = blocksCss();
    for (const name of SECTION_CLASSES) {
      const twin = name.replace("mi-section-", "mi-landing-");
      // (?![\w-]) rather than \b, because \b after "cta" also matches inside
      // "cta-panel" and the test would pass on the wrong rule.
      const edge = "(?![\\w-])";
      const a = `\\.${twin}${edge}`;
      const b = `\\.${name}${edge}`;
      const pattern = new RegExp(`:is\\([^)]*${a}[^)]*${b}[^)]*\\)|:is\\([^)]*${b}[^)]*${a}[^)]*\\)`);
      expect(pattern.test(css), `${name} must sit in an :is() with .${twin}`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine-sections.test.tsx`
Expected: FAIL. None of the `mi-section-*` names are in `blocks.css` yet.

- [ ] **Step 4: Widen the ten selectors in `registry/blocks/blocks.css`**

For each of the ten classes, replace the bare class in its selector with an `:is()` holding both names. Change only the selector text; do not touch a single declaration, and do not reformat lines you did not change. For example, a rule that reads

```css
.mi-landing-headline {
```

becomes

```css
:is(.mi-landing-headline, .mi-section-headline) {
```

and a compound selector such as

```css
.mi-landing-hero .mi-landing-inner {
```

becomes

```css
.mi-landing-hero :is(.mi-landing-inner, .mi-section-inner) {
```

`:where([data-theme])` prefixes and `@layer components` stay exactly as they are. `:is()` takes the specificity of its most specific argument, and both arguments here are single classes, so specificity does not move.

- [ ] **Step 5: Write `registry/blocks/sections/runs.tsx`**

```tsx
/** A span of text. Documents carry no markup, so emphasis is structural. */
export interface Run {
  text: string;
  em?: boolean;
  strong?: boolean;
  code?: boolean;
  href?: string;
}

/** Renders a run list as text. A run can be emphasised, code, a link, or plain. */
export function Runs({ runs }: { runs?: Run[] }) {
  if (!runs?.length) return null;
  return (
    <>
      {runs.map((run, index) => {
        // Runs have no identity of their own, and a run list is only ever
        // replaced wholesale, so the index is a stable enough key here.
        const key = index;
        let node = <>{run.text}</>;
        if (run.code) node = <code>{node}</code>;
        if (run.em) node = <em>{node}</em>;
        if (run.strong) node = <strong>{node}</strong>;
        if (run.href) {
          return (
            <a key={key} href={run.href}>
              {node}
            </a>
          );
        }
        return <span key={key}>{node}</span>;
      })}
    </>
  );
}
```

- [ ] **Step 6: Run the tests and the contrast checker**

Run: `npx vitest run tests/engine-sections.test.tsx`
Expected: PASS.

Run: `npx vitest run tests/contrast.test.ts`
Expected: PASS. The widening adds no declaration, so the pair count must not change.

Run: `node scripts/contrast.ts`
Expected: the same enforced pair count as before the change. Note it: the baseline is **1112 enforced pairs**. If the number moved, a declaration was added or a selector was broken. Find it before going on.

- [ ] **Step 7: Commit**

```bash
git add registry/blocks/sections/runs.tsx registry/blocks/blocks.css tests/engine-sections.test.tsx
git commit -m "Widen the landing block CSS to section class names, and add the runs renderer"
```

---

## Task 13: The three section components

**Files:**
- Create: `registry/blocks/sections/page-hero.tsx`
- Create: `registry/blocks/sections/feature-grid.tsx`
- Create: `registry/blocks/sections/cta-band.tsx`
- Test: `tests/engine-sections.test.tsx` (add describe blocks)

**Interfaces:**
- Consumes: `Runs`, `Run` from `./runs`; `Button` from `../../ui/button`; `Card`, `CardDescription`, `CardHeader`, `CardTitle` from `../../ui/card`.
- Produces, each as a default export plus its props interface:
  - `PageHero`, `PageHeroProps = { eyebrow?: string; headline: string; body?: Run[]; actions?: SectionAction[]; align?: "start" | "center"; media?: SectionImage | null }`
  - `FeatureGrid`, `FeatureGridProps = { title?: string; lede?: Run[]; columns?: "2" | "3" | "4"; features?: { title: string; body?: Run[]; icon?: string }[] }`
  - `CtaBand`, `CtaBandProps = { title: string; body?: Run[]; actions?: SectionAction[] }`
  - `SectionAction = { label: string; variant: "primary" | "secondary"; href?: string }` and `SectionImage = { src: string; alt: string; width: number; height: number }`, both from `./types`.

Note `SectionImage` takes a `src`, not an `assetId`. Resolving an id to a source is the engine's job, so the registry component stays a plain component a user can hand a URL to.

The landing block's hero and CTA buttons are `DialogTrigger`s wired to a page level dialog. A generated section has no dialog, so an action becomes a `Button` or an anchor styled as one. That is the one behavioural difference from the block these are extracted from, and it is deliberate.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-sections.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import CtaBand from "../registry/blocks/sections/cta-band";
import FeatureGrid from "../registry/blocks/sections/feature-grid";
import PageHero from "../registry/blocks/sections/page-hero";
import type { Run } from "../registry/blocks/sections/runs";

describe("PageHero", () => {
  it("renders the headline as the only h1", () => {
    render(<PageHero headline="Ship on Friday." />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ship on Friday.");
  });

  it("renders an eyebrow and a body made of runs", () => {
    const body: Run[] = [{ text: "Deploy previews, " }, { text: "in seconds", em: true }];
    render(<PageHero headline="H" eyebrow="Public beta" body={body} />);
    expect(screen.getByText("Public beta")).toBeTruthy();
    expect(screen.getByText("in seconds").tagName).toBe("EM");
  });

  it("renders a primary and a secondary action", () => {
    render(<PageHero headline="H" actions={[{ label: "Start free", variant: "primary" }, { label: "Read the docs", variant: "secondary" }]} />);
    expect(screen.getByRole("button", { name: "Start free" }).dataset.variant).toBe("primary");
    expect(screen.getByRole("button", { name: "Read the docs" }).dataset.variant).toBe("secondary");
  });

  it("renders an action with an href as a link, not a button", () => {
    render(<PageHero headline="H" actions={[{ label: "Docs", variant: "secondary", href: "/docs" }]} />);
    expect(screen.getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("/docs");
  });

  it("carries the alignment as a data attribute, so the theme styles it", () => {
    const { container } = render(<PageHero headline="H" align="start" />);
    expect(container.querySelector('[data-slot="page-hero"]')?.getAttribute("data-align")).toBe("start");
  });

  it("defaults to centered, matching the shipped landing hero", () => {
    const { container } = render(<PageHero headline="H" />);
    expect(container.querySelector('[data-slot="page-hero"]')?.getAttribute("data-align")).toBe("center");
  });

  it("renders media with its alt text, width and height", () => {
    render(<PageHero headline="H" media={{ src: "data:image/svg+xml,x", alt: "A deploy graph", width: 1600, height: 900 }} />);
    const img = screen.getByRole("img", { name: "A deploy graph" });
    expect(img.getAttribute("width")).toBe("1600");
    expect(img.getAttribute("height")).toBe("900");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("renders no media element when there is none", () => {
    render(<PageHero headline="H" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("FeatureGrid", () => {
  it("renders one card per feature, each with an h3", () => {
    render(<FeatureGrid features={[{ title: "Searchable" }, { title: "Alerts" }, { title: "Rollback" }]} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("renders a title as an h2 and a lede from runs", () => {
    render(<FeatureGrid title="Three things" lede={[{ text: "Properly." }]} features={[]} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Three things");
    expect(screen.getByText("Properly.")).toBeTruthy();
  });

  it("carries the column count as a data attribute", () => {
    const { container } = render(<FeatureGrid columns="4" features={[]} />);
    expect(container.querySelector('[data-slot="feature-grid"]')?.getAttribute("data-columns")).toBe("4");
  });

  it("defaults to three columns, matching the shipped landing grid", () => {
    const { container } = render(<FeatureGrid features={[]} />);
    expect(container.querySelector('[data-slot="feature-grid"]')?.getAttribute("data-columns")).toBe("3");
  });

  it("renders nothing for a feature list that is empty", () => {
    render(<FeatureGrid features={[]} />);
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});

describe("CtaBand", () => {
  it("renders the title as an h2 and the actions", () => {
    render(<CtaBand title="Put your next deploy on watch" actions={[{ label: "Start free", variant: "primary" }]} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Put your next deploy on watch");
    expect(screen.getByRole("button", { name: "Start free" })).toBeTruthy();
  });

  it("renders a body from runs", () => {
    render(<CtaBand title="T" body={[{ text: "Connect a repository." }]} />);
    expect(screen.getByText("Connect a repository.")).toBeTruthy();
  });
});

describe("the registry prop types and the engine document types", () => {
  it("keep the run shape compatible without sharing an import", () => {
    // Registry code must not import from engine/, so this is the seam that keeps
    // the two in step. If the engine's Run grows a field, this fails to compile.
    const fromEngine: import("../engine/document").Run = { text: "x", em: true, strong: true, code: true, href: "/a" };
    const forRegistry: Run = fromEngine;
    expect(forRegistry.text).toBe("x");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-sections.test.tsx`
Expected: FAIL. None of the three components resolve.

- [ ] **Step 3: Write `registry/blocks/sections/types.ts`**

```ts
/** An action a section can offer. A plain button, or a link when it has an href. */
export interface SectionAction {
  label: string;
  variant: "primary" | "secondary";
  href?: string;
}

/** An image a section can show. The src is already resolved, so the component
 * stays a plain component you can hand a URL to. */
export interface SectionImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}
```

- [ ] **Step 4: Write `registry/blocks/sections/actions.tsx`**

```tsx
import { Button } from "../../ui/button";
import type { SectionAction } from "./types";

/** A row of actions. An action with an href is a link, because it navigates. */
export function Actions({ actions, size }: { actions?: SectionAction[]; size?: "md" | "lg" }) {
  if (!actions?.length) return null;
  return (
    <div className="mi-section-actions">
      {actions.map((action) =>
        action.href ? (
          <a key={action.label} className="mi-button" data-slot="button" data-variant={action.variant} data-size={size ?? "md"} href={action.href}>
            {action.label}
          </a>
        ) : (
          <Button key={action.label} variant={action.variant} size={size ?? "md"}>
            {action.label}
          </Button>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write `registry/blocks/sections/page-hero.tsx`**

```tsx
import { Actions } from "./actions";
import { Runs, type Run } from "./runs";
import type { SectionAction, SectionImage } from "./types";

export interface PageHeroProps {
  eyebrow?: string;
  headline: string;
  body?: Run[];
  actions?: SectionAction[];
  align?: "start" | "center";
  media?: SectionImage | null;
}

/** The opening section of a page. One h1, and nothing else claims that level. */
export default function PageHero({ eyebrow, headline, body, actions, align = "center", media }: PageHeroProps) {
  return (
    <section className="mi-landing-hero" data-slot="page-hero" data-align={align}>
      <div className="mi-section-inner">
        {eyebrow ? <p className="mi-section-eyebrow">{eyebrow}</p> : null}
        <h1 className="mi-section-headline">{headline}</h1>
        {body?.length ? (
          <p className="mi-section-sub">
            <Runs runs={body} />
          </p>
        ) : null}
        <Actions actions={actions} size="lg" />
        {media ? <img src={media.src} alt={media.alt} width={media.width} height={media.height} loading="lazy" decoding="async" /> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Write `registry/blocks/sections/feature-grid.tsx`**

```tsx
import { Card, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Runs, type Run } from "./runs";

export interface FeatureGridProps {
  title?: string;
  lede?: Run[];
  columns?: "2" | "3" | "4";
  features?: { title: string; body?: Run[]; icon?: string }[];
}

/** A grid of short claims. The column count is an attribute so the theme owns the
 * breakpoints, which is the same division base.css and the themes already keep. */
export default function FeatureGrid({ title, lede, columns = "3", features }: FeatureGridProps) {
  return (
    <section className="mi-landing-features" data-slot="feature-grid" data-columns={columns}>
      <div className="mi-section-inner">
        {title || lede?.length ? (
          <div className="mi-section-head">
            {title ? <h2 className="mi-block-title">{title}</h2> : null}
            {lede?.length ? (
              <p className="mi-block-lede">
                <Runs runs={lede} />
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mi-section-grid">
          {features?.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                {feature.body?.length ? (
                  <CardDescription>
                    <Runs runs={feature.body} />
                  </CardDescription>
                ) : null}
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

`CardTitle` renders an `h3`. Confirm that with `grep -n "h3\|CardTitle" registry/ui/card.tsx` before writing the test's level assertion, and if it renders a different level, fix the test to match the component rather than changing the component.

- [ ] **Step 7: Write `registry/blocks/sections/cta-band.tsx`**

```tsx
import { Actions } from "./actions";
import { Runs, type Run } from "./runs";
import type { SectionAction } from "./types";

export interface CtaBandProps {
  title: string;
  body?: Run[];
  actions?: SectionAction[];
}

/** The closing ask. */
export default function CtaBand({ title, body, actions }: CtaBandProps) {
  return (
    <section className="mi-landing-cta" data-slot="cta-band">
      <div className="mi-section-inner">
        <div className="mi-section-cta-panel">
          <h2 className="mi-section-cta-title">{title}</h2>
          {body?.length ? (
            <p className="mi-landing-cta-sub">
              <Runs runs={body} />
            </p>
          ) : null}
          <Actions actions={actions} size="lg" />
        </div>
      </div>
    </section>
  );
}
```

`mi-landing-cta-sub` is used directly rather than widened, because the CTA body is the one place a section reuses a landing class whose name needs no section twin. Add `mi-landing-cta-sub` to nothing; leave that selector alone.

- [ ] **Step 8: Run the tests, the whole suite, the contrast checker and the typecheck**

Run: `npx vitest run tests/engine-sections.test.tsx`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS, including the 114 that existed before.

Run: `node scripts/contrast.ts`
Expected: still 1112 enforced pairs, all passing.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Regenerate the registry, because three new files joined it**

Run: `npm run registry && npm run meta`
Then: `npx vitest run tests/generators.test.ts`
Expected: PASS. The drift tests now compare against the regenerated files.

Confirm the new files landed with an explicit target:

Run: `node -e 'const r=require("fs").readFileSync("registry.json","utf8");const j=JSON.parse(r);const f=j.items.flatMap(i=>i.files||[]).filter(x=>x.path.includes("sections/"));console.log(f.length, f.every(x=>x.target))'`
Expected: a non-zero count and `true`. Every file needs a target or the shadcn CLI scatters the tree.

- [ ] **Step 10: Commit**

```bash
git add registry/blocks/sections registry.json registry/meta.json tests/engine-sections.test.tsx
git commit -m "Add three prop driven section components"
```

---

## Task 14: Emitting the page component

**Files:**
- Create: `engine/emit.ts`
- Test: `tests/engine-emit.test.ts` (add describe blocks)

**Interfaces:**
- Consumes: `PageDocument`, `Section`, `PropValue`, `ImageRef` from `engine/document.ts`; `AssetResolver` from `engine/assets.ts`; `VOCABULARY`, `descriptorFor` from `engine/vocabulary.ts`.
- Produces: `EmittedFile = { path: string; contents: string }`, `COMPONENT_OF: Record<string, { component: string; file: string }>`, and `emitApp(document: PageDocument, assets: AssetResolver): string`.

The emitter is deterministic and emits composition only, never styling. Props come out in descriptor declaration order rather than whatever order the model happened to write them, so the same document always produces byte identical output and a golden file diff means a real change.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-emit.test.ts`:

```ts
import { DOCUMENT_VERSION, type PageDocument } from "../engine/document";
import { COMPONENT_OF, emitApp } from "../engine/emit";
import { VOCABULARY } from "../engine/vocabulary";

function doc(sections: PageDocument["sections"]): PageDocument {
  return {
    version: DOCUMENT_VERSION,
    theme: { name: "aqua", mode: "auto", accentHue: null },
    page: { measure: "page" },
    meta: { title: "Kestrel", description: "Ship on Friday." },
    sections,
  };
}

const assets = placeholderAssets();

describe("emitting the page component", () => {
  it("names a component and a file for every ready section", () => {
    for (const [type, d] of Object.entries(VOCABULARY)) {
      if (d.status === "ready") expect(COMPONENT_OF[type], type).toBeTruthy();
    }
  });

  it("imports only the components the document uses, sorted", () => {
    const out = emitApp(doc([
      { id: "s_0003", type: "cta-band", props: { title: "Go" } },
      { id: "s_0001", type: "page-hero", props: { headline: "H" } },
    ]), assets);
    const imports = out.split("\n").filter((l) => l.startsWith("import"));
    expect(imports).toEqual([
      'import CtaBand from "./components/mitame/blocks/sections/cta-band";',
      'import PageHero from "./components/mitame/blocks/sections/page-hero";',
    ]);
  });

  it("imports a component once even when the document uses it twice", () => {
    const out = emitApp(doc([
      { id: "s_0001", type: "cta-band", props: { title: "A" } },
      { id: "s_0002", type: "cta-band", props: { title: "B" } },
    ]), assets);
    expect(out.match(/import CtaBand/g)).toHaveLength(1);
  });

  it("renders sections in document order", () => {
    const out = emitApp(doc([
      { id: "s_0001", type: "page-hero", props: { headline: "H" } },
      { id: "s_0002", type: "cta-band", props: { title: "Go" } },
    ]), assets);
    expect(out.indexOf("<PageHero")).toBeLessThan(out.indexOf("<CtaBand"));
  });

  it("carries the measure on the main element", () => {
    expect(emitApp(doc([]), assets)).toContain('<main data-measure="page">');
    const narrow = { ...doc([]), page: { measure: "narrow" as const } };
    expect(emitApp(narrow, assets)).toContain('<main data-measure="narrow">');
  });

  it("writes a plain string prop as an attribute", () => {
    expect(emitApp(doc([{ id: "s_0001", type: "cta-band", props: { title: "Go now" } }]), assets)).toContain('title="Go now"');
  });

  it("writes a string holding a quote or a newline as an expression, so it stays valid", () => {
    const out = emitApp(doc([{ id: "s_0001", type: "cta-band", props: { title: 'He said "go"' } }]), assets);
    expect(out).toContain('title={"He said \\"go\\""}');
  });

  it("writes runs and items as expressions", () => {
    const out = emitApp(doc([{ id: "s_0001", type: "cta-band", props: { title: "T", body: [{ text: "Hi" }] } }]), assets);
    expect(out).toContain('body={[{"text":"Hi"}]}');
  });

  it("puts props in descriptor order, not in the order the model wrote them", () => {
    const out = emitApp(doc([{ id: "s_0001", type: "page-hero", props: { align: "start", headline: "H", eyebrow: "E" } }]), assets);
    expect(out.indexOf("eyebrow")).toBeLessThan(out.indexOf("headline"));
    expect(out.indexOf("headline")).toBeLessThan(out.indexOf("align"));
  });

  it("omits a prop that is null or absent", () => {
    const out = emitApp(doc([{ id: "s_0001", type: "page-hero", props: { headline: "H", media: null, eyebrow: null } }]), assets);
    expect(out).not.toContain("media");
    expect(out).not.toContain("eyebrow");
  });

  it("resolves an image assetId to a src, because the component takes a URL", () => {
    const out = emitApp(doc([{
      id: "s_0001",
      type: "page-hero",
      props: { headline: "H", media: { assetId: "placeholder-wide", alt: "A graph", width: 1600, height: 900 } },
    }]), assets);
    expect(out).toContain('"src":"data:image/svg+xml,');
    expect(out).not.toContain("assetId");
    expect(out).toContain('"alt":"A graph"');
  });

  it("resolves an image nested inside an item", () => {
    const out = emitApp(doc([{
      id: "s_0001",
      type: "feature-grid",
      props: { features: [{ title: "A", body: [{ text: "x" }] }] },
    }]), assets);
    expect(out).toContain('"title":"A"');
  });

  it("throws on an unresolvable assetId, because that is a bug and not a condition", () => {
    const bad = doc([{ id: "s_0001", type: "page-hero", props: { headline: "H", media: { assetId: "nope", alt: "x", width: 1, height: 1 } } }]);
    expect(() => emitApp(bad, assets)).toThrow(/nope/);
  });

  it("throws on a section the emitter has no component for", () => {
    expect(() => emitApp(doc([{ id: "s_0001", type: "timeline", props: {} }]), assets)).toThrow(/timeline/);
  });

  it("is deterministic, so a golden diff means a real change", () => {
    const d = doc([{ id: "s_0001", type: "page-hero", props: { headline: "H", body: [{ text: "x" }] } }]);
    expect(emitApp(d, assets)).toBe(emitApp(structuredClone(d), assets));
  });

  it("ends with exactly one newline", () => {
    const out = emitApp(doc([]), assets);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-emit.test.ts -t "emitting the page component"`
Expected: FAIL. Cannot resolve `../engine/emit`.

- [ ] **Step 3: Write `engine/emit.ts`**

```ts
// Document to source. Deterministic on purpose: the same document always produces
// byte identical output, so a golden file diff is a real change rather than noise.
//
// The emitter emits composition and never styling. Every declaration the output
// relies on lives in registry/blocks/blocks.css, which the contrast checker
// already reads for all 17 themes, so output is WCAG AA by construction rather
// than by review. Generated CSS would be unchecked CSS.

import type { ImageRef, PageDocument, PropValue, Section } from "./document.ts";
import type { AssetResolver } from "./assets.ts";
import { descriptorFor } from "./vocabulary.ts";

export interface EmittedFile {
  path: string;
  contents: string;
}

/** Where the registry lands in emitted output, relative to the page component. */
const COMPONENTS = "./components/mitame";

export const COMPONENT_OF: Record<string, { component: string; file: string }> = {
  "page-hero": { component: "PageHero", file: "blocks/sections/page-hero" },
  "feature-grid": { component: "FeatureGrid", file: "blocks/sections/feature-grid" },
  "cta-band": { component: "CtaBand", file: "blocks/sections/cta-band" },
};

export function emitApp(document: PageDocument, assets: AssetResolver): string {
  const used = [...new Set(document.sections.map((s) => s.type))].sort();
  const imports = used.map((type) => {
    const entry = COMPONENT_OF[type];
    if (!entry) throw new Error(`emit: no component for section type "${type}"`);
    return `import ${entry.component} from "${COMPONENTS}/${entry.file}";`;
  });

  const body = document.sections.map((section) => renderSection(section, assets, 6)).join("\n");

  return `${imports.join("\n")}

export default function App() {
  return (
    <main data-measure="${document.page.measure}">
${body}
    </main>
  );
}
`;
}

function renderSection(section: Section, assets: AssetResolver, indent: number): string {
  const entry = COMPONENT_OF[section.type];
  if (!entry) throw new Error(`emit: no component for section type "${section.type}"`);
  const descriptor = descriptorFor(section.type);
  const pad = " ".repeat(indent);

  // Descriptor order, not the order the model happened to write the props in.
  const order = Object.keys(descriptor?.props ?? {});
  const attributes = order
    .filter((prop) => section.props[prop] !== undefined && section.props[prop] !== null)
    .map((prop) => renderAttribute(prop, resolveAssets(section.props[prop]!, assets)));

  if (!attributes.length) return `${pad}<${entry.component} />`;
  return `${pad}<${entry.component} ${attributes.join(" ")} />`;
}

/** A plain string reads better as an attribute. Anything else, or a string that
 * would need escaping, goes out as an expression so the output is always valid. */
function renderAttribute(prop: string, value: PropValue): string {
  if (typeof value === "string" && !/["{}\\\n\r<>]/.test(value)) return `${prop}="${value}"`;
  return `${prop}={${JSON.stringify(value)}}`;
}

/** Documents carry an assetId. Components take a src. This is where that crosses. */
function resolveAssets(value: PropValue, assets: AssetResolver): PropValue {
  if (Array.isArray(value)) return value.map((v) => resolveAssets(v as PropValue, assets)) as PropValue;
  if (value && typeof value === "object") {
    const record = value as Record<string, PropValue>;
    if (typeof record.assetId === "string") {
      const image = value as unknown as ImageRef;
      const asset = assets.get(image.assetId);
      // Layer 3 already refused an unknown assetId, so reaching here is a bug in
      // the pipeline rather than a thing a document can do.
      if (!asset) throw new Error(`emit: no asset "${image.assetId}"`);
      return { src: asset.src, alt: image.alt, width: image.width, height: image.height };
    }
    const out: Record<string, PropValue> = {};
    for (const [key, inner] of Object.entries(record)) out[key] = resolveAssets(inner, assets);
    return out;
  }
  return value;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/engine-emit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/emit.ts tests/engine-emit.test.ts
git commit -m "Emit the page component from a document"
```

---

## Task 15: Emitting the whole file set

**Files:**
- Modify: `engine/emit.ts` (add `emit`, `emitStyles`, `emitHtml`, `emitMain`)
- Test: `tests/engine-emit.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: Task 14's `emitApp`; `collectFiles`, `resolveItem`, `THEMES` from `cli/registry.ts`.
- Produces: `emit(document: PageDocument, options: EmitOptions): EmittedFile[]`, where `EmitOptions = { assets: AssetResolver; registryRoot: string }`.

The emitted file set mirrors `playground/`, which is the repo's own four file Vite app: an `index.html`, a `main.tsx`, the page component and a stylesheet. Registry files are collected by `collectFiles` from `cli/registry.ts` rather than by new code, because that resolver already follows relative imports transitively and already knows that anything under `blocks/` needs `blocks/blocks.css`. One copy of that logic is the point.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-emit.test.ts`:

```ts
import { join } from "node:path";
import { emit } from "../engine/emit";

const registryRoot = join(import.meta.dirname, "../registry");
const options = { assets, registryRoot };
const paths = (files: { path: string }[]) => files.map((f) => f.path).sort();
const find = (files: { path: string; contents: string }[], path: string) => files.find((f) => f.path === path);

describe("emitting the whole file set", () => {
  const page = doc([
    { id: "s_0001", type: "page-hero", props: { headline: "Ship on Friday." } },
    { id: "s_0002", type: "cta-band", props: { title: "Go" } },
  ]);

  it("emits the four app files", () => {
    const out = paths(emit(page, options));
    expect(out).toContain("index.html");
    expect(out).toContain("src/main.tsx");
    expect(out).toContain("src/App.tsx");
    expect(out).toContain("src/styles.css");
  });

  it("emits every registry file the sections need, under src/components/mitame", () => {
    const out = paths(emit(page, options));
    expect(out).toContain("src/components/mitame/blocks/sections/page-hero.tsx");
    expect(out).toContain("src/components/mitame/blocks/sections/cta-band.tsx");
    expect(out).toContain("src/components/mitame/blocks/sections/runs.tsx");
    expect(out).toContain("src/components/mitame/blocks/sections/actions.tsx");
    expect(out).toContain("src/components/mitame/ui/button.tsx");
    expect(out).toContain("src/components/mitame/blocks/blocks.css");
  });

  it("emits base.css and exactly one theme", () => {
    const out = paths(emit(page, options));
    expect(out).toContain("src/components/mitame/themes/base.css");
    expect(out).toContain("src/components/mitame/themes/y2k/aqua.css");
    expect(out.filter((p) => p.endsWith(".css") && p.includes("/themes/") && !p.endsWith(".tokens.css"))).toHaveLength(2);
  });

  it("emits the theme's generated token css beside it", () => {
    expect(paths(emit(page, options))).toContain("src/components/mitame/themes/y2k/aqua.tokens.css");
  });

  it("imports the stylesheets in the order the CLI documents, base before the theme", () => {
    const css = find(emit(page, options), "src/styles.css")!.contents;
    const order = ["themes/base.css", "themes/y2k/aqua.css", "blocks/blocks.css"].map((f) => css.indexOf(f));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBeGreaterThan(-1);
  });

  it("sets data-theme on the html element, and no data-mode when the mode is auto", () => {
    const html = find(emit(page, options), "index.html")!.contents;
    expect(html).toContain('data-theme="aqua"');
    expect(html).not.toContain("data-mode");
  });

  it("sets data-mode when the document pins a mode", () => {
    const pinned = { ...page, theme: { ...page.theme, mode: "dark" as const } };
    expect(find(emit(pinned, options), "index.html")!.contents).toContain('data-mode="dark"');
  });

  it("puts the title and description in the html head, escaped", () => {
    const sharp = { ...page, meta: { title: 'A "quoted" title', description: "Less < more" } };
    const html = find(emit(sharp, options), "index.html")!.contents;
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).toContain("Less &lt; more");
    expect(html).not.toContain('A "quoted" title');
  });

  it("emits no file twice", () => {
    const all = paths(emit(page, options));
    expect(all).toEqual([...new Set(all)]);
  });

  it("emits no file outside the project, so the set is safe to write", () => {
    for (const file of emit(page, options)) {
      expect(file.path.startsWith("/")).toBe(false);
      expect(file.path).not.toContain("..");
    }
  });

  it("throws on a theme that is not in the registry", () => {
    const bad = { ...page, theme: { ...page.theme, name: "chartreuse" } };
    expect(() => emit(bad, options)).toThrow(/chartreuse/);
  });

  it("is deterministic across two runs", () => {
    expect(emit(page, options)).toEqual(emit(structuredClone(page), options));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-emit.test.ts -t "whole file set"`
Expected: FAIL. `emit` is not exported.

- [ ] **Step 3: Add the file set to `engine/emit.ts`**

Add these imports at the top:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES, collectFiles, resolveItem } from "../cli/registry.ts";
```

and this below `emitApp`:

```ts
export interface EmitOptions {
  assets: AssetResolver;
  /** The mitame registry directory, which is <repo>/registry. */
  registryRoot: string;
}

/** Where the registry lands in the emitted project. */
const COMPONENT_DIR = "src/components/mitame";

export function emit(document: PageDocument, options: EmitOptions): EmittedFile[] {
  const entries = [...new Set(document.sections.map((s) => {
    const component = COMPONENT_OF[s.type];
    if (!component) throw new Error(`emit: no component for section type "${s.type}"`);
    return `${component.file}.tsx`;
  }))];

  if (!THEMES[document.theme.name]) {
    throw new Error(`emit: "${document.theme.name}" is not a mitame theme`);
  }
  entries.push(resolveItem(options.registryRoot, "themes/base"));
  entries.push(resolveItem(options.registryRoot, document.theme.name));

  // collectFiles follows relative imports transitively and already knows that a
  // file under blocks/ needs blocks/blocks.css. One copy of that logic.
  const registry = collectFiles(options.registryRoot, entries);

  return [
    { path: "index.html", contents: emitHtml(document) },
    { path: "src/main.tsx", contents: emitMain() },
    { path: "src/App.tsx", contents: emitApp(document, options.assets) },
    { path: "src/styles.css", contents: emitStyles(document, registry) },
    ...registry.map((file) => ({
      path: `${COMPONENT_DIR}/${file}`,
      contents: readFileSync(join(options.registryRoot, file), "utf8"),
    })),
  ];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emitHtml(document: PageDocument): string {
  // Leaving data-mode off is what makes a page follow the device, so it is only
  // written when the document pins a mode.
  const mode = document.theme.mode === "auto" ? "" : ` data-mode="${document.theme.mode}"`;
  return `<!doctype html>
<html lang="en" data-theme="${document.theme.name}"${mode}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.meta.title)}</title>
    <meta name="description" content="${escapeHtml(document.meta.description)}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function emitMain(): string {
  return `import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
`;
}

/** base.css first, then exactly one theme, then the block layout. Whichever
 * stylesheet loads first decides the layer order, so the order is not cosmetic. */
function emitStyles(document: PageDocument, registry: string[]): string {
  const themeFile = registry.find((f) => f.startsWith("themes/") && f.endsWith(`${document.theme.name}.css`));
  const lines = [`@import "./${COMPONENT_DIR.replace("src/", "")}/themes/base.css";`];
  if (themeFile) lines.push(`@import "./${COMPONENT_DIR.replace("src/", "")}/${themeFile}";`);
  lines.push(`@import "./${COMPONENT_DIR.replace("src/", "")}/blocks/blocks.css";`);
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run the tests, then confirm the emitted project actually builds**

Run: `npx vitest run tests/engine-emit.test.ts`
Expected: PASS.

Then prove the output is real rather than merely well shaped. Write the file set to a scratch directory and build it:

```bash
node --input-type=module -e '
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { emit } from "./engine/emit.ts";
import { placeholderAssets } from "./engine/assets.ts";
const doc = {
  version: 1,
  theme: { name: "aqua", mode: "auto", accentHue: null },
  page: { measure: "page" },
  meta: { title: "Kestrel", description: "Ship on Friday." },
  sections: [
    { id: "s_0001", type: "page-hero", props: { eyebrow: "Public beta", headline: "Ship on Friday.", body: [{ text: "Quiet weekends." }], actions: [{ label: "Start free", variant: "primary" }] } },
    { id: "s_0002", type: "feature-grid", props: { title: "Three things", features: [{ title: "Searchable" }, { title: "Alerts" }, { title: "Rollback" }] } },
    { id: "s_0003", type: "cta-band", props: { title: "Put your next deploy on watch", actions: [{ label: "Start free", variant: "primary" }] } },
  ],
};
const out = "/tmp/mitame-emit";
for (const f of emit(doc, { assets: placeholderAssets(), registryRoot: join(process.cwd(), "registry") })) {
  const p = join(out, f.path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, f.contents);
}
console.log("wrote", out);
'
cd /tmp/mitame-emit && npm init -y >/dev/null && npm i react react-dom >/dev/null 2>&1 && npm i -D vite @vitejs/plugin-react >/dev/null 2>&1
printf 'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n' > vite.config.js
npx vite build
```

Expected: the build succeeds. If it does not, the emitter is producing output that only looks right, and that is the bug to fix before going on.

- [ ] **Step 5: Commit**

```bash
git add engine/emit.ts tests/engine-emit.test.ts
git commit -m "Emit the whole project file set"
```

---

## Task 16: Golden documents and golden source

**Files:**
- Create: `tests/golden/landing.json`, `tests/golden/narrow-prose-free.json`, `tests/golden/hero-with-media.json`, `tests/golden/minimal.json`
- Create: `tests/golden/landing.App.tsx.txt`, and one `.App.tsx.txt` per golden document
- Create: `tests/engine-golden.test.ts`
- Create: `scripts/update-golden.ts`

**Interfaces:**
- Consumes: `validate` from `engine/validate.ts`; `emit`, `emitApp` from `engine/emit.ts`; `placeholderAssets` from `engine/assets.ts`.
- Produces: `updateGolden(root: string): string[]`, exported from `scripts/update-golden.ts`, returning the paths it wrote.

The emitter is deterministic, so a committed expected output turns any change in it into a visible diff. This is the main regression net for the rest of the engine's life. The expected files are checked in and regenerated by a script, following the same shape as every other generated artifact in the repo, so nobody hand edits them.

- [ ] **Step 1: Write the four golden documents**

`tests/golden/minimal.json` is the smallest document that validates:

```json
{
  "version": 1,
  "theme": { "name": "sumi", "mode": "auto", "accentHue": null },
  "page": { "measure": "narrow" },
  "meta": { "title": "Minimal", "description": "One section." },
  "sections": [{ "id": "s_0001", "type": "cta-band", "props": { "title": "Say hello" } }]
}
```

`tests/golden/landing.json` is a realistic page using all three ready sections:

```json
{
  "version": 1,
  "theme": { "name": "aqua", "mode": "auto", "accentHue": null },
  "page": { "measure": "page" },
  "meta": { "title": "Kestrel", "description": "Ship on Friday." },
  "sections": [
    {
      "id": "s_7f2a",
      "type": "page-hero",
      "props": {
        "eyebrow": "Public beta",
        "headline": "Ship on Friday.",
        "body": [{ "text": "Deploy previews for every branch, " }, { "text": "in seconds", "em": true }, { "text": "." }],
        "actions": [
          { "label": "Start free", "variant": "primary" },
          { "label": "Read the docs", "variant": "secondary", "href": "/docs" }
        ],
        "align": "center"
      }
    },
    {
      "id": "s_91c4",
      "type": "feature-grid",
      "props": {
        "title": "Three things, done properly",
        "lede": [{ "text": "It watches deploys and then gets out of the way." }],
        "columns": "3",
        "features": [
          { "title": "Every release, searchable", "body": [{ "text": "Indexed the moment it ships." }] },
          { "title": "Alerts that name a name", "body": [{ "text": "Routing follows code ownership." }] },
          { "title": "Rollback in one step", "body": [{ "text": "Back to the last good build." }] }
        ]
      }
    },
    {
      "id": "s_b3d8",
      "type": "cta-band",
      "props": {
        "title": "Put your next deploy on watch",
        "body": [{ "text": "There is nothing to install on your servers." }],
        "actions": [{ "label": "Start free", "variant": "primary" }]
      }
    }
  ]
}
```

`tests/golden/hero-with-media.json` exercises an image and a pinned dark mode:

```json
{
  "version": 1,
  "theme": { "name": "liquid", "mode": "dark", "accentHue": null },
  "page": { "measure": "page" },
  "meta": { "title": "Atlas", "description": "A map of your releases." },
  "sections": [
    {
      "id": "s_0001",
      "type": "page-hero",
      "props": {
        "headline": "See every release at once",
        "align": "start",
        "media": { "assetId": "placeholder-wide", "alt": "A timeline of releases, newest first", "width": 1600, "height": 900 }
      }
    }
  ]
}
```

`tests/golden/narrow-prose-free.json` exercises the characters that break naive emitters:

```json
{
  "version": 1,
  "theme": { "name": "paper", "mode": "light", "accentHue": null },
  "page": { "measure": "narrow" },
  "meta": { "title": "A \"quoted\" title", "description": "Less < more & more > less" },
  "sections": [
    {
      "id": "s_0001",
      "type": "page-hero",
      "props": {
        "headline": "She said \"ship it\"",
        "body": [
          { "text": "Braces {like this} and a backslash \\ survive, " },
          { "text": "大丈夫", "strong": true },
          { "text": ", and so does مرحبا." }
        ]
      }
    },
    { "id": "s_0002", "type": "cta-band", "props": { "title": "Go" } }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/engine-golden.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placeholderAssets } from "../engine/assets";
import { emit, emitApp } from "../engine/emit";
import { validate } from "../engine/validate";

const root = join(import.meta.dirname, "..");
const goldenDir = join(root, "tests/golden");
// briefs.json is a vocabulary fixture, not a page document, so it is not emitted.
const names = readdirSync(goldenDir)
  .filter((f) => f.endsWith(".json") && f !== "briefs.json")
  .map((f) => f.replace(/\.json$/, ""))
  .sort();
const read = (name: string) => JSON.parse(readFileSync(join(goldenDir, `${name}.json`), "utf8"));

describe("golden documents", () => {
  it("there are some, so this suite is not vacuously green", () => {
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it.each(names)("%s validates", (name) => {
    const result = validate(read(name), { assets: placeholderAssets() });
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(names)("%s round trips through JSON byte for byte", (name) => {
    const text = readFileSync(join(goldenDir, `${name}.json`), "utf8");
    expect(`${JSON.stringify(JSON.parse(text), null, 2)}\n`).toBe(text);
  });

  it.each(names)("%s emits the committed source", (name) => {
    const expected = readFileSync(join(goldenDir, `${name}.App.tsx.txt`), "utf8");
    expect(emitApp(read(name), placeholderAssets())).toBe(expected);
  });

  it.each(names)("%s emits a file set with no duplicate and no escaping path", (name) => {
    const files = emit(read(name), { assets: placeholderAssets(), registryRoot: join(root, "registry") });
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([...new Set(paths)]);
    for (const p of paths) {
      expect(p.startsWith("/")).toBe(false);
      expect(p).not.toContain("..");
    }
  });

  it.each(names)("%s emits the same bytes twice", (name) => {
    const a = emitApp(read(name), placeholderAssets());
    const b = emitApp(read(name), placeholderAssets());
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine-golden.test.ts`
Expected: FAIL. The `.App.tsx.txt` files do not exist.

- [ ] **Step 4: Write `scripts/update-golden.ts`**

```ts
// Regenerates the expected source beside every golden document, so nobody hand
// edits an expected file and quietly makes a regression look intentional.
//
// Run `npm run golden` after a deliberate change to the emitter, then read the
// diff. If the diff is not what you meant, the change is the bug.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placeholderAssets } from "../engine/assets.ts";
import { emitApp } from "../engine/emit.ts";
import { validate } from "../engine/validate.ts";

export function updateGolden(root: string): string[] {
  const dir = join(root, "tests/golden");
  const written: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "briefs.json").sort()) {
    const name = file.replace(/\.json$/, "");
    const document = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const checked = validate(document, { assets: placeholderAssets() });
    // A golden document that does not validate is a broken fixture, and writing
    // its output would enshrine the breakage.
    if (!checked.ok) throw new Error(`${file} does not validate: ${JSON.stringify(checked.errors, null, 2)}`);
    const out = join(dir, `${name}.App.tsx.txt`);
    writeFileSync(out, emitApp(checked.document, placeholderAssets()));
    written.push(out);
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  for (const path of updateGolden(root)) console.log(`wrote ${path}`);
}
```

- [ ] **Step 5: Add the npm script**

In `package.json`, beside `"meta"`, add:

```json
    "golden": "node scripts/update-golden.ts",
```

- [ ] **Step 6: Generate the expected files and read the diff**

Run: `npm run golden`
Then: `git diff --stat` and read every generated file. They are the contract, so look at them rather than trusting them.

Run: `npx vitest run tests/engine-golden.test.ts`
Expected: PASS.

- [ ] **Step 7: Prove the net actually catches a regression**

Temporarily change `renderAttribute` in `engine/emit.ts` to always use the expression form, then:

Run: `npx vitest run tests/engine-golden.test.ts`
Expected: FAIL on every document. If it passes, the golden net is not wired up and nothing after this point is protected. Revert the change and confirm the suite goes green again.

- [ ] **Step 8: Commit**

```bash
git add tests/golden scripts/update-golden.ts tests/engine-golden.test.ts package.json
git commit -m "Add golden documents and their expected source"
```

---

## Task 17: The accent hue table, gated by the contrast checker

**Files:**
- Create: `scripts/build-hues.ts`
- Create: `registry/hues.json` (generated, committed)
- Test: `tests/engine-hues.test.ts`
- Modify: `package.json` (add `"hues"`)
- Modify: `tests/generators.test.ts` (add the drift assertion)
- Modify: `.github/workflows/ci.yml` (add to the drift step)

**Interfaces:**
- Consumes: `THEMES`, `type TokenFile` from `scripts/build-tokens.ts`; `type Rgb`, `parseHex`, `luminance`, `loadTheme`, `rulesFor`, `checkTheme` from `scripts/contrast.ts`.
- Produces: `HueStep = { hue: number; accent: string; accentFg: string; rotated: string[] }`, `ThemeHues = { light: HueStep[]; dark: HueStep[] }`, `HueTable = { version: number; steps: number[]; refused: Record<string, string>; themes: Record<string, ThemeHues> }`, and `buildHues(root: string): HueTable`.

This is the task that makes "make it more purple" answerable without voiding the WCAG guarantee. The model never emits a colour. It names a direction, the system picks the value from this table, and the table was gated at build time.

**Three things the spec does not say, found in the token files and settled here.**

First, **rotate at constant WCAG relative luminance, not constant oklab lightness.** Those are different. `contrast()` is a pure function of relative luminance, so holding luminance fixed keeps every direct use of the accent at exactly its original ratio. Holding oklab lightness fixed does not, because oklab weights the channels differently.

Second, **Review Focus 5: rotate the coupled tokens too.** Verified in the token files, several themes hardcode the accent in tokens that are not the accent: `terminal` dark has six (`color/fg`, `color/fg-muted`, `color/success`, `color/border`, `glass/highlight`, `glass/edge`), `blueprint` dark has three, `neon` light has one (`glass/edge` is `#C026A340`, and `#C026A3` is neon's light accent), and `system` has eight in each mode. Rotating only `color/accent` would leave those stale and ship a half rotated palette, which is the worst of the three outcomes. So every token whose base hex equals the accent's base hex rotates with it, keeping its own alpha suffix. The contrast gate then decides whether that hue survives, which is why this is safe to do rather than merely tempting.

Third, **a zero chroma accent cannot rotate.** `system`'s accent is `#000000` in light and `#FFFFFF` in dark, whose hue is undefined. It is refused by name, with a reason recorded in the table.

Because coupled tokens now rotate, the pass count will not be the 204 of 204 the spec quotes for accent-only rotation. The generator's output is the source of truth, and the test asserts the shape of the guarantee rather than a number.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-hues.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHues, oklabToSrgb, srgbToOklab } from "../scripts/build-hues";
import { THEMES } from "../scripts/build-tokens";
import { contrast, loadTheme, luminance, parseHex } from "../scripts/contrast";

const root = join(import.meta.dirname, "..");

describe("the colour space round trip", () => {
  it.each(["#000000", "#FFFFFF", "#1C65CC", "#FFE03D", "#33FF66", "#C026A3", "#0D5661"])("round trips %s", (hex) => {
    const back = oklabToSrgb(srgbToOklab(parseHex(hex)));
    for (const channel of ["r", "g", "b"] as const) {
      expect(Math.abs(back[channel] - parseHex(hex)[channel]), `${hex} ${channel}`).toBeLessThan(1.5);
    }
  });
});

describe("the hue table", () => {
  const table = buildHues(root);

  it("covers every theme either as rotatable or as refused, and never both", () => {
    for (const name of Object.keys(THEMES)) {
      const inThemes = name in table.themes;
      const inRefused = name in table.refused;
      expect(inThemes !== inRefused, name).toBe(true);
    }
  });

  // Review Focus 5: a zero chroma accent has no hue to rotate.
  it("refuses system, whose accent is pure black and pure white", () => {
    expect(table.refused).toHaveProperty("system");
    expect(table.refused.system).toMatch(/chroma/i);
  });

  it("offers twelve hue directions", () => {
    expect(table.steps).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  });

  it("holds WCAG relative luminance to the theme's own accent, in both modes", () => {
    for (const [name, hues] of Object.entries(table.themes)) {
      for (const mode of ["light", "dark"] as const) {
        const file = loadTheme(name, root);
        const token = file.tokens.find((t) => t.name === "color/accent")!;
        const target = luminance(parseHex(String(token.values[mode])));
        for (const step of hues[mode]) {
          expect(Math.abs(luminance(parseHex(step.accent)) - target), `${name} ${mode} ${step.hue}`).toBeLessThan(0.005);
        }
      }
    }
  });

  it("never lowers the accent against its own foreground below what the theme already had", () => {
    // The gate preserves the pairs a theme already passes, and a large text pair's
    // minimum is 3 rather than 4.5, so the guarantee is "no worse", not "AA".
    for (const [name, hues] of Object.entries(table.themes)) {
      for (const mode of ["light", "dark"] as const) {
        const file = loadTheme(name, root);
        const own = String(file.tokens.find((t) => t.name === "color/accent")!.values[mode]);
        const fg = String(file.tokens.find((t) => t.name === "color/accent-fg")!.values[mode]);
        const before = contrast(fg, own);
        for (const step of hues[mode]) {
          expect(contrast(step.accentFg, step.accent), `${name} ${mode} ${step.hue}`).toBeGreaterThanOrEqual(Math.min(before, 4.5) - 0.1);
        }
      }
    }
  });

  // Review Focus 5 again: the coupled tokens travel with the accent.
  it("rotates the tokens that hardcode the accent, rather than leaving them stale", () => {
    for (const theme of ["terminal", "blueprint", "neon"]) {
      if (!(theme in table.themes)) continue;
      const rotated = new Set(Object.values(table.themes[theme]!).flatMap((steps) => steps.flatMap((s) => s.rotated)));
      expect(rotated.size, theme).toBeGreaterThan(1);
      expect([...rotated], theme).toContain("color/accent");
    }
  });

  it("names every rotated token as a real token of that theme", () => {
    for (const [name, hues] of Object.entries(table.themes)) {
      const known = new Set(loadTheme(name, root).tokens.map((t) => t.name));
      for (const mode of ["light", "dark"] as const) {
        for (const step of hues[mode]) {
          for (const token of step.rotated) expect(known.has(token), `${name} ${token}`).toBe(true);
        }
      }
    }
  });

  it("emits only six digit uppercase hex, or eight with an alpha", () => {
    for (const hues of Object.values(table.themes)) {
      for (const mode of ["light", "dark"] as const) {
        for (const step of hues[mode]) {
          expect(step.accent).toMatch(/^#[0-9A-F]{6}$/);
          expect(step.accentFg).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  it("leaves at least one theme actually rotatable, or the feature is dead", () => {
    const usable = Object.values(table.themes).filter((h) => h.light.length > 0 && h.dark.length > 0);
    expect(usable.length).toBeGreaterThanOrEqual(6);
  });

  it("is committed and up to date", () => {
    expect(`${JSON.stringify(buildHues(root), null, 2)}\n`).toBe(readFileSync(join(root, "registry/hues.json"), "utf8"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-hues.test.ts`
Expected: FAIL. Cannot resolve `../scripts/build-hues`.

- [ ] **Step 3: Write `scripts/build-hues.ts`**

```ts
// Generates registry/hues.json: for each theme and mode, the accent hue rotations
// that keep every contrast pair the theme already passes.
//
// Rotation holds WCAG relative luminance fixed rather than oklab lightness,
// because contrast() is a pure function of relative luminance, so a rotation at
// constant luminance keeps every direct use of the accent at exactly its original
// ratio. Oklab lightness weights the channels differently and does not.
//
// Several themes hardcode the accent in tokens that are not the accent, for
// example terminal's dark foreground is literally its dark accent. Those rotate
// with it, keeping their own alpha, or the page comes out half rotated. The gate
// below then decides whether the result is still legible.
//
// Run `npm run hues` after changing any theme's accent.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES, type TokenFile } from "./build-tokens.ts";
import { type Rgb, checkTheme, loadTheme, luminance, parseHex, rulesFor } from "./contrast.ts";

export interface HueStep {
  hue: number;
  accent: string;
  accentFg: string;
  /** Token names this step rewrote, always including color/accent. */
  rotated: string[];
}

export interface ThemeHues {
  light: HueStep[];
  dark: HueStep[];
}

export interface HueTable {
  version: number;
  steps: number[];
  /** Theme to the reason its accent cannot rotate. */
  refused: Record<string, string>;
  themes: Record<string, ThemeHues>;
}

export const STEPS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/** Below this, a colour has no hue worth rotating. */
const MIN_CHROMA = 0.01;

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

const toLinear = (c: number) => (c <= 0.04045 * 255 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function srgbToOklab({ r, g, b }: Rgb): Oklab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToSrgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channel = (v: number) => Math.max(0, Math.min(255, Math.round(toGamma(v) * 255)));
  return {
    r: channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const hex = ({ r, g, b }: Rgb) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

/** Does this oklab value survive the trip to sRGB and back, or was it clipped? */
function inGamut(lab: Oklab): boolean {
  const back = srgbToOklab(oklabToSrgb(lab));
  return Math.abs(back.L - lab.L) < 0.02 && Math.abs(back.a - lab.a) < 0.02 && Math.abs(back.b - lab.b) < 0.02;
}

/** A colour at the given hue whose WCAG relative luminance matches the target.
 * Luminance rises monotonically with oklab L at fixed hue and chroma, so this
 * bisects. Chroma is reduced if the result will not fit in sRGB, never luminance,
 * because luminance is the thing the guarantee rests on. */
export function atHue(target: number, hueDegrees: number, chroma: number): string | null {
  const radians = (hueDegrees * Math.PI) / 180;
  for (let c = chroma; c >= 0; c -= 0.005) {
    const lab = (L: number): Oklab => ({ L, a: c * Math.cos(radians), b: c * Math.sin(radians) });
    let low = 0;
    let high = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (luminance(oklabToSrgb(lab(mid))) < target) low = mid;
      else high = mid;
    }
    const solved = lab((low + high) / 2);
    if (!inGamut(solved)) continue;
    const rgb = oklabToSrgb(solved);
    if (Math.abs(luminance(rgb) - target) < 0.004) return hex(rgb);
  }
  return null;
}

/** Tokens whose value is this accent, so they must travel with it. The comparison
 * is on the first seven characters, so #33FF6699 matches #33FF66 and keeps its alpha. */
function coupled(file: TokenFile, mode: string, accent: string): { name: string; alpha: string }[] {
  const base = accent.slice(0, 7).toUpperCase();
  return file.tokens
    .filter((t) => t.type === "COLOR")
    .map((t) => ({ name: t.name, value: String(t.values[mode] ?? "") }))
    .filter((t) => t.value.toUpperCase().startsWith(base))
    .map((t) => ({ name: t.name, alpha: t.value.slice(7) }));
}

function rotated(file: TokenFile, mode: string, accentHex: string, pairs: { name: string; alpha: string }[]): TokenFile {
  const next = structuredClone(file);
  for (const { name, alpha } of pairs) {
    const token = next.tokens.find((t) => t.name === name);
    if (token) token.values[mode] = `${accentHex}${alpha}`;
  }
  return next;
}

export function buildHues(root: string): HueTable {
  const refused: Record<string, string> = {};
  const themes: Record<string, ThemeHues> = {};

  for (const name of Object.keys(THEMES).sort()) {
    const file = loadTheme(name, root);
    const rules = rulesFor(name, root);
    const accentToken = file.tokens.find((t) => t.name === "color/accent");
    const fgToken = file.tokens.find((t) => t.name === "color/accent-fg");
    if (!accentToken || !fgToken) {
      refused[name] = "no color/accent or color/accent-fg token";
      continue;
    }

    const chroma = (["light", "dark"] as const).map((mode) => {
      const lab = srgbToOklab(parseHex(String(accentToken.values[mode])));
      return Math.hypot(lab.a, lab.b);
    });
    if (chroma.some((c) => c < MIN_CHROMA)) {
      refused[name] = `the accent has no chroma in at least one mode, so it has no hue to rotate`;
      continue;
    }

    // What this theme passes today. A rotation may not break any of it.
    const baseline = new Set(checkTheme(file, rules).filter((c) => !c.advisory && c.passes).map((c) => `${c.mode} ${c.pair} ${c.source}`));

    const hues: ThemeHues = { light: [], dark: [] };
    for (const mode of ["light", "dark"] as const) {
      const accent = String(accentToken.values[mode]);
      const target = luminance(parseHex(accent));
      const lab = srgbToOklab(parseHex(accent));
      const pairs = coupled(file, mode, accent);

      for (const hue of STEPS) {
        const next = atHue(target, hue, Math.hypot(lab.a, lab.b));
        if (!next) continue;
        const candidate = rotated(file, mode, next, pairs);
        const checks = checkTheme(candidate, rules).filter((c) => !c.advisory && c.mode === mode);
        const broke = checks.some((c) => !c.passes && baseline.has(`${c.mode} ${c.pair} ${c.source}`));
        if (broke) continue;
        hues[mode].push({ hue, accent: next, accentFg: String(fgToken.values[mode]).toUpperCase(), rotated: pairs.map((p) => p.name).sort() });
      }
    }
    themes[name] = hues;
  }

  return { version: 1, steps: STEPS, refused, themes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  const out = join(root, "registry/hues.json");
  const next = `${JSON.stringify(buildHues(root), null, 2)}\n`;
  const current = (() => {
    try {
      return readFileSync(out, "utf8");
    } catch {
      return "";
    }
  })();
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("registry/hues.json is out of date. Run `npm run hues`.");
      process.exitCode = 1;
    } else console.log("registry/hues.json is up to date.");
  } else {
    writeFileSync(out, next);
    const table = buildHues(root);
    const steps = Object.values(table.themes).reduce((n, h) => n + h.light.length + h.dark.length, 0);
    console.log(`wrote ${out} (${Object.keys(table.themes).length} themes rotatable, ${Object.keys(table.refused).length} refused, ${steps} accepted hue steps)`);
  }
}
```

- [ ] **Step 4: Generate the table and read what it actually says**

Run: `npm run hues` after adding the script in step 6, or directly: `node scripts/build-hues.ts`

Read the output. Note the refused list and the accepted step count. Then open `registry/hues.json` and check two things by hand: that `system` is refused for zero chroma, and that `terminal` dark's steps list its six coupled tokens in `rotated`. If a theme you expected to rotate has zero accepted steps in a mode, that is information rather than a bug, but say so in the commit message.

- [ ] **Step 5: Add the npm script**

In `package.json`, beside `"meta"`:

```json
    "hues": "node scripts/build-hues.ts",
```

- [ ] **Step 6: Add the drift assertion beside the three that exist**

In `tests/generators.test.ts`, after the `registry/meta.json` describe block, add:

```ts
describe("registry/hues.json", () => {
  it("is up to date with the themes, so a rotation never outruns its gate", () => {
    const root = join(import.meta.dirname, "..");
    expect(`${JSON.stringify(buildHues(root), null, 2)}\n`).toBe(readFileSync(join(root, "registry/hues.json"), "utf8"));
  });
});
```

and add the import at the top beside the others:

```ts
import { buildHues } from "../scripts/build-hues";
```

- [ ] **Step 7: Add it to the CI drift gate**

In `.github/workflows/ci.yml`, the step named `Generated files are up to date with their sources` currently runs:

```yaml
          npm run tokens && npm run icons && npm run registry && npm run meta
          git diff --exit-code -- registry/icons registry.json registry/meta.json 'registry/themes/**/*.tokens.css'
```

Change it to:

```yaml
          npm run tokens && npm run icons && npm run registry && npm run meta && npm run hues && npm run golden
          git diff --exit-code -- registry/icons registry.json registry/meta.json registry/hues.json tests/golden 'registry/themes/**/*.tokens.css'
```

- [ ] **Step 8: Run everything**

Run: `npx vitest run tests/engine-hues.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS, every test including the 114 that existed before.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add scripts/build-hues.ts registry/hues.json tests/engine-hues.test.ts tests/generators.test.ts package.json .github/workflows/ci.yml
git commit -m "Precompute the accent hue table, gated by the contrast checker"
```

---

## Task 18: Resolving an accent direction, and emitting the override

**Files:**
- Create: `engine/hues.ts`
- Modify: `engine/validate.ts` (accentHue becomes a lookup, not a free number)
- Modify: `engine/emit.ts` (emit the override, and import it in the right place)
- Test: `tests/engine-hues.test.ts` (add describe blocks)

**Interfaces:**
- Consumes: `cssVarName` from `scripts/build-tokens.ts`; `HueTable`, `HueStep` from `scripts/build-hues.ts` (types only); `registry/hues.json` read at runtime.
- Produces: `loadHues(root: string): HueTable`, `hueStepFor(table: HueTable, theme: string, mode: "light" | "dark", hue: number): HueStep | undefined`, `accentCss(table: HueTable, document: PageDocument): string | null`, and `DIRECTIONS: Record<string, number>`.

The accent override is the one piece of CSS the engine generates, and it is the exception that proves the rule: every value in it came out of a table that the contrast checker gated at build time. Nothing else about the output is generated styling.

`DIRECTIONS` maps the words a model is allowed to use onto hue degrees, so the model names a direction and the system picks the colour.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine-hues.test.ts`:

```ts
import { DIRECTIONS, accentCss, hueStepFor, loadHues } from "../engine/hues";
import { DOCUMENT_VERSION, type PageDocument } from "../engine/document";
import { validate } from "../engine/validate";

const loaded = loadHues(root);

function withAccent(theme: string, mode: PageDocument["theme"]["mode"], accentHue: number | null): PageDocument {
  return {
    version: DOCUMENT_VERSION,
    theme: { name: theme, mode, accentHue },
    page: { measure: "page" },
    meta: { title: "T", description: "D" },
    sections: [{ id: "s_0001", type: "cta-band", props: { title: "Go" } }],
  };
}

/** A theme that really does rotate, taken from the table rather than assumed. */
const rotatable = Object.entries(loaded.themes).find(([, h]) => h.light.length && h.dark.length)![0];
const someHue = loaded.themes[rotatable]!.light[0]!.hue;

describe("the committed table matches the generator", () => {
  it("loads from registry/hues.json", () => {
    expect(loaded.version).toBe(1);
    expect(Object.keys(loaded.themes).length).toBeGreaterThan(0);
  });
});

describe("accent directions", () => {
  it("maps every direction a model may name to a step the table offers", () => {
    for (const degrees of Object.values(DIRECTIONS)) expect(loaded.steps).toContain(degrees);
  });

  it("names directions in plain words, because the model never emits a colour", () => {
    expect(Object.keys(DIRECTIONS)).toContain("purple");
    expect(Object.keys(DIRECTIONS)).toContain("green");
  });

  it("finds a step for a theme and mode that has one", () => {
    expect(hueStepFor(loaded, rotatable, "light", someHue)?.hue).toBe(someHue);
  });

  it("finds nothing for a refused theme", () => {
    const [refusedTheme] = Object.keys(loaded.refused);
    if (refusedTheme) expect(hueStepFor(loaded, refusedTheme, "light", 120)).toBeUndefined();
  });

  it("finds nothing for a hue the table rejected for that theme", () => {
    const offered = new Set(loaded.themes[rotatable]!.light.map((s) => s.hue));
    const missing = loaded.steps.find((s) => !offered.has(s));
    if (missing !== undefined) expect(hueStepFor(loaded, rotatable, "light", missing)).toBeUndefined();
  });
});

describe("validating accentHue as a lookup rather than a free number", () => {
  it("accepts null, which keeps the theme's own accent", () => {
    expect(validate(withAccent(rotatable, "auto", null), { hues: loaded }).ok).toBe(true);
  });

  it("accepts a hue the table offers in both modes when the mode is auto", () => {
    const both = loaded.themes[rotatable]!.light.map((s) => s.hue).filter((h) => loaded.themes[rotatable]!.dark.some((d) => d.hue === h));
    if (both.length) expect(validate(withAccent(rotatable, "auto", both[0]!), { hues: loaded }).ok).toBe(true);
  });

  it("refuses a hue on a theme the table refused, and says why", () => {
    const [refusedTheme] = Object.keys(loaded.refused);
    if (!refusedTheme) return;
    const result = validate(withAccent(refusedTheme, "light", 120), { hues: loaded });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((e) => e.code)).toContain("accent-not-rotatable");
  });

  it("refuses a hue that is not one of the twelve directions", () => {
    const result = validate(withAccent(rotatable, "light", 47), { hues: loaded });
    expect(result.ok ? [] : result.errors.map((e) => e.code)).toContain("accent-hue-unavailable");
  });

  it("refuses a hue the table accepted in light but not in dark, when the mode is auto", () => {
    const onlyLight = loaded.themes[rotatable]!.light.map((s) => s.hue).find((h) => !loaded.themes[rotatable]!.dark.some((d) => d.hue === h));
    if (onlyLight === undefined) return;
    const result = validate(withAccent(rotatable, "auto", onlyLight), { hues: loaded });
    expect(result.ok ? [] : result.errors.map((e) => e.code)).toContain("accent-hue-unavailable");
  });

  it("skips the check when no table is supplied, so other layers stay testable alone", () => {
    expect(validate(withAccent(rotatable, "light", 47)).ok).toBe(true);
  });
});

describe("the accent override stylesheet", () => {
  it("is null when the document keeps the theme's own accent", () => {
    expect(accentCss(loaded, withAccent(rotatable, "auto", null))).toBeNull();
  });

  it("declares the accent for the theme's own selector", () => {
    const css = accentCss(loaded, withAccent(rotatable, "light", someHue))!;
    expect(css).toContain(`[data-theme="${rotatable}"]`);
    expect(css).toContain("--mi-accent:");
  });

  it("mirrors the generated token css, with a media query and a data-mode block for dark", () => {
    const both = loaded.themes[rotatable]!.light.map((s) => s.hue).filter((h) => loaded.themes[rotatable]!.dark.some((d) => d.hue === h));
    if (!both.length) return;
    const css = accentCss(loaded, withAccent(rotatable, "auto", both[0]!))!;
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(`[data-theme="${rotatable}"]:not([data-mode="light"])`);
    expect(css).toContain(`[data-theme="${rotatable}"][data-mode="dark"]`);
  });

  it("writes no dark blocks when the document pins light", () => {
    const css = accentCss(loaded, withAccent(rotatable, "light", someHue))!;
    expect(css).not.toContain("prefers-color-scheme");
  });

  it("declares every coupled token the step rotated, not just the accent", () => {
    for (const theme of Object.keys(loaded.themes)) {
      const step = loaded.themes[theme]!.light[0];
      if (!step || step.rotated.length < 2) continue;
      const css = accentCss(loaded, withAccent(theme, "light", step.hue))!;
      // More than one custom property means the coupled tokens travelled too.
      expect(css.match(/--mi-[a-z-]+:/g)!.length, theme).toBeGreaterThan(1);
      return;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-hues.test.ts -t "accent directions"`
Expected: FAIL. Cannot resolve `../engine/hues`.

- [ ] **Step 3: Write `engine/hues.ts`**

```ts
// The model names a direction and the system picks the colour. Every value here
// came out of registry/hues.json, which the contrast checker gated at build time,
// which is why this is the one place the engine generates CSS.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cssVarName } from "../scripts/build-tokens.ts";
import type { HueStep, HueTable } from "../scripts/build-hues.ts";
import type { PageDocument } from "./document.ts";

export type { HueStep, HueTable };

/** The words a model may use, and the hue each one means. */
export const DIRECTIONS: Record<string, number> = {
  red: 30,
  orange: 60,
  yellow: 90,
  green: 150,
  teal: 180,
  cyan: 210,
  blue: 270,
  indigo: 300,
  purple: 330,
  pink: 0,
};

export function loadHues(root: string): HueTable {
  return JSON.parse(readFileSync(join(root, "registry/hues.json"), "utf8")) as HueTable;
}

export function hueStepFor(table: HueTable, theme: string, mode: "light" | "dark", hue: number): HueStep | undefined {
  return table.themes[theme]?.[mode].find((step) => step.hue === hue);
}

/** Which modes a document actually renders in. "auto" renders in both. */
export function modesOf(document: PageDocument): ("light" | "dark")[] {
  return document.theme.mode === "auto" ? ["light", "dark"] : [document.theme.mode];
}

/** The override stylesheet, or null when the document keeps the theme's accent.
 * The selector shape mirrors the generated token css, because it has to win
 * against it in exactly the same three places. */
export function accentCss(table: HueTable, document: PageDocument): string | null {
  const { name, mode, accentHue } = document.theme;
  if (accentHue === null) return null;

  const declarations = (step: HueStep) =>
    [...step.rotated.map((token) => `  ${cssVarName(token)}: ${step.accent};`), `  ${cssVarName("color/accent-fg")}: ${step.accentFg};`].join("\n");

  const out: string[] = ["/* Generated by the mitame engine from registry/hues.json. */"];

  if (mode !== "dark") {
    const light = hueStepFor(table, name, "light", accentHue);
    if (light) out.push(`[data-theme="${name}"] {\n${declarations(light)}\n}`);
  }
  if (mode !== "light") {
    const dark = hueStepFor(table, name, "dark", accentHue);
    if (dark) {
      const body = declarations(dark);
      if (mode === "auto") {
        out.push(`@media (prefers-color-scheme: dark) {\n  [data-theme="${name}"]:not([data-mode="light"]) {\n${body.replace(/^/gm, "  ")}\n  }\n}`);
      }
      out.push(`[data-theme="${name}"][data-mode="dark"] {\n${body}\n}`);
    }
  }
  return `${out.join("\n\n")}\n`;
}
```

A note on the rotated list: `step.rotated` already includes `color/accent`, and `cssVarName` turns each token name into its custom property, so a coupled token such as `glass/edge` becomes `--mi-glass-edge`. The alpha a coupled token carried in the token file is deliberately dropped here, because the table recorded the rotated value without it and the gate measured that value. If a future change wants the alpha back, it belongs in `build-hues.ts` where the gate can see it.

- [ ] **Step 4: Teach `validate` about the table**

In `engine/validate.ts`, extend the options and add the check. `ValidateOptions` becomes:

```ts
export interface ValidateOptions {
  assets?: AssetNames;
  /** Supplied by the pipeline. Left out, accentHue is not checked, so each layer
   * stays testable without reading a generated file off disk. */
  hues?: HueTable;
}
```

Add the import:

```ts
import { hueStepFor, modesOf } from "./hues.ts";
import type { HueTable } from "./hues.ts";
```

Add this function:

```ts
/** accentHue is a lookup into a gated table, never a free number, because the
 * guarantee is that the value was contrast checked before anyone could pick it. */
export function checkAccent(document: PageDocument, table: HueTable): DocumentError[] {
  const { name, accentHue } = document.theme;
  if (accentHue === null) return [];
  if (name in table.refused) {
    return [{ layer: "vocabulary", code: "accent-not-rotatable", message: `The ${name} theme cannot rotate its accent: ${table.refused[name]}.`, path: "theme.accentHue" }];
  }
  const missing = modesOf(document).filter((mode) => !hueStepFor(table, name, mode, accentHue));
  if (missing.length) {
    const offered = modesOf(document).flatMap((mode) => table.themes[name]?.[mode].map((s) => s.hue) ?? []);
    return [{
      layer: "vocabulary",
      code: "accent-hue-unavailable",
      message: `The ${name} theme has no accepted accent at hue ${accentHue} in ${missing.join(" or ")} mode. It offers ${[...new Set(offered)].sort((a, b) => a - b).join(", ") || "none"}.`,
      path: "theme.accentHue",
    }];
  }
  return [];
}
```

and call it from `validate`, inside the vocabulary stage so a bad accent is reported alongside other vocabulary problems:

```ts
  const vocabulary = [...checkVocabulary(document), ...(options.hues ? checkAccent(document, options.hues) : [])];
  if (vocabulary.length) return { ok: false, errors: vocabulary };
```

- [ ] **Step 5: Teach `emit` to write the override**

In `engine/emit.ts`, extend `EmitOptions`:

```ts
export interface EmitOptions {
  assets: AssetResolver;
  registryRoot: string;
  /** Left out, a document that sets accentHue emits no override, which is a bug
   * the pipeline prevents by always supplying the table. */
  hues?: HueTable;
}
```

Add the imports:

```ts
import { accentCss } from "./hues.ts";
import type { HueTable } from "./hues.ts";
```

In `emit`, after the four app files, add the override when there is one, and pass its presence to `emitStyles`:

```ts
  const accent = options.hues ? accentCss(options.hues, document) : null;

  return [
    { path: "index.html", contents: emitHtml(document) },
    { path: "src/main.tsx", contents: emitMain() },
    { path: "src/App.tsx", contents: emitApp(document, options.assets) },
    { path: "src/styles.css", contents: emitStyles(document, registry, accent !== null) },
    ...(accent ? [{ path: "src/accent.css", contents: accent }] : []),
    ...registry.map((file) => ({
      path: `${COMPONENT_DIR}/${file}`,
      contents: readFileSync(join(options.registryRoot, file), "utf8"),
    })),
  ];
```

and in `emitStyles`, take the flag and import the override after the theme and before the blocks, because it must win against the theme's generated tokens:

```ts
function emitStyles(document: PageDocument, registry: string[], accent: boolean): string {
  const themeFile = registry.find((f) => f.startsWith("themes/") && f.endsWith(`${document.theme.name}.css`));
  const dir = COMPONENT_DIR.replace("src/", "");
  const lines = [`@import "./${dir}/themes/base.css";`];
  if (themeFile) lines.push(`@import "./${dir}/${themeFile}";`);
  if (accent) lines.push(`@import "./accent.css";`);
  lines.push(`@import "./${dir}/blocks/blocks.css";`);
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 6: Run the tests, the whole suite and the typecheck**

Run: `npx vitest run tests/engine-hues.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Prove the override really lands, by measuring it**

Pick a rotatable theme and a hue from `registry/hues.json`, emit a document that uses it, and confirm the generated declaration is the value the table gated:

```bash
node --input-type=module -e '
import { join } from "node:path";
import { loadHues, accentCss } from "./engine/hues.ts";
const root = process.cwd();
const t = loadHues(root);
const [name, hues] = Object.entries(t.themes).find(([, h]) => h.light.length)!;
const step = hues.light[0];
const doc = { version: 1, theme: { name, mode: "light", accentHue: step.hue }, page: { measure: "page" }, meta: { title: "T", description: "D" }, sections: [] };
console.log(name, step.hue, step.accent);
console.log(accentCss(t, doc));
'
```

Expected: the printed CSS declares `--mi-accent` as exactly the `accent` value the table recorded, plus one declaration per coupled token.

- [ ] **Step 8: Commit**

```bash
git add engine/hues.ts engine/validate.ts engine/emit.ts tests/engine-hues.test.ts
git commit -m "Resolve an accent direction from the gated table and emit the override"
```

---

## Task 19: The planner seam, the pipeline, and the public surface

**Files:**
- Create: `engine/planner.ts`
- Create: `engine/generate.ts`
- Create: `engine/index.ts`
- Test: `tests/engine-generate.test.ts`
- Modify: `AGENTS.md` (one short section, because a new top level directory belongs there)

**Interfaces:**
- Consumes: everything built so far.
- Produces:
  - `PlanResult = { kind: "document"; document: unknown } | { kind: "patch"; ops: unknown[] }`
  - `PlanRequest = { prompt: string; document: PageDocument | null; theme: ThemeRef; feedback?: DocumentError[] }`
  - `Planner = { plan(request: PlanRequest): Promise<PlanResult> }`
  - `EngineError`, a discriminated union with a `retryable` boolean on every member
  - `GenerateInput = { prompt: string; document: PageDocument | null; theme: ThemeRef }`
  - `GenerateResult = { ok: true; document: PageDocument; files: EmittedFile[] } | { ok: false; error: EngineError }`
  - `generate(input: GenerateInput, deps: GenerateDeps): Promise<GenerateResult>`, where `GenerateDeps = { planner: Planner; registryRoot: string; root: string; assets?: AssetResolver }`

The planner is an interface with no implementation here. Which model runs behind it, and where, is a cost and latency decision rather than an architecture decision, and leaving it as a seam is what lets every other stage be tested with no network and no key.

The one reprompt policy lives here: a model that returns something invalid is told exactly what was wrong, once, and a second failure is a typed error rather than a silent partial render.

- [ ] **Step 1: Write the failing test**

Create `tests/engine-generate.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placeholderAssets } from "../engine/assets";
import { DOCUMENT_VERSION, type PageDocument, type ThemeRef } from "../engine/document";
import { generate } from "../engine/generate";
import type { PlanRequest, PlanResult, Planner } from "../engine/planner";

const root = join(import.meta.dirname, "..");
const deps = (planner: Planner) => ({ planner, root, registryRoot: join(root, "registry"), assets: placeholderAssets() });
const theme: ThemeRef = { name: "aqua", mode: "auto", accentHue: null };

/** A planner that returns a canned sequence, and records what it was asked. */
function scripted(...results: (PlanResult | Error)[]): Planner & { seen: PlanRequest[] } {
  const seen: PlanRequest[] = [];
  let at = 0;
  return {
    seen,
    async plan(request) {
      seen.push(structuredClone(request));
      const next = results[at++];
      if (next instanceof Error) throw next;
      if (!next) throw new Error("scripted planner ran out of results");
      return next;
    },
  };
}

const page = (headline: string) => ({
  version: DOCUMENT_VERSION,
  theme,
  page: { measure: "page" },
  meta: { title: "T", description: "D" },
  sections: [{ id: "s_0001", type: "page-hero", props: { headline } }],
});

describe("the first turn", () => {
  it("returns a validated document and its source", async () => {
    const result = await generate({ prompt: "a landing page", document: null, theme }, deps(scripted({ kind: "document", document: page("Ship on Friday.") })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.sections[0]!.props.headline).toBe("Ship on Friday.");
    expect(result.files.map((f) => f.path)).toContain("src/App.tsx");
    expect(result.files.find((f) => f.path === "src/App.tsx")!.contents).toContain("Ship on Friday.");
  });

  it("asks the planner for a document, not a patch, when there is nothing yet", async () => {
    const planner = scripted({ kind: "document", document: page("H") });
    await generate({ prompt: "a landing page", document: null, theme }, deps(planner));
    expect(planner.seen[0]!.document).toBeNull();
    expect(planner.seen[0]!.prompt).toBe("a landing page");
  });

  it("overrides whatever theme the planner put in the document with the one asked for", async () => {
    const wrong = { ...page("H"), theme: { name: "neon", mode: "dark" as const, accentHue: null } };
    const result = await generate({ prompt: "p", document: null, theme }, deps(scripted({ kind: "document", document: wrong })));
    expect(result.ok && result.document.theme.name).toBe("aqua");
  });
});

describe("a later turn", () => {
  const existing = page("Old") as PageDocument;

  it("applies a patch and returns the new document", async () => {
    const planner = scripted({ kind: "patch", ops: [{ op: "setProp", sectionId: "s_0001", path: "headline", value: "New" }] });
    const result = await generate({ prompt: "change the headline", document: existing, theme }, deps(planner));
    expect(result.ok && result.document.sections[0]!.props.headline).toBe("New");
  });

  it("hands the planner the current document", async () => {
    const planner = scripted({ kind: "patch", ops: [] });
    await generate({ prompt: "p", document: existing, theme }, deps(planner));
    expect(planner.seen[0]!.document?.sections[0]!.props.headline).toBe("Old");
  });

  it("returns the document unchanged, and a stale error, when a patch targets a removed section", async () => {
    const planner = scripted(
      { kind: "patch", ops: [{ op: "setProp", sectionId: "s_9999", path: "headline", value: "x" }] },
      { kind: "patch", ops: [{ op: "setProp", sectionId: "s_9999", path: "headline", value: "x" }] },
    );
    const result = await generate({ prompt: "p", document: existing, theme }, deps(planner));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.kind).toBe("stale-patch");
    expect(existing.sections[0]!.props.headline).toBe("Old");
  });
});

describe("the one reprompt policy", () => {
  it("tells the planner what was wrong and accepts its second try", async () => {
    const planner = scripted(
      { kind: "document", document: { ...page("H"), sections: [{ id: "s_0001", type: "carousel", props: {} }] } },
      { kind: "document", document: page("Fixed") },
    );
    const result = await generate({ prompt: "p", document: null, theme }, deps(planner));
    expect(result.ok && result.document.sections[0]!.props.headline).toBe("Fixed");
    expect(planner.seen).toHaveLength(2);
    expect(planner.seen[1]!.feedback?.map((e) => e.code)).toContain("unknown-section");
  });

  it("gives up after the second failure rather than looping", async () => {
    const bad = { kind: "document" as const, document: { ...page("H"), sections: [{ id: "s_0001", type: "carousel", props: {} }] } };
    const planner = scripted(bad, bad);
    const result = await generate({ prompt: "p", document: null, theme }, deps(planner));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.kind).toBe("invalid-document");
    expect(planner.seen).toHaveLength(2);
  });

  it("sends no feedback on the first attempt", async () => {
    const planner = scripted({ kind: "document", document: page("H") });
    await generate({ prompt: "p", document: null, theme }, deps(planner));
    expect(planner.seen[0]!.feedback).toBeUndefined();
  });

  it("reprompts once on output that is not a document at all", async () => {
    const planner = scripted({ kind: "document", document: "not an object" }, { kind: "document", document: page("Fixed") });
    const result = await generate({ prompt: "p", document: null, theme }, deps(planner));
    expect(result.ok).toBe(true);
    expect(planner.seen).toHaveLength(2);
  });
});

describe("errors the caller has to tell apart", () => {
  it("marks a planner that threw as retryable, and tries twice", async () => {
    const planner = scripted(new Error("socket hang up"), new Error("socket hang up"));
    const result = await generate({ prompt: "p", document: null, theme }, deps(planner));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("planner-failed");
    expect(result.error.retryable).toBe(true);
    expect(planner.seen).toHaveLength(2);
  });

  it("does not retry when the planner says not to, as when it is over budget", async () => {
    const refusal = Object.assign(new Error("over budget"), { retryable: false });
    const planner = scripted(refusal, refusal);
    const result = await generate({ prompt: "p", document: null, theme }, deps(planner));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("planner-failed");
    expect(result.error.retryable).toBe(false);
    expect(planner.seen).toHaveLength(1);
  });

  it("marks an invalid document as not retryable, because trying again changes nothing", async () => {
    const bad = { kind: "document" as const, document: { version: 1 } };
    const result = await generate({ prompt: "p", document: null, theme }, deps(scripted(bad, bad)));
    expect(result.ok ? null : result.error.retryable).toBe(false);
  });

  it("carries the validation errors on the error, so a caller can show them", async () => {
    const bad = { kind: "document" as const, document: { ...page("H"), sections: [{ id: "s_0001", type: "carousel", props: {} }] } };
    const result = await generate({ prompt: "p", document: null, theme }, deps(scripted(bad, bad)));
    expect(result.ok).toBe(false);
    if (result.ok || result.error.kind !== "invalid-document") throw new Error("wrong error");
    expect(result.error.errors.length).toBeGreaterThan(0);
  });

  it("refuses a patch on the first turn, because there is nothing to patch", async () => {
    const result = await generate({ prompt: "p", document: null, theme }, deps(scripted({ kind: "patch", ops: [] })));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.kind).toBe("invalid-plan");
  });

  it("refuses a whole document on a later turn, because iteration is patches", async () => {
    const result = await generate({ prompt: "p", document: page("Old") as PageDocument, theme }, deps(scripted({ kind: "document", document: page("New") })));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.kind).toBe("invalid-plan");
  });
});

describe("the public surface", () => {
  it("exports what a caller needs and nothing it does not", async () => {
    const api = await import("../engine/index");
    for (const name of ["generate", "validate", "applyPatch", "emit", "VOCABULARY", "DIRECTIONS", "loadHues", "placeholderAssets", "DOCUMENT_VERSION", "migrate"]) {
      expect(api, name).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine-generate.test.ts`
Expected: FAIL. Cannot resolve `../engine/generate`.

- [ ] **Step 3: Write `engine/planner.ts`**

```ts
// The only stage with a model behind it, kept as an interface with no
// implementation. Which model runs here, and where, is a cost and latency
// decision rather than an architecture one, and the seam is what lets every other
// stage be tested with no network and no key.

import type { PageDocument, ThemeRef } from "./document.ts";
import type { DocumentError } from "./errors.ts";

export interface PlanRequest {
  prompt: string;
  /** Null on the first turn, which is the only turn that may return a document. */
  document: PageDocument | null;
  theme: ThemeRef;
  /** Set only on the single reprompt, carrying what was wrong with the last try. */
  feedback?: DocumentError[];
}

/** Unknown on purpose. Nothing a model returns is trusted before validation. */
export type PlanResult = { kind: "document"; document: unknown } | { kind: "patch"; ops: unknown[] };

export interface Planner {
  plan(request: PlanRequest): Promise<PlanResult>;
}
```

- [ ] **Step 4: Write `engine/generate.ts`**

```ts
// The pipeline. Intake, Plan, Validate, Emit, Verify, Return, of which only Plan
// involves a model. Everything after it is deterministic, so a defect downstream
// is a failing test rather than a vibe.

import { type AssetResolver, placeholderAssets } from "./assets.ts";
import type { PageDocument, ThemeRef } from "./document.ts";
import type { DocumentError } from "./errors.ts";
import { type EmitOptions, type EmittedFile, emit } from "./emit.ts";
import { type HueTable, loadHues } from "./hues.ts";
import { type Op, applyPatch } from "./patch.ts";
import type { Planner } from "./planner.ts";
import { validate } from "./validate.ts";

export type EngineError =
  /** The planner threw. Retryable unless it said otherwise: a timeout is worth
   * another go, being over budget is not. Quotas belong to a later sub-project,
   * so the engine only has to carry the distinction, not enforce it. */
  | { kind: "planner-failed"; retryable: boolean; message: string }
  /** The planner returned the wrong kind of plan for this turn. */
  | { kind: "invalid-plan"; retryable: false; message: string }
  /** Two attempts produced a document that does not validate. */
  | { kind: "invalid-document"; retryable: false; message: string; errors: DocumentError[] }
  /** The patch addressed something that is no longer there. */
  | { kind: "stale-patch"; retryable: false; message: string; errors: DocumentError[] };

export interface GenerateInput {
  prompt: string;
  /** Null on the first turn. */
  document: PageDocument | null;
  theme: ThemeRef;
}

export interface GenerateDeps {
  planner: Planner;
  /** The repo root, used to read registry/hues.json. */
  root: string;
  /** The registry directory, which is <root>/registry. */
  registryRoot: string;
  assets?: AssetResolver;
  /** Supplied in tests to avoid reading the table off disk. */
  hues?: HueTable;
}

export type GenerateResult =
  | { ok: true; document: PageDocument; files: EmittedFile[] }
  | { ok: false; error: EngineError };

export async function generate(input: GenerateInput, deps: GenerateDeps): Promise<GenerateResult> {
  const assets = deps.assets ?? placeholderAssets();
  const hues = deps.hues ?? loadHues(deps.root);
  const options: EmitOptions = { assets, registryRoot: deps.registryRoot, hues };

  let feedback: DocumentError[] | undefined;

  // Two attempts, never more. A model that cannot fix its output when told
  // exactly what was wrong will not fix it on the third try either, and a loop
  // here is a loop on somebody's bill.
  for (let attempt = 0; attempt < 2; attempt++) {
    let plan;
    try {
      plan = await deps.planner.plan({ prompt: input.prompt, document: input.document, theme: input.theme, ...(feedback ? { feedback } : {}) });
    } catch (error) {
      // A planner signals "do not retry" by putting retryable: false on what it
      // throws. Anything else is assumed worth another attempt.
      const retryable = !(typeof error === "object" && error !== null && "retryable" in error && (error as { retryable: unknown }).retryable === false);
      if (!retryable || attempt === 1) {
        return { ok: false, error: { kind: "planner-failed", retryable, message: error instanceof Error ? error.message : String(error) } };
      }
      feedback = [{ layer: "shape", code: "planner-threw", message: "The previous attempt failed before returning anything." }];
      continue;
    }

    // The first turn builds a document. Every turn after it sends a patch, so the
    // user's earlier work is not quietly rewritten.
    if (input.document === null && plan.kind !== "document") {
      return { ok: false, error: { kind: "invalid-plan", retryable: false, message: "The first turn must return a whole document." } };
    }
    if (input.document !== null && plan.kind !== "patch") {
      return { ok: false, error: { kind: "invalid-plan", retryable: false, message: "A later turn must return a patch, because the document is the source of truth." } };
    }

    if (plan.kind === "document") {
      // The caller chose the theme, so a theme the planner invented is discarded.
      const candidate = withTheme(plan.document, input.theme);
      const checked = validate(candidate, { assets, hues });
      if (checked.ok) return { ok: true, document: checked.document, files: emit(checked.document, options) };
      if (attempt === 1) return { ok: false, error: { kind: "invalid-document", retryable: false, message: "The planner returned a document that does not validate, twice.", errors: checked.errors } };
      feedback = checked.errors;
      continue;
    }

    const patched = applyPatch(input.document!, plan.ops as Op[]);
    if (patched.ok) {
      const document = { ...patched.document, theme: { ...patched.document.theme, ...input.theme } };
      const checked = validate(document, { assets, hues });
      if (checked.ok) return { ok: true, document: checked.document, files: emit(checked.document, options) };
      if (attempt === 1) return { ok: false, error: { kind: "invalid-document", retryable: false, message: "The patch produced a document that does not validate, twice.", errors: checked.errors } };
      feedback = checked.errors;
      continue;
    }

    const isStale = patched.errors.some((e) => e.code === "stale-target");
    if (attempt === 1) {
      return isStale
        ? { ok: false, error: { kind: "stale-patch", retryable: false, message: "The patch addressed a section that is no longer in the document.", errors: patched.errors } }
        : { ok: false, error: { kind: "invalid-document", retryable: false, message: "The patch does not apply, twice.", errors: patched.errors } };
    }
    feedback = patched.errors;
  }

  // Unreachable: both arms of the loop return on their second attempt.
  throw new Error("generate: fell out of the attempt loop");
}

/** Replaces whatever theme a plan carried with the one the caller asked for. */
function withTheme(document: unknown, theme: ThemeRef): unknown {
  if (typeof document !== "object" || document === null || Array.isArray(document)) return document;
  return { ...(document as Record<string, unknown>), theme: { ...theme } };
}
```

- [ ] **Step 5: Write `engine/index.ts`**

```ts
// The engine's public surface. A caller needs to generate, to validate and patch a
// stored document, to emit from one, and to read the vocabulary and the accent
// directions in order to build a prompt. Nothing else is exported.

export { DOCUMENT_VERSION } from "./document.ts";
export type { Action, ImageRef, Measure, PageDocument, PropValue, Run, Section, ThemeMode, ThemeRef } from "./document.ts";
export type { DocumentError, ErrorLayer } from "./errors.ts";

export { VOCABULARY, LIMITS, descriptorFor } from "./vocabulary.ts";
export type { PropDescriptor, PropKind, SectionDescriptor, SectionStatus } from "./vocabulary.ts";

export { validate, checkShape, checkVocabulary, checkReferential, checkSemantic, checkAccent, SAFE_SCHEMES } from "./validate.ts";
export type { ValidateOptions, ValidateResult, AssetNames } from "./validate.ts";

export { applyPatch } from "./patch.ts";
export type { Op, PatchResult, Position } from "./patch.ts";

export { migrate } from "./migrate.ts";
export { newSectionId, SECTION_ID } from "./ids.ts";

export { emit, emitApp, COMPONENT_OF } from "./emit.ts";
export type { EmitOptions, EmittedFile } from "./emit.ts";

export { placeholderAssets, PLACEHOLDERS } from "./assets.ts";
export type { Asset, AssetResolver } from "./assets.ts";

export { DIRECTIONS, accentCss, hueStepFor, loadHues, modesOf } from "./hues.ts";
export type { HueStep, HueTable } from "./hues.ts";

export { generate } from "./generate.ts";
export type { EngineError, GenerateDeps, GenerateInput, GenerateResult } from "./generate.ts";
export type { PlanRequest, PlanResult, Planner } from "./planner.ts";
```

- [ ] **Step 6: Run the tests, the whole suite and the typecheck**

Run: `npx vitest run tests/engine-generate.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS, all of it, including the 114 that existed before this plan started.

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `node scripts/contrast.ts`
Expected: 1112 enforced pairs, all passing.

Run: `npm run build && npm run site:build`
Expected: both succeed. The engine must not have broken the CLI build or the docs site.

- [ ] **Step 7: Document the engine in `AGENTS.md`**

`AGENTS.md` describes what the project is and names its directories, so a new top level directory belongs there. Under `## What the project is`, after the existing bullets, add:

```markdown
- `engine/` generates pages from a constrained JSON document. It is the vibe coding
  tool's back end, not part of the copy-paste library, and it does not ship in the
  npm package. The document is the source of truth and the emitted source is a build
  artifact, so the engine never generates CSS except the accent override, whose
  values come from `registry/hues.json` and were gated by the contrast checker.
  `engine/` and `scripts/` write relative imports with an explicit `.ts`, because
  plain `node` resolves them; `registry/` and `tests/` leave the extension off.
```

and add a row to the generated files table:

```markdown
| `registry/hues.json` | the themes' accent tokens | `npm run hues` |
| `tests/golden/*.App.tsx.txt` | `tests/golden/*.json` | `npm run golden` |
```

- [ ] **Step 8: Commit**

```bash
git add engine/planner.ts engine/generate.ts engine/index.ts tests/engine-generate.test.ts AGENTS.md
git commit -m "Add the planner seam, the pipeline and the engine's public surface"
```

---

## What this plan deliberately does not do

Named here so a reviewer can tell a gap from an omission.

- **No model implementation.** `Planner` has no concrete implementation, by design. Writing one is a cost and latency decision, and every stage either side of it is tested without a network.
- **No prompt.** The vocabulary is runtime data precisely so the prompt can be generated from it later and never drift. Generating it is preview-loop work.
- **Sixteen of the nineteen sections.** They are declared, validated and refused by name. Building them is the library plan.
- **No novel-nesting contrast check.** `rulesFor` is selector based, so it cannot see a DOM nesting that no selector describes. The guarantee this plan ships is narrower and honest: the emitter emits only composition, every declaration it relies on already lives in `blocks.css` and is checked across all 17 themes in both modes, and the only generated CSS is an accent override whose values were gated. A document that nests existing sections in a combination nobody painted is not covered, and covering it needs a renderer rather than a parser.
- **No persistence, preview, accounts, hosting, quotas or moderation.** Sub-projects 2 to 5.
