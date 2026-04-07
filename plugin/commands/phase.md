---
description: Show current phase and manage phase transitions
allowed-tools:
  - Bash
  - Read
  - Edit
  - mcp__co-dev__codev_get_context
  - mcp__co-dev__codev_save_context
argument-hint: [advance]
---

Display the current CO-DEV phase with its exit conditions, and optionally advance to the next phase. Follow these steps exactly.

## Step 1 — Resolve session_id

Run:
```bash
basename $(pwd) && date +%Y%m%d
```

`$1` = optional action (`advance`).
Construct `session_id` = `{folder}-dev-{date}` (phase management is always the Developer role).

## Step 2 — Load context

Call `codev_get_context(session_id)`.
If not found, output: "❌ No context found. Run /start dev first." and stop.

Extract the `phase` string. Parse the phase number (e.g. "Phase 2 - Implementation" → 2).

## Step 3 — Display phase dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE STATUS — {session_id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: {phase label}

Exit conditions:
  □ {condition 1}
  □ {condition 2}
  □ {condition 3}

Next: {next phase name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Use these phase gate definitions:

**Phase 1 — Planning** → next: Phase 2 - Implementation
Exit conditions:
- Tool/feature list with names in convention (`{verb}_{noun}` or task-appropriate) is confirmed
- Input/output contracts (schema or spec) are drafted and confirmed
- Implementation approach is selected and confirmed

**Phase 2 — Implementation** → next: Phase 3 - Review
Exit conditions:
- Build/run succeeds without errors
- Basic behavior of each feature is verified (manual or automated)
- No unresolved blockers in open_issues

**Phase 3 — Review** → next: Phase 4 - Evaluation
Exit conditions:
- DRY: no duplicated logic
- Type/contract coverage: all inputs and outputs are typed or validated
- Description/naming quality: each component answers "what does this do and when is it used?"
- Error handling: all failure paths return meaningful messages

**Phase 4 — Evaluation** → next: Done ✓
Exit conditions:
- Evaluator session has reviewed the output
- Evaluation result is PASS (or PARTIAL with a resolution plan)
- No open [ISSUE] items remain

## Step 4 — Read TASK.md

Read `co-dev/TASK.md` and display the "현재 스프린트" section below the phase dashboard, so the user can see whether TASK items align with the exit conditions.

## Step 5 — Handle advance request

If `$1` is `advance` OR the user asks to advance:

**5a.** Ask: "All exit conditions confirmed as met? [yes / no]"

If `no`: list which conditions appear incomplete based on the conversation, suggest what to do next, and stop.

**5b.** Ask: "Goals for {next phase name}? (1~3 items, one per line)"
Wait for user input. Parse by newline then comma.

**5c.** Determine next phase label:
- Phase 1 → "Phase 2 - Implementation"
- Phase 2 → "Phase 3 - Review"
- Phase 3 → "Phase 4 - Evaluation"
- Phase 4 → "Done"

**5d.** Call `codev_save_context` with all existing fields preserved, updating only:
- `phase` → new phase label
- `current_goal` → new goals array
- `completed` → brief summary of what was accomplished in the previous phase

**5e.** Update `co-dev/TASK.md` — replace the "현재 스프린트" section with a new sprint entry:

```markdown
## 현재 스프린트

### {next phase name}

**목표**:
{new goals as bullet list}

**완료 기준**:
{exit conditions for the new phase as unchecked checkboxes}

**상태**: 진행 중
```

Keep the "백로그" and "완료된 작업" sections intact.

**5f.** Output:
```
✅ Advanced to {next phase label}
   Goals: {goal 1}, {goal 2}
   co-dev/TASK.md updated with new sprint
```
