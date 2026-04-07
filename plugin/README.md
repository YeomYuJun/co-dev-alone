# CO-DEV Plugin

Brings the CO-DEV multi-session workflow into Claude Desktop. Provides `/start`, `/init`, `/checkpoint`, and `/phase` slash commands for session management, and auto-loads CO-DEV conventions as a skill on every chat.

## Components

| Component | Name | Purpose |
|-----------|------|---------|
| Skill | `co-dev-conventions` | Auto-loads CO-DEV prefix rules, phase gates, checkpoint format, and MCP tool reference |
| Command | `/init` | Initializes CO-DEV project structure in the current workspace |
| Command | `/start` | Starts a session by confirming role, checking inbox, and loading context |
| Command | `/checkpoint` | Saves a `[CHECKPOINT]` summary and leaves a handoff message for the other role |
| Command | `/phase` | Shows current phase exit conditions; optionally advances the phase |

## Requirements

- Claude Desktop (with plugin support)
- CO-DEV MCP server built and registered globally in Claude Desktop

## Setup

### 1. Build the MCP server

```bash
cd /path/to/co-dev-alone
npm install
npm run build
```

### 2. Register MCP server in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "co-dev": {
      "command": "node",
      "args": ["C:/absolute/path/to/co-dev-alone/dist/index.js"]
    }
  }
}
```

### 3. Install the plugin

Install `co-dev.plugin` through Claude Desktop's plugin manager.

## Usage

### Initialize a project

In a new chat pointed at your project workspace:

```
/init
```

Creates `co-dev/` markdown structure and `co-dev/.data/` runtime store.

### Start a session

```
/start dev
/start eval
```

- `dev` — Developer role (implementation)
- `eval` — Evaluator role (independent review)

The command auto-derives `session_id` from the workspace folder name and today's date (e.g. `myproject-dev-20260407`). It then:
1. Checks inbox for messages from the other role
2. Loads or initializes session context
3. Reads `co-dev/TASK.md` for current goals
4. Restores last checkpoint if available
5. Presents a session brief

### Save a checkpoint

At the end of a session:

```
/checkpoint
/checkpoint eval
```

Drafts a `[CHECKPOINT]` from the conversation, asks for confirmation, then calls `codev_save_checkpoint`. If session work is complete, also calls `codev_mark_done` to leave a handoff message for the other role.

### Manage phases

```
/phase              — show current phase and exit conditions
/phase advance      — advance to next phase (confirms conditions first)
```

## Workflow

```
New chat
  → CO-DEV conventions skill auto-loads
  → /start dev          ← role confirmed, context loaded, inbox checked
  → [PLAN] → [IMPL] → [DONE]   ← use prefixes throughout
  → /phase              ← verify exit conditions
  → /checkpoint         ← save handoff, mark done

New chat (Evaluator)
  → /start eval         ← loads last checkpoint, shows inbox message
  → [ISSUE] / [DONE]    ← evaluate and annotate
  → /checkpoint eval    ← save eval checkpoint, mark done
```
