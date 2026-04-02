/**
 * Context tools — map to the [CONTEXT] block in CO-DEV-GUIDE Section 1.1.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionContext } from "../types.js";
import { listSessionIds, loadSessionContext, saveSessionContext } from "../storage.js";

const SessionIdSchema = z
  .string().min(1).max(128)
  .regex(/^[a-zA-Z0-9_\-]+$/, "session_id may only contain letters, digits, hyphens, and underscores")
  .describe("Unique identifier for the session (e.g. 'proj-alpha', 'co-dev-eval-2')");

const SaveContextInputSchema = z.object({
  session_id: SessionIdSchema,
  project: z.string().min(1).max(200).describe("Project name"),
  stack: z.string().min(1).max(200).describe("Language / runtime"),
  phase: z.string().min(1).max(200).describe("Current phase label"),
  completed: z.string().max(2000).default("").describe("Summary of completed work"),
  current_goal: z.array(z.string().min(1).max(500)).min(1).max(3).describe("1-3 goals for this session"),
  constraints: z.string().max(1000).default("").describe("Hard constraints"),
}).strict();

const GetContextInputSchema = z.object({
  session_id: SessionIdSchema,
  response_format: z.enum(["markdown", "json"]).default("markdown"),
}).strict();

const ListSessionsInputSchema = z.object({
  response_format: z.enum(["markdown", "json"]).default("markdown"),
}).strict();

function formatContextMarkdown(ctx: SessionContext): string {
  const goals = ctx.current_goal.map((g, i) => `  ${i + 1}. ${g}`).join("\n");
  return [
    "```",
    "[CONTEXT]",
    `project:      ${ctx.project}`,
    `stack:        ${ctx.stack}`,
    `phase:        ${ctx.phase}`,
    `completed:    ${ctx.completed || "(none)"}`,
    `current_goal:`,
    goals,
    `constraints:  ${ctx.constraints || "(none)"}`,
    `updated_at:   ${ctx.updated_at}`,
    "```",
  ].join("\n");
}

export function registerContextTools(server: McpServer): void {
  server.registerTool("codev_save_context", {
    title: "Save Session Context",
    description: `Save or overwrite the [CONTEXT] block for a CO-DEV session.

Call this at the start of every session to persist the session contract defined in
CO-DEV-GUIDE Section 1.1. Subsequent calls with the same session_id overwrite the previous context.

Args:
  - session_id (string): Unique session identifier (alphanumeric, hyphens, underscores)
  - project (string): Project name
  - stack (string): Language / runtime description
  - phase (string): Current phase label
  - completed (string): Summary of work completed before this session
  - current_goal (string[]): 1-3 goals for this session
  - constraints (string): Hard constraints to respect

Returns: Confirmation message with saved [CONTEXT] block.`,
    inputSchema: SaveContextInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    const ctx: SessionContext = {
      session_id: params.session_id,
      project: params.project,
      stack: params.stack,
      phase: params.phase,
      completed: params.completed,
      current_goal: params.current_goal,
      constraints: params.constraints,
      updated_at: new Date().toISOString(),
    };
    saveSessionContext(ctx);
    return {
      content: [{ type: "text", text: `[DONE] Context saved for session '${params.session_id}'.\n\n${formatContextMarkdown(ctx)}` }],
      structuredContent: { saved: true, context: ctx } as Record<string, unknown>,
    };
  });

  server.registerTool("codev_get_context", {
    title: "Get Session Context",
    description: `Retrieve the saved [CONTEXT] block for a CO-DEV session.

Args:
  - session_id (string): Unique session identifier
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns: Formatted [CONTEXT] block or raw JSON.
Errors: "Session '<id>' not found. Use codev_save_context to create it."`,
    inputSchema: GetContextInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    const ctx = loadSessionContext(params.session_id);
    if (!ctx) {
      return { content: [{ type: "text", text: `Error: Session '${params.session_id}' not found. Use codev_save_context to create it.` }] };
    }
    const text = params.response_format === "json" ? JSON.stringify(ctx, null, 2) : formatContextMarkdown(ctx);
    return { content: [{ type: "text", text }], structuredContent: ctx as unknown as Record<string, unknown> };
  });

  server.registerTool("codev_list_sessions", {
    title: "List CO-DEV Sessions",
    description: `List all session IDs that have a saved context.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns: List of sessions with project name, phase, and last updated timestamp.`,
    inputSchema: ListSessionsInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    const ids = listSessionIds();
    if (ids.length === 0) {
      return { content: [{ type: "text", text: "No sessions found. Use codev_save_context to create one." }] };
    }
    const sessions = ids.map((id) => loadSessionContext(id)).filter((c): c is SessionContext => c !== null);
    let text: string;
    if (params.response_format === "json") {
      text = JSON.stringify(sessions.map((s) => ({ session_id: s.session_id, project: s.project, phase: s.phase, updated_at: s.updated_at })), null, 2);
    } else {
      const lines = [`# CO-DEV Sessions (${sessions.length})`, ""];
      for (const s of sessions) lines.push(`- **${s.session_id}** — ${s.project} | ${s.phase} | updated: ${s.updated_at}`);
      text = lines.join("\n");
    }
    return { content: [{ type: "text", text }], structuredContent: { total: sessions.length, sessions } as Record<string, unknown> };
  });
}
