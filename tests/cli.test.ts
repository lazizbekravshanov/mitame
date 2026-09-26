import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { add, init } from "../cli/commands";
import { THEMES, collectFiles, listItems, localImports, resolveItem } from "../cli/registry";
import { THEMES as TOKEN_THEMES } from "../scripts/build-tokens";

const root = join(import.meta.dirname, "../registry");
const tmp = () => mkdtempSync(join(tmpdir(), "mitame-"));

describe("registry", () => {
  it("resolves names to files", () => {
    expect(resolveItem(root, "button")).toBe("ui/button.tsx");
    expect(resolveItem(root, "liquid")).toBe("themes/now/liquid.css");
    expect(resolveItem(root, "aqua")).toBe("themes/y2k/aqua.css");
    expect(resolveItem(root, "check")).toBe("icons/check.tsx");
    expect(resolveItem(root, "use-popover")).toBe("hooks/use-popover.ts");
    expect(resolveItem(root, "cn")).toBe("lib/cn.ts");
    expect(() => resolveItem(root, "nope")).toThrow(/Unknown item/);
  });

  it("finds TS imports and CSS @imports", () => {
    expect(localImports(`import { a } from "../lib/cn";\nimport "./x.css";\nimport React from "react";`)).toEqual([
      "../lib/cn",
      "./x.css",
    ]);
    expect(localImports(`@import "./liquid.tokens.css";`)).toEqual(["./liquid.tokens.css"]);
  });

  it("pulls dependencies transitively", () => {
    const files = collectFiles(root, ["ui/select.tsx"]);
    expect(files).toEqual(
      expect.arrayContaining([
        "ui/select.tsx",
        "lib/cn.ts",
        "hooks/use-popover.ts",
        "hooks/use-anchor-position.ts",
        "hooks/use-list-navigation.ts",
        "icons/chevron-down.tsx",
        "icons/check.tsx",
      ]),
    );
    expect(collectFiles(root, ["themes/now/liquid.css"])).toContain("themes/now/liquid.tokens.css");
    expect(collectFiles(root, ["themes/y2k/aqua.css"])).toContain("themes/y2k/aqua.tokens.css");
  });

  it("the CLI knows every theme the token generator builds", () => {
    expect(Object.entries(THEMES).sort()).toEqual(Object.entries(TOKEN_THEMES).map(([n, era]) => [n, `${era}/${n}`]).sort());
  });

  it("CSS that a component can import declares the layer order", () => {
    // Whichever stylesheet loads first decides layer order for the page. A CSS
    // file imported from TS can be injected before base.css, so it must name
    // the layers itself or a reset (like Tailwind preflight) outranks themes.
    const all = collectFiles(root, Object.entries(listItems(root)).flatMap(([kind, items]) => items.map((i) => resolveItem(root, `${kind}/${i}`))));
    const importedFromCode = all.filter((f) => f.endsWith(".css") && !f.startsWith("themes/"));
    expect(importedFromCode.length).toBeGreaterThan(0);
    for (const file of importedFromCode) {
      expect(readFileSync(join(root, file), "utf8")).toContain("@layer theme, base, components, utilities;");
    }
  });

  it("every item `list` prints can be added by that name", () => {
    // `mitame list` is the discovery surface: if it prints a name, `add <name>`
    // has to resolve it. lib/ was printed but not resolvable once.
    for (const [kind, items] of Object.entries(listItems(root))) {
      for (const item of items) expect(() => resolveItem(root, item.includes("/") ? `${kind}/${item}` : item)).not.toThrow();
    }
  });

  it("every registry file only imports things inside the registry", () => {
    const all = Object.entries(listItems(root)).flatMap(([kind, items]) => items.map((i) => resolveItem(root, `${kind}/${i}`)));
    expect(all.length).toBeGreaterThan(30);
    expect(() => collectFiles(root, all)).not.toThrow();
  });
});

describe("commands", () => {
  it("init defaults to aqua and writes config plus the base files", () => {
    const cwd = tmp();
    const r = init(root, cwd);
    expect(JSON.parse(readFileSync(join(cwd, "mitame.json"), "utf8"))).toEqual({ dir: "src/components/mitame", theme: "aqua" });
    for (const f of ["lib/cn.ts", "themes/base.css", "themes/y2k/aqua.css", "themes/y2k/aqua.tokens.css"]) {
      expect(existsSync(join(cwd, "src/components/mitame", f))).toBe(true);
    }
    expect(r.written).toHaveLength(5);
  });

  it("init can pick another theme and rejects unknown ones", () => {
    const cwd = tmp();
    init(root, cwd, { theme: "liquid" });
    expect(existsSync(join(cwd, "src/components/mitame/themes/now/liquid.css"))).toBe(true);
    expect(() => init(root, tmp(), { theme: "nope" })).toThrow(/Unknown theme/);
  });

  it("add refuses to run before init", () => {
    expect(() => add(root, tmp(), ["button"])).toThrow(/mitame init/);
  });

  it("add copies deps, keeps edited files, and --overwrite only touches what was asked for", () => {
    const cwd = tmp();
    init(root, cwd, { dir: "ui-kit" });
    add(root, cwd, ["checkbox"]);
    expect(readdirSync(join(cwd, "ui-kit/icons")).sort()).toEqual(["check.tsx", "minus.tsx"]);

    writeFileSync(join(cwd, "ui-kit/ui/checkbox.tsx"), "// mine");
    writeFileSync(join(cwd, "ui-kit/lib/cn.ts"), "// my cn");

    const again = add(root, cwd, ["checkbox"]);
    expect(again.skipped).toEqual(["ui-kit/ui/checkbox.tsx"]);
    expect(again.reused).toContain("ui-kit/lib/cn.ts");
    expect(readFileSync(join(cwd, "ui-kit/ui/checkbox.tsx"), "utf8")).toBe("// mine");

    add(root, cwd, ["checkbox"], { overwrite: true });
    expect(readFileSync(join(cwd, "ui-kit/ui/checkbox.tsx"), "utf8")).not.toBe("// mine");
    expect(readFileSync(join(cwd, "ui-kit/lib/cn.ts"), "utf8")).toBe("// my cn");
  });
});
