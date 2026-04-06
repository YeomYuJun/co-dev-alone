# GUI 세션 패널 아이데이션 — co-dev-alone 개선 방향

> 작성일: 2026-04-06
> 목적: claude-code-leaked-src 분석을 통해 도출한 co-dev-alone의 GUI 세션 패널 구현 방향 정리
> 최종 업데이트: 2026-04-06 (Phase 1–3 + control_request 구현 완료)

---

## 현재 구현 상태 (2026-04-06 기준)

| Phase | 항목 | 상태 |
|-------|------|------|
| Phase 1 | DirectConnect 서버 (HTTP+WS) | ✅ 완료 |
| Phase 1 | `--sdk-url` spawn, 쉘 이스케이프 제거 | ✅ 완료 |
| Phase 1 | 상태바 아이템 + EventEmitter 단일화 | ✅ 완료 |
| Phase 2 | WebView 세션 패널 (카드 + 피드) | ✅ 완료 |
| Phase 2 | postMessage 부분 갱신 (card-add/card-status) | ✅ 완료 |
| Phase 2 | session_id 충돌 방지 (-2, -3 suffix) | ✅ 완료 |
| Phase 3 | Developer done → Evaluator 자동 스폰 | ✅ 완료 |
| Phase 3 | `control_request` 모달 팝업 (Allow/Deny/ESC) | ✅ 완료 |
| Quick Win | ROLE-GUIDE.md MCP 호출 명시 + eval 체크포인트 조회 | ✅ 완료 |
| Quick Win | session_id 자동 생성 및 프롬프트 주입 | ✅ 완료 |
| Phase 4 | xterm.js 인라인 터미널 | ⏸ 보류 (현 구조에서 효과 제한적) |

### 핵심 구현 파일

| 파일 | 역할 |
|------|------|
| `vscode-for-co-dev-launcher/src/directConnectServer.ts` | HTTP+WS 서버, 세션 관리, EventEmitter 이벤트, control_request 처리 |
| `vscode-for-co-dev-launcher/src/sessionLauncher.ts` | `spawn()` + `--sdk-url` 기반 claude 스폰 |
| `vscode-for-co-dev-launcher/src/sessionPanel.ts` | WebView 패널 — 세션 카드, 피드, 메시지 입력, 권한 팝업 |
| `vscode-for-co-dev-launcher/src/extension.ts` | 서버 lifecycle, 상태바, Phase 3 자동 스폰 |
| `co-dev/ROLE-GUIDE.md` | Developer/Evaluator 세션 프로토콜 (eval 체크포인트 조회 포함) |

### Open Issues

- `--sdk-url` / `--replay-user-messages` 는 `hideHelp()` 내부 플래그 — CLI 버전 업 시 호환성 모니터링 필요
- control_request 실제 포맷은 실제 세션에서 검증 필요 (raw 파싱으로 대응)
- Evaluator 자동 스폰 후 MCP context 전달 흐름 E2E 검증 미완료

---

## 1. 현재 프로젝트 구조 요약

### MCP Server (`D:\co-dev-alone\src\`)

| 파일 | 역할 |
|------|------|
| `index.ts` | 엔트리포인트 (stdio 기반 MCP 서버) |
| `types.ts` | SessionContext, Checkpoint, Role 타입 |
| `constants.ts` | DATA_DIR, ROLES, 키워드 상수 |
| `storage.ts` | 파일 기반 JSON 저장소 |
| `tools/context.ts` | codev_save_context, codev_get_context, codev_list_sessions |
| `tools/checkpoint.ts` | codev_save/read/list_checkpoint |
| `tools/role.ts` | codev_detect_role |

**저장소 구조**: `~/.co-dev/sessions/`, `~/.co-dev/checkpoints/`

### VS Code Extension (`vscode-for-co-dev-launcher/`)

| 파일 | 역할 |
|------|------|
| `extension.ts` | 커맨드 등록, 서버 lifecycle, Phase 3 자동 스폰 |
| `directConnectServer.ts` | HTTP+WS 서버, EventEmitter 이벤트, control_request |
| `sessionLauncher.ts` | spawn() + --sdk-url 기반 세션 시작 |
| `sessionPanel.ts` | WebView 패널 (카드, 피드, 모달) |
| `roleParser.ts` | ROLE-GUIDE.md `##` 헤더 기반 역할 파싱 |
| `config.ts` | settings.json fallback 설정 읽기 |

**현재 동작**: 커맨드 실행 → DirectConnect 서버에 세션 등록 → spawn(claude, [--sdk-url, ...]) → WS 연결 → WebView 패널 실시간 표시

---

## 2. claude-code-leaked-src에서 발견한 핵심 구조

### IDE 통합 4개 레이어

```
1. DirectConnect (로컬, 가장 빠름)
   IDE Extension → HTTP POST /sessions → session_id + ws_url 획득
                → WebSocket → JSON-RPC 메시지 양방향 교환

2. IDE 감지 레이어 (src/utils/ide.ts)
   VS Code / Cursor / Windsurf / 10+ JetBrains IDEs
   localhost:{port} HTTP + Bearer 토큰

3. Web/Terminal (브라우저 기반)
   xterm.js + WebSocket PTY
   src/server/web/ — session-manager, terminal, pty-server

4. Bridge (원격/멀티세션)
   환경 등록 → Work polling → 자식 프로세스 스폰
   src/bridge/ — bridgeMain, sessionRunner, bridgeApi
```

### --sdk-url 플래그 (hideHelp 내부 플래그, 실제 동작 확인)

