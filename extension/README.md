# CO-DEV Launcher — VS Code Extension

Launches CO-DEV Developer / Evaluator sessions as Claude Code CLI terminals directly from VS Code — no manual prompt construction needed.

## Requirements

- VS Code 1.85+
- [Claude Code CLI](https://claude.ai/code) installed and available on PATH
- CO-DEV MCP server built and registered in Claude Code settings

## Installation

Install the VSIX package:

1. Open VS Code
2. `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
3. Select `vscode-co-dev-launcher-x.x.x.vsix`

Or from the command line:

```bash
code --install-extension vscode-co-dev-launcher-x.x.x.vsix
```

## Commands

Open the Command Palette with `Ctrl+Shift+P` and search for `Co-Dev`:

| Command | Description |
|---------|-------------|
| `Co-Dev: New Session` | Pick a role from a dropdown, then launch |
| `Co-Dev: New Developer Session` | Launch a Developer session immediately |
| `Co-Dev: New Evaluator Session` | Launch an Evaluator session immediately |

### What happens on launch

1. A new terminal opens in the workspace root, named `[RoleName] YYYY-MM-DDTHH-MM-SS`
2. The extension auto-generates a `session_id` as `{project}-{dev|eval}-{YYYYMMDD}`
3. Claude Code CLI starts with the role prompt injected:
   ```
   claude --append-system-prompt "SESSION_ID: myproject-dev-20260407\n\n{role prompt}"
   ```
4. Claude begins the session protocol: checks inbox, loads context, reads `TASK.md`

## Role Resolution

The extension reads `co-dev/ROLE-GUIDE.md` in the workspace root to get role names and prompts. If the file is missing or unparseable, it falls back to built-in Developer / Evaluator defaults.

## Configuration

Settings are under `Co-Dev Launcher` in VS Code preferences (`Ctrl+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `codev.roleGuideRelativePath` | `co-dev/ROLE-GUIDE.md` | Path to ROLE-GUIDE.md relative to workspace root |
| `codev.claudeCommand` | `claude` | Claude CLI command (use absolute path if not on PATH) |
| `codev.defaultRoles` | Developer + Evaluator | Fallback role definitions when ROLE-GUIDE.md is absent |

## Building from Source

```bash
cd extension
npm install
npm run compile      # single build
npm run watch        # watch mode
npm run package      # produce .vsix
```
