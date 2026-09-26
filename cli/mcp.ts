// An MCP server over stdio, so any agent that speaks the protocol (Claude Code,
// Cursor, Windsurf) can read mitame's real source and install from it instead of
// guessing an API from its training data.
//
// The protocol is JSON-RPC 2.0 over newline delimited JSON, and the three
// methods that matter are initialize, tools/list and tools/call. That is little
// enough to write by hand, which is the point: mitame ships no dependencies, and
// adding an SDK to the package that advertises having none would be a strange
// way to make that promise.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { add, init, readConfig } from "./commands.ts";
import { KINDS, THEMES, collectFiles, listItems, resolveItem } from "./registry.ts";

const PROTOCOL = "2025-06-18";
const SUPPORTED = new Set([PROTOCOL, "2025-03-26", "2024-11-05"]);

interface Request {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // A method signature rather than a property, so each tool can declare the
  // argument shape it actually takes instead of casting inside every one.
  run(args: Record<string, unknown>, ctx: { root: string; cwd: string }): string;
}

const str = (description: string) => ({ type: "string", description });

function meta(root: string): {
  version: string;
  components: { name: string; add: string; description: string; native: string; props: { name: string; type: string; default?: string; description: string }[]; keyboard?: [string, string][]; notes?: string[] }[];
  blocks: { name: string; add: string; description: string; uses: string[] }[];
  themes: { name: string; add: string; group: string; era: string; year: string; css: string }[];
} {
  return JSON.parse(readFileSync(join(root, "meta.json"), "utf8"));
}

/** The rules an agent gets wrong when it has only seen the source. */
const HOUSE_RULES = `mitame is copy-paste: `+
`the CLI writes source into the project and the project owns it. There is no package to import from and no npm dependency to add.
Import the theme CSS exactly once in a global stylesheet, base.css first and then one theme file, or every component renders unstyled.
Set the theme on a root element: <html data-theme="aqua">. Force a mode with data-mode="light" or data-mode="dark", or leave it off to follow the device.
Style through the data-slot, data-variant, data-size and data-state attributes, or through the --mi-* custom properties. mitame's CSS sits in @layer components, so plain classes and Tailwind utilities already win. Do not add tailwind-merge.
The @/ alias is not configured by mitame. Either add "@/*": ["./src/*"] to the tsconfig paths, or import with relative paths.`;

