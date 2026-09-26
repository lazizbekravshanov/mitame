import { describe, expect, it } from "vitest";
import { checkAll, checkTheme, contrast, expandSelector, mergeRules, parseRules } from "../scripts/contrast";
import type { TokenFile } from "../scripts/build-tokens";
import { THEMES } from "../scripts/build-tokens";

describe("contrast maths", () => {
  it("matches the WCAG reference ratios", () => {
    expect(contrast("#000000", "#FFFFFF")).toBe(21);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });

  it("composites a translucent ink onto its surface first", () => {
    // 50% black over white is mid grey, not black.
    expect(contrast("#00000080", "#FFFFFF")).toBeLessThan(contrast("#000000", "#FFFFFF"));
    expect(contrast("#00000080", "#FFFFFF")).toBeCloseTo(contrast("#7F7F7F", "#FFFFFF"), 0);
  });
});

describe("CSS reading", () => {
  it("flattens at-rules and keeps the last value for a property", () => {
    const rules = parseRules(`@layer components { a { color: red; color: blue } @media (x) { b { color: green } } }`, "t.css");
    expect(rules.map((r) => r.selector)).toEqual(["a", "b"]);
    expect(rules[0]!.decls["color"]).toBe("blue");
  });

  it("splits a grouped selector into one rule per branch", () => {
    expect(expandSelector("a, b")).toEqual(["a", "b"]);
    expect(expandSelector(':is([data-slot="x"], [data-slot="y"]):focus')).toEqual([
      '[data-slot="x"]:focus',
      '[data-slot="y"]:focus',
    ]);
  });

  it("merges base and theme like the cascade does", () => {
    const merged = mergeRules([
      ...parseRules(`[data-slot="field-error"] { color: var(--mi-danger) }`, "base.css"),
      ...parseRules(`:where([data-theme="t"]) [data-slot="field-error"] { background: var(--mi-danger); color: #000 }`, "t.css"),
    ]);
    const entry = merged.get('[data-slot="field-error"]')!;
    expect(entry.color!.value).toBe("#000");
    expect(entry.background!.value).toBe("var(--mi-danger)");
  });
});

describe("every theme", () => {
  const checks = checkAll();

  it("passes WCAG AA on every pair we can resolve to a flat colour", () => {
    const failures = checks
      .filter((c) => !c.advisory && !c.passes)
      .map((c) => `${c.theme} ${c.mode}: ${c.pair} ${c.fg} on ${c.bg} = ${c.ratio} (needs ${c.min})\n    ${c.source}`);
    expect(failures).toEqual([]);
  });

  it("checks a real number of pairs, so a parser regression cannot pass by finding nothing", () => {
    const enforced = checks.filter((c) => !c.advisory);
    expect(enforced.length).toBeGreaterThan(300);
    expect(new Set(enforced.map((c) => c.theme)).size).toBe(Object.keys(THEMES).length);
  });
});

describe("custom properties are substituted where they are declared", () => {
  // A var() inside a custom property resolves against the element the property
  // is declared on. A gradient held on the theme that reaches for a --mi-tone
  // only a button sets is invalid, and the button paints nothing. The checker
  // used to substitute lazily and report that fill as fine, which is worse than
  // missing it: it passes a theme whose buttons are invisible.
  const tokens: TokenFile = {
    collection: "trap",
    modes: ["light", "dark"],
    tokens: [
      { name: "color/bg", type: "COLOR", values: { light: "#FFFFFF", dark: "#000000" } },
      { name: "color/fg", type: "COLOR", values: { light: "#111111", dark: "#EEEEEE" } },
      { name: "color/accent", type: "COLOR", values: { light: "#0A5", dark: "#0A5" } },
      { name: "color/accent-fg", type: "COLOR", values: { light: "#FFFFFF", dark: "#FFFFFF" } },
    ],
  };

  // The shape that bit a real theme: the fill is declared on the plain button
  // and the tone that fill reaches for is declared on the variant, together
  // with the label colour. The variant is the rule the checker measures.
  const check = (declaration: string) =>
    checkTheme(
      tokens,
      parseRules(
        `@layer components {
          :where([data-theme="trap"]) { ${declaration} }
          :where([data-theme="trap"]) .mi-button { background: var(--gel); }
          :where([data-theme="trap"]) .mi-button[data-variant="primary"] { --mi-tone: var(--mi-accent); color: var(--mi-accent-fg); }
        }`,
        "trap.css",
      ),
    );

  it("reports a theme level gradient that reaches for a rule level property as unresolved", () => {
    const pairs = check("--gel: linear-gradient(180deg, var(--mi-tone), var(--mi-tone));");
    // White on the accent would be a comfortable pass, which is exactly the
    // reassurance a browser would not give: the button paints nothing.
    const passedOnAccent = pairs.filter((c) => !c.advisory && c.fg === "#FFFFFF" && c.bg === "#00AA55");
    expect(passedOnAccent).toEqual([]);
    expect(pairs.some((c) => c.advisory)).toBe(true);
  });

  it("still resolves a gradient that only uses properties the theme itself declares", () => {
    const pairs = check("--gel: linear-gradient(180deg, var(--mi-accent), var(--mi-accent));");
    expect(pairs.filter((c) => !c.advisory && c.bg === "#00AA55").length).toBeGreaterThan(0);
  });
});
