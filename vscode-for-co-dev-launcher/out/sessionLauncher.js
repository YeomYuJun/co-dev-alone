"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchSession = launchSession;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const config_1 = require("./config");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function roleSlug(roleName) {
    return roleName.toLowerCase().includes('eval') ? 'eval' : 'dev';
}
/**
 * co-dev MCP 도구에서 사용할 session_id 생성.
 * 형식: {project}-{role}-{YYYYMMDD}
 */
function buildSessionId(roleName, workspaceRoot) {
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
function launchSession(roleName, rolePrompt, workspaceRoot, server) {
    const claudeCmd = (0, config_1.getClaudeCommand)();
    const sessionId = buildSessionId(roleName, workspaceRoot);
    const promptWithId = `SESSION_ID: ${sessionId}\n\n${rolePrompt}`;
    const handle = server.createSession(sessionId, roleName);
    const args = [
        '--print',
        '--sdk-url', handle.wsUrl,
        '--session-id', sessionId,
        '--replay-user-messages',
        '--append-system-prompt', promptWithId,
    ];
    handle.outputChannel.appendLine(`[Co-Dev] Starting ${roleName} (session: ${sessionId})\n`);
    const child = (0, child_process_1.spawn)(claudeCmd, args, {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
    });
    // stdout/stderr: WS 연결 전 초기 로그 또는 오류 캡처
    child.stdout?.on('data', (chunk) => {
        handle.outputChannel.append(chunk.toString());
    });
    child.stderr?.on('data', (chunk) => {
        handle.outputChannel.append('[stderr] ' + chunk.toString());
    });
    child.on('close', (code) => {
        handle.outputChannel.appendLine(`\n[Process exited: ${code}]`);
    });
    child.on('error', (err) => {
        handle.outputChannel.appendLine(`[Spawn error] ${err.message}`);
        vscode.window.showErrorMessage(`Co-Dev: claude 프로세스 시작 실패 — ${err.message}`);
    });
    return handle;
}
//# sourceMappingURL=sessionLauncher.js.map