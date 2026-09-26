import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "../cli/registry";
import { components } from "../site/src/data/components";

const root = join(import.meta.dirname, "..");

describe("docs site", () => {
  it("documents every component in the registry, with a demo, and nothing extra", () => {
    const registry = readdirSync(join(root, "registry/ui")).map((f) => f.replace(/\.tsx$/, "")).sort();
    expect(components.map((c) => c.slug).sort()).toEqual(registry);
    for (const c of components) expect(existsSync(join(root, "site/src/components/demos", `${c.slug}.tsx`))).toBe(true);
  });
});

describe("the site loads every theme", () => {
  it("imports each theme CSS file, or the switcher offers a theme with no styling", () => {
    const css = readFileSync(join(root, "site/src/styles/site.css"), "utf8");
    for (const [name, path] of Object.entries(THEMES)) {
      expect(css, name).toContain(`registry/themes/${path}.css`);
    }
  });
});

describe("the themes page", () => {
  it("shows every theme, so a new one cannot ship invisible", () => {
    const page = readFileSync(join(root, "site/src/pages/themes.astro"), "utf8");
    for (const name of Object.keys(THEMES)) expect(page, name).toContain(`id: "${name}"`);
  });
});
