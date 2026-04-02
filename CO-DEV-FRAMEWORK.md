# Co-Dev Framework
**Multi-Session AI Collaboration Guide — v0.3.0**

> Developer Session / Evaluator Session으로 분리된 AI 에이전트 협업 구조의
> 설계 원칙, 파일 포맷, 운영 프로토콜을 정의한다.

---

## 1. 개요

단일 AI 세션은 컨텍스트 오염, 역할 혼재, 지시 충돌 문제가 있다.
세션을 역할별로 분리하고, **Flat Structured Markdown 기반 filesystem 비동기 통신**으로 세션 간 정보를 교환한다.

```
┌──────────────────────┐     co-dev/communication/     ┌───────────────────────┐
│   Developer (A)      │ ────────────────────────────▶ │   Evaluator  (B)      │
│                      │ ◀──────────────────────────── │                       │
│  · TASK.md 기반 구현  │                               │  · TASK 기준 평가     │
│  · CHANGELOG 기록    │                               │  · trend 분석         │
│  · dev-state 갱신    │                               │  · eval-state 갱신    │
└──────────────────────┘                               └───────────────────────┘
            ▲                                                       ▲
            └──────────────────── 사용자 (중재자) ──────────────────┘
```

**포맷 선택: Flat Structured Markdown**
- Agent가 파싱 없이 section 단위로 직접 읽을 수 있음
- git diff가 자연스럽게 붙어 사람도 추적 가능
- 고정 헤더 계층 (`##`, `###`) 으로 section 위치를 예측 가능하게 유지

---

## 2. 디렉토리 구조

```
/project/
├── README.md                        # 프로젝트 스펙, 방향, 제약, 성공 기준 (불변 기준선)
└── co-dev/
    ├── COLLABO.md                   # 협업 구조 원칙 (이 문서)
    ├── ROLE-GUIDE.md                # 각 세션 system prompt 베이스
    ├── TASK.md                      # 전체 작업 목록 + 평가 기준 연결
    ├── EVAL-CRITERIA.md             # 평가 기준 버전 관리
    ├── DECISIONS.md                 # 아키텍처/핵심 결정 역인덱스 (태스크 15개+ 도입 권장)
    └── communication/
        ├── CHANGELOG.md             # 누적 변경 이력 (append-only)
        ├── eval-history.md          # 누적 평가 이력 (append-only)
        ├── ISSUES.md                # Blocked 상태 및 이슈 추적
        ├── dev-state.md             # Developer 현재 상태 스냅샷 (overwrite)
        ├── eval-state.md            # Evaluator 최신 평가 스냅샷 (overwrite)
        └── sessions/
            ├── dev/                 # Developer 세션별 상세 로그 + Handoff Note
            │   └── YYYY-MM-DD_HH-MM-SS.md
            └── eval/                # Evaluator 세션별 상세 평가 리포트 + Handoff Note
                └── YYYY-MM-DD_HH-MM-SS.md
```

**파일 읽기/쓰기 정책 요약**

