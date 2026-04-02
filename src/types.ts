import { ROLES } from "./constants.js";

/** CO-DEV session role union type */
export type Role = (typeof ROLES)[keyof typeof ROLES]; // "Dev" | "Eval"

/**
 * CONTEXT block — provided at the start of each session.
 * Maps 1:1 to the [CONTEXT] template in CO-DEV-GUIDE Section 1.1.
 */
export interface SessionContext {
  session_id: string;
  project: string;
  stack: string;
  phase: string;
  completed: string;
  current_goal: string[];
  constraints: string;
  /** ISO 8601 timestamp of last update */
  updated_at: string;
}

/**
 * CHECKPOINT block — written when /checkpoint is called.
 * Maps 1:1 to the [CHECKPOINT] output template in CO-DEV-GUIDE Section 1.2.
 */
export interface Checkpoint {
  checkpoint_id: string;     // "<session_id>-<index>" e.g. "proj-alpha-3"
  session_id: string;
  index: number;             // auto-incremented per session
  completed: string[];
  pending: string[];
  next_session_goal: string[];
  open_issues: string[];
  /** ISO 8601 creation timestamp */
  created_at: string;
}

/** Lightweight listing entry (no full content) */
export interface CheckpointMeta {
  checkpoint_id: string;
  session_id: string;
  index: number;
  created_at: string;
  completed_count: number;
  pending_count: number;
}

/** Result from role detection */
export interface RoleDetectionResult {
  role: Role;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

/** Generic paginated list response */
export interface PaginatedList<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}
