---
name: co-dev-handoff
description: Use at the END of every CO-DEV session to hand off cleanly to the other role. Triggers when the user says "end session", "wrap up", "finish", "checkpoint", "hand off", "종료", "마무리", "핸드오프", or when a unit of work is complete and ready for evaluation/review. Also triggers on /checkpoint. Must run before the session closes or the other role will be stranded.
version: 0.1.0
---

# CO-DEV Session Handoff Ritual

The handoff is the only mechanism that bridges two independent Claude sessions. Skipping it means the other role has no knowledge of what you did.

## Required Sequence

```
1. codev_save_checkpoint(session_id, completed, pending, next_session_goal, open_issues)
     → creates a durable record. Auto-increments index.

2. codev_mark_done(
     role=YOUR_ROLE,
     session_id,
     summary,
     action_required
   )
     → writes to the OTHER role's inbox. Inbox only — does NOT update CHANGELOG/state.

3. (Evaluator, after ALL PASS and user confirmation) codev_finalize(...)
     → commits confirmed results to CHANGELOG.md + state.md.
     → Never call codev_finalize from a Developer session.
     → Never call before evaluator has confirmed PASS.
```

## `mark_done` vs `finalize` — Do Not Confuse

| Tool | Writes to | When |
|---|---|---|
| `codev_mark_done` | the OTHER role's inbox | end of every session |
| `codev_finalize` | CHANGELOG.md + state.md | only after Evaluator confirms ALL PASS |

Calling `finalize` prematurely creates a false "accepted" record. Calling `mark_done` again after `finalize` is harmless but pointless.

## Checkpoint Field Rules

See `references/checkpoint-format.md` in the `co-dev-conventions` skill for full format. Summary:

- **completed**: only *demonstrably done* items (build passes, behavior verified). Not "started" items.
- **pending**: in-progress items with enough context to resume.
- **next_session_goal**: 1–3 actionable goals mapped to Phase activities. Not vague "continue".
- **open_issues**: unresolved decisions or blockers needing input.

## Summary & Action Required — Be Concrete

`summary` and `action_required` in `mark_done` are what the other role will read *first* in the next session. Vague summaries cause clarifying questions that defeat the async purpose.

- ❌ `summary: "Made progress on auth"`
- ✅ `summary: "Implemented authenticate_user tool with JWT validation. Build passes. Open: token refresh policy."`

- ❌ `action_required: "Please review"`
- ✅ `action_required: "Evaluate against EVAL-CRITERIA #3 (auth flows). Decide refresh-token window (sliding vs fixed) — see open_issues."`

## Anti-Patterns

- ❌ `mark_done` without a prior `save_checkpoint` — the inbox message points to a checkpoint that does not exist.
- ❌ Writing CHANGELOG.md / state.md manually before evaluator PASS — bypasses the finalize gate.
- ❌ Calling `mark_done` with `role` = the other role — writes to your own inbox, other role never sees it.

## Before Closing the Session

Emit a `[CHECKPOINT]` block in your response so the user sees the handoff summary. The MCP tool records machine state; the response text records human context.
