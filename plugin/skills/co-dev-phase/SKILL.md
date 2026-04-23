---
name: co-dev-phase
description: >
  Use when the user asks about phase status, wants to advance a phase, or runs
  /phase / /phase advance. Triggers on keywords: "phase", "gate", "exit
  condition", "advance", "페이즈", "단계", "게이트", or when deciding whether
  Planning/Implementation/Review/Evaluation work is complete. Load this before
  declaring a phase done or moving to the next one.
version: 0.1.0
---

# CO-DEV Phase Gate Check

Phases are not calendar stages — they are *exit-condition gates*. Do not advance a phase until every exit condition is met.

## Phase Summary

| Phase | Name | Exit Condition |
|---|---|---|
| 1 | Planning | Tool list and schema draft are confirmed by the developer |
| 2 | Implementation | Build succeeds AND basic tool behavior is verified |
| 3 | Review | DRY, type coverage, description quality, error handling all reviewed |
| 4 | Evaluation | 10 evaluation questions answered; no open `[ISSUE]` items |

## Phase 1 — Planning

**Goal**: Define what will be built before writing code.

**Activities**:
- Tool list with `{verb}_{noun}` snake_case names
- Input/output schemas (Zod for TS, Pydantic for Python)
- Transport decision (stdio for local, Streamable HTTP for remote)
- Error handling strategy identified

**Exit**: Tool list + schema draft confirmed by developer. → Phase 2.

## Phase 2 — Implementation

**Goal**: Build working code for all planned tools.

**Activities**:
- Each tool implemented with full type definitions
- `readOnlyHint` / `destructiveHint` annotations applied
- Error messages guide the *next action*, not just describe failure
- `npm run build` or equivalent passes

**Exit**: Build succeeds AND basic tool behavior verified (manual or automated). → Phase 3.

## Phase 3 — Review

**Goal**: Improve quality without changing behavior.

**Checklist (in order)**:

1. **DRY**: No duplicated logic across tools
2. **Type coverage**: All inputs and outputs typed; no `any`
3. **Description quality**: Each tool description answers "when should an LLM call this?"
4. **Error handling**: Every error path returns `McpError` with a recovery hint

**Exit**: All four items reviewed and issues resolved. → Phase 4.

## Phase 4 — Evaluation

**Goal**: Independently verify correctness before shipping. **Evaluator session only.**

**Activities**:
- Generate 10 evaluation questions covering edge cases and happy paths
- Run or simulate each case, verify expected output
- Flag discrepancies as `[ISSUE]` for the Developer session

**Exit**: All 10 questions answered and verified. No open `[ISSUE]`. → Done ✓.

## `/phase` Command

- `/phase` — show current phase and remaining exit conditions.
- `/phase advance` — mark current phase complete and move to next. Refuses if any exit condition is unmet.

## Anti-Patterns

- ❌ Advancing Phase 2 because "most tools compile" — exit is *build passes*, full stop.
- ❌ Declaring Phase 4 done while `[ISSUE]` items are open in communication/ISSUES.md.
- ❌ Running Phase 4 activities in a Developer session — evaluation must happen in Evaluator session to preserve independence.

## Relationship to Other Skills

- Before advancing a phase near session end, use `co-dev-handoff` to record what was completed and why the exit condition is met.
- When resuming, `co-dev-resume` + `TASK.md` + latest checkpoint will tell you which phase you are in.
