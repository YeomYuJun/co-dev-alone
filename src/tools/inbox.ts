/**
 * Inbox tools — session-to-session handoff via JSON files.
 *
 * codev_check_inbox(role)  — read my inbox, mark as read
 * codev_mark_done(role, session_id, summary, action_required) — write to the other role's inbox
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ROLES } from "../constants.js";
import { markInboxRead, readInbox, writeInbox } from "../storage.js";
import type { InboxMessage, Role } from "../types.js";
import { roleReminder, validateRoleMatch } from "../validation.js";

const RoleSchema = z
  .enum(["developer", "evaluator"])
  .describe(
    "YOUR current role. Developer checks developer inbox, Evaluator checks evaluator inbox. Do NOT check the other role's inbox."
  );

const CheckInboxInputSchema = z.object({
  role: RoleSchema,
}).strict();

const MarkDoneInputSchema = z.object({
  role: RoleSchema.describe("YOUR current role (the sender). Must match your session_id convention."),
  session_id: z.string().min(1).max(128).describe("Your session ID"),
  summary: z.string().min(1).max(2000).describe("Summary of completed work / feedback"),
  action_required: z.string().min(1).max(1000).describe(
    "What the other role must do next (e.g. '코드 리뷰 후 pass/fail 판정을 내리고 mark_done으로 결과를 전달하세요')"
  ),
}).strict();

function oppositeRole(role: Role): Role {
  return role === ROLES.DEV ? ROLES.EVAL : ROLES.DEV;
}

function formatInboxMessage(role: Role, msg: InboxMessage): string {
  const lines = [
    `${roleReminder(role)} Checked YOUR inbox (${role}).`,
    ``,
    `[INBOX MESSAGE] From: ${msg.from} | Session: ${msg.session_id}`,
    `Written at: ${msg.written_at}`,
    ``,
    msg.summary,
  ];

  if (msg.action_required) {
    lines.push(``, `⚠️ ACTION REQUIRED: ${msg.action_required}`);
  }

  lines.push(``, `[Marked as read]`);
  return lines.join("\n");
}

function formatInboxEmpty(role: Role): string {
  return [
    `${roleReminder(role)} Checked YOUR inbox (${role}).`,
    `No pending messages.`,
    ``,
    `Proceed by loading context: codev_get_context(session_id)`,
  ].join("\n");
}

export function registerInboxTools(server: McpServer): void {
  server.registerTool("codev_check_inbox", {
    title: "Check Session Inbox",
    description: `Read and consume the inbox message left by the other session role.

Call this at the start of every session to check for handoff signals.
The role parameter is YOUR role — you are reading YOUR OWN inbox.

Args:
  - role: Your role ('developer' or 'evaluator'). This reads YOUR inbox, not the other role's.

Returns:
  - If message found: message content with ACTION REQUIRED, marks as read
  - If empty: "no pending messages" signal`,
    inputSchema: CheckInboxInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    const role = params.role as Role;
    const inbox = readInbox(role);

    // Empty sentinel or already-read
    if (("read" in inbox && inbox.read === true && !("from" in inbox)) || (inbox as InboxMessage).read) {
      return { content: [{ type: "text", text: formatInboxEmpty(role) }] };
    }

    const msg = inbox as InboxMessage;
    markInboxRead(role);

    return {
      content: [{ type: "text", text: formatInboxMessage(role, msg) }],
      structuredContent: msg as unknown as Record<string, unknown>,
    };
  });

  server.registerTool("codev_mark_done", {
    title: "Mark Session Done & Notify Other Role",
    description: `Signal completion and leave a message for the other role's inbox.

This tool ONLY writes an inbox message. It does NOT update CHANGELOG or state files.
Use codev_finalize for CHANGELOG/state updates after eval ALL PASS.

Args:
  - role: Your current role (must match session_id convention)
  - session_id: Your session ID
  - summary: Summary of what you did / feedback
  - action_required: What the other role must do next

Returns: Confirmation that inbox was written.`,
    inputSchema: MarkDoneInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    const senderRole = params.role as Role;

    // P0-A(D): session_id 기반 role 검증
    const mismatch = validateRoleMatch(params.session_id, senderRole);
    if (mismatch) {
      return { content: [{ type: "text", text: `${roleReminder(senderRole)} ERROR\n\n${mismatch}` }] };
    }

    const targetRole = oppositeRole(senderRole);

    writeInbox(targetRole, {
      from: senderRole,
      session_id: params.session_id,
      summary: params.summary,
      action_required: params.action_required,
      written_at: new Date().toISOString(),
    });

    const text = [
      `${roleReminder(senderRole)} [DONE] Inbox written for '${targetRole}'.`,
      ``,
      `From: ${senderRole} (${params.session_id})`,
      `Summary: ${params.summary}`,
      `Action required for ${targetRole}: ${params.action_required}`,
      ``,
      `The ${targetRole} session will receive this on next codev_check_inbox('${targetRole}').`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  });
}
