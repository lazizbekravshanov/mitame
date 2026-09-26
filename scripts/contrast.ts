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
  /** The at-rule conditions this rule sits inside, e.g. a colour-scheme query. */
  media: string[];
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
        const media = stack.filter((sel) => sel.startsWith("@"));
        for (const one of expandSelector(selector)) out.push({ file, selector: one.trim(), decls, media });
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

// ---- oklab, so `color-mix(in oklab, ...)` resolves the way a browser computes it.
// Themes lean on color-mix for glass tints, hover states and focus washes, and
// those are exactly the surfaces text has to survive. Skipping them would mean
// skipping the checks that matter most.

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

function toOklab(c: Rgb): [number, number, number] {
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: [number, number, number], alpha: number): Rgb {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

function withAlpha(hex: string, a: number): string {
  const base = hex.slice(0, 7);
  return a >= 1 ? base : base + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0").toUpperCase();
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
function resolveColor(value: string, vars: Map<string, string>, depth = 0): Color {
  if (depth > 8) return { unresolved: value };
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
    // A theme's own var can hold another var (`--mi-tone: var(--mi-accent)`), or
    // a length (`--mi-line: 3px`), which is not a colour at all.
    if (named) return resolveColor(named, vars, depth + 1);
    if (varRef[2]) return resolveColor(varRef[2], vars, depth + 1);
    // A var nothing defines as a colour: a gradient, a shadow stack, a length.
    return { unresolved: v };
  }
  const mix = v.match(/^color-mix\(\s*in\s+(oklab|srgb)\s*,([\s\S]+)\)$/i);
  if (mix) {
    const parts = topLevelParts(mix[2]!);
    if (parts.length !== 2) return { unresolved: v };
    const read = (part: string): { color: Color; pct: number | null } => {
      const m = part.match(/^([\s\S]+?)\s+([\d.]+)%$/) ?? part.match(/^([\d.]+)%\s+([\s\S]+)$/);
      if (!m) return { color: resolveColor(part, vars, depth + 1), pct: null };
      const [a, b] = [m[1]!, m[2]!];
      return /%$/.test(part) ? { color: resolveColor(a, vars, depth + 1), pct: Number(b) } : { color: resolveColor(b, vars, depth + 1), pct: Number(a) };
    };
    const one = read(parts[0]!);
    const two = read(parts[1]!);
    let p1 = one.pct ?? (two.pct !== null ? 100 - two.pct : 50);
    p1 = Math.max(0, Math.min(100, p1)) / 100;
    const p2 = 1 - p1;
    // `color-mix(in oklab, X 30%, transparent)` is the standard way to write
    // "X at 30% alpha", and it is how every theme here draws a tint.
    const isTransparent = (part: string, c: Color) => c === null && /transparent/i.test(part);
    if (isTransparent(parts[1]!, two.color) && one.color && "hex" in one.color) {
      return { hex: withAlpha(one.color.hex, parseHex(one.color.hex).a * p1) };
    }
    if (isTransparent(parts[0]!, one.color) && two.color && "hex" in two.color) {
      return { hex: withAlpha(two.color.hex, parseHex(two.color.hex).a * p2) };
    }
    if (!one.color || !two.color || !("hex" in one.color) || !("hex" in two.color)) return { unresolved: v };
    const c1 = parseHex(one.color.hex);
    const c2 = parseHex(two.color.hex);
    const alpha = c1.a * p1 + c2.a * p2;
    if (mix[1]!.toLowerCase() === "srgb") {
      return { hex: withAlpha(toHex({ r: c1.r * p1 + c2.r * p2, g: c1.g * p1 + c2.g * p2, b: c1.b * p1 + c2.b * p2, a: 1 }), alpha) };
    }
    const [l1, a1, b1] = toOklab(c1);
    const [l2, a2, b2] = toOklab(c2);
    const mixed = fromOklab([l1 * p1 + l2 * p2, a1 * p1 + a2 * p2, b1 * p1 + b2 * p2], alpha);
    return { hex: withAlpha(toHex(mixed), alpha) };
  }
  return { unresolved: v };
}

const BG_KEYWORDS = /\b(no-repeat|repeat(-[xy])?|border-box|padding-box|content-box|center|cover|contain|fixed|scroll|local)\b/g;

/**
 * A gradient sampled where a label actually sits. A gel button is light at the
 * top and dark at the bottom; its text covers the middle band, so checking the
 * extreme top stop would fail a button nobody can read badly.
 */
const TEXT_BAND = [0.35, 0.5, 0.65];

interface Stop {
  color: Rgb;
  at: number | null;
}

/** Stops of a linear gradient, with their positions where they are given. */
function parseStops(inner: string, vars: Map<string, string>): Stop[] | null {
  const out: Stop[] = [];
  for (const part of topLevelParts(inner)) {
    const piece = part.trim();
    if (/^(to\s|[\d.-]+deg|[\d.-]+turn|circle|ellipse|at\s|from\s|closest|farthest|in\s)/i.test(piece)) continue;
    const posMatch = piece.match(/\s(-?[\d.]+)%$/);
    const colorText = posMatch ? piece.slice(0, posMatch.index).trim() : piece;
    const c = resolveColor(colorText, vars);
    if (!c) {
      // `transparent` is a real stop: it reveals whatever is underneath.
      if (/transparent/i.test(colorText)) out.push({ color: { r: 0, g: 0, b: 0, a: 0 }, at: posMatch ? Number(posMatch[1]) / 100 : null });
      continue;
    }
    if (!("hex" in c)) return null;
    out.push({ color: parseHex(c.hex), at: posMatch ? Number(posMatch[1]) / 100 : null });
  }
  return out.length >= 2 ? out : null;
}

/** Fill in the positions CSS would imply, then read the gradient at `t`. */
function sampleGradient(stops: Stop[], t: number): Rgb {
  const at = stops.map((s) => s.at);
  if (at[0] === null) at[0] = 0;
  if (at[at.length - 1] === null) at[at.length - 1] = 1;
  for (let i = 1; i < at.length - 1; i++) {
    if (at[i] !== null) continue;
    let j = i;
    while (j < at.length && at[j] === null) j++;
    const from = at[i - 1]!;
    const to = at[j]!;
    for (let k = i; k < j; k++) at[k] = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  let lo = 0;
  while (lo < stops.length - 2 && at[lo + 1]! < t) lo++;
  const a = stops[lo]!.color;
  const b = stops[lo + 1]!.color;
  const span = at[lo + 1]! - at[lo]!;
  const f = span <= 0 ? 0 : Math.max(0, Math.min(1, (t - at[lo]!) / span));
  return { r: a.r + (b.r - a.r) * f, g: a.g + (b.g - a.g) * f, b: a.b + (b.b - a.b) * f, a: a.a + (b.a - a.a) * f };
}

/** The colours a gradient paints, so a label over it is checked against each. */
function gradientStops(value: string, vars: Map<string, string>): Color[] {
  const m = value.match(/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i);
  if (!m) return [];
  const stops = parseStops(m[3]!, vars);
  if (!stops) return [{ unresolved: value.slice(0, 40) }];
  // A linear gradient is read where the text band crosses it. A radial or conic
  // one sits behind an icon, so every stop it paints counts.
  const samples = m[2]!.toLowerCase() === "linear" ? TEXT_BAND.map((t) => sampleGradient(stops, t)) : stops.map((s) => s.color);
  return samples.map((c) => ({ hex: toHex(c) + (c.a >= 1 ? "" : Math.round(c.a * 255).toString(16).padStart(2, "0").toUpperCase()) }));
}

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

/** A bare `var(--x)` whose value is itself a gradient, expanded to that gradient. */
function expandVars(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 6) return value;
  const m = value.trim().match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  const held = m ? vars.get(m[1]!) : undefined;
  return held ? expandVars(held, vars, depth + 1) : value;
}

/** What one background layer paints at a given point down the element. */
function layerAt(raw: string, t: number, vars: Map<string, string>): Color[] {
  const layer = expandVars(raw, vars);
  const flat = resolveColor(layer, vars);
  if (flat && "hex" in flat) return [flat];
  const m = layer.match(/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i);
  if (!m) return flat ? [flat] : [];
  const stops = parseStops(m[3]!, vars);
  if (!stops) return [{ unresolved: layer.slice(0, 40) }];
  if (m[2]!.toLowerCase() !== "linear") {
    // A radial or conic gradient sits behind an icon rather than a line of
    // text, so each of its stops is somewhere the glyph can land.
    return stops.map((x) => ({ hex: toHex(x.color) + (x.color.a >= 1 ? "" : Math.round(x.color.a * 255).toString(16).padStart(2, "0").toUpperCase()) }));
  }
  const c = sampleGradient(stops, t);
  return [{ hex: toHex(c) + (c.a >= 1 ? "" : Math.round(c.a * 255).toString(16).padStart(2, "0").toUpperCase()) }];
}

/**
 * Every opaque surface a background value can present where a label sits. The
 * layers are read at the same point down the element and composited bottom up,
 * because a gel button is a white gloss over a coloured fill and what the text
 * has behind it is the two of them together, at the same height.
 */
export function surfaceCandidates(value: string, vars: Map<string, string>, page: string): Color[] {
  const layers = topLevelParts(value).map((l) => l.replace(BG_KEYWORDS, "").trim());
  if (!layers.length) return [];
  const out = new Set<string>();
  const unresolved: Color[] = [];
  for (const t of TEXT_BAND) {
    let stack: string[] = [];
    for (let i = layers.length - 1; i >= 0; i--) {
      const painted = layerAt(layers[i]!, t, vars);
      const flats = painted.filter((c): c is { hex: string } => !!c && "hex" in c);
      for (const c of painted) if (c && "unresolved" in c) unresolved.push(c);
      if (!flats.length) continue;
      stack = stack.length ? stack.flatMap((under) => flats.map((over) => flatten(over.hex, under))) : flats.map((c) => flatten(c.hex, page));
      if (stack.length > 12) stack = stack.slice(0, 12);
    }
    for (const c of stack) out.add(c);
  }
  if (!out.size) return unresolved.slice(0, 1);
  return [...out].map((hex) => ({ hex }));
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
    .replace(/:where\(([^()]*(\([^()]*\))?[^()]*)\)/g, (_, inner: string) => (/data-theme/.test(inner) ? "" : `:where(${inner})`))
    .replace(/\[data-theme(=("[a-z]+"))?\]\s*/g, "")
    // A mode-scoped rule overrides its own light counterpart, so they share a key.
    .replace(/:not\(\[data-mode="(light|dark)"\]\)/g, "")
    .replace(/\[data-mode="(light|dark)"\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Which colour scheme a rule applies to, from its media query and its selector. */
export function ruleMode(rule: Rule): "light" | "dark" | "both" {
  const text = rule.media.join(" ") + " " + rule.selector;
  if (/prefers-color-scheme:\s*dark/.test(text) || /\[data-mode="dark"\]/.test(text) || /:not\(\[data-mode="light"\]\)/.test(text)) return "dark";
  if (/prefers-color-scheme:\s*light/.test(text) || /\[data-mode="light"\]/.test(text) || /:not\(\[data-mode="dark"\]\)/.test(text)) return "light";
  return "both";
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
  rings: Record<string, { value: string; source: string }>;
  /** Custom properties this rule sets, e.g. aqua's `--mi-tone: var(--mi-accent)`. */
  props: Record<string, string>;
  /** What a state draws to mark itself, when it is not just a fill. */
  outline?: { value: string; source: string };
  shadow?: { value: string; source: string };
}

/** Merge rules in cascade order: same state, later file and later rule win. */
export function mergeRules(rules: Rule[]): Map<string, Merged> {
  const out = new Map<string, Merged>();
  for (const rule of rules) {
    const key = stateKey(rule.selector);
    const entry = out.get(key) ?? { key, rings: {}, props: {} };
    const source = `${rule.file.replace(/^.*(themes|blocks)\//, "")} ${rule.selector}`.slice(0, 110);
    if (rule.decls["color"]) entry.color = { value: rule.decls["color"]!, source };
    const bg = rule.decls["background-color"] ?? rule.decls["background"];
    if (bg) entry.background = { value: bg, source };
    for (const [prop, value] of Object.entries(rule.decls)) if (prop.startsWith("--")) entry.props[prop] = value;
    if (rule.decls["outline"] && rule.decls["outline"] !== "none") entry.outline = { value: rule.decls["outline"]!, source };
    if (rule.decls["box-shadow"] && rule.decls["box-shadow"] !== "none") entry.shadow = { value: rule.decls["box-shadow"]!, source };
    if (rule.decls["--mi-ring"]) entry.rings["--mi-ring"] = { value: rule.decls["--mi-ring"]!, source };
    if (key.includes(":focus-visible") && rule.decls["outline"]) entry.rings["outline"] = { value: rule.decls["outline"]!, source };
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

/**
 * Whether a focus state also repaints its text. If it does, the fill is not the
 * only thing telling a user where they are, so it does not have to carry the
 * 3:1 on its own. Aqua's selected row turns white on blue; minimal's just gets
 * a slightly paler grey, and that one is the problem.
 */
function changesInk(merged: Map<string, Merged>, entry: Merged, slot: string): boolean {
  const focusInk = entry.color?.value;
  if (!focusInk) return false;
  const resting = merged.get(`[data-slot="${slot}"]`)?.color?.value ?? merged.get(`[data-slot="${PARENT[slot] ?? ""}"]`)?.color?.value;
  return !resting || resting.trim() !== focusInk.trim();
}

export function checkTheme(file: TokenFile, rules: Rule[]): Check[] {
  const byMode = {
    light: mergeRules(rules.filter((r) => ruleMode(r) !== "dark")),
    dark: mergeRules(rules.filter((r) => ruleMode(r) !== "light")),
  };
  const merged = byMode.light;
  const out: Check[] = [];

  for (const mode of ["light", "dark"] as const) {
    const merged = byMode[mode];
    // Rules that set an ink on a descendant of another slot, e.g. brutalist's
    // "a filled toast makes its description black". They do not merge with the
    // slot-keyed rule they override, so a pair they already handle is theirs.
    const overrides = [...merged.values()]
      .filter((e) => e.color && allSlots(e.key).size > 1)
      .map((e) => allSlots(e.key));
    const vars = varMap(file, mode);
    // The theme's own block (`:where([data-theme="x"]) { --mi-face: ... }`)
    // reduces to an empty key once the theme selector is stripped.
    for (const [prop, value] of Object.entries(merged.get("")?.props ?? {})) if (!vars.has(prop)) vars.set(prop, value);
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
    /** The token values plus whatever custom properties this rule and its resting form set. */
    const varsFor = (entry: Merged | undefined): Map<string, string> => {
      if (!entry) return vars;
      const resting = restingKey(entry.key);
      const props = { ...(resting ? merged.get(resting)?.props : undefined), ...entry.props };
      if (!Object.keys(props).length) return vars;
      const local = new Map(vars);
      for (const [prop, value] of Object.entries(props)) local.set(prop, value);
      return local;
    };

    const surfacesUnder = (slot: string | null, seen = new Set<string>()): { color: Color; key: string }[] | "inherit" => {
      if (!slot || seen.has(slot)) return "inherit";
      seen.add(slot);
      const fills: { color: Color; key: string }[] = [];
      for (const entry of merged.values()) {
        if (subjectSlot(entry.key) !== slot || !entry.background) continue;
        if (/::(before|after|backdrop|-webkit-|-moz-)/.test(entry.key)) continue;
        for (const c of surfaceCandidates(entry.background.value, varsFor(entry), page)) fills.push({ color: c, key: entry.key });
      }
      if (fills.length) return fills;
      return surfacesUnder(PARENT[slot] ?? null, seen);
    };

    for (const entry of merged.values()) {
      const slot = subjectSlot(entry.key);

      for (const ring of Object.values(entry.rings)) {
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
      // WCAG 1.4.11: a state a user has to see must differ from the resting
      // state by 3:1 when colour is the only thing that changes. The focused
      // row in a menu is the case that matters, because base.css takes the
      // browser outline away and the fill is then the whole indicator.
      if (slot && /:focus/.test(entry.key) && !Object.keys(entry.rings).length && !changesInk(merged, entry, slot)) {
        // The indicator is whatever the state draws: an outline, a bar drawn as
        // an inset shadow, or, failing those, the fill itself.
        // A variant's focus rule often sets only its own fill, while the mark is
        // drawn by the plainer focus rule that also matches the element.
        const generic = [...merged.values()].find(
          (e) => e !== entry && subjectSlot(e.key) === slot && /:focus/.test(e.key) && (e.outline ?? e.shadow),
        );
        const mark = entry.outline ?? entry.shadow ?? generic?.outline ?? generic?.shadow;
        const drawn = mark ? colorInShorthand(mark.value, varsFor(entry)) : null;
        const restingEntry = merged.get(`[data-slot="${slot}"]`);
        const resting = restingEntry?.background;
        const restingFill = resting ? surfaceCandidates(resting.value, varsFor(restingEntry), page) : null;
        const under = restingFill && restingFill.length ? restingFill.map((color) => ({ color })) : surfacesUnder(PARENT[slot] ?? null);
        const indicator = drawn && "hex" in drawn ? [drawn] : entry.background ? surfaceCandidates(entry.background.value, varsFor(entry), page) : [];
        if (under !== "inherit" && indicator.length) {
          for (const b of under) {
            if (!b.color || !("hex" in b.color)) continue;
            for (const f of indicator) {
              if (!f || !("hex" in f)) continue;
              add(drawn ? "focus mark against the resting row" : "focus fill against the resting row", f.hex, b.color.hex, UI, (mark ?? entry.background)!.source);
            }
          }
        }
      }

      if (!inkDecl) continue;
      const ink = resolveColor(inkDecl.value, varsFor(entry));
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
      const local = varsFor(entry);
      // A translucent fill shows whatever it sits on, so it is flattened over
      // the ancestor's surface rather than over the page: aqua's toast action
      // is a 15% white wash, and it sits on a near black toast.
      const under = slot ? surfacesUnder(PARENT[slot] ?? null) : "inherit";
      const bases =
        under === "inherit"
          ? [page]
          : [...new Set(under.map((u) => (u.color && "hex" in u.color ? flatten(u.color.hex, page) : page)))].slice(0, 4);
      const own = ownBg ? bases.flatMap((base) => surfaceCandidates(ownBg.value, local, base)) : null;
      // `background: none` on the slot itself means "whatever is behind me", so
      // an unpainted slot keeps looking upward rather than assuming the page.
      // Start above the slot: its own states are not surfaces for its resting ink
      // (`:not(:focus)` text never sits on the `:focus` fill), while a descendant's
      // ink genuinely sits on whatever its ancestor painted.
      const fills = own && own.length ? own.map((color) => ({ color, key: entry.key })) : surfacesUnder(slot ? (PARENT[slot] ?? null) : null);

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

export function checkAll(root = ROOT, only?: string[]): Check[] {
  const names = only?.length ? only : Object.keys(THEMES);
  return names.flatMap((name) => checkTheme(loadTheme(name, root), rulesFor(name, root)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const at = process.argv.indexOf("--theme");
  const checks = checkAll(undefined, at === -1 ? undefined : process.argv.slice(at + 1).filter((a) => !a.startsWith("--")));
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
