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

describe("the mitame skill", () => {
  const skill = readFileSync(join(root, "skills/mitame/SKILL.md"), "utf8");

  it("names every theme, so an agent does not offer a subset", () => {
    for (const name of Object.keys(THEMES)) expect(skill, name).toContain(`\`${name}\``);
  });

  it("carries the frontmatter that decides when it loads", () => {
    expect(skill.startsWith("---\nname: mitame\ndescription: ")).toBe(true);
    expect(skill).toMatch(/description: .{60,}/);
  });
});

describe("markdown twins", () => {
  it("every component page has one", () => {
    // The route is one file that builds a page per component, so its existence
    // plus getStaticPaths over `components` is the guarantee.
    const route = readFileSync(join(root, "site/src/pages/docs/components/[slug].md.ts"), "utf8");
    expect(route).toContain("components.map");
    expect(route).toContain("text/markdown");
  });
});

describe("social shots", () => {
  it("has a shot page for every theme, generated rather than listed", () => {
    const page = readFileSync(join(root, "site/src/pages/og/gallery/[theme].astro"), "utf8");
    expect(page).toContain("THEMES.map");
    const script = readFileSync(join(root, "scripts/build-social.mjs"), "utf8");
    expect(script).toContain("meta.json");
  });
});

describe("the counts in the prose", () => {
  it("match what actually ships, because a stale number is the first thing a reader checks", () => {
    const themes = Object.keys(THEMES).length;
    const blocks = readdirSync(join(root, "registry/blocks")).filter((f) => f.endsWith(".tsx")).length;
    const components = readdirSync(join(root, "registry/ui")).filter((f) => f.endsWith(".tsx")).length;
    for (const file of ["README.md", "AGENTS.md"]) {
      const text = readFileSync(join(root, file), "utf8");
      const stale = [...text.matchAll(/(\d+) (themes|page blocks|components)\b/g)].filter(([, n, kind]) => {
        const actual = kind === "themes" ? themes : kind === "components" ? components : blocks;
        return Number(n) !== actual;
      });
      expect(stale.map((m) => m[0]), file).toEqual([]);
    }
  });
});
