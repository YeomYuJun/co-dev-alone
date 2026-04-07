---
description: Start a CO-DEV session as dev or eval
allowed-tools:
  - Bash
  - Read
  - mcp__co-dev__codev_check_inbox
  - mcp__co-dev__codev_get_context
  - mcp__co-dev__codev_save_context
  - mcp__co-dev__codev_read_checkpoint
  - mcp__co-dev__codev_list_sessions
argument-hint: <dev|eval>
---

Initialize a CO-DEV session following the official session protocol. Follow these steps exactly and in order.

## Step 0 — Guard: verify project is initialized

Run:
```bash
test -d co-dev/.data && echo "ok" || echo "not_initialized"
```

If `not_initialized`:
```
❌ CO-DEV is not initialized in this workspace.
   Run /init first to create the project structure.
```
Stop here.

## Step 1 — Parse role

Parse `$1` as role. Must be `dev` or `eval`.
If missing or invalid, ask: "Which role? [dev / eval]" and wait.

Map to MCP enum: `dev` → `developer`, `eval` → `evaluator`.

## Step 2 — Auto-derive session_id

Run:
```bash
basename $(pwd) && date +%Y%m%d
```

Construct `session_id` = `{folder}-{role}-{date}` (e.g. `myproject-dev-20260407`).
Do NOT ask the user for session_id.

## Step 3 — Check inbox (Session Protocol Step 1)

Call `codev_check_inbox(role: <developer|evaluator>)`.

- If a message is found: display it prominently under **📬 Inbox from [other role]:**
- If empty: proceed silently

## Step 4 — Load or initialize context (Session Protocol Step 2a)

Call `codev_get_context(session_id)`.

**Path A — Context found:**
Extract `phase`, `current_goal`, `completed`, `constraints` from the result.
Proceed to Step 5.

**Path B — Context not found (new session):**
Ask (single grouped prompt):
```
New session: {session_id}

Please provide:
  1. Stack  — language / runtime
  2. Phase  — current phase (default: "Phase 1 - Planning")
  3. Goals  — 1~3 goals, one per line (or comma-separated)
```

Parse goals: split by newline first, then by comma. Trim whitespace from each item. Filter empty strings.

Call `codev_save_context`:
- `session_id`: auto-derived
- `project`: folder name (from Step 2)
- `stack`: user input
- `phase`: user input (default "Phase 1 - Planning")
- `current_goal`: parsed goals array
- `completed`: ""
- `constraints`: ""

Proceed to Step 5.

## Step 5 — Read TASK.md (Session Protocol Step 2b)

Read the file `co-dev/TASK.md`.

Extract the "현재 스프린트" section content. If the file contains only the template placeholder (`[작업 제목]`), skip and note "(no tasks defined yet — edit co-dev/TASK.md)".

## Step 6 — Restore last checkpoint

Call `codev_read_checkpoint(session_id)`.

- If a checkpoint exists: extract `pending` and `open_issues` arrays for the brief.
- If no checkpoints: skip silently.

## Step 7 — Role-specific context injection

**For Evaluator role only:**
Read `co-dev/EVAL-CRITERIA.md` and include its content in the session brief under "Evaluation Criteria".

## Step 8 — Present session brief

Output in this exact format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CO-DEV SESSION STARTED
Role     : Developer  (or Evaluator)
Session  : {session_id}
Phase    : {phase}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[CONTEXT]
  completed : {completed or "(none)"}
  goals     : {goal 1} / {goal 2}
  constraints: {constraints or "(none)"}

📋 TASK.md — Current Sprint:
{task content or "(no tasks defined yet)"}

{If checkpoints exist:}
📌 Last checkpoint pending:
  • {pending item 1}
  • {pending item 2}
  Open issues:
  • {open issue 1}

{Evaluator only — EVAL-CRITERIA.md section here}

Ready. Use [PLAN] prefix to start, /checkpoint when done.
```

**Evaluator role reminder** (add after the separator):
```
Reminder: Evaluate based on output and behavior only.
Do NOT reference the Developer's implementation decisions.
```
