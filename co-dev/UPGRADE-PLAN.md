# CO-DEV MCP 고도화 계획

## 배경

LLM이 co-dev 프로토콜을 능동적으로 따르지 않는 문제가 핵심.
도구 스펙 자체의 결함이 아니라, 인지 부하와 행동 유도 부재가 원인.

### 현재 흐름의 문제점

- 세션 종료 시 `mark_done`을 LLM이 스스로 호출하지 않음 → 사용자가 직접 지시해야 함
- `/checkpoint` plugin이 checkpoint 저장 + CHANGELOG + state.md + mark_done을 한꺼번에 수행 → 확정되지 않은 작업도 CHANGELOG에 기록됨
- tool 응답이 다음 행동을 유도하지 않음 → LLM이 프로토콜 중간에 멈춤

### 올바른 흐름

```
Dev 세션: 개발 → mark_done (inbox write만)
                    ↓
Eval 세션: check_inbox → 코드 리뷰 → mark_done (pass/fail + 피드백)
                    ↓
사용자: eval 피드백 확인 → 확정 판단
                    ↓
         [ALL PASS] → codev_finalize로 CHANGELOG, state.md 확정 기록
         [FAIL]    → Dev 세션 재시작 → check_inbox로 피드백 수신 → 수정
```

---

## P0 — 즉시

### 1. mark_done 경량화

inbox write만 수행. CHANGELOG/state.md 갱신 로직 제거.

- 변경 대상: `src/tools/inbox.ts`
- mark_done은 상대 역할의 inbox에 메시지를 쓰는 것만 담당
- CHANGELOG, state.md 갱신은 `codev_finalize`로 이관

### 2. InboxMessage에 action_required 필드 추가

- 변경 대상: `src/types.ts`, `src/tools/inbox.ts`
- `InboxMessage`에 `action_required: string` 필드 추가
- `mark_done` 호출 시 action_required를 필수 인자로 받음
- `check_inbox` 응답에 ACTION REQUIRED 섹션으로 표시

```typescript
interface InboxMessage {
  from: Role;
  session_id: string;
  summary: string;
  action_required: string;  // 신규
  written_at: string;
  read: boolean;
}
```

check_inbox 응답 예시:
```
[INBOX MESSAGE] From: developer | Session: proj-dev-20260415
Summary: analyze_dryrun.py 구현 완료.

⚠️ ACTION REQUIRED: 코드 리뷰 후 pass/fail 판정을 내리고 mark_done으로 결과를 전달하세요.
```

### 3. codev_finalize 신규 도구

- 변경 대상: 신규 파일 `src/tools/finalize.ts`, `src/index.ts`에 등록
- eval ALL PASS 확정 후에만 사용
- 수행 내용:
  - CHANGELOG.md append
  - dev-state.md / eval-state.md 갱신
  - TASK.md 해당 작업 완료 표시 (optional)

---

## P1 — 이후

### 4. /checkpoint plugin 경량화

- 변경 대상: `plugin/commands/checkpoint.md`
- checkpoint 저장 + 선택적 mark_done만 수행
- CHANGELOG, state.md 갱신 단계 제거 (finalize로 이관)
- checkpoint는 컨텍스트 비우고 새 세션에서 이어가기 위한 용도로만 사용

### 5. ROLE-GUIDE.md 세션 종료 의무 강화

- 변경 대상: `co-dev/ROLE-GUIDE.md`
- 문서 최상단에 "작업 완료 시 반드시 mark_done 호출" 명시
- Developer, Evaluator 양쪽 섹션 모두에 동일 적용

---

## P2 — 여유 시

### 6. codev_start_session 복합 도구

- 신규 도구: `codev_start_session(role)`
- 내부에서 check_inbox + get_context + read_checkpoint를 순차 실행
- 1-call로 세션 시작에 필요한 모든 정보 반환
- 기존 세부 도구는 그대로 유지 (고급 용도, 디버깅용)

---

## P0-A — Role 망각 문제 (실제 장애 사례 기반)

### 발생 사례

Claude Desktop plugin 환경, Developer 세션 진행 중:

