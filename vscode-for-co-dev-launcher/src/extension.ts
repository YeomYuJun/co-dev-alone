import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseRoles, Role } from './roleParser';
import { getRoleGuideRelativePath, getDefaultRoles } from './config';
import { launchSession } from './sessionLauncher';

// ─── helpers ────────────────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * workspace의 ROLE-GUIDE.md를 읽어 파싱한다.
 * 파일이 없거나 파싱 결과가 비어있으면 settings fallback을 사용한다.
 */
function resolveRoles(): Role[] {
  const root = getWorkspaceRoot();
  if (root) {
    const guidePath = path.join(root, getRoleGuideRelativePath());
    if (fs.existsSync(guidePath)) {
      try {
        const content = fs.readFileSync(guidePath, 'utf-8');
        const parsed = parseRoles(content);
        if (parsed.length > 0) {
          return parsed;
        }
      } catch {
        // 파일 읽기 실패 → fallback
      }
    }
  }
  return getDefaultRoles();
}

/**
 * 역할 이름으로 Role을 찾아 세션을 시작한다.
 * 역할이 없으면 오류 메시지를 표시한다.
 */
function launchRoleByName(roleName: string): void {
  const root = getWorkspaceRoot() ?? process.cwd();
  const roles = resolveRoles();
  const role = roles.find(r => r.name.toLowerCase().includes(roleName.toLowerCase()));

  if (!role) {
    vscode.window.showErrorMessage(
      `Co-Dev: "${roleName}" 역할을 찾을 수 없습니다. ROLE-GUIDE.md 또는 settings.json의 codev.defaultRoles를 확인하세요.`
    );
    return;
  }

  launchSession(role.name, role.prompt, root);
}

// ─── commands ───────────────────────────────────────────────────────────────

/** Ctrl+Shift+P → "Co-Dev: New Session" — Quick Pick으로 역할 선택 */
async function cmdNewSession(): Promise<void> {
  const roles = resolveRoles();

  if (roles.length === 0) {
    vscode.window.showErrorMessage(
      'Co-Dev: 사용 가능한 역할이 없습니다. co-dev/ROLE-GUIDE.md 파일이나 settings.json의 codev.defaultRoles를 설정하세요.'
    );
    return;
  }

  const items = roles.map(r => ({
    label: r.name,
    description: r.prompt.slice(0, 80).replace(/\n/g, ' ') + '...',
    role: r,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '시작할 역할을 선택하세요',
    title: 'Co-Dev: New Session',
  });

  if (!selected) {
    return;
  }

  const root = getWorkspaceRoot() ?? process.cwd();
  launchSession(selected.role.name, selected.role.prompt, root);
}

/** "Co-Dev: New Developer Session" — Developer 직접 실행 */
function cmdNewDeveloperSession(): void {
  launchRoleByName('Developer');
}

/** "Co-Dev: New Evaluator Session" — Evaluator 직접 실행 */
function cmdNewEvaluatorSession(): void {
  launchRoleByName('Evaluator');
}

// ─── activate / deactivate ───────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('co-dev.newSession', cmdNewSession),
    vscode.commands.registerCommand('co-dev.newDeveloperSession', cmdNewDeveloperSession),
    vscode.commands.registerCommand('co-dev.newEvaluatorSession', cmdNewEvaluatorSession),
  );
}

export function deactivate(): void {
  // nothing
}
