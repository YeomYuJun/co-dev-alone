import * as vscode from 'vscode';
import { getClaudeCommand } from './config';

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
 */
export function launchSession(roleName: string, rolePrompt: string, workspaceRoot: string): void {
  const claudeCmd = getClaudeCommand();
  const escaped = escapePrompt(rolePrompt);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const terminal = vscode.window.createTerminal({
    name: `[${roleName}] ${timestamp}`,
    cwd: workspaceRoot,
  });

  terminal.show(false); // false = 포커스를 터미널로 이동하지 않음 (원하면 true)
  terminal.sendText(`${claudeCmd} --append-system-prompt "${escaped}"`);
}
