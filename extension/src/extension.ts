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

function escapePrompt(prompt: string): string {
  return prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n');
}

function launchRole(roleName: string, rolePrompt: string): void {
  const root = getWorkspaceRoot() ?? process.cwd();
  const sessionId = buildSessionId(roleName, root);
  const fullPrompt = `SESSION_ID: ${sessionId}\n\n${rolePrompt}`;
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
