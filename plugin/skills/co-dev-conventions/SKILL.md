---
name: co-dev-conventions
description: >
  This skill should be used whenever the user mentions "CO-DEV", "dev session",
  "eval session", "checkpoint", "phase gate", "role detection", or asks about
  the multi-session development workflow. Also triggers when the user references
  prefixes like "[PLAN]", "[IMPL]", "[ISSUE]", "[CHECKPOINT]", "[DONE]", or
  "[QUESTION]", or asks which phase they are in. Load this skill before using
  any /init, /start, /checkpoint, or /phase command.
version: 0.2.0
---

# CO-DEV Conventions

CO-DEV is a workflow framework that splits a single project across two independent Claude sessions to prevent context contamination: one session develops, the other evaluates. Sessions communicate asynchronously via the local filesystem using the CO-DEV MCP tools.

## Data Layout

Every CO-DEV project has two layers:

```
co-dev/                          ← git-tracked (human-readable)
  COLLABO.md                     ← collaboration principles
  ROLE-GUIDE.md                  ← role definitions
  TASK.md                        ← current sprint tasks and acceptance criteria
  EVAL-CRITERIA.md               ← evaluation criteria (Evaluator reads this)
  communication/
    CHANGELOG.md                 ← append-only session history
    ISSUES.md                    ← issue tracker
    dev-state.md                 ← latest Developer session snapshot
    eval-state.md                ← latest Evaluator evaluation result

co-dev/.data/                    ← .gitignored (machine-readable, MCP storage)
  sessions/{session_id}.json     ← SessionContext (codev_save/get_context)
  checkpoints/{session_id}/*.json ← Checkpoint records
  inbox/developer.json           ← Developer inbox
  inbox/evaluator.json           ← Evaluator inbox
```

`CODEV_DATA_DIR` resolves the `.data/` path. Set by `codev_init` via `.claude/settings.json`.
Priority: `CODEV_DATA_DIR` env var → `{cwd}/co-dev/.data/` → error.

## Session Roles

| Role | Responsibility | Behavior |
|------|---------------|----------|
| Developer | Code generation, implementation, planning | Full context; write code |
| Evaluator | Code review, quality evaluation, independent critique | Read output only; no implementation decisions |

Evaluator must NOT have seen the Developer's implementation choices during the same session. Load `EVAL-CRITERIA.md` at the start of every Evaluator session.

## Official Session Protocol (README)

```
1. codev_check_inbox(role)           ← always first
2. Read co-dev/TASK.md               ← check current sprint tasks
3. Do the work
4. codev_mark_done(role, session_id, summary)  ← always last
```

Steps 2 and 4 involve the git-tracked markdown layer, NOT just the MCP `.data/` layer. Both must stay in sync.

## Response Prefix Rules

Always prefix responses with the appropriate tag:

| Prefix | Use when |
|--------|----------|
| `[PLAN]` | Presenting a work plan before starting |
| `[IMPL]` | Providing implementation code |
| `[ISSUE]` | A problem found that needs attention |
| `[DONE]` | A specific task is complete |
| `[QUESTION]` | A decision needed — max 2 questions, A/B/C format |
| `[CHECKPOINT]` | Session-end summary for handoff |

## Communication Rules

- Ask at most **2 questions per response**, presented as multiple choice.
- If proceeding on an assumption, state it explicitly.
- Never unilaterally decide: file structure changes, external library additions, API/schema changes, error handling strategy.

## Phase Gate Definitions

See `references/phase-gates.md` for full conditions. Summary:

| Phase | Name | Exit Condition |
|-------|------|---------------|
| 1 | Planning | Contracts and approach confirmed |
| 2 | Implementation | Build succeeds, basic behavior verified |
| 3 | Review | DRY, types, naming, error handling reviewed |
| 4 | Evaluation | Evaluator PASS, no open issues |

## Plugin Commands

| Command | When to use |
|---------|------------|
| `/init` | Once, on a brand-new project — creates co-dev/ structure |
| `/start dev` | Beginning every Developer session |
| `/start eval` | Beginning every Evaluator session |
| `/checkpoint` | End of every session — saves to MCP + updates markdown |
| `/phase` | Check exit conditions; `/phase advance` to move to next phase |

## MCP Tool Reference

| Tool | Purpose |
|------|---------|
| `codev_init` | Create co-dev/ + .data/ + .claude/settings.json |
| `codev_save_context` | Persist [CONTEXT] block |
| `codev_get_context` | Load [CONTEXT] block |
| `codev_list_sessions` | List all known session IDs |
| `codev_save_checkpoint` | Persist [CHECKPOINT] block (auto-increment index) |
| `codev_read_checkpoint` | Read latest or specific checkpoint |
| `codev_list_checkpoints` | Paginated checkpoint metadata |
| `codev_check_inbox` | Read handoff message from other role (marks as read) |
| `codev_mark_done` | Write handoff message to other role's inbox |
| `codev_detect_role` | Keyword-score text to infer Dev vs Eval role |
