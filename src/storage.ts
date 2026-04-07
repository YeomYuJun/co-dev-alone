/**
 * File-based JSON storage layer for CO-DEV state.
 *
 * Directory layout:
 *   $CODEV_DATA_DIR/
 *     sessions/
 *       {session_id}.json
 *     checkpoints/
 *       {session_id}/
 *         {index:04d}.json
 *     inbox/
 *       developer.json
 *       evaluator.json
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { getCheckpointsDir, getInboxDir, getSessionsDir } from "./constants.js";
import type { Checkpoint, CheckpointMeta, InboxEmpty, InboxMessage, SessionContext } from "./types.js";
import type { Role } from "./types.js";

// ─── Directory helpers ────────────────────────────────────────────────────────

export function ensureDirectories(): void {
  const sessionsDir = getSessionsDir();
  const checkpointsDir = getCheckpointsDir();
  const inboxDir = getInboxDir();

  for (const dir of [sessionsDir, checkpointsDir, inboxDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Ensure inbox sentinel files exist
  for (const role of ["developer", "evaluator"] as const) {
    const p = join(inboxDir, `${role}.json`);
    if (!existsSync(p)) {
      writeFileSync(p, JSON.stringify({ read: true }, null, 2), "utf8");
    }
  }
}

// ─── Session Context ──────────────────────────────────────────────────────────

function sessionPath(session_id: string): string {
  return join(getSessionsDir(), `${session_id}.json`);
}

export function saveSessionContext(ctx: SessionContext): void {
  ensureDirectories();
  writeFileSync(sessionPath(ctx.session_id), JSON.stringify(ctx, null, 2), "utf8");
}

export function loadSessionContext(session_id: string): SessionContext | null {
  const p = sessionPath(session_id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as SessionContext;
}

export function listSessionIds(): string[] {
  ensureDirectories();
  return readdirSync(getSessionsDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
}

// ─── Checkpoints ──────────────────────────────────────────────────────────────

function checkpointDir(session_id: string): string {
  return join(getCheckpointsDir(), session_id);
}

function checkpointPath(session_id: string, index: number): string {
  const idx = String(index).padStart(4, "0");
  return join(checkpointDir(session_id), `${idx}.json`);
}

export function saveCheckpoint(cp: Omit<Checkpoint, "index" | "checkpoint_id">): Checkpoint {
  ensureDirectories();
  const dir = checkpointDir(cp.session_id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const existing = readdirSync(dir).filter((f) => f.endsWith(".json")).length;
  let index = existing + 1;
  const MAX_RETRIES = 20;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++, index++) {
    const p = checkpointPath(cp.session_id, index);
    try {
      const fd = openSync(p, "wx");
      closeSync(fd);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") { continue; }
      throw err;
    }
    const final: Checkpoint = {
      ...cp,
      index,
      checkpoint_id: `${cp.session_id}-${index}`,
    };
    writeFileSync(p, JSON.stringify(final, null, 2), "utf8");
    return final;
  }

  throw new Error(`saveCheckpoint: could not claim a free index after ${MAX_RETRIES} retries`);
}

export function loadCheckpoint(session_id: string, index: number): Checkpoint | null {
  const p = checkpointPath(session_id, index);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Checkpoint;
}

export function loadLatestCheckpoint(session_id: string): Checkpoint | null {
  const dir = checkpointDir(session_id);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1]!;
  return JSON.parse(readFileSync(join(dir, latest), "utf8")) as Checkpoint;
}

export function listCheckpointMetas(
  session_id: string | null,
  offset: number,
  limit: number
): { total: number; items: CheckpointMeta[] } {
  ensureDirectories();
  const checkpointsDir = getCheckpointsDir();
  const sessionIds: string[] = session_id
    ? [session_id]
    : readdirSync(checkpointsDir).filter((d) => existsSync(join(checkpointsDir, d)));

  const allMetas: CheckpointMeta[] = [];

  for (const sid of sessionIds) {
    const dir = checkpointDir(sid);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      const cp = JSON.parse(readFileSync(join(dir, file), "utf8")) as Checkpoint;
      allMetas.push({
        checkpoint_id: cp.checkpoint_id,
        session_id: cp.session_id,
        index: cp.index,
        created_at: cp.created_at,
        completed_count: cp.completed.length,
        pending_count: cp.pending.length,
      });
    }
  }

  allMetas.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { total: allMetas.length, items: allMetas.slice(offset, offset + limit) };
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

function inboxPath(role: Role): string {
  return join(getInboxDir(), `${role}.json`);
}

export function readInbox(role: Role): InboxMessage | InboxEmpty {
  ensureDirectories();
  const p = inboxPath(role);
  if (!existsSync(p)) return { read: true };
  return JSON.parse(readFileSync(p, "utf8")) as InboxMessage | InboxEmpty;
}

export function markInboxRead(role: Role): void {
  const p = inboxPath(role);
  writeFileSync(p, JSON.stringify({ read: true }, null, 2), "utf8");
}

export function writeInbox(targetRole: Role, message: Omit<InboxMessage, "read">): void {
  ensureDirectories();
  const full: InboxMessage = { ...message, read: false };
  writeFileSync(inboxPath(targetRole), JSON.stringify(full, null, 2), "utf8");
}
