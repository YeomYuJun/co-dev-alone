---
name: co-dev-resume
description: >
  Use at the start of EVERY CO-DEV session to restore context correctly. Triggers
  when the user opens a Developer or Evaluator session, says "continue", "resume",
  "where were we", "pick up", "이어서", "재개", or runs /start. Also load this
  skill before calling any codev_* tool if no prior inbox/context has been read
  in the current conversation. Must run before implementation or evaluation work.
version: 0.1.0
---

# CO-DEV Session Resume Ritual

At session start, the session has no memory of prior work. Restoring state in the wrong order leads to skipped inbox messages and stale context. Always follow this sequence.

## Required Sequence

```
1. codev_check_inbox(role=YOUR_ROLE)
     → if message found  : READ IT FIRST. It is feedback/handoff from the other role.
                           Do not start working until you have understood it.
     → if empty          : continue to step 2.

2. codev_get_context(session_id)
     → restores SessionContext (files modified, open threads, notes).

3. Read co-dev/TASK.md
     → the current sprint goals. Never skip this even if inbox had a message.

4. (Evaluator only) Read co-dev/EVAL-CRITERIA.md
     → the rubric you must score against.
     (Developer must NOT open EVAL-CRITERIA.md during implementation — it biases
      toward the scorecard. See co-dev-conventions SKILL for the role boundary.)

5. Begin work.
```

## Role Parameter — Be Exact

`codev_check_inbox` takes YOUR role, not the other role:

- Developer session → `codev_check_inbox('developer')`
- Evaluator session → `codev_check_inbox('evaluator')`

Calling the wrong role marks the wrong inbox as read and loses handoff messages. This is unrecoverable without re-writing the message.

## Session ID Format

If you need to construct a session_id, use:

- Developer: `{project}-dev-{YYYYMMDD}`
- Evaluator: `{project}-eval-{YYYYMMDD}`

Prefer calling `codev_list_sessions` to discover existing IDs instead of guessing.

## Anti-Patterns

- ❌ Reading TASK.md first, then checking inbox — inbox message may change the task priority.
- ❌ Starting implementation before acknowledging open `[ISSUE]` items from inbox.
- ❌ Calling `codev_check_inbox` for the *other* role to "peek" at their state — this marks their inbox as read.
- ❌ Skipping `codev_get_context` because "I remember" — you don't, this is a fresh session.

## After Resume

Once context is restored, follow the always-on rules in the `co-dev-conventions` skill (response prefixes, communication rules). When ending the session, load `co-dev-handoff` skill.
