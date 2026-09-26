import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS } from "../cli/mcp";
import { THEMES } from "../cli/registry";

const repo = join(import.meta.dirname, "..");
const root = join(repo, "registry");
const tmp = () => mkdtempSync(join(tmpdir(), "mitame-mcp-"));
const call = (name: string, args: Record<string, unknown>, cwd = repo) =>
  TOOLS.find((t) => t.name === name)!.run(args, { root, cwd });

describe("the MCP server speaks the protocol", () => {
  // One real round trip through the CLI, because the tools being right does not
  // prove the framing, the ids or the handshake are.
  const talk = (...messages: Record<string, unknown>[]) =>
    execFileSync(process.execPath, [join(repo, "cli/index.ts"), "mcp"], {
      input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { id?: number; result?: Record<string, unknown>; error?: unknown });

  it("initializes, lists its tools and answers a call", () => {
    const [init, list, called] = talk(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_items", arguments: { kind: "ui" } } },
    );
    expect(init!.id).toBe(1);
    expect(init!.result!.protocolVersion).toBe("2025-06-18");
    expect((init!.result!.serverInfo as { name: string }).name).toBe("mitame");
    // The notification carried no id, so it must not have produced a reply.
    expect(list!.id).toBe(2);
    expect((list!.result!.tools as { name: string }[]).map((t) => t.name)).toContain("get_item");
    expect(called!.id).toBe(3);
    expect((called!.result!.content as { text: string }[])[0]!.text).toContain("button");
  });

  it("answers an older protocol version with that version", () => {
    const [init] = talk({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    expect(init!.result!.protocolVersion).toBe("2024-11-05");
  });

  it("refuses a tool it does not have, without dying", () => {
    const [, second] = talk(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "rm_rf", arguments: {} } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    );
    expect(second!.id).toBe(2);
  });
});

describe("the MCP tools", () => {
  it("lists every kind, with descriptions where mitame has them", () => {
    const all = call("list_items", {});
    for (const kind of ["ui", "blocks", "hooks", "icons", "themes"]) expect(all).toContain(kind);
    expect(all).toContain("The gel pill");
  });

  it("returns a component's API and the source of everything it imports", () => {
    const text = call("get_item", { name: "select" });
    expect(text).toContain("Props");
    expect(text).toContain("Keyboard");
    // Select pulls hooks and icons, and the caller should see all of them.
    expect(text).toContain("--- ui/select.tsx ---");
    expect(text).toContain("--- hooks/use-anchor-position.ts ---");
    expect(text).toContain("--- icons/check.tsx ---");
  });

  it("gives a theme's tokens and the lines that turn it on", () => {
    const text = call("get_theme", { name: "sumi" });
    expect(text).toContain('data-theme="sumi"');
    expect(text).toContain("--mi-bg");
    expect(() => call("get_theme", { name: "nope" })).toThrow(/Unknown theme/);
  });

  it("knows every theme the CLI knows", () => {
    for (const name of Object.keys(THEMES)) expect(() => call("get_theme", { name })).not.toThrow();
  });

  it("initializes a project and then installs into it", () => {
    const cwd = tmp();
    const started = call("init_project", { theme: "terminal" }, cwd);
    expect(started).toContain("theme terminal");
    expect(JSON.parse(readFileSync(join(cwd, "mitame.json"), "utf8")).theme).toBe("terminal");

    const added = call("add_items", { names: ["dialog"] }, cwd);
    expect(added).toContain("written");
    expect(existsSync(join(cwd, "src/components/mitame/ui/dialog.tsx"))).toBe(true);
    // The rules an agent gets wrong travel with the result, every time.
    expect(added).toContain("@layer components");
  });

  it("tells a caller to init before it can add", () => {
    expect(() => call("add_items", { names: ["button"] }, tmp())).toThrow(/mitame init/);
  });
});
