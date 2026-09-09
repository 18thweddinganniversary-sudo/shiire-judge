# Shiire Judge v9.40 Completion Plan

> Execute continuously through GitHub and Vercel production verification. User-approved requirements are the 2026-09-09 completion request.

**Goal:** Make every green decision conservative, consistent, fresh, and based on one decision engine while preserving the existing store workflow.

**Architecture:** Keep `/api/keepa` as a strict raw-data adapter. Put all business decisions in `decision-engine.js`, packaging identity in `related-core.js`, and browser-safe display/storage/input helpers in `app-core.js`. Treat missing demand data separately from measured low demand; sales rank is display-only unless category-relative evidence exists.

**Tech Stack:** Vanilla browser JavaScript, Vercel Functions, Node built-in test runner, localStorage, Keepa Product API.

---

### Task 1: Lock regressions with failing tests

- Extend decision tests for null demand, measured low demand, freshness, all-green-only, and calculation consistency.
- Extend related tests for capacity and multi-stage pack expressions.
- Add Keepa adapter and UI helper tests for strict null handling, display fallbacks, input caret, and storage.
- Extend deployment tests for one decision source, current assets, and deprecated-file removal.
- Run the focused tests and confirm failures before implementation.

### Task 2: Consolidate Keepa parsing and decision evidence

- Add `keepa-core.js` and use it from `/api/keepa`.
- Validate Keepa indexes and fields against official backend definitions.
- Remove API-side signal/label and request a bounded freshness update.
- Add explicit demand evidence to `decision-engine.js`; never convert missing values to zero.

### Task 3: Repair browser behavior and labels

- Add `app-core.js` for safe demand display, storage normalization, and caret-preserving money formatting.
- Rename the price-only guide so it cannot be confused with a green decision.
- Auto-refresh stale saved Keepa data on detail open; keep stale data red until refresh succeeds.
- Harden camera lifecycle while preserving manual JAN entry.

### Task 4: Make same-shelf packaging conservative

- Parse per-unit capacity, total units, cases/boxes/sets, and multi-stage expressions.
- For food/drink, exclude candidates when identity-critical packaging facts are missing or differ.
- Preserve current product-type and brand relevance filters.

### Task 5: Clarify storage and current structure

- Document the exact localStorage fields and single-device/no-cloud limitation.
- Remove the unused v9.17 patch file.
- Update all version strings and asset cache keys to v9.40.

### Task 6: Verify and release

- Run every automated test and static syntax check.
- Exercise production-like mobile flows in an automated browser where hardware permits.
- Commit, publish the exact tree to GitHub main, and wait for the Vercel production deployment.
- Verify production HTTP 200, matching title/assets, product/keepa/related APIs, and runtime errors.
