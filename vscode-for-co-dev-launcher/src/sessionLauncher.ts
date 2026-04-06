import * as path from 'path';
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { getClaudeCommand } from './config';
import { DirectConnectServer } from './directConnectServer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleSlug(roleName: string): string {
  return roleName.toLowerCase().includes('eval') ? 'eval' : 'dev';
}

/**
 * co-dev MCP 도구에서 사용할 session_id 생성.
 * 형식: {project}-{role}-{YYYYMMDD}
 */
function buildSessionId(roleName: string, workspaceRoot: string): string {
  const project = path.basename(workspaceRoot).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${project}-${roleSlug(roleName)}-${date}`;
}

// ─── Launch ───────────────────────────────────────────────────────────────────

/**
 * DirectConnect 서버를 통해 claude 세션을 자식 프로세스로 스폰한다.
 * - spawn() 사용으로 쉘 이스케이프 불필요
 * - --sdk-url로 Extension이 세션을 완전히 제어
 * - stdout/stderr는 OutputChannel로 출력 (WS 메시지 처리 전 fallback)
 */
export function launchSession(
  roleName: string,
  rolePrompt: string,
  workspaceRoot: string,
  server: DirectConnectServer,
): import('./directConnectServer').SessionHandle {
  const claudeCmd = getClaudeCommand();
  const sessionId = buildSessionId(roleName, workspaceRoot);
  const promptWithId = `SESSION_ID: ${sessionId}\n\n${rolePrompt}`;

  const handle = server.createSession(sessionId, roleName);

  const args = [
    '--print',
    '--sdk-url', handle.wsUrl,
    '--session-id', sessionId,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--replay-user-messages',
    '--append-system-prompt', promptWithId,
  ];

  handle.outputChannel.appendLine(
    `[Co-Dev] Starting ${roleName} (session: ${sessionId})\n`
  );

  handle.outputChannel.appendLine(`[Spawn] cmd=${claudeCmd}`);
  handle.outputChannel.appendLine(`[Spawn] args=${JSON.stringify(args)}`);
  handle.outputChannel.appendLine(`[Spawn] cwd=${workspaceRoot}`);

  const child = spawn(claudeCmd, args, {
    cwd: workspaceRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    shell: process.platform === 'win32',  // Windows: .cmd 파일 지원
  });

  handle.outputChannel.appendLine(`[Spawn] pid=${child.pid ?? 'none'}`);

  // stdout/stderr: WS 연결 전 초기 로그 또는 오류 캡처
  child.stdout?.on('data', (chunk: Buffer) => {
    handle.outputChannel.append(chunk.toString());
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    handle.outputChannel.append('[stderr] ' + chunk.toString());
  });

  child.on('close', (code) => {
    handle.outputChannel.appendLine(`\n[Process exited: ${code}]`);
  });

  child.on('error', (err) => {
    handle.outputChannel.appendLine(`[Spawn error] ${err.message}`);
    vscode.window.showErrorMessage(
      `Co-Dev: claude 프로세스 시작 실패 — ${err.message}`
    );
  });

  return handle;
}
