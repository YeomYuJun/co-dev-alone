/**
 * codev_sync — Reconcile scaffolded templates with their current bundle versions.
 *
 * Status per file (by content hash):
 *   MISSING       file does not exist in project
 *   UP_TO_DATE    installed hash == current template hash
 *   DIVERGED      installed hash != current template hash (user-modified OR stale)
 *
 * Default is dry_run=true: report only, no writes.
 * apply=true creates MISSING files; with force=true also overwrites DIVERGED.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { TEMPLATES, type TemplateEntry } from "../templates/manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = resolve(__dirname, "..", "..", "src", "templates");

const SyncInputSchema = z.object({
  dry_run: z.boolean().default(true).describe(
    "If true (default), only report. If false, apply changes per `apply_mode`."
  ),
  apply_mode: z.enum(["create_missing", "force_all"]).default("create_missing").describe(
    "create_missing: only write MISSING files (safe). force_all: also overwrite DIVERGED files (destructive)."
  ),
}).strict();

type Status = "MISSING" | "UP_TO_DATE" | "DIVERGED";

interface FileStatus {
  name: string;
  installPath: string;
  status: Status;
  action: "none" | "created" | "overwritten";
}

function hashContent(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function readTemplate(templatePath: string): string {
  const p = join(TEMPLATES_DIR, templatePath);
  return readFileSync(p, "utf8");
}

function computeStatus(cwd: string, tpl: TemplateEntry): { status: Status; templateContent: string } {
  const templateContent = readTemplate(tpl.templatePath);
  const installedPath = join(cwd, tpl.installPath);

  if (!existsSync(installedPath)) {
    return { status: "MISSING", templateContent };
  }

  const installedContent = readFileSync(installedPath, "utf8");
  const sameHash = hashContent(installedContent) === hashContent(templateContent);
  return { status: sameHash ? "UP_TO_DATE" : "DIVERGED", templateContent };
}

function formatReport(cwd: string, results: FileStatus[], dryRun: boolean, applyMode: string): string {
  const counts = { MISSING: 0, UP_TO_DATE: 0, DIVERGED: 0 } as Record<Status, number>;
  for (const r of results) counts[r.status]++;

  const lines: string[] = [];
  lines.push(`[CODEV SYNC] ${dryRun ? "DRY RUN (no changes written)" : `APPLIED (mode=${applyMode})`}`);
  lines.push("");
  lines.push(`Summary: ${counts.MISSING} missing · ${counts.UP_TO_DATE} up-to-date · ${counts.DIVERGED} diverged`);
  lines.push("");
  lines.push("Files:");

  for (const r of results) {
    const icon = r.status === "UP_TO_DATE" ? "·" : r.status === "MISSING" ? "+" : "!";
    const actionNote = r.action === "none" ? "" : ` → ${r.action}`;
    lines.push(`  ${icon} [${r.status.padEnd(11)}] ${r.installPath.replace(cwd, ".")} — ${r.name}${actionNote}`);
  }

  lines.push("");

  if (dryRun) {
    if (counts.MISSING > 0) {
      lines.push("→ next: codev_sync(dry_run=false, apply_mode='create_missing') to create missing files.");
    }
    if (counts.DIVERGED > 0) {
      lines.push("→ diverged files will NOT be auto-updated. They are either user-modified or from an older version.");
      lines.push("  To overwrite: codev_sync(dry_run=false, apply_mode='force_all') — destructive, will lose local edits.");
    }
    if (counts.MISSING === 0 && counts.DIVERGED === 0) {
      lines.push("→ no action needed. All templates up to date.");
    }
  } else {
    const changed = results.filter((r) => r.action !== "none");
    if (changed.length === 0) {
      lines.push("→ nothing to apply. Consider codev_sync(dry_run=true) first to preview.");
    } else {
      lines.push(`→ ${changed.length} file(s) modified.`);
    }
  }

  return lines.join("\n");
}

export function registerSyncTools(server: McpServer): void {
  server.registerTool("codev_sync", {
    title: "Sync Scaffolded Templates",
    description: `Reconcile co-dev/* and .claude/agents/* with the MCP bundle's current templates.

Per-file status:
  - MISSING:    not present in project → would create
  - UP_TO_DATE: identical to bundle template
  - DIVERGED:   differs from bundle (user-modified OR from older co-dev version)

Args:
  - dry_run (boolean, default true): preview without writing
  - apply_mode ('create_missing' | 'force_all', default 'create_missing'):
      - create_missing: only write MISSING files (safe)
      - force_all: also overwrite DIVERGED files (destructive — loses local edits)

Returns: status report. Call dry_run=true first to preview.`,
    inputSchema: SyncInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    const cwd = process.cwd();
    const results: FileStatus[] = [];

    for (const tpl of TEMPLATES) {
      const { status, templateContent } = computeStatus(cwd, tpl);
      const entry: FileStatus = {
        name: tpl.name,
        installPath: join(cwd, tpl.installPath),
        status,
        action: "none",
      };

      if (!params.dry_run) {
        const shouldCreate = status === "MISSING";
        const shouldOverwrite = status === "DIVERGED" && params.apply_mode === "force_all";

        if (shouldCreate || shouldOverwrite) {
          mkdirSync(dirname(entry.installPath), { recursive: true });
          writeFileSync(entry.installPath, templateContent, "utf8");
          entry.action = shouldCreate ? "created" : "overwritten";
        }
      }

      results.push(entry);
    }

    const text = formatReport(cwd, results, params.dry_run, params.apply_mode);

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        dry_run: params.dry_run,
        apply_mode: params.apply_mode,
        results,
      } as unknown as Record<string, unknown>,
    };
  });
}
