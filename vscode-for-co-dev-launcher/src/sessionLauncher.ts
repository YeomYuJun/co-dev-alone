import * as path from 'path';
import * as vscode from 'vscode';
import { getClaudeCommand } from './config';

/**
 * 역할 이름에서 session_id용 슬러그를 생성한다.
 * "Developer Session" → "dev", "Evaluator Session" → "eval"
 */
function roleSlug(roleName: string): string {
  const lower = roleName.toLowerCase();
  if (lower.includes('eval')) { return 'eval'; }
  return 'dev';
}

/**
 * 프로젝트 폴더명 + 역할 + 날짜로 session_id를 생성한다.
 * 형식: {project}-{role}-{YYYYMMDD}  (MCP 도구 허용 문자만 포함)
 */
function buildSessionId(roleName: string, workspaceRoot: string): string {
  const project = path.basename(workspaceRoot).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${project}-${roleSlug(roleName)}-${date}`;
}

/**
 * 역할 프롬프트를 --append-system-prompt 인자로 안전하게 이스케이프.
 * Windows cmd / bash 양쪽에서 동작하도록 처리.
 */
function escapePrompt(prompt: string): string {
  return prompt
    .replace(/\\/g, '\\\\')   // 백슬래시 먼저
    .replace(/"/g, '\\"')      // 쌍따옴표
    .replace(/\r?\n/g, '\\n'); // 줄바꿈 → \n 리터럴
}

/**
 * 새 통합 터미널을 열고, 지정된 역할로 claude 세션을 시작한다.
 * session_id를 프롬프트 첫 줄에 주입해 MCP 도구 호출 시 일관된 ID를 보장한다.
 */
export function launchSession(roleName: string, rolePrompt: string, workspaceRoot: string): void {
  const claudeCmd = getClaudeCommand();
  const sessionId = buildSessionId(roleName, workspaceRoot);
  const promptWithId = `SESSION_ID: ${sessionId}\n\n${rolePrompt}`;
  const escaped = escapePrompt(promptWithId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const terminal = vscode.window.createTerminal({
    name: `[${roleName}] ${timestamp}`,
    cwd: workspaceRoot,
  });

  terminal.show(false);
  terminal.sendText(`${claudeCmd} --append-system-prompt "${escaped}"`);
}
