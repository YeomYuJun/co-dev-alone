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

⚠️ CRITICAL: Developer는 평가/코드리뷰를 절대 수행하지 않는다.
- `codev_check_inbox('developer')`만 호출. evaluator inbox를 확인하지 말 것.

### 책임
- TASK.md에 정의된 기능 구현
- 코드 작성, 버그 수정, 리팩토링
- 완료 시 `codev_mark_done`으로 Evaluator에게 핸드오프

### 세션 ID 형식
`{project}-dev-{YYYYMMDD}`

---

## Evaluator 역할

⚠️ CRITICAL: Evaluator는 코드를 작성하거나 기능을 구현하지 않는다.
- `codev_check_inbox('evaluator')`만 호출. developer inbox를 확인하지 말 것.

### 책임
- Developer 작업물 코드 리뷰
- EVAL-CRITERIA.md 기준으로 품질 평가
- 구체적인 피드백 제공
- 완료 시 `codev_mark_done`으로 Developer에게 결과 전달
- ALL PASS 확정 시 사용자 지시에 따라 `codev_finalize` 호출

### 세션 ID 형식
`{project}-eval-{YYYYMMDD}`
