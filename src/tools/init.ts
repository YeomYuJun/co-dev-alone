/**
 * codev_init — Initialize a Co-Dev project structure.
 *
 * Creates:
 *   1. co-dev/ markdown structure (git-tracked)
 *   2. co-dev/.data/ JSON structure (.gitignored)
 *   3. {project}/.claude/settings.json (CODEV_DATA_DIR override)
 *   4. {project}/.gitignore entry
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Templates are located at ../../src/templates/ relative to dist/tools/
const TEMPLATES_DIR = resolve(__dirname, "..", "..", "src", "templates");

const InitInputSchema = z.object({
  project_name: z.string().min(1).max(100).describe("Project name (used in template headers)"),
  tech_stack: z.string().max(200).default("").describe("Language / framework (optional)"),
  scope: z.string().max(500).default("").describe("Project scope or description (optional)"),
}).strict();

function readTemplate(filename: string): string {
  const p = join(TEMPLATES_DIR, filename);
  if (!existsSync(p)) {
    throw new Error(`Template not found: ${p}`);
  }
  return readFileSync(p, "utf8");
}

function writeIfNotExists(filePath: string, content: string): "created" | "skipped" {
  if (existsSync(filePath)) return "skipped";
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return "created";
}

function ensureGitignoreEntry(gitignorePath: string, entry: string): "added" | "exists" {
  let content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.trim() === entry)) return "exists";
  if (content && !content.endsWith("\n")) content += "\n";
  content += `${entry}\n`;
  writeFileSync(gitignorePath, content, "utf8");
  return "added";
}

export function registerInitTools(server: McpServer): void {
  server.registerTool("codev_init", {
    title: "Initialize Co-Dev Project",
    description: `Initialize Co-Dev project structure in the current working directory.

Creates:
  - co-dev/ markdown files (COLLABO.md, ROLE-GUIDE.md, TASK.md, EVAL-CRITERIA.md, communication/)
  - co-dev/.data/ JSON directories (sessions/, checkpoints/, inbox/)
  - .claude/settings.json with CODEV_DATA_DIR override
  - .gitignore entry for co-dev/.data/

Args:
  - project_name: Project name used in template headers
  - tech_stack: Language / framework (optional)
  - scope: Project scope description (optional)

Safe to re-run — existing files are not overwritten.`,
    inputSchema: InitInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    const cwd = process.cwd();
    const codevDir = join(cwd, "co-dev");
    const dataDir = join(codevDir, ".data");
    const commDir = join(codevDir, "communication");

    const results: string[] = [];

    // ── 1. Markdown structure ────────────────────────────────────────────────
    const markdownFiles: Array<[string, string]> = [
      [join(codevDir, "COLLABO.md"), readTemplate("COLLABO.md")],
      [join(codevDir, "ROLE-GUIDE.md"), readTemplate("ROLE-GUIDE.md")],
      [join(codevDir, "TASK.md"), readTemplate("TASK.md")],
      [join(codevDir, "EVAL-CRITERIA.md"), readTemplate("EVAL-CRITERIA.md")],
      [join(commDir, "CHANGELOG.md"), `# CHANGELOG\n\n> append-only 변경 이력\n`],
      [join(commDir, "ISSUES.md"), `# ISSUES\n\n> 이슈 추적\n`],
      [join(commDir, "dev-state.md"), readTemplate("dev-state.md")],
      [join(commDir, "eval-state.md"), readTemplate("eval-state.md")],
    ];

    for (const [filePath, content] of markdownFiles) {
      const status = writeIfNotExists(filePath, content);
      results.push(`  ${status === "created" ? "✓" : "·"} ${filePath.replace(cwd, ".")} (${status})`);
    }

    // ── 2. JSON .data structure ──────────────────────────────────────────────
    const dataDirs = [
      join(dataDir, "sessions"),
      join(dataDir, "checkpoints"),
      join(dataDir, "inbox"),
    ];
    for (const dir of dataDirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        results.push(`  ✓ ${dir.replace(cwd, ".")} (created)`);
      } else {
        results.push(`  · ${dir.replace(cwd, ".")} (exists)`);
      }
    }

    // Inbox sentinel files
    const emptyInbox = JSON.stringify({ read: true }, null, 2);
    for (const role of ["developer", "evaluator"]) {
      const p = join(dataDir, "inbox", `${role}.json`);
      const status = writeIfNotExists(p, emptyInbox);
      results.push(`  ${status === "created" ? "✓" : "·"} ${p.replace(cwd, ".")} (${status})`);
    }

    // ── 3. .claude/settings.json ─────────────────────────────────────────────
    //
    // Record CODEV_DATA_DIR as documentation of intent.
    // Note: Claude Code CLI registers MCP servers via ~/.claude.json (user scope)
    // or .mcp.json (project scope), NOT via .claude/settings.json. So this env is
    // not what actually drives per-project isolation — that's handled by the
    // cwd-first resolveDataDir() logic (see src/constants.ts). This file stays
    // for human readability and future compatibility.
    const settingsPath = join(cwd, ".claude", "settings.json");
    const codevMcpEnv = {
      env: { CODEV_DATA_DIR: dataDir.replace(/\\/g, "/") },
    };

    if (!existsSync(settingsPath)) {
      mkdirSync(dirname(settingsPath), { recursive: true });
      writeFileSync(
        settingsPath,
        JSON.stringify({ mcpServers: { "co-dev": codevMcpEnv } }, null, 2),
        "utf8"
      );
      results.push(`  ✓ .claude/settings.json (created)`);
    } else {
      try {
        const existing = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
        const mcpServers = (existing["mcpServers"] as Record<string, unknown> | undefined) ?? {};
        const codevServer = (mcpServers["co-dev"] as Record<string, unknown> | undefined) ?? {};
        codevServer["env"] = codevMcpEnv.env;
        mcpServers["co-dev"] = codevServer;
        existing["mcpServers"] = mcpServers;
        writeFileSync(settingsPath, JSON.stringify(existing, null, 2), "utf8");
        results.push(`  ✓ .claude/settings.json (merged CODEV_DATA_DIR)`);
      } catch {
        results.push(`  ! .claude/settings.json (exists, skipped — could not merge)`);
      }
    }

    // ── 4. .gitignore ────────────────────────────────────────────────────────
    const gitignorePath = join(cwd, ".gitignore");
    const gitignoreStatus = ensureGitignoreEntry(gitignorePath, "co-dev/.data/");
    results.push(`  ${gitignoreStatus === "added" ? "✓" : "·"} .gitignore co-dev/.data/ (${gitignoreStatus})`);

    const summary = [
      `[DONE] Co-Dev project initialized: ${params.project_name}`,
      params.tech_stack ? `Stack: ${params.tech_stack}` : "",
      params.scope ? `Scope: ${params.scope}` : "",
      "",
      "Files:",
      ...results,
      "",
      "Next steps:",
      "  1. Edit co-dev/TASK.md — define your tasks",
      "  2. VS Code → Ctrl+Shift+P → Co-Dev: New Developer Session",
    ]
      .filter((l, i) => i < 3 || l !== "")
      .join("\n");

    return { content: [{ type: "text", text: summary }] };
  });
}
