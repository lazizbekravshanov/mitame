// WCAG contrast over what the themes actually paint.
//
// The pairs are not a hand-written list, they are read out of the shipped CSS:
//
//  1. Rules are merged the way the cascade merges them, base.css first and the
//     theme second, so a theme that overrides both the ink and the surface of a
//     slot is measured on its final result, not on base's half of it.
//  2. A slot with no surface of its own inherits one. We walk the component's
//     real parent chain (a toast-close sits on a toast, a menu item on the menu
//     panel) and fall back to the page and the panel tints.
//  3. Anything that cannot be resolved to a flat colour (a gradient, a
//     color-mix) is reported as unchecked instead of being silently skipped.
//
// Doing it this way matters. An earlier version assumed every status token was
// body text, so it asked brutalist to darken its flat yellow accent, when what
// brutalist paints is black ink on that yellow at 15:1 and a focus ring in its
// own black. A checker that measures the wrong pair does not just miss bugs, it
// invents work that damages the design.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, cssVarName, type TokenFile } from "./build-tokens.ts";

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** #RGB, #RGBA, #RRGGBB and #RRGGBBAA. Alpha comes back 0..1. */
export function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 || h.length === 4 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
}

/** Paint `fg` (which may be translucent) onto opaque `bg`. */
export function composite(fg: Rgb, bg: Rgb): Rgb {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(c: Rgb): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG 2.1 contrast ratio, rounded to 2 decimals. A translucent `fg` is composited over `bg` first. */
export function contrast(fgHex: string, bgHex: string): number {
  const bg = parseHex(bgHex);
  const fg = composite(parseHex(fgHex), bg);
  const hi = Math.max(luminance(fg), luminance(bg));
  const lo = Math.min(luminance(fg), luminance(bg));
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function toHex(c: Rgb): string {
  const h = (x: number) => Math.round(x).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** Flatten a translucent colour onto an opaque one. */
function flatten(color: string, onto: string): string {
  return toHex(composite(parseHex(color), parseHex(onto)));
}

// ---------------------------------------------------------------- CSS reading

export interface Rule {
  file: string;
  selector: string;
  decls: Record<string, string>;
}

/** Every rule in a stylesheet. At-rules contribute the rules inside them. */
export function parseRules(css: string, file: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const stack: string[] = [];
  let buf = "";
  for (const ch of src) {
    if (ch === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
    } else if (ch === "}") {
      const selector = stack[stack.length - 1] ?? "";
      const decls: Record<string, string> = {};
      for (const part of buf.split(";")) {
        const at = part.indexOf(":");
        if (at < 1) continue;
        decls[part.slice(0, at).trim()] = part.slice(at + 1).trim();
      }
      if (Object.keys(decls).length && !selector.startsWith("@")) {
        for (const one of expandSelector(selector)) out.push({ file, selector: one.trim(), decls });
      }
      stack.pop();
      buf = "";
    } else {
      buf += ch;
    }
  }
  return out;
}

/**
 * One rule per branch: `A, B { }` and `:is(A, B):focus { }` each describe several
 * elements with different surfaces, so they cannot be measured as one thing.
 */
export function expandSelector(selector: string, depth = 0): string[] {
  if (depth > 4) return [selector];
  const commas = topLevelParts(selector);
  if (commas.length > 1) return commas.flatMap((c) => expandSelector(c, depth + 1));
  const at = selector.search(/:is\(/);
  if (at === -1) return [selector];
  let i = at + 4;
  let level = 1;
  while (i < selector.length && level > 0) {
    if (selector[i] === "(") level++;
    if (selector[i] === ")") level--;
    i++;
  }
  const inner = selector.slice(at + 4, i - 1);
  const branches = topLevelParts(inner);
  if (branches.length < 2) return [selector];
  const before = selector.slice(0, at);
  const after = selector.slice(i);
  return branches.flatMap((b) => expandSelector(`${before}${b}${after}`, depth + 1));
}

const NAMED: Record<string, string> = { white: "#FFFFFF", black: "#000000" };

/** Split on top-level commas, so `rgb(0 0 0 / 1), var(--x)` stays two pieces. */
function topLevelParts(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

type Color = { hex: string } | { unresolved: string } | null;

/** One colour value, resolved through the theme's tokens. null means "no paint". */
function resolveColor(value: string, vars: Map<string, string>): Color {
  const v = value.trim();
  if (!v || ["transparent", "none", "inherit", "currentColor", "currentcolor"].includes(v)) return null;
  if (NAMED[v]) return { hex: NAMED[v]! };
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return { hex: v.toUpperCase() };
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/i);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Math.round(Number(n)));
    const rawA = rgb[4];
    const a = rawA === undefined ? 1 : rawA.endsWith("%") ? Number(rawA.slice(0, -1)) / 100 : Number(rawA);
    return { hex: toHex({ r: r!, g: g!, b: b!, a: 1 }) + Math.round(a * 255).toString(16).padStart(2, "0").toUpperCase() };
  }
  const varRef = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,([\s\S]+))?\)$/i);
  if (varRef) {
    const named = vars.get(varRef[1]!);
    if (named) return { hex: named.toUpperCase() };
    if (varRef[2]) return resolveColor(varRef[2], vars);
    // A var the theme defines itself: a gradient, a shadow stack, a length.
    return { unresolved: v };
  }
  return { unresolved: v };
}

