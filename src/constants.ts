import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** Maximum response payload size in characters */
export const CHARACTER_LIMIT = 25_000;

/** CO-DEV session roles */
export const ROLES = {
  DEV: "developer",
  EVAL: "evaluator",
} as const;

/** Keywords that strongly indicate an Eval session context */
export const EVAL_KEYWORDS: readonly string[] = [
  "eval",
  "evaluate",
  "review",
  "quality",
  "check",
  "평가",
  "검토",
  "품질",
];

/** Keywords that strongly indicate a Dev session context */
export const DEV_KEYWORDS: readonly string[] = [
  "impl",
  "implement",
  "build",
  "code",
  "develop",
  "구현",
  "개발",
  "작성",
];

/**
 * Resolve the CO-DEV data directory using 4-tier priority:
 *   1. CODEV_DATA_DIR environment variable (explicit override, used by codev_init via .claude/settings.json)
 *   2. {cwd}/co-dev/.data/ if it exists (CLI per-project mode)
 *   3. ~/.co-dev/ global fallback (Claude Desktop mode — single global MCP process)
 *
 * Tier 3 makes Desktop behavior intentional: sessions are namespaced by session_id
 * so multiple projects can coexist in the global store. Inbox is shared, which is
 * acceptable for single-project-at-a-time Desktop workflows.
 *
 * codev_init bypasses this and uses its own path logic.
 */
export function resolveDataDir(): string {
  // 1st: explicit env var (set by codev_init via .claude/settings.json or global Desktop config)
  if (process.env["CODEV_DATA_DIR"]) {
    return process.env["CODEV_DATA_DIR"];
  }

  // 2nd: cwd-relative per-project (CLI mode)
  const cwdPath = join(process.cwd(), "co-dev", ".data");
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  // 3rd: global home directory fallback (Claude Desktop mode)
  const homePath = join(homedir(), ".co-dev");
  mkdirSync(homePath, { recursive: true });
  return homePath;
}

/**
 * Resolve the git-tracked co-dev/ communication directory.
 * Derived from dataDir by removing the trailing `.data` segment.
 */
export function getCommunicationDir(): string {
  const dataDir = resolveDataDir();
  // dataDir = .../co-dev/.data  →  .../co-dev/communication
  return join(dataDir, "..", "communication");
}

/** Derive sub-directories from resolved data dir */
export function getSessionsDir(): string {
  return join(resolveDataDir(), "sessions");
}

export function getCheckpointsDir(): string {
  return join(resolveDataDir(), "checkpoints");
}

export function getInboxDir(): string {
  return join(resolveDataDir(), "inbox");
}
