# CO-DEV-GUIDE — Claude + Developer MCP Development Convention
> Version: 0.1.0  
> 운용: 프로젝트 폴더에 두고 세션 시작 시 수동 주입  
> 목적: Claude와 함께 MCP 서버를 개발할 때의 공통 약속

---

## 1. SESSION CONTRACT (세션 약속)

### 1.1 세션 시작 시 필수 제공 항목

```
[CONTEXT]
project: <프로젝트명>
stack: <언어/런타임, 예: TypeScript / Node 20>
phase: <현재 단계, 예: Phase 2 - Tool Implementation>
completed: <완료된 것 요약>
current_goal: <이번 세션 목표 1~3개>
constraints: <지켜야 할 제약 사항>
```

> Claude는 이 블록이 없으면 작업 시작 전 반드시 요청해야 한다.

### 1.2 세션 종료 시 Claude 출력 형식

세션 종료 요청(`/checkpoint`) 시 Claude는 아래 형식으로 요약한다:

```
[CHECKPOINT]
completed:
  - <완료 항목>
pending:
  - <미완료 항목>
next_session_goal:
  - <다음 세션 권장 목표>
open_issues:
  - <미해결 이슈 또는 결정 필요 사항>
```

---

## 2. DEVELOPMENT RULES (공통 개발 규칙)

### 2.1 코드 생성 원칙

- 코드는 항상 **컴파일/실행 가능한 완전한 형태**로 제공한다.
- 생략(`// ... existing code`) 없이 전체 파일을 작성한다. 단, 파일이 200줄 초과 시 섹션 단위로 분할하여 순서대로 제공한다.
- 네이밍은 **MCP 표준 컨벤션**을 따른다: `{server}_{action}_{resource}` 형식.

### 2.2 변경 전 확인 의무

아래 사항은 Claude가 임의로 결정하지 않고 반드시 질문한다:
- 기존 파일 구조 변경
- 외부 라이브러리 추가
- API 설계(tool name, schema) 변경
- 에러 처리 전략 변경

### 2.3 작업 단위

- 한 세션 = 한 수직 슬라이스 (예: 단일 tool 구현 + 타입 정의 + 에러 처리)
- 범위가 명확하지 않으면 Claude가 먼저 작업 범위를 제안하고 확인받는다.

---

## 3. MCP-SPECIFIC RULES (MCP 개발 전용 규칙)

### 3.1 Tool 설계 원칙

| 항목 | 규칙 |
|------|------|
| Tool 이름 | `{verb}_{noun}` snake_case, 동사 우선 |
| Description | 1~2줄, LLM이 언제 쓸지 명확히 |
| Input Schema | Zod(TS) / Pydantic(Python) 필수 |
| Output | 구조화된 JSON + 사람이 읽을 수 있는 text 병행 |
| Annotation | `readOnlyHint`, `destructiveHint` 항상 명시 |

### 3.2 에러 메시지 원칙

```typescript
// ❌ Bad
throw new Error("Failed");

// ✅ Good
throw new McpError(
  ErrorCode.InvalidRequest,
  `Tool 'get_user' failed: userId '${id}' not found. Check valid IDs with 'list_users'.`
);
```

> 에러 메시지는 **다음 행동을 안내**해야 한다.

### 3.3 Transport 선택

| 환경 | Transport |
|------|-----------|
| 로컬 개발/테스트 | stdio |
| 원격/프로덕션 | Streamable HTTP (stateless JSON) |

### 3.4 Phase Gate (단계 전환 조건)

```
Phase 1 (Planning)   → Phase 2 조건: tool 목록과 schema 초안 확정
Phase 2 (Impl)       → Phase 3 조건: npm run build 성공, 기본 동작 확인
Phase 3 (Review)     → Phase 4 조건: DRY, 타입 커버리지, description 검토 완료
Phase 4 (Eval)       → Done 조건: 평가 질문 10개 + 답변 검증 완료
```

---

## 4. COMMUNICATION RULES (Claude ↔ Developer 소통 규칙)

### 4.1 Claude의 질문 방식

- 한 번에 **최대 2개**까지만 질문한다.
- 질문은 **선택지 형태**로 제공한다 (Yes/No 또는 A/B/C).
- 모호한 요구사항은 **가정을 명시**하고 진행한 후 확인받는다.

### 4.2 진행 상태 표기

Claude는 작업 중 아래 prefix를 사용한다:

| Prefix | 의미 |
|--------|------|
| `[PLAN]` | 작업 계획 제시 |
| `[IMPL]` | 구현 코드 제공 |
| `[ISSUE]` | 문제 발견, 확인 필요 |
| `[DONE]` | 해당 작업 완료 |
| `[QUESTION]` | 결정 필요 사항 |

### 4.3 리뷰 요청 형식

```
/review <파일명 또는 기능명>
```
→ Claude는 DRY, 타입 안전성, tool description 품질, 에러 처리 순서로 검토한다.

---

## 5. CO-DEV SPECIFIC (CO-DEV MCP 전용 규칙)

> CO-DEV: 다중 Claude 세션 간 개발/평가 역할을 분리하는 협업 MCP

### 5.1 세션 역할 정의

| 역할 | 책임 | 주입 지침 |
|------|------|-----------|
| Dev Session | 코드 생성, 구현 | 이 문서 전체 |
| Eval Session | 코드 검토, 품질 평가 | Section 3 + 4만 |

### 5.2 CO-DEV 자동 주입 목표 (향후)

MCP 완성 후 아래 흐름으로 자동화:
```
세션 시작 감지
  → 역할 판별 (Dev / Eval)
  → 해당 섹션만 context에 주입
  → /checkpoint 호출 시 자동 체크포인트 저장
```

### 5.3 CO-DEV 개발 시 우선 구현 순서

1. Session context injection tool
2. Checkpoint read/write tool
3. Role detection (Dev / Eval) tool
4. Cross-session state sync tool

---

## APPENDIX: 빠른 참조

```
세션 시작  → [CONTEXT] 블록 제공
작업 중    → /review <대상> 으로 중간 검토 요청
세션 종료  → /checkpoint 로 요약 생성
막힐 때    → [QUESTION] prefix 확인 후 답변
```
