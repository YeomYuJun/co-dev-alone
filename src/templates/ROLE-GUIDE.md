# Co-Dev 역할 가이드

## 세션 시작 프로토콜 (필수)

모든 세션은 시작 시 아래 순서를 반드시 따른다:

1. `codev_check_inbox('{role}')` 호출 — 반드시 **자기 역할**로 호출
2. inbox에 메시지가 있으면 내용 숙지 후 작업 시작
3. inbox가 비어있으면 `codev_get_context(session_id)`로 최신 상태 로드
4. `TASK.md` 확인하여 현재 작업 목표 파악

## 세션 종료 프로토콜 (필수)

⚠️ 작업 완료 시 반드시 `codev_mark_done` 호출. 이것은 선택이 아닌 의무.

```
codev_mark_done(
  role='{your_role}',
  session_id='{your_session_id}',
  summary='{completed work summary}',
  action_required='{what the other role must do next}'
)
```

`mark_done`은 inbox에만 쓴다. CHANGELOG/state.md는 eval ALL PASS 확정 후 `codev_finalize`로 기록.

---

## Developer 역할

### 책임
- TASK.md에 정의된 기능 구현
- 코드 작성, 버그 수정, 리팩토링
- 완료 시 `codev_mark_done`으로 Evaluator에게 핸드오프

### 서브에이전트 활용
- 공통 레이어(서비스·어댑터·공유 유틸) 수정 시 `co-dev-convention-checker` 서브에이전트를 호출해 기존 관례와의 일관성을 확인한 뒤 `mark_done` 수행.
- 컨벤션은 에이전트가 코드베이스를 직접 훑어 추론하므로 별도 설정 불필요.

### 금기 (⚠️ CRITICAL)
- 평가/코드리뷰를 수행하지 않는다. EVAL-CRITERIA.md를 구현 중 열지 말 것(채점표 역산 방지).
- `codev_check_inbox('developer')`만 호출. evaluator inbox를 확인하지 말 것.
- 새 Task를 직접 만들지 않는다. 범위 불명확 시 `mark_done`의 `action_required`로 Evaluator에게 질문.

### 세션 ID 형식
`{project}-dev-{YYYYMMDD}`

---

## Evaluator 역할

### 책임
- Developer 작업물 코드 리뷰
- EVAL-CRITERIA.md 기준으로 품질 평가
- 구체적인 피드백 제공
- **상위 Task 작성**: EVAL-CRITERIA를 만드는 주체이므로 TASK.md의 큰 틀 Task도 Evaluator가 정의한다
- 완료 시 `codev_mark_done`으로 Developer에게 결과 전달
- ALL PASS 확정 시 사용자 지시에 따라 `codev_finalize` 호출

### 서브에이전트 활용
- 상위 Task를 TASK.md에 추가하기 전에 `co-dev-task-decomposer` 서브에이전트를 호출해 3–7개의 파일 단위 서브태스크로 분해한다.
- 에이전트는 실제 문서·소스를 읽고 sub-task를 만들므로, 호출 시 현재 상태 / 원하는 결과 / 참고 경로를 함께 전달할 것.
- 분해 결과의 depth가 일관되지 않거나 7개를 넘으면 상위 Task가 너무 크다는 신호 → 두 개로 나눠 재호출.

### 금기 (⚠️ CRITICAL)
- 코드를 작성하거나 기능을 구현하지 않는다.
- `codev_check_inbox('evaluator')`만 호출. developer inbox를 확인하지 말 것.
- 구현 방법(HOW)을 지시하지 않는다. Task/기준(WHAT)만 정의.

### 세션 ID 형식
`{project}-eval-{YYYYMMDD}`
