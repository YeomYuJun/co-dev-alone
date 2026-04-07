# Checkpoint Format

The `[CHECKPOINT]` block is the handoff artifact between sessions. It must be structured, complete, and actionable so the receiving session can resume without asking clarifying questions.

## Structure

```
[CHECKPOINT]
completed:
  - <specific item that is fully done>
  - <another completed item>
pending:
  - <item that was started but not finished>
next_session_goal:
  - <recommended goal 1 for the next session>
  - <recommended goal 2>
open_issues:
  - <unresolved issue or decision that needs attention>
```

## Rules for Each Field

**`completed`**: List only items that are demonstrably done — build passes, tests pass, or behavior was manually verified. Do not list "started" items here.

**`pending`**: List items that were in progress but not finished. Include enough context so the next session knows exactly where to pick up.

**`next_session_goal`**: 1–3 actionable goals. Should map to specific Phase activities. Example: "Implement `get_user` tool with Zod schema and error handling" not "Continue implementation."

**`open_issues`**: Unresolved decisions, blockers, or questions that require input. Example: "Decide whether `list_users` should paginate — tradeoff between simplicity and scalability."

## Calling `codev_save_checkpoint`

Map the fields directly to tool parameters:

```
codev_save_checkpoint(
  session_id: string,        // e.g. "proj-alpha-dev"
  completed: string[],
  pending: string[],
  next_session_goal: string[],
  open_issues: string[]
)
```

The tool auto-increments the checkpoint index. The returned `checkpoint_id` format is `<session_id>-<index>`.

## Anti-Patterns

- ❌ "Made progress on the auth module" — too vague, not actionable
- ✅ "Implemented `authenticate_user` tool with JWT validation and McpError on invalid token"

- ❌ "Some issues remain" — not specific enough
- ✅ "Open issue: `refresh_token` expiry policy not defined — Dev needs to decide between sliding vs fixed window"
