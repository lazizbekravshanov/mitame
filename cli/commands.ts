import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { THEMES, collectFiles, resolveItem } from "./registry.ts";

export interface Config {
  /** Where mitame files go, relative to the project root. */
  dir: string;
  theme: string;
}

export const CONFIG_FILE = "mitame.json";
export const DEFAULT_CONFIG: Config = { dir: "src/components/mitame", theme: "aqua" };

export function readConfig(cwd: string): Config {
  const file = join(cwd, CONFIG_FILE);
  if (!existsSync(file)) throw new Error("No mitame.json here. Run `npx @lazizbekio/mitame init` first.");
  return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(file, "utf8")) };
}

export interface CopyResult {
  written: string[];
  /** Requested files that already existed and were left alone. */
  skipped: string[];
  /** Shared dependencies (cn, hooks, icons) that were already there. */
  reused: string[];
}

function copy(root: string, cwd: string, dir: string, files: string[], overwrite: boolean, requested: string[] = files): CopyResult {
  const result: CopyResult = { written: [], skipped: [], reused: [] };
  for (const file of files) {
    const dest = join(cwd, dir, file);
    // --overwrite only replaces what was asked for; shared deps you may have edited stay put.
    if (existsSync(dest) && (!overwrite || !requested.includes(file))) {
      (requested.includes(file) ? result.skipped : result.reused).push(join(dir, file));
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(root, file), dest);
    result.written.push(join(dir, file));
  }
  return result;
}

export function init(root: string, cwd: string, opts: Partial<Config> & { overwrite?: boolean } = {}): CopyResult & { config: Config } {
  const config: Config = { ...DEFAULT_CONFIG, ...(existsSync(join(cwd, CONFIG_FILE)) ? readConfig(cwd) : {}) };
  if (opts.dir) config.dir = opts.dir;
  if (opts.theme) config.theme = opts.theme;
  if (!THEMES[config.theme]) throw new Error(`Unknown theme "${config.theme}". Available: ${Object.keys(THEMES).join(", ")}`);
  writeFileSync(join(cwd, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");
  const files = collectFiles(root, ["lib/cn.ts", "themes/base.css", "themes/tailwind.css", `themes/${THEMES[config.theme]}.css`]);
  return { ...copy(root, cwd, config.dir, files, opts.overwrite ?? false), config };
}

export function add(root: string, cwd: string, names: string[], opts: { overwrite?: boolean } = {}): CopyResult {
  const config = readConfig(cwd);
  if (!names.length) throw new Error("Tell me what to add, for example `npx @lazizbekio/mitame add button dialog`.");
  const entries = names.map((n) => resolveItem(root, n));
  return copy(root, cwd, config.dir, collectFiles(root, entries), opts.overwrite ?? false, entries);
}