const TOOLS: Tool[] = [
  {
    name: "list_items",
    description: "Everything that can be installed: components, blocks, hooks, icons, lib helpers and themes. Start here.",
    inputSchema: {
      type: "object",
      properties: { kind: { type: "string", enum: [...KINDS], description: "Narrow to one kind. Omit for all." } },
    },
    run: (args: { kind?: string }, { root }) => {
      const items = listItems(root);
      const m = meta(root);
      const described = new Map<string, string>([
        ...m.components.map((c) => [c.name, c.description] as [string, string]),
        ...m.blocks.map((b) => [b.name, b.description] as [string, string]),
        ...m.themes.map((t) => [t.name, `${t.group}, ${t.era} ${t.year}`] as [string, string]),
      ]);
      const kinds = args.kind ? { [args.kind]: items[args.kind] ?? [] } : items;
      const lines = Object.entries(kinds).map(
        ([kind, names]) =>
          `${kind}\n${names.map((n) => `  ${n}${described.has(n) ? `: ${described.get(n)}` : ""}`).join("\n")}`,
      );
      return `${lines.join("\n\n")}\n\nInstall with the add_items tool, or \`npx @lazizbekio/mitame add <name>\`.`;
    },
  },
  {
    name: "get_item",
    description:
      "The full source of one item and every file it imports, plus its props and keyboard behaviour where mitame documents them. Read this before writing code that uses a component.",
    inputSchema: {
      type: "object",
      properties: { name: str("A name from list_items, for example button, select, sign-in or aqua.") },
      required: ["name"],
    },
    run: (args: { name: string }, { root }) => {
      const entry = resolveItem(root, args.name);
      const files = collectFiles(root, [entry]);
      const doc = meta(root).components.find((c) => c.name === args.name || c.add === args.name);
      const api = doc
        ? [
            `${doc.name}: ${doc.description}`,
            `Built on ${doc.native}.`,
            "",
            "Props",
            ...doc.props.map((p) => `  ${p.name}: ${p.type}${p.default ? ` = ${p.default}` : ""}  ${p.description}`),
            ...(doc.keyboard?.length ? ["", "Keyboard", ...doc.keyboard.map(([k, v]) => `  ${k}: ${v}`)] : []),
            ...(doc.notes?.length ? ["", "Notes", ...doc.notes.map((n) => `  ${n}`)] : []),
            "",
          ].join("\n")
        : "";
      const sources = files
        .map((f) => `--- ${f} ---\n${readFileSync(join(root, f), "utf8")}`)
        .join("\n");
      return `${api}Installing "${args.name}" copies ${files.length} file${files.length === 1 ? "" : "s"}:\n${files.map((f) => `  ${f}`).join("\n")}\n\n${sources}`;
    },
  },
  {
    name: "add_items",
    description:
      "Copy items into this project, following their imports. Run init_project first if there is no mitame.json. Existing files are kept unless overwrite is true.",
    inputSchema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, description: "Names from list_items." },
        overwrite: { type: "boolean", description: "Replace files that are already there. Shared dependencies you edited are still kept." },
      },
      required: ["names"],
    },
    run: (args: { names: string[]; overwrite?: boolean }, { root, cwd }) => {
      const result = add(root, cwd, args.names, { overwrite: args.overwrite });
      const lines = [
        ...result.written.map((f) => `written  ${f}`),
        ...result.skipped.map((f) => `kept     ${f} (already there)`),
        ...result.reused.map((f) => `reused   ${f}`),
      ];
      const needsBlockCss = [...result.written, ...result.reused, ...result.skipped].some((f) => f.endsWith("blocks/blocks.css"));
      const dir = readConfig(cwd).dir.replace(/^src\//, "");
      return [
        lines.join("\n") || "Nothing to do.",
        needsBlockCss ? `\nThis block needs its layout CSS. Import it once, next to the theme:\n  @import "./${dir}/blocks/blocks.css";` : "",
        `\n${HOUSE_RULES}`,
      ].join("\n");
    },
  },
  {
    name: "init_project",
    description:
      "Set this project up: writes mitame.json and copies the base CSS, the Tailwind bridge and one theme. Safe to run again to switch theme.",
    inputSchema: {
      type: "object",
      properties: {
        theme: str("A theme name from list_items. Defaults to aqua."),
        dir: str("Where the files go. Defaults to src/components/mitame."),
      },
    },
    run: (args: { theme?: string; dir?: string }, { root, cwd }) => {
      const r = init(root, cwd, { theme: args.theme, dir: args.dir });
      return [
        `mitame ready in ${r.config.dir}, theme ${r.config.theme}.`,
        ...r.written.map((f) => `written  ${f}`),
        "",
        "Import the CSS once in your global stylesheet, in this order:",
        `  @import "./${r.config.dir.replace(/^src\//, "")}/themes/base.css";`,
        `  @import "./${r.config.dir.replace(/^src\//, "")}/themes/${THEMES[r.config.theme]}.css";`,
        `Then set the theme: <html data-theme="${r.config.theme}">`,
        "",
        HOUSE_RULES,
      ].join("\n");
    },
  },
  {
    name: "get_theme",
    description:
      "One theme's token values for both modes, and the lines that turn it on. Use this to match a design to a theme, or to read what a --mi-* property resolves to.",
    inputSchema: {
      type: "object",
      properties: { name: str("A theme name, for example aqua, sumi or terminal.") },
      required: ["name"],
    },
    run: (args: { name: string }, { root }) => {
      const path = THEMES[args.name];
      if (!path) throw new Error(`Unknown theme "${args.name}". Available: ${Object.keys(THEMES).join(", ")}`);
      const tokens = readFileSync(join(root, `themes/${path}.tokens.css`), "utf8");
      const doc = meta(root).themes.find((t) => t.name === args.name);
      return [
        doc ? `${args.name}: ${doc.group}, ${doc.era} ${doc.year}` : args.name,
        "",
        "Turn it on:",
        `  @import "./components/mitame/themes/base.css";`,
        `  @import "./components/mitame/themes/${path}.css";`,
        `  <html data-theme="${args.name}">`,
        "",
        tokens,
      ].join("\n");
    },
  },
];

function send(message: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(req: Request, ctx: { root: string; cwd: string }): void {
  const reply = (result: unknown) => send({ jsonrpc: "2.0", id: req.id, result });
  if (req.method === "initialize") {
    const asked = (req.params?.protocolVersion as string) ?? PROTOCOL;
    return reply({
      protocolVersion: SUPPORTED.has(asked) ? asked : PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: "mitame", version: "0.1.1" },
      instructions: HOUSE_RULES,
    });
  }
  // Notifications carry no id and get no response.
  if (req.id === undefined || req.id === null) return;
  if (req.method === "ping") return reply({});
  if (req.method === "tools/list") {
    return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (req.method === "tools/call") {
    const name = req.params?.name as string;
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return send({ jsonrpc: "2.0", id: req.id, error: { code: -32602, message: `Unknown tool "${name}"` } });
    try {
      const text = tool.run((req.params?.arguments ?? {}) as Record<string, unknown>, ctx);
      return reply({ content: [{ type: "text", text }] });
    } catch (e) {
      // A failed tool call is a result the model can read and act on, not a
      // protocol error, so it comes back as content with isError set.
      return reply({ content: [{ type: "text", text: (e as Error).message }], isError: true });
    }
  }
  send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Unknown method "${req.method}"` } });
}

/** Reads newline delimited JSON-RPC from stdin until it closes. */
export function serve(root: string, cwd: string = process.cwd()): void {
  if (!existsSync(join(root, "meta.json"))) throw new Error("registry/meta.json is missing. Run `npm run meta`.");
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let at: number;
    while ((at = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      try {
        handle(JSON.parse(line) as Request, { root, cwd });
      } catch (e) {
        send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: (e as Error).message } });
      }
    }
  });
  process.stdin.on("end", () => process.exit(0));
}

export { TOOLS };
