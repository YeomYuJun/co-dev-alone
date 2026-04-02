# Co-Dev 호환성 분석 리포트

> 분석 일자: 2026-04-02

## 전체 호환성 분석

### 아키텍처 요약

```
[VSCode Extension]         [MCP Server]            [Claude Code CLI]
vscode-co-dev-launcher --> co-dev-alone/dist --> claude_desktop_config.json
  - 역할 선택 QuickPick      - 7개 MCP 도구             (공유 설정)
  - terminal.sendText()      - ~/.co-dev/ 저장소
  - --append-system-prompt
```

---

## ✅ 정상 작동하는 부분

**1. MCP 서버 경로 & 컴파일 상태**
- `D:\co-dev-alone\dist\index.js` 컴파일 완료
- `claude_desktop_config.json`에 올바른 경로로 등록됨
- `CODEV_DATA_DIR = C:\Users\YeomYuJun\.co-dev` 설정 일치

**2. Claude Code가 MCP를 로드하는 방식**
- Extension이 `claude` CLI를 터미널에서 실행할 때, Claude Code는 `%APPDATA%\Claude\claude_desktop_config.json`을 읽음
- 따라서 extension으로 열린 세션에서도 `co-dev` MCP 도구가 **자동으로 사용 가능**

**3. 데이터 공유**
- Developer 세션 / Evaluator 세션 / 직접 열린 Claude Code 세션 모두 `~/.co-dev/`를 공유
- 멀티 세션 협업 의도와 일치

**4. Extension 컴파일 상태**
- `out/` 폴더에 JS 파일 완성됨

---

## ⚠️ 문제가 있는 부분

### 문제 1: 역할 프롬프트와 MCP 도구 간 단절 (핵심 이슈)

Extension의 default role prompt (`codev.defaultRoles`)가 **파일 기반 통신** 모델을 설명합니다:
```
"Read CHANGELOG.md, eval-state.md, dev-state.md..."
```
MCP 도구(`codev_save_context`, `codev_save_checkpoint` 등)를 **언급하지 않습니다.**

결과: Claude가 세션을 시작해도 MCP 도구를 사용해야 한다는 것을 모름 → checkpointing이 실제로 동작하지 않음.

**해결**: `ROLE-GUIDE.md`나 `codev.defaultRoles` 프롬프트에 아래 내용 추가 필요:
```markdown
At session start: call codev_read_checkpoint(session_id) and codev_get_context(session_id)
At session end: call codev_save_checkpoint(session_id, ...)
```

---

### 문제 2: `session_id` 관리 미정의

MCP 도구 전체가 `session_id` 파라미터를 요구하는데, Extension은 session_id를 생성하거나 전달하지 않습니다. Claude가 스스로 결정해야 하므로:
- 세션마다 다른 id를 만들 수 있음
- 이전 checkpoint를 못 찾을 수 있음

**해결**: 역할 프롬프트에 session_id 명명 규칙 포함 필요:
```
session_id: "{project_name}-{role}-{YYYYMMDD}"
```

---

### 문제 3: Filesystem MCP 경로 오류 (사소)

`claude_desktop_config.json`의 filesystem MCP 설정:
```json
"/Users/YeomYuJun/Desktop"  ← Unix 경로 (Windows에서 동작 안 함)
"D://servers"               ← Windows 경로
```
첫 번째 경로가 Windows에서 resolve되지 않음. co-dev 동작에 직접 영향은 없지만 filesystem 도구가 일부 경로에서 오류 날 수 있음.

---

### 문제 4: 동시 쓰기 레이스 컨디션 (잠재적)

Developer + Evaluator 세션이 동시에 `codev_save_checkpoint`를 호출하면 `nextCheckpointIndex()`가 같은 인덱스를 반환할 수 있음. 현재 storage.ts는 동시성 보호가 없음.
- 실제로 두 세션이 완전히 동시에 쓰는 경우는 드물지만 주의 필요

---

## 📋 권장 조치 요약

| 우선순위 | 항목 | 위치 |
|---------|------|------|
| 높음 | 역할 프롬프트에 MCP 도구 사용 지시 추가 | `ROLE-GUIDE.md` 또는 `codev.defaultRoles` |
| 높음 | session_id 명명 규칙 정의 및 프롬프트에 포함 | 역할 프롬프트 |
| 낮음 | Filesystem MCP의 `/Users/YeomYuJun/Desktop` 경로 수정 | `claude_desktop_config.json` |
| 낮음 | checkpoint 저장 시 파일 락(lock) 메커니즘 추가 고려 | `src/storage.ts` |

---

## 핵심 결론

Extension ↔ MCP 서버 ↔ Claude Code 간 **기술적 연결은 정상**입니다. 다만 역할 프롬프트가 MCP 도구 사용을 안내하지 않아서, 현 상태로는 Extension을 통해 세션을 열어도 MCP checkpointing이 실제로 활용되지 않습니다. 역할 프롬프트 수정이 최우선 과제입니다.
