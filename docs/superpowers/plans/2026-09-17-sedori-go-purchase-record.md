# せどりGO 買付け結果記録 Implementation Plan

**Goal:** 既存の店頭判定を壊さず、ユーザーの「買った / 見送った」を端末内へ記録する。

**Architecture:** 判定ロジックとは独立した `purchase-record-core.js` に正規化・検証・保存配列操作を集約する。`app.js` は現在開いている商品/価格/判定から記録payloadを作り、localStorageへ保存するだけにする。

**Tech:** Vanilla JS, Node built-in test runner, localStorage.

### Task 1: Record core contract
- Add `tests/purchase-record-core.test.js` first.
- Verify RED because core module does not exist.
- Add `purchase-record-core.js` with normalization/validation/list append/load helpers.
- Verify GREEN.

### Task 2: Detail-sheet UI wiring
- Add a deployment-structure test requiring the purchase record module and `買った` / `見送った` controls.
- Verify RED.
- Add minimal buttons to the existing detail sheet and wire them from `app.js` without changing decision thresholds.
- `買った` requires positive store cost; `見送った` can be saved without cost.
- Verify GREEN.

### Task 3: Persistence safety
- Ensure malformed localStorage JSON returns an empty record list instead of throwing.
- Cap history to a bounded recent list so storage cannot grow without limit.
- Verify full quality gate.

### Task 4: Preview acceptance
- Deploy isolated Preview.
- Confirm root serves new module/buttons without triggering Keepa candidate search.
- Do not repeat paid Keepa probes because this feature does not alter candidate APIs.

### Task 5: Source truth
- Update PROJECT_STATUS / TEST_MATRIX only after verification.
- Merge through PR after required quality-gate succeeds.
