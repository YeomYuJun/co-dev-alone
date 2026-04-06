import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseRoles, Role } from './roleParser';
import { getRoleGuideRelativePath, getDefaultRoles } from './config';
import { launchSession } from './sessionLauncher';
import { DirectConnectServer } from './directConnectServer';
import { SessionPanel } from './sessionPanel';

// ─── Module-level state ───────────────────────────────────────────────────────

let server: DirectConnectServer;
let statusBarItem: vscode.StatusBarItem;

/** 이미 Begin session. 을 보낸 세션 — 재연결 시 중복 전송 방지 */
const initializedSessions = new Set<string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

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
        // fallback
      }
    }
  }
  return getDefaultRoles();
}

function updateStatusBar(): void {
  const sessions = server.getSessions();
  const active = sessions.filter(s => s.status === 'active').length;
  const total = sessions.length;

  if (total === 0) {
    statusBarItem.text = '$(circle-outline) Co-Dev';
    statusBarItem.tooltip = 'Co-Dev: 실행 중인 세션 없음';
  } else {
    statusBarItem.text = `$(zap) Co-Dev: ${active}/${total}`;
    statusBarItem.tooltip = sessions
      .map(s => `${s.roleName} [${s.status}]`)
      .join('\n');
  }
}

function autoSpawnEvaluator(): void {
  const roles = resolveRoles();
  const evalRole = roles.find(r => r.name.toLowerCase().includes('eval'));
  if (!evalRole) {
    return; // Evaluator 역할 없으면 무시
  }

  // 이미 active/pending 상태의 Evaluator 세션이 있으면 중복 스폰 방지
  const alreadyRunning = server.getSessions().some(
    s => s.roleName.toLowerCase().includes('eval') && s.status !== 'done'
  );
  if (alreadyRunning) {
    return;
  }

  const root = getWorkspaceRoot() ?? process.cwd();
  vscode.window.showInformationMessage(
    'Co-Dev: Developer 세션 완료 — Evaluator 세션을 자동으로 시작합니다.'
  );
  launchSession(evalRole.name, evalRole.prompt, root, server);
}

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

  launchSession(role.name, role.prompt, root, server);
}

// ─── Commands ─────────────────────────────────────────────────────────────────

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
  launchSession(selected.role.name, selected.role.prompt, root, server);
}

function cmdNewDeveloperSession(): void {
  launchRoleByName('Developer');
}

function cmdNewEvaluatorSession(): void {
  launchRoleByName('Evaluator');
}

function cmdShowPanel(context: vscode.ExtensionContext): void {
  SessionPanel.show(server, context);
}

// ─── Activate / Deactivate ────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  server = new DirectConnectServer();

  // 상태바는 server 이벤트로 단일 갱신
  server.on('session:created', () => updateStatusBar());
  server.on('session:status', (sessionId, status) => {
    updateStatusBar();
    if (status === 'active' && !initializedSessions.has(sessionId)) {
      // 최초 연결 시에만 Begin session. 전송 — 매 턴 후 재연결 시 재전송 방지
      initializedSessions.add(sessionId);
      server.sendToSession(sessionId, {
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'Begin session.' }] },
      });
    }
    // done은 WS close 시 발생 — 매 턴 후 재연결 사이클에서도 발생하므로
    // autoSpawnEvaluator는 여기서 호출하지 않음 (수동 트리거 방식으로 변경)
  });

  server.start().then((port) => {
    console.log(`[Co-Dev] DirectConnect server listening on port ${port}`);
  }).catch((err: Error) => {
    vscode.window.showErrorMessage(`Co-Dev: 서버 시작 실패 — ${err.message}`);
  });

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  statusBarItem.command = 'co-dev.showPanel';
  updateStatusBar();
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand('co-dev.newSession', cmdNewSession),
    vscode.commands.registerCommand('co-dev.newDeveloperSession', cmdNewDeveloperSession),
    vscode.commands.registerCommand('co-dev.newEvaluatorSession', cmdNewEvaluatorSession),
    vscode.commands.registerCommand('co-dev.showPanel', () => cmdShowPanel(context)),
  );
}

export function deactivate(): void {
  server?.stop();
}
