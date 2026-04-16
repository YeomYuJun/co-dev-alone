import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getClaudeCommand, getDefaultRoles, getRoleGuideRelativePath } from './config';
import { parseRoles, Role } from './roleParser';

// ─── helpers ────────────────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function resolveRoles(): Role[] {
  const root = getWorkspaceRoot();
  if (root) {
    const guidePath = path.join(root, getRoleGuideRelativePath());
    if (fs.existsSync(guidePath)) {
      try {
        const parsed = parseRoles(fs.readFileSync(guidePath, 'utf-8'));
        if (parsed.length > 0) return parsed;
      } catch { /* fallback */ }
    }
  }
  return getDefaultRoles();
}

function buildSessionId(roleName: string, workspaceRoot: string): string {
  const project = path.basename(workspaceRoot).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const slug = roleName.toLowerCase().includes('eval') ? 'eval' : 'dev';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${project}-${slug}-${date}`;
}

/**
 * Session bootstrap block — injected into the --append-system-prompt.
 *
 * Why this exists:
 *   The extension intentionally does NOT push project/stack/phase values into the
 *   launch prompt (the user's rule: "Ctrl+Shift+P 시작 시 context 안 넣기").
 *   But without a bootstrap check, the model loses role/context on compaction
 *   and starts flailing. This block makes Claude:
 *     1. look up the session file first,
 *     2. adopt it silently if present,
 *     3. ask the user in one grouped prompt if absent, then persist.
 *
 *   It instructs — it does not prefill. That distinction matters.
 */
function buildBootstrapPrompt(sessionId: string, roleName: string): string {
  const roleSlug = roleName.toLowerCase().includes('eval') ? 'evaluator' : 'developer';
  return [
    `## SESSION BOOTSTRAP (run this FIRST, before any other tool call or response)`,
    ``,
    `Your session_id is: ${sessionId}`,
    `Your role is: ${roleSlug}`,
    ``,
    `Step 1 — Load or request context:`,
    `  • Call codev_get_context(session_id='${sessionId}').`,
    `  • If FOUND: silently adopt project / stack / phase / current_goal / constraints. Do not re-ask.`,
    `  • If NOT FOUND: do NOT guess from files. Ask the user in ONE grouped prompt:`,
    `      - project (short name; default = workspace folder)`,
    `      - stack (language / runtime)`,
    `      - phase (current phase label)`,
    `      - current_goal (1–3 goals, one per line or comma-separated)`,
    `      - constraints (hard limits; optional)`,
    `    Then call codev_save_context with session_id='${sessionId}' and the answers.`,
    ``,
    `Step 2 — Check inbox: codev_check_inbox('${roleSlug}').  (read YOUR OWN inbox only.)`,
    ``,
    `Step 3 — Present a one-line session brief (role, session_id, phase, goals) and wait.`,
    ``,
    `If later in the conversation you feel you've lost context, re-run`,
    `codev_get_context('${sessionId}') to restore it. Do not fabricate role or goals.`,
    ``,
    `---`,
    ``,
  ].join('\n');
}

/**
 * Sanitize + escape a multi-line prompt for safe injection into the shell command line.
 *
 * Why strip backticks:
 *   - PowerShell: `"` is parsed as escaped-quote → closing quote lost, REPL hangs on `>>`
 *   - bash: `...` is command substitution → contents get executed
 *   Backticks are markdown formatting only; removing them is lossless for Claude.
 *
 * Why strip the dollar sign:
 *   - bash: `$var` / `${var}` perform variable expansion inside double quotes
 */
function escapePrompt(prompt: string): string {
  return prompt
    .replace(/`/g, '')           // kill backticks (PowerShell escape + bash cmd substitution)
    .replace(/\$/g, '')          // kill $ (bash var expansion)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n');
}

function launchRole(roleName: string, rolePrompt: string): void {
  const root = getWorkspaceRoot() ?? process.cwd();
  const sessionId = buildSessionId(roleName, root);
  const bootstrap = buildBootstrapPrompt(sessionId, roleName);
  const fullPrompt = `SESSION_ID: ${sessionId}\n\n${bootstrap}${rolePrompt}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const terminal = vscode.window.createTerminal({
    name: `[${roleName}] ${timestamp}`,
    cwd: root,
  });
  terminal.show(false);
  terminal.sendText(`${getClaudeCommand()} --append-system-prompt "${escapePrompt(fullPrompt)}"`);
}

// ─── commands ────────────────────────────────────────────────────────────────

async function cmdNewSession(): Promise<void> {
  const roles = resolveRoles();
  if (roles.length === 0) {
    vscode.window.showErrorMessage(
      'Co-Dev: 사용 가능한 역할이 없습니다. co-dev/ROLE-GUIDE.md 또는 settings.json의 codev.defaultRoles를 설정하세요.'
    );
    return;
  }

  const selected = await vscode.window.showQuickPick(
    roles.map(r => ({ label: r.name, description: r.prompt.slice(0, 80).replace(/\n/g, ' ') + '...', role: r })),
    { placeHolder: '시작할 역할을 선택하세요', title: 'Co-Dev: New Session' }
  );
  if (selected) launchRole(selected.role.name, selected.role.prompt);
}

function cmdNewDeveloperSession(): void {
  const role = resolveRoles().find(r => r.name.toLowerCase().includes('developer'));
  if (!role) {
    vscode.window.showErrorMessage('Co-Dev: Developer 역할을 찾을 수 없습니다. co-dev/ROLE-GUIDE.md를 확인하세요.');
    return;
  }
  launchRole(role.name, role.prompt);
}

function cmdNewEvaluatorSession(): void {
  const role = resolveRoles().find(r => r.name.toLowerCase().includes('evaluator'));
  if (!role) {
    vscode.window.showErrorMessage('Co-Dev: Evaluator 역할을 찾을 수 없습니다. co-dev/ROLE-GUIDE.md를 확인하세요.');
    return;
  }
  launchRole(role.name, role.prompt);
}

// ─── activate / deactivate ───────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('co-dev.newSession', cmdNewSession),
    vscode.commands.registerCommand('co-dev.newDeveloperSession', cmdNewDeveloperSession),
    vscode.commands.registerCommand('co-dev.newEvaluatorSession', cmdNewEvaluatorSession),
  );
}

export function deactivate(): void { /* nothing */ }