```
[상황] Developer 세션에서 개발 완료 후, 별도 Evaluator 세션에서 코드 리뷰를 마침.
       Evaluator가 Developer inbox에 리뷰 결과를 남김.

사용자: "평가 세션의 inbox체크 후 진행해줘"

LLM 행동:
  1. check_inbox('evaluator') 호출 ← 자기 inbox(developer)가 아닌 evaluator inbox 확인
  2. 비어있으니 직접 Evaluator 역할 수행 시작
  3. session_id는 dev-20260415인데 Role을 Evaluator로 표기

사용자: "아니 inbox 남겼다는데 어딜 확인한거야. 그리고 너 개발세션이야 정신차려"

LLM 행동:
  1. 사과 후 하위 에이전트(Evaluator)를 직접 스폰하려고 시도
  2. inbox를 읽으라는 명령을 여전히 이해하지 못함

사용자: "다른 세션에서 이미 코드리뷰를 했다고. inbox에 메시지를 남겼으니 읽으라고"

LLM: "아, Developer inbox 확인하겠습니다"
```

### 원인 분석

1. **`check_inbox(role)` 파라미터 혼동**: `role`이 "내 역할"인데 LLM이 "확인할 대상"으로 오해. "평가 세션" 언급에 이끌려 evaluator inbox를 확인함.

2. **대화 길어지면 역할 망각**: 세션 초반에 `/start dev`로 Developer 역할이 설정되지만, 대화가 길어지면 LLM이 자기 역할을 잊음. 사용자가 "평가", "evaluator" 등을 언급하면 역할이 오염됨.

3. **tool 응답에 역할 리마인더 없음**: check_inbox, mark_done 등의 응답이 현재 역할을 상기시키지 않아서, 호출할수록 역할 인식이 강화되는 구조가 아님.

### 개선안

#### A. 모든 co-dev tool 응답에 역할 리마인더 삽입

현재:
```
[INBOX EMPTY] No pending messages for 'evaluator'.
```

개선:
```
[YOUR ROLE: Developer] Checked YOUR inbox (developer).
No pending messages.
```

모든 tool 응답 첫 줄에 `[YOUR ROLE: {role}]`을 포함. LLM이 tool을 쓸 때마다 자기 역할을 재확인하게 됨.

#### B. check_inbox 파라미터 의미 명확화

현재:
```
role: "Session role: 'developer' or 'evaluator'"
```

개선 — description을 명시적으로:
```
role: "YOUR current role. Developer checks developer inbox, Evaluator checks evaluator inbox. Do NOT check the other role's inbox."
```

#### C. 잘못된 역할 사용 감지 (P2 연계)

`codev_start_session(role)`이 구현되면, MCP 서버가 현재 세션의 역할을 `.data/active-session.json`에 기록 가능.
이후 다른 tool 호출 시 role 파라미터가 시작 시 역할과 불일치하면 경고 응답:

```
⚠️ ROLE MISMATCH: This session was started as 'developer' but you called check_inbox('evaluator').
Did you mean check_inbox('developer')?
```

단, MCP 서버는 단일 프로세스로 여러 세션을 서빙하므로 (Claude Desktop), active-session 파일이 덮어써질 수 있음.
대안: role을 모든 tool의 필수 파라미터로 유지하되, session_id에서 역할을 추출하여 cross-check.
(session_id 형식이 `{project}-{role}-{date}`이므로 `-dev-` 또는 `-eval-`로 역할 판별 가능)

#### D. session_id 기반 role 검증 (구조적 접근 — 1안)

모든 co-dev tool에서 session_id와 role 파라미터의 정합성을 검증.
session_id 네이밍 컨벤션(`-dev-`, `-eval-`)에서 역할을 추출하여 불일치 시 tool이 ERROR를 반환.

```typescript
function extractRoleFromSessionId(session_id: string): Role | null {
  if (session_id.includes("-dev-")) return "developer";
  if (session_id.includes("-eval-")) return "evaluator";
  return null;
}

function validateRole(session_id: string, claimed_role: Role): string | null {
  const expected = extractRoleFromSessionId(session_id);
  if (expected && expected !== claimed_role) {
    return `Role mismatch: session '${session_id}' is ${expected}, but '${claimed_role}' was passed.`;
  }
  return null;
}
```

