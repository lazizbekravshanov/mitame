import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocs } from "../scripts/build-docs";
import { components } from "../site/src/data/components";
import { THEMES } from "../site/src/lib/theme";
import { contrastSummary } from "../site/src/lib/docs-md";

const root = join(import.meta.dirname, "..");

// The docs the npm package ships. The site serves the same documents, so what
// is checked here is the packaged copy: files on disk, links that stay inside
// the package, and claims that are measured rather than remembered.
describe("the packaged docs", () => {
  const out = mkdtempSync(join(tmpdir(), "mitame-docs-"));
  const written = buildDocs(root, out);

  it("writes one markdown doc per component plus the index", () => {
    for (const c of components) expect(written, c.slug).toContain(`${c.slug}.md`);
    expect(written).toContain("llms.txt");
    for (const f of written) expect(existsSync(join(out, f)), f).toBe(true);
  });

  it("the index links every component doc as a file next to it", () => {
    const index = readFileSync(join(out, "llms.txt"), "utf8");
    for (const c of components) expect(index, c.slug).toContain(`](./${c.slug}.md)`);
  });

  it("each doc carries the real example and the install command", () => {
    for (const c of components) {
      const doc = readFileSync(join(out, `${c.slug}.md`), "utf8");
      expect(doc, c.slug).toContain(`npx @lazizbekio/mitame add ${c.add}`);
      // The example is shown the way it looks after `add`, never the repo alias.
      expect(doc, c.slug).not.toContain("@mitame/");
    }
  });

  it("the contrast claim carries the measured numbers and the theme count", () => {
    const index = readFileSync(join(out, "llms.txt"), "utf8");
    const { pass, total } = contrastSummary(root);
    expect(total).toBeGreaterThan(0);
    expect(index).toContain(`${pass} of ${total} colour pairs`);
    expect(index).toContain(`${THEMES.length} themes`);
  });

  it("never mentions the retired minimal theme", () => {
    for (const f of written) {
      expect(readFileSync(join(out, f), "utf8"), f).not.toMatch(/\bminimal\b/);
    }
  });
});
