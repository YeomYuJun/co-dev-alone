# CO-DEV

Multi-session AI collaboration framework for Claude — Developer / Evaluator role separation with checkpoint-based handoff.

## Overview

CO-DEV separates a single AI-assisted project into two independent Claude sessions:

- **Developer** — implements tasks defined in `co-dev/TASK.md`
- **Evaluator** — reviews output against `co-dev/EVAL-CRITERIA.md` and leaves feedback

Sessions communicate through a file-based inbox. Neither role can see the other's live context, preventing anchoring bias.

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| **MCP Server** | `src/` | Core session state, checkpoints, inbox — works with any Claude client |
| **VS Code Extension** | `extension/` | One-command session launcher inside VS Code terminal |
| **Claude Desktop Plugin** | `plugin/` | `/init`, `/start`, `/checkpoint`, `/phase` slash commands for Claude Desktop |

## MCP Server

### Requirements

- Node.js >= 18
- Claude Code CLI or Claude Desktop

### Build

```bash
npm install
npm run build
```

### Register (Claude Desktop)

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "co-dev": {
      "command": "node",
      "args": ["/absolute/path/to/co-dev-alone/dist/index.js"],
      "env": {
        "CODEV_DATA_DIR": "/absolute/path/to/your-project/co-dev/.data"
      }
    }
  }
}
```

> Set `CODEV_DATA_DIR` to the `co-dev/.data` path of the project you are working on. If omitted, the server falls back to `~/.co-dev/` as a global store.

### Register (Claude Code CLI)

Add to `~/.claude/settings.json` or the project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "co-dev": {
      "command": "node",
      "args": ["/absolute/path/to/co-dev-alone/dist/index.js"]
    }
  }
}
```

### Initialize a Project

In any Claude session, call:

```
codev_init("my-project", tech_stack="TypeScript", scope="...")
```

This creates:
- `co-dev/` — markdown structure (git-tracked)
- `co-dev/.data/` — session/checkpoint/inbox JSON store (git-ignored)
- `.claude/settings.json` — injects `CODEV_DATA_DIR` for CLI mode
- `.gitignore` entry for `co-dev/.data/`

## MCP Tools

| Tool | Description |
|------|-------------|
| `codev_init` | Initialize CO-DEV project structure |
| `codev_save_context` | Save session context |
| `codev_get_context` | Read saved session context |
| `codev_list_sessions` | List all session IDs |
| `codev_save_checkpoint` | Save checkpoint (auto-increments index) |
| `codev_read_checkpoint` | Read latest or specific checkpoint |
| `codev_list_checkpoints` | Paginated checkpoint metadata |
| `codev_detect_role` | Detect Dev / Eval role from context keywords |
| `codev_check_inbox` | Read inbox message from the other role (marks as read) |
| `codev_mark_done` | Signal completion and write to the other role's inbox |

## Session Protocol

Every session follows this sequence:

```
1. codev_check_inbox(role)
   → message found : read feedback, note open issues
   → empty         : codev_get_context(session_id) to restore state

2. Review co-dev/TASK.md for current goals

3. Do the work

4. codev_mark_done(role, session_id, summary)
   → writes handoff message to the other role's inbox
```

## Data Layout

```
co-dev/
├── COLLABO.md          — collaboration agreement (git-tracked)
├── ROLE-GUIDE.md       — role prompts parsed by Extension (git-tracked)
├── TASK.md             — current sprint goals (git-tracked)
├── EVAL-CRITERIA.md    — evaluation rubric (git-tracked)
└── communication/
    ├── CHANGELOG.md
    ├── ISSUES.md
    ├── dev-state.md
    └── eval-state.md

co-dev/.data/           — runtime store (.gitignored)
├── sessions/
│   └── {session_id}.json
├── checkpoints/
│   └── {session_id}/0001.json ...
└── inbox/
    ├── developer.json
    └── evaluator.json
```

### Data Directory Resolution

| Priority | Condition | Path used |
|----------|-----------|-----------|
| 1 | `{cwd}/co-dev/.data/` exists | project-local (CLI mode) |
| 2 | `CODEV_DATA_DIR` env var set | value of env var |
| 3 | fallback | `~/.co-dev/` global (Desktop mode) |

**CLI mode** — Claude Code CLI runs from the project root, so tier 1 resolves automatically and always wins over any inherited `CODEV_DATA_DIR`. This keeps each project's inbox/checkpoints isolated even when the user-scope CLI config sets a global path.

**Desktop mode** — Claude Desktop has no project-bound cwd, so tier 1 never matches. Set `CODEV_DATA_DIR` in `claude_desktop_config.json` (see [Register (Claude Desktop)](#register-claude-desktop)) to pin Desktop to a specific store, or let it fall through to tier 3 (`~/.co-dev/`), a shared global store across all projects.
