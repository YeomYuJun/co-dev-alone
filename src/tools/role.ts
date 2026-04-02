/**
 * Role detection tool — CO-DEV-GUIDE Section 5.1 / 5.2.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEV_KEYWORDS, EVAL_KEYWORDS, ROLES } from "../constants.js";
import { loadSessionContext } from "../storage.js";
import type { Role, RoleDetectionResult } from "../types.js";

function inferRole(text: string): RoleDetectionResult {
  const lower = text.toLowerCase();
  const evalHits = EVAL_KEYWORDS.filter((k) => lower.includes(k));
  const devHits = DEV_KEYWORDS.filter((k) => lower.includes(k));
  const evalScore = evalHits.length;
  const devScore = devHits.length;

  let role: Role;
  let confidence: RoleDetectionResult["confidence"];
  let reasoning: string;

  if (evalScore === 0 && devScore === 0) {
    role = ROLES.DEV; confidence = "low";
    reasoning = "No role-specific keywords found. Defaulting to Dev. Add keywords like 'review', 'evaluate', 'implement', or 'build'.";
  } else if (evalScore === devScore) {
    role = ROLES.DEV; confidence = "low";
    reasoning = `Equal signal (eval: ${evalScore}, dev: ${devScore}). Defaulting to Dev. Eval: [${evalHits.join(", ")}], Dev: [${devHits.join(", ")}].`;
  } else if (evalScore > devScore) {
    role = ROLES.EVAL; confidence = evalScore >= 3 ? "high" : "medium";
    reasoning = `Eval role detected (score ${evalScore} vs dev ${devScore}). Keywords: [${evalHits.join(", ")}].`;
  } else {
    role = ROLES.DEV; confidence = devScore >= 3 ? "high" : "medium";
    reasoning = `Dev role detected (score ${devScore} vs eval ${evalScore}). Keywords: [${devHits.join(", ")}].`;
  }
  return { role, confidence, reasoning };
}

const DetectRoleInputSchema = z.object({
  session_id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/).optional()
    .describe("Session ID to load context from. If omitted, provide raw_context."),
  raw_context: z.string().max(4000).optional()
    .describe("Raw text to analyse when no session_id is available."),
  response_format: z.enum(["markdown", "json"]).default("markdown"),
}).strict().refine(
  (d) => d.session_id !== undefined || d.raw_context !== undefined,
  { message: "Provide either session_id or raw_context." }
);

export function registerRoleTools(server: McpServer): void {
  server.registerTool("codev_detect_role", {
    title: "Detect Session Role",
    description: `Detect whether a CO-DEV session is a Dev or Eval session (CO-DEV-GUIDE Section 5.1).

Uses keyword scoring on the session context fields. Pass session_id or raw_context.

Args:
  - session_id (string, optional): Load context from saved session
  - raw_context (string, optional): Analyse arbitrary text
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns: { role: 'Dev'|'Eval', confidence: 'high'|'medium'|'low', reasoning: string }`,
    inputSchema: DetectRoleInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    let analysisText: string;
    if (params.session_id !== undefined) {
      const ctx = loadSessionContext(params.session_id);
      if (!ctx) return { content: [{ type: "text", text: `Error: Session '${params.session_id}' not found. Use codev_save_context first.` }] };
      analysisText = [ctx.project, ctx.stack, ctx.phase, ctx.completed, ...ctx.current_goal, ctx.constraints].join(" ");
    } else {
      analysisText = params.raw_context!;
    }
    const result: RoleDetectionResult = inferRole(analysisText);
    let text: string;
    if (params.response_format === "json") {
      text = JSON.stringify(result, null, 2);
    } else {
      const badge = result.role === ROLES.DEV ? "🛠 **Dev**" : "🔍 **Eval**";
      const conf = { high: "🟢 high", medium: "🟡 medium", low: "🔴 low" }[result.confidence];
      text = [`## Role Detection Result`, "", `- **Role**: ${badge}`, `- **Confidence**: ${conf}`, `- **Reasoning**: ${result.reasoning}`].join("\n");
    }
    return { content: [{ type: "text", text }], structuredContent: result as unknown as Record<string, unknown> };
  });
}