| 파일 | 쓰기 방식 | 주체 |
|------|----------|------|
| CHANGELOG.md | append-only | Developer |
| eval-history.md | append-only | Evaluator |
| ISSUES.md | append-only (상태 갱신은 새 항목으로) | 양측 + 사용자 |
| DECISIONS.md | append-only | Developer (사용자 승인 후) |
| dev-state.md | overwrite | Developer |
| eval-state.md | overwrite | Evaluator |
| sessions/dev/*.md | 신규 생성 | Developer |
| sessions/eval/*.md | 신규 생성 | Evaluator |

---

## 3. 파일 포맷 정의

### 3.1 `/project/README.md` — 프로젝트 기준선

세션이 바뀌어도 이 파일은 변하지 않는다. 모든 세션이 최초 읽는 파일.

```markdown
# Project: <name>

## Goal
한 문장으로 이 프로젝트가 무엇을 달성하는지.

## Tech Stack
- Language / Framework
- Database
- Infrastructure

## Scope
### In Scope
- ...
### Out of Scope
- ...

## Key Constraints
- 성능, 보안, 호환성 등 절대 넘으면 안 되는 제약

## Success Criteria
- 최종적으로 이 기준을 충족하면 완료
```

---

### 3.2 `co-dev/TASK.md` — 작업 목록 + 평가 기준 연결

**이 파일이 전체 구조의 핵심이다.**
Developer는 구현 대상과 평가 기준을 한 곳에서 확인하고,
Evaluator는 동일한 기준으로 평가한다.
초기 기획 단계에서 사용자 ↔ Claude 대화로 함께 작성하며, 최대한 정밀하게 만든다.

```markdown
# TASK LIST

## TASK-001: <task name>

### Description
구현해야 할 내용 설명.

### Acceptance Criteria
- [ ] 조건 1
- [ ] 조건 2
- [ ] 조건 3

### Eval Criteria
- 연결된 EVAL-CRITERIA.md 항목: v0.1 > 항목 2번
- 추가 평가 포인트: ...

### Status
`TODO` | `IN_PROGRESS` | `DONE` | `BLOCKED`

### Dev Session
dev/YYYY-MM-DD_HH-MM-SS (작업 시작 시 기입)

### Eval Session
eval/YYYY-MM-DD_HH-MM-SS → `PASS` | `PARTIAL` | `FAIL`

---

## TASK-002: <task name>
...
```

> **운영 원칙**:
> - Status는 Developer가 갱신, Eval Session + 결과는 Evaluator가 갱신
> - Acceptance Criteria 변경은 사용자 승인 필요 (scope 변경이기 때문)

---

### 3.3 `co-dev/EVAL-CRITERIA.md` — 평가 기준 버전 관리

```markdown
# Evaluation Criteria

## v0.1 (YYYY-MM-DD ~)

### 기능성
- 모든 Acceptance Criteria 충족 여부

### 테스트
- 핵심 로직 단위 테스트 존재 여부

### Scope Drift
- README.md의 Out of Scope 항목이 구현에 포함되어 있지 않은지

---

## v0.2 (YYYY-MM-DD ~)

v0.1 항목 유지 +

### 성능
- API latency < 200ms (p95)

### 보안
- OWASP Top 10 기준 고위험 항목 없음
```

---

### 3.4 `co-dev/DECISIONS.md` — 아키텍처 결정 역인덱스

태스크 15개 이상이거나 장기 프로젝트에서 도입 권장.
CHANGELOG의 Decision Log가 흩어질 때 핵심 결정만 모아두는 인덱스.

```markdown
# Architecture Decisions

## DECISION-001: Redis 캐싱 선택 (YYYY-MM-DD)

**Context**: RefreshToken 저장 방식 선택
**Decision**: Redis 캐싱
**Alternatives Considered**: DB 저장 (감사 이력 필요 시 전환 가능)
**Rationale**: 만료 처리 속도 + 수평 확장 고려
**Status**: `ACTIVE` | `SUPERSEDED` | `DEPRECATED`
**Ref**: CHANGELOG > YYYY-MM-DD HH:MM:SS

---

## DECISION-002: ...
```

---

### 3.5 `co-dev/communication/CHANGELOG.md` — 변경 추적

**append-only**. 절대 기존 항목 수정 금지.
Developer Session이 작업 완료 시 반드시 기록한다.

````markdown
# CHANGELOG

---

## [YYYY-MM-DD HH:MM:SS] DEV | <one-line summary>

**Session**: `dev/YYYY-MM-DD_HH-MM-SS`
**Related Task**: TASK-001

### Changed Files
| File | 변경 내용 |
|------|----------|
| `src/.../Foo.java` | JWT 만료 처리 로직 추가 |
| `src/.../BarTest.java` | 만료 케이스 단위 테스트 추가 |

### Diff Summary
```diff
+ TokenValidator.isExpired() 메서드 추가
+ RefreshTokenService 클래스 신규 생성
- 기존 StaticTokenChecker 제거
```

### Decision Log
RefreshToken을 DB 저장 방식 대신 Redis 캐싱 선택.
이유: 만료 처리 속도와 수평 확장 고려.
대안: DB 저장 (감사 이력 필요 시 전환 가능)
→ DECISIONS.md에 DECISION-001로 등록

### Known Issues / TODOs
- RefreshToken rotation 정책 미구현 (TASK-003에서 다룰 예정)

### Requires Eval
`YES`

---
````

---

### 3.6 `co-dev/communication/eval-history.md` — 누적 평가 이력

**append-only**. eval-state.md가 최신 상태 빠른 확인용이라면,
이 파일은 trend 분석 및 장기 추적용이다.

```markdown
# Evaluation History

---

## [YYYY-MM-DD HH:MM:SS] EVAL | <one-line verdict>

**Session**: `eval/YYYY-MM-DD_HH-MM-SS`
**Evaluated Dev State**: `dev/YYYY-MM-DD_HH-MM-SS`
**Criteria Version**: v0.1
**Verdict**: `PASS` | `PARTIAL` | `FAIL`
**Trend**: `IMPROVING` | `STAGNANT` | `REGRESSING`

### Scores
| 항목 | 점수 | 비고 |
|------|------|------|
| 기능성 | 4/5 | ... |
| 테스트 | 3/5 | ... |
| Scope Drift | CLEAN | ... |

### Key Findings
- ...

### Recommendations (→ Developer)
- ...

---
```

---

### 3.7 `co-dev/communication/ISSUES.md` — Blocked 상태 및 이슈 추적

Developer나 Evaluator가 진행 불가 상황 발생 시 기록.
사용자에게 명시적으로 전달되는 채널.

```markdown
# Issues

---

## ISSUE-001 [OPEN] YYYY-MM-DD HH:MM:SS

**Reporter**: Developer Session
**Related Task**: TASK-003
**Description**: Redis 연결 설정 정보가 README에 없어 구현 불가
**Waiting For**: 사용자 확인

---

## ISSUE-001 [RESOLVED] YYYY-MM-DD HH:MM:SS

**Resolution**: co-dev/communication/INFRA.md 추가로 해결
**Resolved By**: 사용자

---
```

> 동일 ISSUE 번호로 `[OPEN]` → `[RESOLVED]` 항목을 이어서 append.
> 절대 기존 항목을 수정하지 않는다.

---

### 3.8 `co-dev/communication/dev-state.md` — Developer 상태 스냅샷

Developer Session이 작업 완료 시 **overwrite**.

```markdown
# Developer State

## Meta
- **Timestamp**: YYYY-MM-DD HH:MM:SS
- **Session**: dev/YYYY-MM-DD_HH-MM-SS
- **Last Applied Eval**: eval/YYYY-MM-DD_HH-MM-SS

## Current Task
TASK-001 — JWT 인증 구현 (IN_PROGRESS)

## Completed Since Last Eval
- TokenValidator, RefreshTokenService 구현 완료
- 단위 테스트 3건 추가

## Blocked On
없음 (있으면 ISSUES.md 참조)

## File Hashes
| File | Hash |
|------|------|
| `src/.../TokenValidator.java` | `a1b2c3d4` |
| `src/.../RefreshTokenService.java` | `e5f6a7b8` |
| `src/.../BarTest.java` | `c9d0e1f2` |

## Notes for Evaluator
RefreshToken rotation은 TASK-003. 현재 평가는 기본 발급/검증/만료 흐름만 요청.
```

---

### 3.9 `co-dev/communication/eval-state.md` — Evaluator 최신 평가 스냅샷

Evaluator Session이 평가 완료 시 **overwrite**.

```markdown
# Evaluator State

## Meta
- **Timestamp**: YYYY-MM-DD HH:MM:SS
- **Session**: eval/YYYY-MM-DD_HH-MM-SS
- **Evaluated Dev State**: dev/YYYY-MM-DD_HH-MM-SS
- **Criteria Version**: v0.1
- **Previous Eval**: eval/YYYY-MM-DD_HH-MM-SS

## Verdict
`PASS` | `PARTIAL` | `FAIL`

## Scores
| 항목 | 점수 | 비고 |
|------|------|------|
| 기능성 | 4/5 | 만료 처리 OK, rotation 미구현 |
| 테스트 | 3/5 | 정상 케이스만, edge case 부족 |
| Scope Drift | CLEAN | 이탈 없음 |

## Critical Issues
없음

## Recommendations
- RefreshToken 탈취 시나리오 테스트 케이스 추가 필요
- TokenValidator clock skew 처리 고려

## Trend
`IMPROVING`
이전 대비: 테스트 커버리지 +2건, Decision Log 품질 개선됨

## Notes for Developer
edge case 테스트가 다음 평가의 주요 관찰 포인트.
```

---

### 3.10 `co-dev/sessions/dev/YYYY-MM-DD_HH-MM-SS.md` — 세션 로그 + Handoff Note

```markdown
# Developer Session Log

- **Date**: YYYY-MM-DD HH:MM:SS
- **Tasks**: TASK-001

## Work Summary
이번 세션에서 수행한 작업 상세.

## Handoff Note

### Completed This Session
- TokenValidator 구현 완료
- 단위 테스트 3건 추가

### In Progress (중단 지점)
- `RefreshTokenService.java` line 83까지 작성, rotate() 로직 미완성

### Next Session Should Start With
- TASK-001 이어서, rotate() 완성 후 integration test 작성

### Context That Won't Be Obvious From Files
- Spring Security filter chain 순서 때문에 TokenValidator를 AuthFilter보다 먼저 등록해야 함
  (현재 코드에 주석 없음, 순서 바꾸면 NPE 발생)
- Redis TTL은 application.yml이 아닌 RedisConfig.java에서 하드코딩 중 (리팩토링 예정)
```

---

### 3.11 `co-dev/ROLE-GUIDE.md` — 세션 System Prompt 베이스

```markdown
# Role Guide

## Developer Session

### Primary Mission
TASK.md에 정의된 작업을 구현한다.

### 세션 시작 시 읽어야 할 파일 (순서 중요)
1. `README.md` — 프로젝트 전체 맥락
2. `co-dev/TASK.md` — 담당 태스크 + Acceptance Criteria
3. `co-dev/communication/eval-state.md` — 마지막 평가 피드백
4. `co-dev/communication/CHANGELOG.md` (최근 5건) — 이전 작업 흐름
5. `co-dev/communication/dev-state.md` — 내 이전 상태
6. `co-dev/communication/ISSUES.md` — 열린 이슈 확인
7. 이전 세션 Handoff Note (sessions/dev/ 최신 파일)

### Responsibilities
- TASK.md의 Acceptance Criteria 기준으로 구현
- 작업 완료 후 CHANGELOG.md append
- dev-state.md overwrite (file hashes 포함)
- Decision Log 기록 (왜 이 방법인지, 대안은 무엇인지)
- 중요한 아키텍처 결정은 DECISIONS.md에 등록
- 세션 종료 시 Handoff Note 작성

### 금지 사항
- 평가하지 않는다
- TASK.md Acceptance Criteria 임의 수정 금지
- eval-state.md, eval-history.md 수정 금지
- README.md의 Out of Scope 구현 금지 (Scope Drift)

### 작업 완료 체크리스트
- [ ] CHANGELOG.md append 완료
- [ ] dev-state.md overwrite 완료 (file hashes 포함)
- [ ] TASK.md Status 갱신 완료
- [ ] Blocked 상황 발생 시 ISSUES.md 기록
- [ ] `Requires Eval` 명시
- [ ] sessions/dev/ 에 Handoff Note 포함한 세션 로그 작성

---

## Evaluator Session

### Primary Mission
TASK.md + EVAL-CRITERIA.md 기준으로 현재 구현 상태를 평가하고,
개발 방향의 건전성을 판단한다.

### 세션 시작 시 읽어야 할 파일 (순서 중요)
1. `README.md` — 프로젝트 기준선
2. `co-dev/EVAL-CRITERIA.md` — 현재 적용 기준 버전
3. `co-dev/TASK.md` — 평가 대상 태스크 Acceptance Criteria
4. `co-dev/communication/eval-state.md` — 이전 평가 (비교 기준점)
5. `co-dev/communication/dev-state.md` — 변경 파일 목록 (file hashes)
6. `co-dev/communication/CHANGELOG.md` (마지막 eval 이후 항목만)
7. 변경된 파일 직접 읽기 (file hashes 기반 선택적 읽기)

### Responsibilities
- TASK별 Acceptance Criteria 달성 여부 판정
- 이전 평가 대비 trend 분석 (IMPROVING / STAGNANT / REGRESSING)
- Scope Drift 감지 (README.md 기준)
- eval-state.md overwrite
- eval-history.md append
- sessions/eval/ 에 상세 평가 리포트 + Handoff Note 기록

### 금지 사항
- 코드를 수정하지 않는다
- 구현 방법을 직접 지시하지 않는다 (방향 제시만)
- TASK.md Acceptance Criteria 임의 변경 금지

### 평가 완료 체크리스트
- [ ] eval-state.md overwrite 완료
- [ ] eval-history.md append 완료
- [ ] TASK.md 해당 태스크 Eval Session + 결과 기입
- [ ] sessions/eval/ 에 Handoff Note 포함한 평가 리포트 작성
```

---

## 4. 협업 플로우

```
[사용자 + Claude] 프로젝트 초기화 (대화로 TASK.md 작성)
    └─▶ README.md 작성
        TASK.md 작성 (Acceptance Criteria 정밀하게, 대화로 함께)
        EVAL-CRITERIA.md v0.1 작성
        ROLE-GUIDE.md 설정
        codev_init으로 나머지 파일 템플릿 생성

[사용자] Developer에게 작업 지시
    └─▶ [Developer Session A]
            1. 파일 읽기 순서대로 컨텍스트 로드
            2. 이전 Handoff Note 확인
            3. eval-state.md 피드백 반영
            4. 구현
            5. CHANGELOG.md append
            6. dev-state.md overwrite
            7. Handoff Note 포함 세션 로그 저장
            └─▶ "Requires Eval: YES" 기록

[사용자] Evaluator에게 평가 지시
    └─▶ [Evaluator Session B]
            1. 파일 읽기 순서대로 컨텍스트 로드
            2. file hashes 기반 변경 파일만 선택적 읽기
            3. TASK 기준 평가
            4. trend 분석 (eval-history.md 참조)
            5. Scope Drift 체크
            6. eval-state.md overwrite
            7. eval-history.md append
            8. Handoff Note 포함 평가 리포트 저장
            └─▶ Recommendations → 다음 Dev 세션에 전달

[사용자] 사이클 반복 or 완료 판정
```

---

## 5. MCP Tool 설계 (to-be)

초기엔 Agent 자발적 기록으로 운영하고, 프로젝트 규모가 커지면 MCP로 자동화한다.
TASK.md 생성은 사용자 ↔ Claude 대화로 작성하며, MCP 개입 불필요.
파일 저장은 Filesystem MCP로 충분.

### 5.1 Tool 목록

| Tool | 역할 | 주체 |
|------|------|------|
| `codev_init` | co-dev/ 디렉토리 구조 + 템플릿 파일 초기화 | 사용자 |
| `codev_load_context` | 역할별 필수 파일을 토큰 최적화된 번들로 반환 | 양측 |
| `codev_log_change` | CHANGELOG.md에 항목 append | Developer |
| `codev_update_dev_state` | dev-state.md overwrite + file hash 자동 계산 | Developer |
| `codev_get_changes_since_eval` | 마지막 eval 이후 CHANGELOG 항목만 추출 | Evaluator |
| `codev_get_changed_files` | 이전 eval 이후 hash 변경된 파일 목록 반환 | Evaluator |
| `codev_submit_eval` | eval-state.md overwrite + eval-history.md append + 세션 로그 기록 | Evaluator |
| `codev_get_trend` | 최근 N개 eval-history 항목 비교 → trend 리포트 | 사용자 |
| `codev_open_issue` | ISSUES.md에 새 이슈 append | 양측 |
| `codev_resolve_issue` | ISSUES.md에 RESOLVED 항목 append | 사용자 |

### 5.2 `codev_load_context` 설계 원칙

```
codev_load_context(role="developer", max_changelog_entries=5)
→ 반환:
  - README.md (전체)
  - ROLE-GUIDE.md (developer section만)
  - TASK.md (IN_PROGRESS + TODO 태스크만)
  - CHANGELOG.md (최근 N건만)
  - eval-state.md (전체)
  - dev-state.md (전체)
  - ISSUES.md (OPEN 항목만)
  - sessions/dev/ 최신 파일의 Handoff Note section만
```

불필요한 파일을 읽지 않도록 컨텍스트를 제어하는 것이 이 tool의 핵심 가치.

### 5.3 remote-memory-mcp 기술 차용 범위

- **file hash 추적**: `dev-state.md`의 File Hashes 테이블 → remote-memory의 hash diff 방식으로 구현
- **per-project scope**: 각 프로젝트의 `co-dev/`를 독립 scope로 관리
- **remote-memory-mcp 자체는 분리 유지** (역할 혼재 방지)

---

## 6. 자동화 도입 판단 기준

| 조건 | 권장 방식 |
|------|----------|
| 세션당 수정 파일 ≤ 5개, 작업 범위 명확 | Agent 자발적 기록으로 충분 |
| 세션당 수정 파일 > 10개 or 사용자도 직접 코드 수정 | git hook 기반 MCP 자동 감지 고려 |
| 프로젝트 기간 > 2주, 태스크 > 20개 | `codev_load_context` MCP 도입 권장 |
| 핵심 아키텍처 결정 누적 > 10개 | DECISIONS.md 도입 권장 |

---

## 7. 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 0.1.0 | 2026-03-31 | 초안 |
| 0.2.0 | 2026-03-31 | Flat Markdown 확정, TASK.md 포맷 추가, file hash 기반 선택적 읽기, Scope Drift 감지, codev_load_context 설계 |
| 0.3.0 | 2026-03-31 | eval-history.md 추가, DECISIONS.md 추가, ISSUES.md 추가, Handoff Note 섹션 추가, MCP tool 목록 확장 |
