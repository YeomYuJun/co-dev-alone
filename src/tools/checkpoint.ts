/**
 * Checkpoint tools — map to the [CHECKPOINT] block in CO-DEV-GUIDE Section 1.2.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT } from "../constants.js";
import { listCheckpointMetas, loadCheckpoint, loadLatestCheckpoint, saveCheckpoint } from "../storage.js";
import type { Checkpoint } from "../types.js";

const SessionIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/).describe("Session identifier");

// Factory function — each call returns a fresh ZodDefault<ZodArray> instance.
// DO NOT share a single base schema and chain .describe() on it multiple times:
// Zod shares _def by reference, causing type/items info to be lost from the
// 3rd+ .describe() call when the MCP SDK generates JSON Schema.
const stringList = (description: string) =>
  z.array(z.string().min(1).max(1000)).default([]).describe(description);

const SaveCheckpointInputSchema = z.object({
  session_id: SessionIdSchema,
  completed: stringList("List of completed items in this session"),
  pending: stringList("List of items that remain incomplete"),
  next_session_goal: stringList("Recommended goals for the next session"),
  open_issues: stringList("Unresolved issues or decisions needed"),
}).strict();

const ReadCheckpointInputSchema = z.object({
  session_id: SessionIdSchema,
  index: z.number().int().min(1).optional().describe("Checkpoint index (1-based). Omit for latest."),
  response_format: z.enum(["markdown", "json"]).default("markdown"),
}).strict();

const ListCheckpointsInputSchema = z.object({
  session_id: SessionIdSchema.optional().describe("Filter by session ID. Omit for all sessions."),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  response_format: z.enum(["markdown", "json"]).default("markdown"),
}).strict();

function formatCheckpointMarkdown(cp: Checkpoint): string {
  const section = (title: string, items: string[]): string =>
    items.length === 0 ? `${title}:\n  (none)` : `${title}:\n${items.map((i) => `  - ${i}`).join("\n")}`;
  return [
    "```", "[CHECKPOINT]",
    `checkpoint_id: ${cp.checkpoint_id}`,
    `session_id:    ${cp.session_id}`,
    `index:         ${cp.index}`,
    `created_at:    ${cp.created_at}`, "",
    section("completed", cp.completed), "",
    section("pending", cp.pending), "",
    section("next_session_goal", cp.next_session_goal), "",
    section("open_issues", cp.open_issues), "```",
  ].join("\n");
}

export function registerCheckpointTools(server: McpServer): void {
  server.registerTool("codev_save_checkpoint", {
    title: "Save Session Checkpoint",
    description: `Persist a [CHECKPOINT] summary for a CO-DEV session (/checkpoint command handler).

Each call auto-increments the checkpoint index. checkpoint_id = '<session_id>-<index>'.

Args:
  - session_id (string): Session to attach the checkpoint to
  - completed (string[]): Items fully finished in this session
  - pending (string[]): Items left incomplete
  - next_session_goal (string[]): Recommended goals for the next session
  - open_issues (string[]): Unresolved issues or decisions needed

Returns: Confirmation with checkpoint_id and full [CHECKPOINT] block.`,
    inputSchema: SaveCheckpointInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    let cp: Checkpoint;
    try {
      cp = saveCheckpoint({
        session_id: params.session_id,
        completed: params.completed,
        pending: params.pending,
        next_session_goal: params.next_session_goal,
        open_issues: params.open_issues,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      return { content: [{ type: "text", text: `Error saving checkpoint: ${err instanceof Error ? err.message : String(err)}` }] };
    }
    return {
      content: [{ type: "text", text: `[DONE] Checkpoint '${cp.checkpoint_id}' saved.\n\n${formatCheckpointMarkdown(cp)}` }],
      structuredContent: { saved: true, checkpoint: cp } as Record<string, unknown>,
    };
  });

  server.registerTool("codev_read_checkpoint", {
    title: "Read Session Checkpoint",
    description: `Read the latest or a specific [CHECKPOINT] for a CO-DEV session.

Args:
  - session_id (string): Session identifier
  - index (number, optional): Checkpoint index (1-based). Defaults to latest.
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Errors:
  - "No checkpoints found for session '<id>'"
  - "Checkpoint index <n> not found for session '<id>'"`,
    inputSchema: ReadCheckpointInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    let cp: Checkpoint | null;
    if (params.index !== undefined) {
      cp = loadCheckpoint(params.session_id, params.index);
      if (!cp) return { content: [{ type: "text", text: `Error: Checkpoint index ${params.index} not found for session '${params.session_id}'.` }] };
    } else {
      cp = loadLatestCheckpoint(params.session_id);
      if (!cp) return { content: [{ type: "text", text: `Error: No checkpoints found for session '${params.session_id}'. Use codev_save_checkpoint first.` }] };
    }
    const text = params.response_format === "json" ? JSON.stringify(cp, null, 2) : formatCheckpointMarkdown(cp);
    return { content: [{ type: "text" , text }], structuredContent: cp as unknown as Record<string, unknown> };
  });

  server.registerTool("codev_list_checkpoints", {
    title: "List Checkpoints",
    description: `List checkpoint metadata across one or all CO-DEV sessions (paginated, newest-first).

Args:
  - session_id (string, optional): Filter to a specific session. Omit for all.
  - limit (number): Max entries (1-100, default 20)
  - offset (number): Pagination offset (default 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns: { total, count, offset, has_more, items: CheckpointMeta[] }`,
    inputSchema: ListCheckpointsInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    const { total, items } = listCheckpointMetas(params.session_id ?? null, params.offset, params.limit);
    if (total === 0) {
      return { content: [{ type: "text", text: `No checkpoints found for ${params.session_id ? `session '${params.session_id}'` : "any session"}.` }] };
    }
    const has_more = total > params.offset + items.length;
    const response = { total, count: items.length, offset: params.offset, has_more, ...(has_more ? { next_offset: params.offset + items.length } : {}), items };
    let text = params.response_format === "json"
      ? JSON.stringify(response, null, 2)
      : [`# Checkpoints (${items.length} of ${total})`, "", ...items.map((m) => `- **${m.checkpoint_id}** | session: ${m.session_id} | ${m.completed_count} done, ${m.pending_count} pending | ${m.created_at}`), has_more ? `\n_More available — offset=${params.offset + items.length}_` : ""].join("\n");
    if (text.length > CHARACTER_LIMIT) text = text.slice(0, CHARACTER_LIMIT) + "\n\n[TRUNCATED]";
    return { content: [{ type: "text", text }], structuredContent: response as unknown as Record<string, unknown> };
  });
}
