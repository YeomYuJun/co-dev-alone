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
exports.getRoleGuideRelativePath = getRoleGuideRelativePath;
exports.getClaudeCommand = getClaudeCommand;
exports.getDefaultRoles = getDefaultRoles;
const vscode = __importStar(require("vscode"));
const SECTION = 'codev';
function getRoleGuideRelativePath() {
    return vscode.workspace
        .getConfiguration(SECTION)
        .get('roleGuideRelativePath', 'co-dev/ROLE-GUIDE.md');
}
function getClaudeCommand() {
    return vscode.workspace
        .getConfiguration(SECTION)
        .get('claudeCommand', 'claude');
}
/**
 * settings.json의 codev.defaultRoles를 Role[] 형태로 반환.
 * ROLE-GUIDE.md 파싱 실패 시 fallback으로 사용.
 */
function getDefaultRoles() {
    const raw = vscode.workspace
        .getConfiguration(SECTION)
        .get('defaultRoles', {});
    return Object.entries(raw).map(([name, prompt]) => ({ name, prompt }));
}
//# sourceMappingURL=config.js.map