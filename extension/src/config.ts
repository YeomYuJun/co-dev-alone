import * as vscode from 'vscode';
import { Role } from './roleParser';

const SECTION = 'codev';

export function getRoleGuideRelativePath(): string {
  return vscode.workspace
    .getConfiguration(SECTION)
    .get<string>('roleGuideRelativePath', 'co-dev/ROLE-GUIDE.md');
}

export function getClaudeCommand(): string {
  return vscode.workspace
    .getConfiguration(SECTION)
    .get<string>('claudeCommand', 'claude');
}

/**
 * settings.json의 codev.defaultRoles를 Role[] 형태로 반환.
 * ROLE-GUIDE.md 파싱 실패 시 fallback으로 사용.
 */
export function getDefaultRoles(): Role[] {
  const raw = vscode.workspace
    .getConfiguration(SECTION)
    .get<Record<string, string>>('defaultRoles', {});

  return Object.entries(raw).map(([name, prompt]) => ({ name, prompt }));
}
