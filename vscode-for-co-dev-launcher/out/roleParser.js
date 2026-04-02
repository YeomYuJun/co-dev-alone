"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRoles = parseRoles;
/**
 * ROLE-GUIDE.md의 ## [Role Name] 섹션을 파싱하여 역할 목록 반환.
 * 각 ## 헤더가 역할 이름, 그 아래 내용 전체가 프롬프트가 됨.
 *
 * 예시:
 *   ## Developer Session
 *   ### Primary Mission
 *   ...
 *   ---
 *   ## Evaluator Session
 *   ...
 */
function parseRoles(markdown) {
    const roles = [];
    // ## 로 시작하는 섹션 분할 (### 이하 제외)
    const sectionRegex = /^## (.+)$/gm;
    const matches = [...markdown.matchAll(sectionRegex)];
    if (matches.length === 0) {
        return roles;
    }
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const name = match[1].trim();
        const startIndex = (match.index ?? 0) + match[0].length;
        const endIndex = i + 1 < matches.length ? (matches[i + 1].index ?? markdown.length) : markdown.length;
        const rawContent = markdown.slice(startIndex, endIndex).trim();
        // 구분자(---) 제거 후 trim
        const prompt = rawContent.replace(/^---\s*$/gm, '').trim();
        if (prompt.length > 0) {
            roles.push({ name, prompt });
        }
    }
    return roles;
}
//# sourceMappingURL=roleParser.js.map