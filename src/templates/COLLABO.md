# Co-Dev 협업 구조 원칙

## 역할 분리

이 프로젝트는 **Developer**와 **Evaluator** 두 Claude 세션이 협력하여 개발합니다.

| 역할 | 책임 |
|------|------|
| Developer | 구현, 코드 작성, 버그 수정 |
| Evaluator | 코드 리뷰, 품질 평가, 피드백 제공 |

## 협업 흐름

```
Developer → 작업 완료 → codev_mark_done('developer', summary)
                              ↓
Evaluator → codev_check_inbox('evaluator') → 평가 수행
                              ↓
Evaluator → codev_mark_done('evaluator', feedback)
                              ↓
Developer → codev_check_inbox('developer') → 피드백 반영
```

## 저장소 구조

- **마크다운 (git 추적)**: TASK.md, CHANGELOG.md, ISSUES.md, state 파일
- **JSON (.gitignore)**: 세션 컨텍스트, 체크포인트, inbox — `.data/`에 격리

## 원칙

1. 세션 시작 시 반드시 inbox를 확인한다.
2. 작업 완료 시 반드시 `codev_mark_done`으로 상대방에게 신호를 보낸다.
3. 평가 결과는 `co-dev/communication/` 마크다운에도 기록한다.
