/**
 * Inbox tools — session-to-session handoff via JSON files.
 *
 * codev_check_inbox(role)  — read my inbox, mark as read
 * codev_mark_done(role, summary) — write to the other role's inbox
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ROLES } from "../constants.js";
import { markInboxRead, readInbox, writeInbox } from "../storage.js";
import type { InboxMessage, Role } from "../types.js";

const RoleSchema = z
  .enum(["developer", "evaluator"])
  .describe("Session role: 'developer' or 'evaluator'");

const CheckInboxInputSchema = z.object({
  role: RoleSchema,
}).strict();

const MarkDoneInputSchema = z.object({
  role: RoleSchema.describe("Your current role (the sender)"),
  session_id: z.string().min(1).max(128).describe("Your session ID"),
  summary: z.string().min(1).max(2000).describe("Summary of completed work / feedback"),
}).strict();

function oppositeRole(role: Role): Role {
  return role === ROLES.DEV ? ROLES.EVAL : ROLES.DEV;
}

export function registerInboxTools(server: McpServer): void {
  server.registerTool("codev_check_inbox", {
    title: "Check Session Inbox",
    description: `Read and consume the inbox message left by the other session role.

Call this at the start of every session to check for handoff signals from the other role.

Args:
  - role: Your role ('developer' or 'evaluator')

Returns:
  - If message found: message content, marks as read
  - If empty: "inbox empty" signal`,
    inputSchema: CheckInboxInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    const inbox = readInbox(params.role as Role);

    if ("read" in inbox && inbox.read === true && !("from" in inbox)) {
      // Empty inbox
      return {
        content: [{ type: "text", text: `[INBOX EMPTY] No pending messages for '${params.role}'.\n\nProceed by loading context: codev_get_context(session_id)` }],
      };
    }

    const msg = inbox as InboxMessage;

    if (msg.read) {
      return {
        content: [{ type: "text", text: `[INBOX EMPTY] No pending messages for '${params.role}'.\n\nProceed by loading context: codev_get_context(session_id)` }],
      };
    }

    // Mark as read
    markInboxRead(params.role as Role);

    const text = [
      `[INBOX MESSAGE] From: ${msg.from} | Session: ${msg.session_id}`,
      `Written at: ${msg.written_at}`,
      ``,
      `${msg.summary}`,
      ``,
      `[Marked as read]`,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: msg as unknown as Record<string, unknown>,
    };
  });

  server.registerTool("codev_mark_done", {
    title: "Mark Session Done & Notify Other Role",
    description: `Signal completion of your session work and leave a message for the other role.

Call this when your current session work is done — the other role will see this
message when they call codev_check_inbox.

Args:
  - role: Your current role ('developer' or 'evaluator')
  - session_id: Your session ID
  - summary: Summary of what you did / feedback for the other role

Returns: Confirmation that inbox was written.`,
    inputSchema: MarkDoneInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    const senderRole = params.role as Role;
    const targetRole = oppositeRole(senderRole);

    writeInbox(targetRole, {
      from: senderRole,
      session_id: params.session_id,
      summary: params.summary,
      written_at: new Date().toISOString(),
    });

    const text = [
      `[DONE] Inbox written for '${targetRole}'.`,
      ``,
      `From: ${senderRole} (${params.session_id})`,
      `Summary: ${params.summary}`,
      ``,
      `The ${targetRole} session will receive this on next codev_check_inbox('${targetRole}').`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  });
}
