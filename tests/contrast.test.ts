import { describe, expect, it } from "vitest";
import { checkAll, contrast, expandSelector, mergeRules, parseRules } from "../scripts/contrast";

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
    expect(new Set(enforced.map((c) => c.theme)).size).toBe(11);
  });
});
