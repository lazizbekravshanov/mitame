import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// jsdom cannot lay boxes out or emulate forced colors, so these tests read the
// stylesheet as text. The browser proof for both behaviours lives in the
// release probes; this file only pins the declarations they rely on.
const css = readFileSync(join(__dirname, "../registry/themes/base.css"), "utf8");

/** The declarations of the first rule for `selector` whose body mentions `inside`. */
function block(source: string, selector: string, inside = ""): string {
  for (let at = source.indexOf(selector); at > -1; at = source.indexOf(selector, at + 1)) {
    const open = source.indexOf("{", at);
    const body = source.slice(open + 1, source.indexOf("}", open));
    if (body.includes(inside)) return body;
  }
  expect.fail(`no rule for ${selector} containing "${inside}"`);
}

describe("base.css box sizing", () => {
  // A host app without a universal border-box reset renders these at
  // width plus padding, which pushes a 440px dialog past a 375px viewport.
  it.each([
    ["dialog-panel", "dialog panel width is viewport based"],
    ["toaster", "toaster width is viewport based"],
    ["field-input", "input is 100% wide inside a padded parent"],
    ["select-trigger", "trigger is 100% wide inside a padded parent"],
  ])("gives %s border-box where width and padding meet (%s)", (slot) => {
    expect(block(css, `[data-slot="${slot}"]`, "width")).toContain("box-sizing: border-box");
  });
});

describe("base.css forced colors", () => {
  const start = css.indexOf("@media (forced-colors: active)");
  it("has a forced-colors block", () => {
    expect(start).toBeGreaterThan(-1);
  });
  const forced = start === -1 ? "" : css.slice(start);

  it("keeps the switch visible with borders and system colors", () => {
    expect(block(forced, '[data-slot="switch-track"]')).toMatch(/border: 1px solid/);
    expect(block(forced, '[data-slot="switch-thumb"]')).toMatch(/ButtonText/);
  });

  it("tells checked from unchecked with Highlight", () => {
    expect(forced).toMatch(/switch-input"\]:checked[^}]*switch-track"\]\s*\{[^}]*Highlight/);
    expect(forced).toMatch(/checkbox-input"\]:is\(:checked[^}]*checkbox-box"\]\s*\{[^}]*Highlight/);
  });

  it("gives the checkbox box a border", () => {
    expect(block(forced, '[data-slot="checkbox-box"]')).toMatch(/border: 1px solid/);
  });

  it("redraws the slider track and thumb", () => {
    expect(forced).toContain("::-webkit-slider-runnable-track");
    expect(forced).toContain("::-moz-range-thumb");
  });

  it("keeps a focus indicator where themes draw focus as a box-shadow", () => {
    // Most themes mark focus with box-shadow: var(--mi-ring), which this
    // mode strips, so without an outline here Tab lands nowhere visible.
    expect(forced).toMatch(/switch-input"\]:focus-visible \+ \[data-slot="switch-track"\][^{]*\{[^}]*outline: 2px solid/);
    expect(forced).toMatch(/checkbox-input"\]:focus-visible \+ \[data-slot="checkbox-box"\][^{]*\{[^}]*outline: 2px solid/);
    expect(forced).toMatch(/slider"\]:focus-visible[^{]*\{[^}]*outline: 2px solid/);
    expect(forced).toMatch(/tabs-trigger"\]:focus-visible[^{]*\{[^}]*outline: 2px solid/);
  });
});
