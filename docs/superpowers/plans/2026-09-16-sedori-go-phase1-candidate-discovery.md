# せどりGO Phase 1 Candidate Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keepa Product Finderを低コストな一次絞り込みに使い、既存の判定基準と同じ考え方で「店頭価格が仕入れ上限以下なら候補になり得る」JAN/ASIN候補を安全に抽出できる経路を作る。

**Architecture:** 新規 `candidate-core.js` に候補探索用の純粋ロジックを隔離し、`api/candidates.js` はKeepa `/query` のProduct Finderだけを呼ぶ。Phase 1では候補ASIN一覧の取得とトークン可視化までに限定し、候補ごとのProduct Request総当たりは行わない。既存 `decision-engine.js` と店頭判定は変更しない。

**Tech Stack:** Vanilla JavaScript, Node.js serverless functions on Vercel, Node built-in test runner, Keepa REST API (domain=5 / Amazon.co.jp)

**Spec:** `docs/superpowers/specs/2026-09-16-sedori-go-design.md`

## Global Constraints

- サポート優先。最終判断はユーザーに委ねる。
- 既存の `decision-engine.js` の閾値は変更しない。
- 通常の店頭判定フロー、Keepa basic lookup、6時間キャッシュを回帰させない。
- Keepa Product Finderは1回あたり10 tokens + 結果100 ASINごと1 token。`stats=1` は使わない。
- Phase 1では `perPage=50` を上限とし、自動ページングしない。
- 候補探索の実行は明示的なユーザー操作のみ。起動時・スキャン時の自動探索は禁止。
- Keepa APIキーはサーバー側のみ。
- API失敗、429、データ不足を正常候補として扱わない。
- 同じ失敗を場当たり修正で繰り返さず、指示・実装・外部要因を切り分ける。

---

### Task 1: Product Finder selection builder

**Files:**
- Create: `candidate-core.js`
- Create: `tests/candidate-core.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildFinderSelection(options)` → Keepa Product Finder selection object
- Produces: `normalizeCandidateQuery(input)` → validated options

- [ ] **Step 1: Write failing tests**

Tests must prove that defaults are conservative: `page:0`, `perPage:50`, `productType:0`, `availabilityAmazon:[-1]`, `monthlySold_gte:30`, no `stats`, and no automatic paging fields beyond page 0. Tests also prove invalid limits are clamped to 50 and that optional category filters are copied only when explicitly supplied.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/candidate-core.test.js`
Expected: FAIL because `candidate-core.js` does not exist.

- [ ] **Step 3: Implement minimal pure builder**

Use UMD/CommonJS-compatible structure matching `decision-engine.js`. Do not perform network access in this file. Keep all Product Finder defaults in one frozen config object.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/candidate-core.test.js`
Expected: PASS.

- [ ] **Step 5: Run existing unit suite**

Run: `npm run test:unit`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add conservative candidate query builder`

### Task 2: Server-side candidate discovery endpoint

**Files:**
- Create: `api/candidates.js`
- Create: `tests/api-candidates.test.js`
- Modify: `package.json` syntax check

**Interfaces:**
- Consumes: `buildFinderSelection()` from `candidate-core.js`
- Produces: `GET /api/candidates?category=<optional>` returning `{ ok, candidates, totalResults, tokensConsumed, tokensLeft, refillRate, query }`

- [ ] **Step 1: Write failing endpoint tests**

Mock `global.fetch` and assert the Keepa request targets `https://api.keepa.com/query`, uses `domain=5`, sends one Product Finder selection, never sends `stats=1`, never requests page > 0, and never exposes `KEEPA_API_KEY` in the JSON response. Add tests for 429 and malformed Keepa responses.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/api-candidates.test.js`
Expected: FAIL because endpoint does not exist.

- [ ] **Step 3: Implement minimal endpoint**

Use `KEEPA_API_KEY` server-side. Return ASIN strings only as `candidates` at this phase. Preserve Keepa token envelope fields. Use a 15-second AbortController timeout consistent with existing API endpoints. Convert upstream 429 into HTTP 429 with a clear `token_limit` error. Other upstream failures return 502/504, never an empty successful candidate list.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `node --test tests/api-candidates.test.js`
Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `npm run verify`
Expected: all syntax checks and tests PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add low-cost Keepa candidate endpoint`

### Task 3: Token guard and explicit-use contract

**Files:**
- Modify: `candidate-core.js`
- Modify: `api/candidates.js`
- Modify: `tests/candidate-core.test.js`
- Modify: `tests/api-candidates.test.js`
- Modify: `TEST_MATRIX.md`

**Interfaces:**
- Produces: `estimateFinderTokenFloor(resultCount)` → integer minimum estimated token cost (`10 + ceil(resultCount / 100)`)
- Endpoint must expose actual Keepa `tokensConsumed` and refuse caller-supplied `page` values other than 0.

- [ ] **Step 1: Write failing guard tests**

Verify page override attempts are ignored/rejected, `perPage` cannot exceed 50, and no endpoint path performs a second Product Finder request automatically. Verify token estimate for 0/50/100/101 results.

- [ ] **Step 2: Verify RED**

Run focused tests; expected failures for the new guard/estimator behavior.

- [ ] **Step 3: Implement token guard**

Keep the endpoint one-request-per-user-action. Include `estimatedMinimumTokens` in the response for transparency, while keeping actual `tokensConsumed` authoritative.

- [ ] **Step 4: Verify GREEN + regression**

Run `npm run verify`; expected PASS.

- [ ] **Step 5: Document acceptance matrix**

Add Phase 1 checks: one explicit request only, max 50 ASINs, no stats, no paging, 429 semantics, API key not exposed, existing normal scan unchanged.

- [ ] **Step 6: Commit**

Commit message: `test: lock candidate discovery token budget`

### Task 4: Controlled production feasibility probe

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/superpowers/specs/2026-09-16-sedori-go-design.md` only if real evidence changes the chosen approach

**Interfaces:**
- Uses deployed `/api/candidates`
- Produces evidence: HTTP status, result count, actual `tokensConsumed`, sample ASIN count only; no brute-force product enrichment

- [ ] **Step 1: Deploy preview branch**

Wait for Vercel preview READY and inspect build/quality gate.

- [ ] **Step 2: Call candidate endpoint exactly once**

Do not loop. Record `tokensConsumed`, `tokensLeft`, `totalResults`, and number of returned ASINs.

- [ ] **Step 3: Decide Phase 1 feasibility**

PASS only if a single Product Finder call returns a non-empty candidate pool at a bounded/understood token cost. If no candidates are returned, adjust query only after inspecting the exact filter reason; do not brute-force multiple live calls.

- [ ] **Step 4: Regression check existing production behavior**

Confirm no code path changed the normal `/api/keepa` scan behavior or decision thresholds.

- [ ] **Step 5: Update source of truth**

Record measured evidence and the next task in `PROJECT_STATUS.md`. Do not claim candidate quality yet; Phase 2 will enrich only a bounded subset and compare them with `decision-engine.js`.

- [ ] **Step 6: Commit**

Commit message: `docs: record candidate discovery feasibility`

## Self-review

- Spec coverage for Phase 1: candidate discovery, low token use, no brute force, same decision philosophy, uncertainty handling, user final decision.
- Deliberately deferred to later plans: candidate enrichment/ranking, candidate list UI, one-tap store judgment, purchase-result recording, learning from store outcomes.
- No Product Finder `stats=1`, no automatic paging, no mass Product Request enrichment in this phase.
