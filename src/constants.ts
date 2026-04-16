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
 * Resolve the CO-DEV data directory with a cwd-first priority.
 *
 *   1. {cwd}/co-dev/.data/ if it exists  → per-project (Claude Code CLI)
 *   2. CODEV_DATA_DIR env var             → explicit override (Claude Desktop)
 *   3. ~/.co-dev/                         → global fallback
 *
 * Why cwd-first:
 *   Claude Code CLI is always launched from the project root, so a project-local
 *   co-dev/.data is an unambiguous signal that the user wants per-project state.
 *   Putting env above it caused cross-project contamination when the Claude Code
 *   CLI inherited CODEV_DATA_DIR from the user-scope ~/.claude.json Desktop entry.
 *
 *   Claude Desktop has no meaningful cwd, so tier 1 never matches and it falls
 *   through to env (tier 2) or ~/.co-dev (tier 3) as intended.
 */
export function resolveDataDir(): string {
  // 1st: cwd-relative per-project (CLI is always launched from project root)
  const cwdPath = join(process.cwd(), "co-dev", ".data");
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  // 2nd: explicit env var override (Claude Desktop, or manual override)
  if (process.env["CODEV_DATA_DIR"]) {
    return process.env["CODEV_DATA_DIR"];
  }

  // 3rd: global home directory fallback
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
