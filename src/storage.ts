/**
 * File-based JSON storage layer for CO-DEV state.
 *
 * Directory layout:
 *   $CODEV_DATA_DIR/
 *     sessions/
 *       {session_id}.json          <- SessionContext
 *     checkpoints/
 *       {session_id}/
 *         {index:04d}.json         <- Checkpoint
 */

import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { CHECKPOINTS_DIR, SESSIONS_DIR } from "./constants.js";
import type { Checkpoint, CheckpointMeta, SessionContext } from "./types.js";

export function ensureDirectories(): void {
  for (const dir of [SESSIONS_DIR, CHECKPOINTS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

function sessionPath(session_id: string): string {
  return join(SESSIONS_DIR, `${session_id}.json`);
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
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
}

function checkpointDir(session_id: string): string {
  return join(CHECKPOINTS_DIR, session_id);
}

function checkpointPath(session_id: string, index: number): string {
  const idx = String(index).padStart(4, "0");
  return join(checkpointDir(session_id), `${idx}.json`);
}

/**
 * Atomically claims the next checkpoint index using O_EXCL (exclusive create).
 * If two sessions race, one will get EEXIST and retry with the next index.
 * Returns the final Checkpoint with the claimed index and checkpoint_id.
 */
export function saveCheckpoint(cp: Omit<Checkpoint, "index" | "checkpoint_id">): Checkpoint {
  ensureDirectories();
  const dir = checkpointDir(cp.session_id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Start from current file count + 1; retry on collision (EEXIST).
  const existing = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).length : 0;
  let index = existing + 1;
  const MAX_RETRIES = 20;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++, index++) {
    const p = checkpointPath(cp.session_id, index);
    try {
      // wx = O_WRONLY | O_CREAT | O_EXCL — fails if file already exists
      const fd = openSync(p, "wx");
      closeSync(fd);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") { continue; }
      throw err;
    }
    // File created exclusively — write the full checkpoint
    const final: Checkpoint = {
      ...cp,
      index,
      checkpoint_id: `${cp.session_id}-${index}`,
    };
    writeFileSync(p, JSON.stringify(final, null, 2), "utf8");
    return final;
  }

  throw new Error(`saveCheckpoint: could not claim a free index after ${MAX_RETRIES} retries for session '${cp.session_id}'`);
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
  const sessionIds: string[] = session_id
    ? [session_id]
    : readdirSync(CHECKPOINTS_DIR).filter((d) =>
        existsSync(join(CHECKPOINTS_DIR, d))
      );

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
