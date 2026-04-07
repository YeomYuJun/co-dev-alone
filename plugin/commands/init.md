---
description: Initialize CO-DEV project structure for this workspace
allowed-tools:
  - Bash
  - Read
  - mcp__co-dev__codev_init
argument-hint: [stack] [scope]
---

Initialize CO-DEV project structure for the current workspace. Run this ONCE per new project, before /start.

## Step 1 — Detect workspace

Run:
```bash
basename $(pwd)
```

Use the output as `project_name`.

## Step 2 — Check if already initialized

Run:
```bash
test -d co-dev/.data && echo "exists" || echo "not_found"
```

If `exists`:
```
⚠️  CO-DEV already initialized in this project.
    co-dev/ structure is present. Run /start dev or /start eval to begin.
```
Stop here — do not re-run init.

## Step 3 — Collect info

Ask (single grouped question):
```
Initializing CO-DEV for: {project_name}

Please provide:
  1. Stack  — language / runtime (e.g. Python 3.x, TypeScript Node.js)
  2. Scope  — one-line project description (optional)
```

Wait for input. `scope` may be empty.

## Step 4 — Run codev_init

Call `codev_init`:
- `project_name`: from Step 1
- `tech_stack`: user input from Step 3
- `scope`: user input from Step 3 (empty string if skipped)

## Step 5 — Show TASK.md and prompt for tasks

Read the newly created `co-dev/TASK.md` and display it.

Then output:
```
✅ CO-DEV initialized: {project_name}
   Stack: {stack}

📋 Next: Define your tasks in co-dev/TASK.md (shown above).
   Edit the TASK-001 section with your actual goals and acceptance criteria.

   When ready, run:
     /start dev   — to begin a Developer session
     /start eval  — to begin an Evaluator session

⚠️  Important: Restart the Cowork session (or reload MCP) so that
   CODEV_DATA_DIR from .claude/settings.json takes effect.
   Without this, session data may be stored in the wrong location.
```
