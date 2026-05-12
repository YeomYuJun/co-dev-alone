---
name: co-dev-conventions
description: Always-on CO-DEV conventions — data layout, response prefix rules, communication rules, and index of other co-dev-* skills. Load whenever the user mentions CO-DEV, dev session, eval session, checkpoint, or uses response prefixes like [PLAN], [IMPL], [ISSUE], [DONE], [QUESTION], [CHECKPOINT]. This is the reference skill; procedural rituals live in co-dev-resume, co-dev-handoff, co-dev-phase.
version: 0.4.0
---

# CO-DEV Conventions — Always-On Rules

CO-DEV splits a project across two independent Claude sessions (Developer / Evaluator) to prevent context contamination. Sessions communicate asynchronously through the local filesystem via CO-DEV MCP tools.

**Role definitions live in `co-dev/ROLE-GUIDE.md`** (scaffolded by `codev_init`). This skill does NOT redefine them — see that file for role boundaries, inbox rules, and session ID formats.

## Related Skills (Index)

| Skill | When to load |
|---|---|
| `co-dev-resume` | At the START of every session — restore context before working. |
| `co-dev-handoff` | At the END of every session — checkpoint and write to the other role's inbox. |
| `co-dev-phase` | When checking phase exit conditions or running `/phase`. |

This skill stays loaded for the duration of a CO-DEV session; the three above are invoked at specific moments.

## Data Layout

Every CO-DEV project has two layers:

```
co-dev/                          ← git-tracked (human-readable content)
  COLLABO.md                     ← collaboration principles
  ROLE-GUIDE.md                  ← role definitions (source of truth)
  TASK.md                        ← current sprint tasks and acceptance criteria
  EVAL-CRITERIA.md               ← evaluation rubric (Evaluator only)
  communication/
    CHANGELOG.md                 ← append-only session history
    ISSUES.md                    ← issue tracker
    dev-state.md                 ← latest Developer session snapshot
    eval-state.md                ← latest Evaluator evaluation result

co-dev/.data/                    ← .gitignored (machine-readable MCP storage)
  sessions/{session_id}.json
  checkpoints/{session_id}/*.json
  inbox/developer.json
  inbox/evaluator.json
```

`CODEV_DATA_DIR` resolves the `.data/` path. Priority: project-local `{cwd}/co-dev/.data/` → `CODEV_DATA_DIR` env var → `~/.co-dev/` fallback. See [README.md](../../../README.md) for details.

## Response Prefix Rules (Always On)

Always prefix responses with the appropriate tag:

| Prefix | Use when |
|---|---|
| `[PLAN]` | Presenting a work plan before starting |
| `[IMPL]` | Providing implementation code |
| `[ISSUE]` | A problem found that needs attention |
| `[DONE]` | A specific task is complete |
| `[QUESTION]` | A decision is needed — max 2 questions, A/B/C format |
| `[CHECKPOINT]` | Session-end handoff summary |

The prefix governs the *type* of content the user expects. Mixing types in one response confuses handoff; split into multiple tagged sections instead.

## Communication Rules (Always On)

- Ask at most **2 questions per response**, presented as A/B/C multiple choice.
- If proceeding on an assumption, state the assumption explicitly.
- Never decide unilaterally on: file structure changes, external library additions, API/schema changes, error handling strategy. These require `[QUESTION]` first.

## Plugin Commands (Index)

| Command | Entry to |
|---|---|
| `/init` | First-time project setup — creates `co-dev/` structure |
| `/start dev` | Developer session — loads `co-dev-resume` then begins |
| `/start eval` | Evaluator session — loads `co-dev-resume` then begins |
| `/checkpoint` | Shortcut that invokes `co-dev-handoff` ritual |
| `/phase` | Shortcut that invokes `co-dev-phase` check |

## References

- [references/checkpoint-format.md](references/checkpoint-format.md) — `[CHECKPOINT]` block structure.
- [references/phase-gates.md](references/phase-gates.md) — phase definitions (mirrored in `co-dev-phase` skill).

## What This Skill Does NOT Cover

- **Role definitions, boundaries, session ID formats** — in `co-dev/ROLE-GUIDE.md`.
- **Session start procedure** — in `co-dev-resume` skill.
- **Session end procedure** — in `co-dev-handoff` skill.
- **Phase gate details** — in `co-dev-phase` skill.
- **MCP tool parameter schemas** — in each tool's `description` (not duplicated here to prevent drift).
