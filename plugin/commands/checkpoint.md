---
description: Save a CO-DEV checkpoint (lightweight — no CHANGELOG/state update)
allowed-tools:
  - Bash
  - Read
  - mcp__co-dev__codev_save_checkpoint
  - mcp__co-dev__codev_get_context
argument-hint: [dev|eval]
---

Save a [CHECKPOINT] to MCP storage. This is a **lightweight** operation:
- Saves checkpoint data only
- Does NOT update CHANGELOG.md or state files (use `codev_finalize` after eval PASS)
- Does NOT write to inbox (use `codev_mark_done` separately if handing off)

Follow these steps exactly.

## Step 1 — Resolve session_id and role

Run:
```bash
basename $(pwd) && date +%Y%m%d
```

Parse `$1` as role (`dev` or `eval`). Default to `dev` if not provided.
Map: `dev` → `developer`, `eval` → `evaluator`.

Construct `session_id` = `{folder}-{role}-{date}`.

## Step 2 — Load current context

Call `codev_get_context(session_id)` to retrieve the current phase and goals.
If not found, ask: "Session ID?" — this should not normally happen if /start was used.

## Step 3 — Draft the checkpoint

Analyze the conversation to produce:

**completed** — specific, verifiable items:
- ✅ "Implemented `codev_save_checkpoint` with Zod schema"
- ❌ "Made progress on checkpoint tool" (too vague)

**pending** — in-progress items with enough context to resume

**next_session_goal** — 1~3 actionable goals tied to the current phase

**open_issues** — unresolved decisions; each must include enough context to decide without asking

## Step 4 — Confirm with user

Present the draft:
```
[CHECKPOINT]
completed:
  - {item}
pending:
  - {item}
next_session_goal:
  - {item}
open_issues:
  - {item}
```

Ask: "Save this checkpoint? [save / edit]"
If `edit`: accept corrections and re-present before proceeding.

## Step 5 — Save to MCP storage

Call `codev_save_checkpoint`:
- `session_id`: derived value
- `completed`: array
- `pending`: array
- `next_session_goal`: array
- `open_issues`: array

Capture the returned `checkpoint_id` and `created_at` timestamp.

## Step 6 — Display confirmation

```
✅ Checkpoint saved: {checkpoint_id}

Next steps:
  - To hand off to the other role: call codev_mark_done(role, session_id, summary, action_required)
  - To finalize (after eval ALL PASS): call codev_finalize(...)
```
