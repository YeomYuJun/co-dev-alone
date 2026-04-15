/**
 * codev_finalize — Commit confirmed results to git-tracked markdown files.
 *
 * Use ONLY after Evaluator ALL PASS is confirmed.
 * Performs:
 *   1. CHANGELOG.md append
 *   2. dev-state.md or eval-state.md overwrite
 *   3. TASK.md task completion marking (optional)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { getCommunicationDir, ROLES } from "../constants.js";
import type { Role } from "../types.js";
import { roleReminder, validateRoleMatch } from "../validation.js";

const RoleSchema = z
  .enum(["developer", "evaluator"])
  .describe("YOUR current role (the session that triggers finalize)");

const FinalizeInputSchema = z.object({
  role: RoleSchema,
  session_id: z.string().min(1).max(128).describe("Your session ID"),
  phase: z.string().min(1).max(200).describe("Current phase label (e.g. 'Phase 2 - Implementation')"),
  completed: z.array(z.string().min(1).max(1000)).min(1).describe("Completed items to record"),
  pending: z.array(z.string().min(1).max(1000)).default([]).describe("Remaining pending items"),
  next_session_goal: z.array(z.string().min(1).max(500)).default([]).describe("Goals for the next session"),
  open_issues: z.array(z.string().min(1).max(1000)).default([]).describe("Unresolved issues"),
  eval_result: z.enum(["PASS", "PARTIAL", "FAIL"]).optional()
    .describe("Evaluator only — evaluation verdict"),
  task_id: z.string().max(100).optional()
    .describe("TASK.md task ID to mark as complete (e.g. 'TASK-001'). Optional."),
}).strict();

// ─── Markdown generators ─────────────────────────────────────────────────────

function buildChangelogEntry(
  sessionId: string, role: Role, phase: string,
  completed: string[], pending: string[], openIssues: string[],
): string {
  const timestamp = new Date().toISOString();
  const roleLabel = role === ROLES.DEV ? "Developer" : "Evaluator";
  const bullets = (items: string[]) =>
    items.length === 0 ? "- (none)\n" : items.map((i) => `- ${i}`).join("\n") + "\n";

  return [
    `## [${sessionId}] — ${timestamp}`,
    `**Role**: ${roleLabel}`,
    `**Phase**: ${phase}`,
    ``,
    `### Completed`,
    bullets(completed),
    `### Pending`,
    bullets(pending),
    `### Open Issues`,
    bullets(openIssues),
    `---`,
    ``,
  ].join("\n");
}

function buildDevState(
  sessionId: string, phase: string,
  completed: string[], pending: string[],
  nextGoals: string[], openIssues: string[],
): string {
  const timestamp = new Date().toISOString();
  const bullets = (items: string[]) =>
    items.length === 0 ? "-\n" : items.map((i) => `- ${i}`).join("\n") + "\n";

  return [
    `# Developer 상태 스냅샷`,
    ``,
    `> 최신 Developer 세션 상태를 기록합니다. 세션 종료 시 업데이트.`,
    ``,
    `---`,
    ``,
    `**세션 ID**: ${sessionId}`,
    `**마지막 업데이트**: ${timestamp}`,
    `**현재 TASK**: ${phase}`,
    ``,
    `## 완료한 작업`,
    ``,
    bullets(completed),
    `## 진행 중인 작업`,
    ``,
    bullets(pending),
    `## 다음 세션 목표`,
    ``,
    bullets(nextGoals),
    `## 미해결 이슈`,
    ``,
    bullets(openIssues),
  ].join("\n");
}

function buildEvalState(
  sessionId: string, phase: string, evalResult: string,
  completed: string[], openIssues: string[], nextGoals: string[],
): string {
  const timestamp = new Date().toISOString();
  const bullets = (items: string[]) =>
    items.length === 0 ? "-\n" : items.map((i) => `- ${i}`).join("\n") + "\n";

  return [
    `# Evaluator 상태 스냅샷`,
    ``,
    `> 최신 Evaluator 평가 결과를 기록합니다. 평가 완료 시 업데이트.`,
    ``,
    `---`,
    ``,
    `**세션 ID**: ${sessionId}`,
    `**마지막 업데이트**: ${timestamp}`,
    `**평가 대상 TASK**: ${phase}`,
    `**평가 결과**: ${evalResult}`,
    ``,
    `## 평가 요약`,
    ``,
    bullets(completed),
    `## 구체적 피드백`,
    ``,
    bullets(openIssues),
    `## 다음 Developer에게 전달할 사항`,
    ``,
    bullets(nextGoals),
  ].join("\n");
}

// ─── Tool registration ───────────────────────────────────────────────────────

export function registerFinalizeTools(server: McpServer): void {
  server.registerTool("codev_finalize", {
    title: "Finalize Confirmed Results",
    description: `Commit confirmed session results to git-tracked markdown files.

Use ONLY after Evaluator ALL PASS is confirmed.
This is the ONLY tool that writes to CHANGELOG.md and state files.
mark_done does NOT do this — it only writes to the inbox.

Performs:
  1. Appends entry to co-dev/communication/CHANGELOG.md
  2. Overwrites co-dev/communication/{dev|eval}-state.md
  3. Marks task as complete in co-dev/TASK.md (if task_id provided)

Args:
  - role: Your current role
  - session_id: Your session ID
  - phase: Current phase label
  - completed: Items confirmed as done
  - pending: Remaining items (default [])
  - next_session_goal: Goals for next session (default [])
  - open_issues: Unresolved issues (default [])
  - eval_result: Evaluator only — PASS/PARTIAL/FAIL
  - task_id: Optional — task ID in TASK.md to mark complete

Returns: Confirmation with list of updated files.`,
    inputSchema: FinalizeInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    const role = params.role as Role;

    // Role validation
    const mismatch = validateRoleMatch(params.session_id, role);
    if (mismatch) {
      return { content: [{ type: "text", text: `${roleReminder(role)} ERROR\n\n${mismatch}` }] };
    }

    const commDir = getCommunicationDir();
    const results: string[] = [];

    // 1. CHANGELOG.md append
    const changelogPath = join(commDir, "CHANGELOG.md");
    const entry = buildChangelogEntry(
      params.session_id, role, params.phase,
      params.completed, params.pending, params.open_issues,
    );
    appendToFile(changelogPath, entry);
    results.push("✓ CHANGELOG.md updated");

    // 2. State file overwrite
    if (role === ROLES.DEV) {
      const statePath = join(commDir, "dev-state.md");
      const content = buildDevState(
        params.session_id, params.phase,
        params.completed, params.pending,
        params.next_session_goal, params.open_issues,
      );
      writeFileSync(statePath, content, "utf8");
      results.push("✓ dev-state.md updated");
    } else {
      const evalResult = params.eval_result ?? "PASS";
      const statePath = join(commDir, "eval-state.md");
      const content = buildEvalState(
        params.session_id, params.phase, evalResult,
        params.completed, params.open_issues, params.next_session_goal,
      );
      writeFileSync(statePath, content, "utf8");
      results.push("✓ eval-state.md updated");
    }

    // 3. TASK.md completion marking (optional)
    if (params.task_id) {
      const taskPath = join(commDir, "..", "TASK.md");
      const marked = markTaskComplete(taskPath, params.task_id);
      results.push(marked ? `✓ TASK.md — ${params.task_id} marked complete` : `· TASK.md — ${params.task_id} not found or already complete`);
    }

    const text = [
      `${roleReminder(role)} [FINALIZED] Session results committed.`,
      ``,
      ...results,
      ``,
      `These files are git-tracked. Commit when ready.`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  });
}

// ─── File helpers ────────────────────────────────────────────────────────────

function appendToFile(filePath: string, content: string): void {
  let existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  if (existing && !existing.endsWith("\n")) existing += "\n";
  existing += "\n" + content;
  writeFileSync(filePath, existing, "utf8");
}

function markTaskComplete(taskPath: string, taskId: string): boolean {
  if (!existsSync(taskPath)) return false;
  const content = readFileSync(taskPath, "utf8");
  // Match patterns like: **상태**: 진행 중  or  **상태**: pending
  // within the section starting with the task_id
  const taskSection = new RegExp(
    `(###\\s+${escapeRegex(taskId)}[\\s\\S]*?\\*\\*상태\\*\\*:\\s*)([^\\n]+)`,
  );
  const match = content.match(taskSection);
  if (!match || match[2]?.includes("완료")) return false;

  const updated = content.replace(taskSection, `$1완료 ✅`);
  writeFileSync(taskPath, updated, "utf8");
  return true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