```typescript
// main.tsx:3861
program.addOption(
  new Option('--sdk-url <url>', '...').hideHelp()
)
// --sdk-url 있으면 자동으로 비인터랙티브 + stream-json 모드
// --session-id UUID 검증 스킵 (project-dev-YYYYMMDD 형식 허용)
```

```typescript
// sessionRunner.ts에서 실제 사용 패턴
const args = [
  '--print',
  '--sdk-url', opts.sdkUrl,
  '--session-id', opts.sessionId,
  '--input-format', 'stream-json',
  '--output-format', 'stream-json',
  '--replay-user-messages',
]
```

---

## 3. 현재 문제점 vs 개선 방향

| 현재 문제 | 현황 | 개선 방향 |
|-----------|------|-----------|
| 세션 시작이 단순 CLI 실행 | ~~`claude --append-system-prompt`~~ | ✅ DirectConnect: spawn + --sdk-url |
| 세션 상태 가시성 없음 | ~~터미널 텍스트만~~ | ✅ WebView 세션 패널 + 실시간 상태 |
| GUI 없음 | ~~QuickPick만~~ | ✅ WebView 세션 카드 + 피드 |
| 세션 간 통신 불편 | MCP 도구 수동 호출 | ✅ Developer done → Evaluator 자동 스폰 |
| 권한 요청 처리 불가 | ~~터미널 Y/N 입력~~ | ✅ control_request/response → 모달 팝업 |
| 역할 프롬프트 ↔ MCP 단절 | ~~프롬프트가 MCP 사용 지시 안 함~~ | ✅ ROLE-GUIDE.md에 MCP 호출 명시 |
| session_id 관리 미정의 | ~~Extension이 생성/전달 안 함~~ | ✅ 명명 규칙 정의 + 프롬프트 주입 + 충돌 방지 |
| eval 세션 피드백 미수신 | Developer가 eval 체크포인트 미조회 | ✅ ROLE-GUIDE.md step 3 추가 |

---

## 4. 현재 아키텍처

```
VSCode Extension
├── [A] WebView Panel (sessionPanel.ts)
│   ├── 세션 카드: roleName, status badge, started time
│   ├── 실시간 피드: text / tool / status / error (200개 링버퍼)
│   ├── 메시지 입력창 → sendToSession → WS → claude
│   └── Permission 모달: control_request → Allow/Deny/ESC
│
├── [B] DirectConnectServer (directConnectServer.ts)
│   ├── HTTP 업그레이드 핸들러
│   ├── WS /sessions/{id} → claude 연결
│   ├── EventEmitter: session:created / session:status / session:message / session:control-request
│   └── respondToControl(sessionId, requestId, decision)
│
├── [C] SessionLauncher (sessionLauncher.ts)
│   └── spawn(claude, ['--print', '--sdk-url', wsUrl, '--session-id', id, ...])
│
└── [D] MCP Server (src/ — 변경 없음)
    └── ~/.co-dev/sessions/, ~/.co-dev/checkpoints/ 관리
```

---

## 5. 단계별 구현 로드맵

### Phase 1 — DirectConnect 서버 구축 ✅ 완료

- HTTP+WebSocket 서버 (포트 자동 할당)
- `spawn(claude, ['--print', '--sdk-url', wsUrl, ...])` — 쉘 이스케이프 불필요
- session_id: `{project}-{dev|eval}-{YYYYMMDD}`, 충돌 시 `-2`, `-3` suffix

### Phase 2 — WebView 세션 패널 ✅ 완료

- `vscode.window.createWebviewPanel` — `retainContextWhenHidden: true`
- 초기 렌더 1회 → 이후 postMessage로 부분 갱신 (card-add / card-status / feed-update)
- `ready` 메시지로 패널 재열기 시 피드 복원

### Phase 3 — 멀티 세션 자동 관리 ✅ 완료

- Developer `session:status = done` → Evaluator 자동 스폰 (중복 방지)
- `control_request` 수신 → WebView 모달 팝업 → `control_response` 전송

### Phase 4 — xterm.js 인라인 터미널 ⏸ 보류

> **현재 구조에서 추가 효과 없음**
> - `--sdk-url` 방식에서 claude는 WS 통신, PTY 없음
> - WebView 피드가 이미 출력을 담당
> - `node-pty` 네이티브 모듈 빌드 복잡도만 증가
> - 재검토 조건: shell 터미널이 별도로 필요해지는 경우

---

## 6. 기술 스택

| 요소 | 목적 | 상태 |
|------|------|------|
| `ws` | WebSocket 서버 | ✅ 사용 중 |
| Node.js `http` + `events` | HTTP 서버 + EventEmitter | ✅ 사용 중 |
| VSCode WebviewPanel API | GUI 패널 | ✅ 사용 중 |
| `node:child_process` spawn | claude 프로세스 스폰 | ✅ 사용 중 |
| `express` | (불필요 — http 직접 사용) | ❌ 미사용 |
| React + esbuild | (불필요 — vanilla JS로 충분) | ❌ 미사용 |
| `xterm.js` + `node-pty` | PTY 터미널 | ⏸ 보류 |

---

## 참조 소스 경로

```
D:\claude-code-src\claude-code-leaked-src\src\
├── server/
│   ├── directConnectManager.ts      ← Phase 1 핵심 참조
│   ├── createDirectConnectSession.ts
│   └── web/
│       ├── terminal.ts              ← xterm.js (Phase 4 보류)
│       └── pty-server.ts
├── hooks/
│   └── useDirectConnect.ts          ← WebView Hook 패턴 참조
├── bridge/
│   └── sessionRunner.ts             ← --sdk-url 스폰 패턴 참조
└── utils/
    └── ide.ts                       ← IDE 감지/연결 참조
```