- LLM이 잘못된 role로 tool 호출 시 실패 반환 → 텍스트 리마인더와 달리 무시 불가
- prompt 엔지니어링 의존 제거, 모델 변경에도 견고
- 전제: session_id에 `-dev-` / `-eval-` 포함하는 네이밍 컨벤션 유지 필요
- 한계: tool 호출 없이 LLM이 직접 역할을 수행하는 경우는 MCP로 막을 수 없음 (prompt 레벨 보완 필요)

#### E. ROLE-GUIDE.md에 역할 고정 문구 강화

Developer/Evaluator 섹션 최상단에:
```
⚠️ CRITICAL: You are a DEVELOPER session. 
- NEVER perform evaluation, code review, or quality assessment.
- NEVER check the evaluator's inbox. Only check YOUR inbox: check_inbox('developer').
- If the user mentions "evaluator" or "평가", they are referring to a SEPARATE session, not you.
```

#### F. Hook 기반 매 턴 Role 주입 (Plugin 전용 — 2안)

> **적용 범위: Claude Desktop (Plugin) 전용.**
> VSCode Extension은 Ctrl+Shift+P로 system prompt를 직접 주입하므로 이 문제가 없음.

Claude Code의 hook 시스템을 활용하여 매 사용자 턴마다 role을 `<system-reminder>`로 자동 주입.

**근거 (Claude Code 소스 분석):**
- 모든 hook의 stdin에 `session_id`가 포함됨 (`BaseHookInputSchema.session_id`)
  → 같은 프로젝트에서 dev/eval 두 대화창이 동시에 열려 있어도 각각 구분 가능
- `UserPromptSubmit` hook의 `additionalContext`는 `<system-reminder>` 태그로 감싸져 매 턴 주입됨
  → 대화가 길어져도 role 정보가 희석되지 않음

**흐름:**

```
1. /start dev 실행 시 (SessionStart hook):
   - stdin으로 { session_id: "claude-abc123", ... } 수신
   - co-dev/.data/role-bindings/claude-abc123.json 생성:
     { "role": "developer", "codev_session_id": "proj-dev-20260415" }

2. 이후 매 사용자 메시지 (UserPromptSubmit hook):
   - stdin으로 { session_id: "claude-abc123", prompt: "..." } 수신
   - role-bindings/claude-abc123.json 조회
   - stdout에 JSON 출력:
     {
       "hookSpecificOutput": {
         "hookEventName": "UserPromptSubmit",
         "additionalContext": "You are a DEVELOPER session (proj-dev-20260415). Only check YOUR inbox: check_inbox('developer'). Do NOT perform evaluation."
       }
     }
   - Claude Code가 <system-reminder>로 감싸서 대화에 주입

3. 다른 대화창에서 /start eval:
   - 별도 claude session_id → 별도 role-bindings 파일 → 별도 role 유지
   - 파일 충돌 없음
```

**장점:**
- MCP 서버 변경 없이 settings.json hook 설정 + 경량 스크립트로 구현
- 매 턴 반복 주입되므로 대화 길이와 무관하게 role 유지
- Claude Code의 session_id로 대화창 간 격리 보장

**한계:**
- hook 스크립트 실행 오버헤드 (매 턴 파일 I/O 1회, ~수ms)
- Claude Desktop에서 hooks 지원 여부 확인 필요 (Claude Code CLI에서는 확실)

**구현 위치:**
- `plugin/hooks/role-reminder.sh` (또는 `.js`) — hook 스크립트
- `plugin/commands/start.md` — SessionStart 시 role-bindings 파일 생성 로직 추가
- `.claude/settings.json` — hook 등록

---

## 보류 (현재 문제 아님)

- inbox ring buffer (단일 슬롯 → 큐): 실제 유실 문제 발생 시 재검토
- send_message 분리: SSE 없이 중간 메시지의 실용성 낮음
- session_id 관리 변경: 현재 /start의 basename 파생 방식으로 충분
