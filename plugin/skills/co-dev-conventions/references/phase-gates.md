# Phase Gate Definitions

Each phase has explicit entry and exit conditions. Do not advance a phase until all exit conditions are met. Use `/phase` to display current status and mark completion.

---

## Phase 1 — Planning

**Goal**: Define what will be built before writing any code.

**Activities**:
- Define tool list with names following `{verb}_{noun}` snake_case convention
- Draft input/output schemas (Zod for TypeScript, Pydantic for Python)
- Confirm transport type (stdio for local, Streamable HTTP for remote)
- Identify error handling strategy

**Exit condition**: Tool list and schema draft are confirmed by the developer.

**Moves to**: Phase 2

---

## Phase 2 — Implementation

**Goal**: Build working code for all planned tools.

**Activities**:
- Implement each tool with full type definitions
- Apply `readOnlyHint` and `destructiveHint` annotations
- Write error messages that guide the next action (not just describe failure)
- Ensure `npm run build` or equivalent succeeds without errors

**Exit condition**: Build succeeds AND basic tool behavior is verified (manual or automated).

**Moves to**: Phase 3

---

## Phase 3 — Review

**Goal**: Improve quality without changing behavior.

**Review checklist** (in order):
1. **DRY**: No duplicated logic across tools
2. **Type coverage**: All inputs and outputs are typed; no `any`
3. **Description quality**: Each tool description answers "when should an LLM call this?"
4. **Error handling**: Every error path returns an `McpError` with a recovery hint

**Exit condition**: All four checklist items reviewed and issues resolved.

**Moves to**: Phase 4

---

## Phase 4 — Evaluation

**Goal**: Independently verify correctness and quality before shipping.

**Activities** (Evaluator session only):
- Generate 10 evaluation questions covering edge cases and happy paths
- Run or simulate each case and verify expected output
- Flag any discrepancy as an `[ISSUE]` for the Developer session

**Exit condition**: All 10 questions answered and verified. No open `[ISSUE]` items.

**Moves to**: Done ✓
