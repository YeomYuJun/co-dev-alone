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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const roleParser_1 = require("./roleParser");
const config_1 = require("./config");
const sessionLauncher_1 = require("./sessionLauncher");
// ─── helpers ────────────────────────────────────────────────────────────────
function getWorkspaceRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
/**
 * workspace의 ROLE-GUIDE.md를 읽어 파싱한다.
 * 파일이 없거나 파싱 결과가 비어있으면 settings fallback을 사용한다.
 */
function resolveRoles() {
    const root = getWorkspaceRoot();
    if (root) {
        const guidePath = path.join(root, (0, config_1.getRoleGuideRelativePath)());
        if (fs.existsSync(guidePath)) {
            try {
                const content = fs.readFileSync(guidePath, 'utf-8');
                const parsed = (0, roleParser_1.parseRoles)(content);
                if (parsed.length > 0) {
                    return parsed;
                }
            }
            catch {
                // 파일 읽기 실패 → fallback
            }
        }
    }
    return (0, config_1.getDefaultRoles)();
}
/**
 * 역할 이름으로 Role을 찾아 세션을 시작한다.
 * 역할이 없으면 오류 메시지를 표시한다.
 */
function launchRoleByName(roleName) {
    const root = getWorkspaceRoot() ?? process.cwd();
    const roles = resolveRoles();
    const role = roles.find(r => r.name.toLowerCase().includes(roleName.toLowerCase()));
    if (!role) {
        vscode.window.showErrorMessage(`Co-Dev: "${roleName}" 역할을 찾을 수 없습니다. ROLE-GUIDE.md 또는 settings.json의 codev.defaultRoles를 확인하세요.`);
        return;
    }
    (0, sessionLauncher_1.launchSession)(role.name, role.prompt, root);
}
// ─── commands ───────────────────────────────────────────────────────────────
/** Ctrl+Shift+P → "Co-Dev: New Session" — Quick Pick으로 역할 선택 */
async function cmdNewSession() {
    const roles = resolveRoles();
    if (roles.length === 0) {
        vscode.window.showErrorMessage('Co-Dev: 사용 가능한 역할이 없습니다. co-dev/ROLE-GUIDE.md 파일이나 settings.json의 codev.defaultRoles를 설정하세요.');
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
    (0, sessionLauncher_1.launchSession)(selected.role.name, selected.role.prompt, root);
}
/** "Co-Dev: New Developer Session" — Developer 직접 실행 */
function cmdNewDeveloperSession() {
    launchRoleByName('Developer');
}
/** "Co-Dev: New Evaluator Session" — Evaluator 직접 실행 */
function cmdNewEvaluatorSession() {
    launchRoleByName('Evaluator');
}
// ─── activate / deactivate ───────────────────────────────────────────────────
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('co-dev.newSession', cmdNewSession), vscode.commands.registerCommand('co-dev.newDeveloperSession', cmdNewDeveloperSession), vscode.commands.registerCommand('co-dev.newEvaluatorSession', cmdNewEvaluatorSession));
}
function deactivate() {
    // nothing
}
//# sourceMappingURL=extension.js.map