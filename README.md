# CO-DEV MCP Server

Multi-session context injection, checkpoint management, and role detection for Claude-powered development workflows.

---

## Tools

| Tool | Description | Hints |
|---|---|---|
| `codev_save_context` | Save [CONTEXT] block for a session | W, idempotent |
| `codev_get_context` | Read saved [CONTEXT] block | R |
| `codev_list_sessions` | List all known session IDs | R |
| `codev_save_checkpoint` | Save /checkpoint output (auto-increments index) | W |
| `codev_read_checkpoint` | Read latest or specific checkpoint | R |
| `codev_list_checkpoints` | Paginated checkpoint metadata | R |
| `codev_detect_role` | Detect Dev / Eval role from context | R |

---

## Install & Build

```bash
npm install
npm run build
```

Requires Node.js >= 18.

---

## Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "co-dev": {
      "command": "node",
      "args": ["D:\\servers\\co-dev-mcp-server\\dist\\index.js"],
      "env": {
        "CODEV_DATA_DIR": "C:\\Users\\YeomYuJun\\.co-dev"
      }
    }
  }
}
```

Default `CODEV_DATA_DIR`: `~/.co-dev/`

---

## Data Layout

```
%CODEV_DATA_DIR%/
  sessions/
    {session_id}.json          <- SessionContext
  checkpoints/
    {session_id}/
      0001.json                <- Checkpoint index 1
      0002.json                <- Checkpoint index 2
```

---

## Typical Session Flow

```
# 1. Start of session
codev_save_context(session_id="proj-alpha", project="...", ...)

# 2. Check last state
codev_read_checkpoint(session_id="proj-alpha")

# 3. Detect role
codev_detect_role(session_id="proj-alpha")

# 4. End of session
codev_save_checkpoint(session_id="proj-alpha", completed=[...], pending=[...], ...)
```