const BG_KEYWORDS = /\b(no-repeat|repeat(-[xy])?|border-box|padding-box|content-box|center|cover|contain|fixed|scroll|local)\b/g;

/** The bottom paint layer of a `background` / `background-color` value. */
function resolveSurface(value: string, vars: Map<string, string>): Color {
  const parts = topLevelParts(value);
  const bottom = (parts[parts.length - 1] ?? "").replace(BG_KEYWORDS, "").trim();
  return resolveColor(bottom, vars);
}

/** The colour inside a shorthand like `2px dashed var(--mi-accent)`. */
function colorInShorthand(value: string, vars: Map<string, string>): Color {
  for (const part of value.split(/\s+(?![^(]*\))/)) {
    const c = resolveColor(part, vars);
    if (c && "hex" in c) return c;
  }
  return null;
}

// ---------------------------------------------------------------- the model

/** AA: 4.5 for text, 3.0 for a focus indicator, an icon or another non-text boundary. */
const TEXT = 4.5;
const UI = 3;

/**
 * Slots whose ink only becomes visible once a state fills them: base.css keeps
 * the checkbox glyph at opacity 0 until the box is checked, and the switch thumb
 * carries no glyph at all. Their real pair is measured on the filled state below.
 */
const INK_HIDDEN_UNTIL_FILLED = new Set(["checkbox-box", "switch-thumb"]);

/** Slots that only ever tint an icon. An icon is a graphic, so 3:1 is the bar. */
const ICON_SLOTS = new Set([
  "toast-icon", "toast-close", "select-chevron", "dialog-close-icon", "field-icon",
  "menu-item-icon", "checkbox-check", "checkbox-dash", "select-item-check",
]);

/**
 * Which slot each slot is painted on, from the components' own markup. Used to
 * find the surface under an ink when its own rule declares none.
 */
const PARENT: Record<string, string> = {
  "card-header": "card", "card-title": "card", "card-description": "card", "card-footer": "card",
  "field-label": "field", "field-control": "field", "field-description": "field", "field-error": "field",
  "field-input": "field-control", "field-icon": "field-control",
  "select-value": "select-trigger", "select-chevron": "select-trigger",
  "select-item": "select-content", "select-item-label": "select-item", "select-item-check": "select-item",
  "menu-item": "menu-content", "menu-label": "menu-content", "menu-separator": "menu-content",
  "menu-item-icon": "menu-item", "menu-item-label": "menu-item",
  "tabs-list": "tabs", "tabs-panel": "tabs", "tabs-trigger": "tabs-list",
  "dialog-panel": "dialog", "dialog-title": "dialog-panel", "dialog-description": "dialog-panel",
  "dialog-footer": "dialog-panel", "dialog-close-icon": "dialog-panel",
  "toast-icon": "toast", "toast-text": "toast", "toast-title": "toast", "toast-description": "toast",
  "toast-action": "toast", "toast-close": "toast", "toast": "toaster",
  "checkbox-box": "checkbox", "checkbox-label": "checkbox", "switch-track": "switch", "switch-thumb": "switch-track",
};

