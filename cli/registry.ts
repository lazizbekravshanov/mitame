import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

/** Registry kinds, matching folders under registry/. */
export const KINDS = ["ui", "hooks", "lib", "icons", "themes"] as const;

export const THEMES: Record<string, string> = { aqua: "y2k/aqua", liquid: "now/liquid" };

const EXTS = [".tsx", ".ts", ".css"];

/** Turns what the user typed into a registry file path (relative to the registry root). */
export function resolveItem(root: string, name: string): string {
  const clean = name.replace(/\.(tsx?|css)$/, "");
  const candidates = [
    clean.includes("/") ? clean : `ui/${clean}`,
    `themes/${THEMES[clean] ?? clean}`,
    `icons/${clean}`,
    `hooks/${clean}`,
  ];
  for (const c of candidates) {
    for (const ext of EXTS) {
      const file = c + ext;
      if (existsSync(join(root, file))) return file;
    }
  }
  throw new Error(`Unknown item "${name}". Run \`mitame list\` to see what is available.`);
}

/** Relative imports in a TS/TSX file and @imports in CSS. */
export function localImports(source: string): string[] {
  const out = new Set<string>();
  // `from "./x"`, side effect `import "./x"`, and CSS `@import "./x.css"`
  for (const m of source.matchAll(/(?:from|@?import)\s+["'](\.{1,2}\/[^"']+)["']/g)) out.add(m[1]!);
  return [...out];
}

/** The file plus every registry file it imports, transitively. Paths are registry relative. */
export function collectFiles(root: string, entries: string[]): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(root, file), "utf8");
    for (const spec of localImports(src)) {
      const base = normalize(join(dirname(file), spec));
      const hit = [base, ...EXTS.map((e) => base + e)].find((p) => existsSync(join(root, p)) && p !== dirname(file));
      if (!hit) throw new Error(`${file} imports "${spec}", which is not in the registry`);
      visit(hit);
    }
  };
  entries.forEach(visit);
  return [...seen].sort();
}

/** Everything a user can add, grouped by kind. */
export function listItems(root: string): Record<string, string[]> {
  const walk = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : [relative(root, join(root, dir, d.name))],
    );
  const out: Record<string, string[]> = {};
  for (const kind of KINDS) {
    if (!existsSync(join(root, kind))) continue;
    out[kind] = walk(kind)
      .filter((f) => !f.endsWith(".tokens.css"))
      .map((f) => f.replace(/^[^/]+\//, "").replace(/\.(tsx?|css)$/, ""))
      .sort();
  }
  return out;
}
