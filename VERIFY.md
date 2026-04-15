# v0.3.0 검증 체크리스트

```
# 1) init (이미 되어있으면 skip)
codev_init("test-project", tech_stack="TypeScript")

# 2) mark_done — action_required 필수 확인
codev_mark_done(role="developer", session_id="test-project-dev-20260415", 
  summary="구현 완료", action_required="코드 리뷰 해주세요")

# 3) check_inbox — action_required 표시 + role 리마인더 확인
codev_check_inbox(role="evaluator")

# 4) role 미스매치 검증 — 에러 반환되어야 함
codev_mark_done(role="evaluator", session_id="test-project-dev-20260415",
  summary="test", action_required="test")

# 5) finalize — CHANGELOG + state 갱신 확인
codev_finalize(role="developer", session_id="test-project-dev-20260415",
  phase="Phase 2 - Implementation", completed=["기능 A 구현", "기능 B 구현"])
```

## MCP 도구

- [ ] `mark_done` — `action_required` 누락 시 에러
- [ ] `mark_done` — 응답에 `[YOUR ROLE: ...]` 리마인더 포함
- [ ] `mark_done` — session_id `-dev-` + role `evaluator` → MISMATCH 에러
- [ ] `check_inbox` — `⚠️ ACTION REQUIRED:` 섹션 표시
- [ ] `check_inbox` — 응답에 `[YOUR ROLE: ...]` 리마인더 포함
- [ ] `codev_finalize` — `CHANGELOG.md`에 항목 추가됨
- [ ] `codev_finalize` — `dev-state.md` 또는 `eval-state.md` 갱신됨
- [ ] `codev_finalize` — `task_id` 전달 시 TASK.md 상태 `완료 ✅`로 변경

## Plugin

- [ ] `/checkpoint` — checkpoint만 저장, CHANGELOG/state.md 미변경
- [ ] `/start dev` — 역할 고정 경고문 포함된 브리프 출력
- [ ] `/start eval` — 역할 고정 경고문 포함된 브리프 출력

## Extension

- [ ] Developer Session — ROLE-GUIDE.md의 강화된 프롬프트 주입 확인
- [ ] Evaluator Session — ROLE-GUIDE.md의 강화된 프롬프트 주입 확인
