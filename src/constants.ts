import { homedir } from "os";
import { join } from "path";

/**
 * Root data directory for CO-DEV state storage.
 * Override via CODEV_DATA_DIR environment variable.
 */
export const DATA_DIR: string =
  process.env["CODEV_DATA_DIR"] ?? join(homedir(), ".co-dev");

/** Sub-directories under DATA_DIR */
export const SESSIONS_DIR = join(DATA_DIR, "sessions");
export const CHECKPOINTS_DIR = join(DATA_DIR, "checkpoints");

/** Maximum response payload size in characters */
export const CHARACTER_LIMIT = 25_000;

/** CO-DEV session roles */
export const ROLES = {
  DEV: "Dev",
  EVAL: "Eval",
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