/** Every slot a selector names. */
function allSlots(selector: string): Set<string> {
  return new Set([...selector.matchAll(/data-slot="([a-z-]+)"/g)].map((m) => m[1]!));
}

/** The slot a selector is about: the last `data-slot` it names. */
function subjectSlot(selector: string): string | null {
  const all = [...selector.matchAll(/data-slot="([a-z-]+)"/g)];
  return all.length ? all[all.length - 1]![1]! : null;
}

/** A theme-independent key for a rule, so base.css and the theme merge like the cascade does. */
function stateKey(selector: string): string {
  return selector
    .replace(/:where\(\[data-theme(=("[a-z]+"))?\]\)\s*/g, "")
    .replace(/\[data-theme(=("[a-z]+"))?\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The resting form of a state selector, which is where it inherits its surface
 * from: `.mi-button[data-variant="primary"]` falls back to `.mi-button`, and
 * `[data-slot="x"]:focus-visible` to `[data-slot="x"]`. Longest pseudo-class
 * first, or `:focus` eats the front of `:focus-visible`.
 */
function restingKey(key: string): string | null {
  const bare = key
    .replace(/:(focus-visible|focus|hover|active|disabled|popover-open|not\([^)]*\)|is\([^)]*\))/g, "")
    .replace(/\[data-(variant|state|size|mode|position|placeholder|invalid|disabled)(=("[^"]*"))?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return bare && bare !== key ? bare : null;
}

interface Merged {
  key: string;
  color?: { value: string; source: string };
  background?: { value: string; source: string };
  rings: { value: string; source: string }[];
}

/** Merge rules in cascade order: same state, later file and later rule win. */
export function mergeRules(rules: Rule[]): Map<string, Merged> {
  const out = new Map<string, Merged>();
  for (const rule of rules) {
    const key = stateKey(rule.selector);
    const entry = out.get(key) ?? { key, rings: [] };
    const source = `${rule.file.replace(/^.*(themes|blocks)\//, "")} ${rule.selector}`.slice(0, 110);
    if (rule.decls["color"]) entry.color = { value: rule.decls["color"]!, source };
    const bg = rule.decls["background-color"] ?? rule.decls["background"];
    if (bg) entry.background = { value: bg, source };
    const ring = rule.decls["--mi-ring"] ?? (key.includes(":focus-visible") ? rule.decls["outline"] : undefined);
    if (ring) entry.rings.push({ value: ring, source });
    out.set(key, entry);
  }
  return out;
}

export interface Check {
  theme: string;
  mode: "light" | "dark";
  /** What sits on what, in plain words. */
  pair: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  passes: boolean;
  /** Where in the CSS the pair comes from. */
  source: string;
  /** Reported but not enforced: values we cannot resolve to a flat colour. */
  advisory: boolean;
}

function varMap(file: TokenFile, mode: "light" | "dark"): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of file.tokens) if (t.type === "COLOR") out.set(cssVarName(t.name), String(t.values[mode]));
  return out;
}

export function checkTheme(file: TokenFile, rules: Rule[]): Check[] {
  const merged = mergeRules(rules);
  const out: Check[] = [];

  // Rules that set an ink on a descendant of another slot, e.g. brutalist's
  // "a filled toast makes its description black". They do not merge with the
  // slot-keyed rule they override, so a pair they already handle is theirs.
  const overrides = [...merged.values()]
    .filter((e) => e.color && allSlots(e.key).size > 1)
    .map((e) => allSlots(e.key));

  for (const mode of ["light", "dark"] as const) {
    const vars = varMap(file, mode);
    const page = vars.get("--mi-bg");
    if (!page) throw new Error(`${file.collection}: no --mi-bg`);

    // The surfaces a component can sit on: the page, and the panel tints over it.
    const surfaces = new Map<string, string>([["page", page]]);
    for (const [label, name] of [["panel", "--mi-glass-tint"], ["input", "--mi-glass-tint-strong"]] as const) {
      const tint = vars.get(name);
      if (tint) surfaces.set(label, flatten(tint, page));
    }
    const distinct = [...new Map([...surfaces].map(([l, c]) => [c, l])).entries()].map(([c, l]) => [l, c] as const);

    const add = (pair: string, fg: string, bg: string, min: number, source: string, advisory = false) =>
      out.push({ theme: file.collection, mode, pair, fg, bg, ratio: advisory ? 0 : contrast(fg, bg), min, passes: advisory || contrast(fg, bg) >= min, source, advisory });

    /**
     * Every surface an ancestor slot can paint under this ink. A toast is filled
     * by its variant rules, a menu row by its focus rule, so one slot can offer
     * several, and the ink has to read on all of them. Walking up stops at the
     * first ancestor that paints anything at all.
     */
    const surfacesUnder = (slot: string | null, seen = new Set<string>()): { color: Color; key: string }[] | "inherit" => {
      if (!slot || seen.has(slot)) return "inherit";
      seen.add(slot);
      const fills: { color: Color; key: string }[] = [];
      for (const entry of merged.values()) {
        if (subjectSlot(entry.key) !== slot || !entry.background) continue;
        if (/::(before|after|backdrop|-webkit-|-moz-)/.test(entry.key)) continue;
        const c = resolveSurface(entry.background.value, vars);
        if (c) fills.push({ color: c, key: entry.key });
      }
      if (fills.length) return fills;
      return surfacesUnder(PARENT[slot] ?? null, seen);
    };

    for (const entry of merged.values()) {
      const slot = subjectSlot(entry.key);

      for (const ring of entry.rings) {
        const seenBands = new Set<string>();
        for (const band of topLevelParts(ring.value)) {
          const c = colorInShorthand(band, vars);
          if (!c || !("hex" in c)) continue;
          // A band in the page colour is the gap of a two-tone ring, not the ring.
          if (c.hex === page.toUpperCase() || seenBands.has(c.hex)) continue;
          seenBands.add(c.hex);
          add("focus ring on the page", c.hex, page, UI, ring.source);
        }
      }

      // A state that paints a fill but declares no ink (the checked checkbox, the
      // hovered row) still shows the slot's resting ink on top of that fill.
      const inkDecl = entry.color ?? (entry.background && slot ? merged.get(`[data-slot="${slot}"]`)?.color : undefined);
      if (!inkDecl) continue;
      const ink = resolveColor(inkDecl.value, vars);
      if (!ink) continue;
      if ("unresolved" in ink) {
        add(`ink ${ink.unresolved} is not a flat colour`, "?", "?", 0, inkDecl.source, true);
        continue;
      }
      // Pseudo-elements in these themes are rules, underlines and hit areas, never text.
      if (/::(-webkit-|-moz-|backdrop|marker|before|after|selection)/.test(entry.key)) continue;
      // The resting checkbox glyph is transparent until the box is filled; the
      // filled state below is where the pair becomes visible.
      if (slot && INK_HIDDEN_UNTIL_FILLED.has(slot) && entry.key === `[data-slot="${slot}"]`) continue;
      const min = slot && ICON_SLOTS.has(slot) ? UI : TEXT;

      // The surface: this state's own fill, the resting state's fill, then the
      // slot's ancestors, then the page and panel tints.
      // A state inherits its surface from its resting form. Sibling-combinator
      // states (`input:checked + box`) rest on their subject slot, not on a
      // prefix of their own selector.
      const resting = restingKey(entry.key);
      const ownBg =
        entry.background ??
        (resting ? merged.get(resting)?.background : undefined) ??
        (slot ? merged.get(`[data-slot="${slot}"]`)?.background : undefined);
      const own = ownBg ? resolveSurface(ownBg.value, vars) : null;
      // `background: none` on the slot itself means "whatever is behind me", so
      // an unpainted slot keeps looking upward rather than assuming the page.
      // Start above the slot: its own states are not surfaces for its resting ink
      // (`:not(:focus)` text never sits on the `:focus` fill), while a descendant's
      // ink genuinely sits on whatever its ancestor painted.
      const fills = own ? [{ color: own, key: entry.key }] : surfacesUnder(slot ? (PARENT[slot] ?? null) : null);

      if (fills === "inherit") {
        for (const [label, surface] of distinct) add(`ink on the ${label}`, ink.hex, surface, min, inkDecl.source);
        continue;
      }
      for (const { color: fill, key: fillKey } of fills) {
        if (!fill) continue;
        // Skip a surface whose ink this theme sets in a rule of its own.
        const ancestor = subjectSlot(fillKey);
        if (slot && ancestor && overrides.some((o) => o.has(ancestor) && o.has(slot) && o !== allSlots(entry.key))) continue;
        if ("hex" in fill) add(`ink on ${own && ownBg ? ownBg.value.slice(0, 26) : "the surface under it"}`, ink.hex, flatten(fill.hex, page), min, inkDecl.source);
        else add(`ink over ${fill.unresolved.slice(0, 30)}`, ink.hex, "?", 0, inkDecl.source, true);
      }
    }
  }
  return dedupe(out);
}

/** One pair can come from several rules; keep the first, with its source. */
function dedupe(checks: Check[]): Check[] {
  const seen = new Map<string, Check>();
  for (const c of checks) {
    const key = `${c.theme}|${c.mode}|${c.fg}|${c.bg}|${c.min}|${c.advisory}|${c.pair.startsWith("focus") ? "ring" : "ink"}|${c.advisory ? c.source : ""}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}

/** The repo root, whether this runs as a script or inside the test runner. */
function repoRoot(): string {
  if (import.meta.dirname) return join(import.meta.dirname, "..");
  try {
    return join(fileURLToPath(new URL(".", import.meta.url)), "..");
  } catch {
    return process.cwd();
  }
}

const ROOT = repoRoot();

export function loadTheme(name: string, root = ROOT): TokenFile {
  return JSON.parse(readFileSync(join(root, "tokens", `${name}.json`), "utf8")) as TokenFile;
}

/** base.css and the blocks apply to every theme, so they are checked against each one. */
export function rulesFor(name: string, root = ROOT): Rule[] {
  const era = THEMES[name]!;
  const rules = [
    join(root, "registry/themes/base.css"),
    join(root, "registry/blocks/blocks.css"),
    join(root, "registry/themes", era, `${name}.css`),
  ].flatMap((f) => parseRules(readFileSync(f, "utf8"), f));
  // A rule scoped to another theme never applies here. base.css and blocks.css
  // both carry a few theme-scoped overrides, and merging those into every theme
  // would pair one theme's ink with another theme's surface.
  return rules.filter((r) => {
    const scoped = [...r.selector.matchAll(/data-theme="([a-z]+)"/g)].map((m) => m[1]!);
    return scoped.every((t) => t === name);
  });
}

export function checkAll(root = ROOT): Check[] {
  return Object.keys(THEMES).flatMap((name) => checkTheme(loadTheme(name, root), rulesFor(name, root)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const checks = checkAll();
  const enforced = checks.filter((c) => !c.advisory);
  const failures = enforced.filter((c) => !c.passes);
  for (const c of failures) {
    console.log(`FAIL ${c.theme.padEnd(10)} ${c.mode.padEnd(5)} ${c.pair.padEnd(34)} ${c.fg} on ${c.bg}  ${c.ratio} < ${c.min}\n       ${c.source}`);
  }
  const unchecked = checks.filter((c) => c.advisory);
  if (process.argv.includes("--all")) for (const c of unchecked) console.log(`note ${c.theme.padEnd(10)} ${c.mode.padEnd(5)} ${c.pair}\n       ${c.source}`);
  console.log(`\n${enforced.length - failures.length}/${enforced.length} pairs pass, ${failures.length} fail. ${unchecked.length} values are not flat colours (--all to list).`);
  process.exitCode = failures.length ? 1 : 0;
}
