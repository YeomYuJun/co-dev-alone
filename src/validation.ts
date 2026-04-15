/**
 * Role validation utilities — session_id naming convention based.
 *
 * session_id format: {project}-{dev|eval}-{YYYYMMDD}
 * Extracts role from the `-dev-` / `-eval-` segment and cross-checks
 * against the claimed role parameter.
 */

import type { Role } from "./types.js";

/** Extract role from session_id naming convention. Returns null if pattern not found. */
export function extractRoleFromSessionId(sessionId: string): Role | null {
  if (sessionId.includes("-dev-")) return "developer";
  if (sessionId.includes("-eval-")) return "evaluator";
  return null;
}

/**
 * Validate that claimed role matches session_id convention.
 * Returns an error message string if mismatched, null if valid.
 */
export function validateRoleMatch(sessionId: string, claimedRole: Role): string | null {
  const expected = extractRoleFromSessionId(sessionId);
  if (expected && expected !== claimedRole) {
    return `⚠️ ROLE MISMATCH: session '${sessionId}' is a ${expected} session, but role '${claimedRole}' was passed. Did you mean '${expected}'?`;
  }
  return null;
}

/** Format a role reminder prefix for tool responses. */
export function roleReminder(role: Role): string {
  const label = role === "developer" ? "Developer" : "Evaluator";
  return `[YOUR ROLE: ${label}]`;
}
