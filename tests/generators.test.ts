import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { componentName, svgToTsx } from "../scripts/build-icons";
import { buildMeta } from "../scripts/build-meta";
import { buildRegistry } from "../scripts/build-registry";
import { THEMES, cssValue, cssVarName, tokensToCss, type TokenFile } from "../scripts/build-tokens";

describe("build-tokens", () => {
  it("names and units", () => {
    expect(cssVarName("color/fg-muted")).toBe("--mi-fg-muted");
    expect(cssVarName("glass/tint")).toBe("--mi-glass-tint");
    expect(cssVarName("motion/duration")).toBe("--mi-duration");
    expect(cssVarName("space/3")).toBe("--mi-space-3");
    expect(cssValue("radius/md", 12)).toBe("12px");
    expect(cssValue("glass/saturate", 180)).toBe("180%");
    expect(cssValue("motion/duration", 220)).toBe("220ms");
    expect(cssValue("font/sans", "Inter")).toMatch(/^"Inter", ui-sans-serif/);
  });

  it("emits light values plus dark overrides for both media query and data-mode", () => {
    const file: TokenFile = {
      collection: "demo",
      modes: ["light", "dark"],
      tokens: [
        { name: "color/bg", type: "COLOR", values: { light: "#FFFFFF", dark: "#000000" } },
        { name: "radius/sm", type: "FLOAT", values: { light: 8, dark: 8 } },
      ],
    };
    const css = tokensToCss(file);
    expect(css).toContain('[data-theme="demo"] {');
    expect(css).toContain("--mi-bg: #FFFFFF;");
    expect(css).toContain('[data-theme="demo"]:not([data-mode="light"])');
    expect(css).toContain('[data-theme="demo"][data-mode="dark"]');
    expect(css.match(/--mi-radius-sm/g)).toHaveLength(1);
  });

  it.each(Object.entries(THEMES))("the committed %s css is up to date with its Figma tokens", (name, era) => {
    const root = join(import.meta.dirname, "..");
    const json = JSON.parse(readFileSync(join(root, `tokens/${name}.json`), "utf8"));
    expect(readFileSync(join(root, `registry/themes/${era}/${name}.tokens.css`), "utf8")).toBe(tokensToCss(json));
  });

  it("every theme defines the full token contract in both modes", () => {
    const root = join(import.meta.dirname, "..");
    const names = (n: string) =>
      (JSON.parse(readFileSync(join(root, `tokens/${n}.json`), "utf8")) as TokenFile).tokens.map((t) => t.name).sort();
    const [first, ...rest] = Object.keys(THEMES);
    for (const other of rest) expect(names(other)).toEqual(names(first!));
  });

  it("gives Lucida Grande its Windows relatives", () => {
    expect(cssValue("font/sans", "Lucida Grande")).toMatch(/^"Lucida Grande", "Lucida Sans Unicode"/);
  });
});

describe("build-icons", () => {
  it("names components", () => {
    expect(componentName("chevron-down.svg")).toBe("ChevronDownIcon");
  });

  it("converts attributes and colors", () => {
    const tsx = svgToTsx(
      "x",
      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M0 0" stroke="black" stroke-width="1.5" stroke-linecap="round"/>\n</svg>\n`,
    );
    expect(tsx).toContain('stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />');
    expect(tsx).toContain("export function XIcon(");
    expect(tsx).not.toContain("xmlns");
  });
});

describe("registry.json", () => {
  it("is up to date with the registry, so the shadcn CLI installs what ships", () => {
    const root = join(import.meta.dirname, "..");
    expect(`${JSON.stringify(buildRegistry(root), null, 2)}\n`).toBe(readFileSync(join(root, "registry.json"), "utf8"));
  });

  it("gives every file an explicit target, or the shadcn CLI scatters them", () => {
    // mitame components import each other with relative paths, and the CLI only
    // rewrites @/-prefixed imports. Without a target the tree breaks.
    const items = buildRegistry(join(import.meta.dirname, "..")).items as { name: string; files: { path: string; target?: string }[] }[];
    expect(items.length).toBeGreaterThan(20);
    for (const item of items) {
      expect(item.files.length).toBeGreaterThan(0);
      for (const file of item.files) {
        expect(file.target, `${item.name} / ${file.path}`).toMatch(/^@components\/mitame\//);
        expect(file.path).toMatch(/^registry\//);
      }
    }
  });
});

describe("registry/meta.json", () => {
  const root = join(import.meta.dirname, "..");

  it("is up to date, so the MCP server serves what the docs say", () => {
    expect(`${JSON.stringify(buildMeta(root), null, 2)}\n`).toBe(readFileSync(join(root, "registry/meta.json"), "utf8"));
  });

  it("ships in the package, because the site it is generated from does not", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { files: string[] };
    expect(pkg.files).toContain("registry");
    expect(pkg.files).toContain("skills");
  });
});
