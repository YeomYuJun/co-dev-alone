---
description: Save a CO-DEV checkpoint and update project state files
allowed-tools:
  - Bash
  - Read
  - Edit
  - mcp__co-dev__codev_save_checkpoint
  - mcp__co-dev__codev_get_context
  - mcp__co-dev__codev_mark_done
argument-hint: [dev|eval]
---

Save a [CHECKPOINT] and synchronize all git-tracked state files. Follow these steps exactly.

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

## Step 6 — Update CHANGELOG.md

Read `co-dev/communication/CHANGELOG.md`, then append the following block at the end:

```
## [{checkpoint_id}] — {created_at}
**Role**: {Developer | Evaluator}
**Phase**: {current phase from context}

### Completed
{completed items as bullet list}

### Pending
{pending items as bullet list, or "(none)"}

### Open Issues
{open_issues as bullet list, or "(none)"}

---
```

## Step 7 — Update state snapshot

**For Developer role** — overwrite `co-dev/communication/dev-state.md` with:
```
# Developer 상태 스냅샷

> 최신 Developer 세션 상태를 기록합니다. 세션 종료 시 업데이트.

---

**세션 ID**: {session_id}
**마지막 업데이트**: {created_at}
**현재 TASK**: {phase}

## 완료한 작업

{completed items as bullet list}

## 진행 중인 작업

{pending items as bullet list, or "-"}

## 다음 세션 목표

{next_session_goal as bullet list}

## 미해결 이슈

{open_issues as bullet list, or "-"}
```

**For Evaluator role** — overwrite `co-dev/communication/eval-state.md` with:
```
# Evaluator 상태 스냅샷

> 최신 Evaluator 평가 결과를 기록합니다. 평가 완료 시 업데이트.

---

**세션 ID**: {session_id}
**마지막 업데이트**: {created_at}
**평가 대상 TASK**: {phase}
**평가 결과**: {PASS / PARTIAL / FAIL — infer from completed/open_issues}

## 평가 요약

{summary from completed items}

## 구체적 피드백

{open_issues as bullet list, or "-"}

## 다음 Developer에게 전달할 사항

{next_session_goal as bullet list}
```

## Step 8 — Signal handoff via inbox

Call `codev_mark_done`:
- `role`: `developer` or `evaluator`
- `session_id`: derived value
- `summary`: one-paragraph summary of what was accomplished and what the other role should do next

## Step 9 — Display confirmation

```
✅ Checkpoint saved: {checkpoint_id}
   CHANGELOG.md updated
   {dev-state.md | eval-state.md} updated
   📬 Inbox written for [{evaluator | developer}]

The other role will see this on next /start.
```
