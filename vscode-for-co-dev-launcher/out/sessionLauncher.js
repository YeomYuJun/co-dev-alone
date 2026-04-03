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
const config_1 = require("./config");
/**
 * 역할 이름에서 session_id용 슬러그를 생성한다.
 * "Developer Session" → "dev", "Evaluator Session" → "eval"
 */
function roleSlug(roleName) {
    const lower = roleName.toLowerCase();
    if (lower.includes('eval')) {
        return 'eval';
    }
    return 'dev';
}
/**
 * 프로젝트 폴더명 + 역할 + 날짜로 session_id를 생성한다.
 * 형식: {project}-{role}-{YYYYMMDD}  (MCP 도구 허용 문자만 포함)
 */
function buildSessionId(roleName, workspaceRoot) {
    const project = path.basename(workspaceRoot).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${project}-${roleSlug(roleName)}-${date}`;
}
/**
 * 역할 프롬프트를 --append-system-prompt 인자로 안전하게 이스케이프.
 * Windows cmd / bash 양쪽에서 동작하도록 처리.
 */
function escapePrompt(prompt) {
    return prompt
        .replace(/\\/g, '\\\\') // 백슬래시 먼저
        .replace(/"/g, '\\"') // 쌍따옴표
        .replace(/\r?\n/g, '\\n'); // 줄바꿈 → \n 리터럴
}
/**
 * 새 통합 터미널을 열고, 지정된 역할로 claude 세션을 시작한다.
 * session_id를 프롬프트 첫 줄에 주입해 MCP 도구 호출 시 일관된 ID를 보장한다.
 */
function launchSession(roleName, rolePrompt, workspaceRoot) {
    const claudeCmd = (0, config_1.getClaudeCommand)();
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
//# sourceMappingURL=sessionLauncher.js.map