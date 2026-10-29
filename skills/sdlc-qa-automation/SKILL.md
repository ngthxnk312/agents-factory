---
name: sdlc-qa-automation
description: Turn an approved manual suite into reliable automated tests — select candidates with explicit rationale, assess readiness, choose the layer (API, UI, unit) and framework, design page/screen objects, data and locator/wait/assertion strategies, generate traceable scripts, review them for flakiness, run them, and triage failures into product, script, environment or flaky. Use when regression or acceptance cases should be automated for web, mobile or API, when an automation suite is flaky, or when automated results must be analyzed.
stage: 4-build
role: qa
icon: 🤖
mode: acceptEdits
prefer: e2e-testing-patterns, test-automation, qa-automation
---

# QA automation (select → design → script → run → triage)

Automation is a product: it must be traceable to test cases, deterministic, and cheap to maintain. Automating the wrong case, or automating a case unreliably, costs more than leaving it manual. Apply `sdlc-standards` and the test-code rules of `sdlc-test` (determinism, no real outbound effects, synthetic data).

## When to use

- An approved suite exists (`sdlc-qa-test-design`, reviewed by `sdlc-qa-testcase-review`) and regression or acceptance cases should be automated.
- An existing UI/API suite is flaky or unmaintainable.
- Automated results need failure triage for a test report.

## When not to use

- Developer unit/integration tests during implementation — `sdlc-test`.
- The suite is not reviewed yet — automating unreviewed cases bakes in their errors.

## Guardrails

- Never report a test as passing that you did not run in this session; report the exact command and raw counts.
- Tests run only against designated test environments. No production endpoints, no real customer accounts, no real payments, messages or third-party side effects. One-time codes, captchas and biometrics are handled by test-environment mechanisms (fixed codes for test accounts, test-only endpoints, bypass flags) agreed with the environment owner — never by real devices or real numbers.
- Credentials and tokens come from environment variables or the secret store; never in scripts, fixtures, reports or committed files. Auth-state files and `.env` files are ignored by version control.
- Do not edit product code to make a test pass; report the product defect instead (`sdlc-qa-defect`).
- Do not commit, push or wire tests into shared CI without approval.

## Procedure

### 1. Candidate selection

For every case in the suite decide exactly one status:

| Status | When |
|--------|------|
| Candidate | Stable flow, deterministic expected result, verifiable via UI/API/state, data can be prepared and reset, regression value high or run often |
| Partial | Part of the flow automatable (e.g. up to an external verification step) or needs a stub not yet available — name the dependency |
| Manual-only | Needs human judgement (visual/UX feel), real devices/hardware, real external effects, or a one-off check |
| Deferred | Would qualify but blocked now (flow still changing, no stable locators, environment missing) — name the blocker |

Good candidates: core happy paths, stable validations, deterministic boundaries, state transitions with clear outcomes, regression-critical rules, API contracts. Being a happy path alone is not a reason. Assign automation priority P1 (write first, runs every release) / P2 / P3. The status counts must add up to the suite total — check the arithmetic.

### 2. Readiness and layer

Per candidate: expected result clear? test data and reset available? environment dependencies controllable (stubs, sandboxes, seeded accounts)? stable selectors available (or can developers add test IDs)? Choose the **lowest reliable layer**: rule logic → unit (hand to developers); service behavior and contracts → API tests; only user-visible journeys → UI. Recommend a framework that matches the project and platform (modern web: a browser-automation runner with auto-wait; legacy web: a WebDriver-based runner; native/cross-platform mobile: a mobile automation driver or the platform's UI test framework; API: the project's HTTP test tooling). Reuse the existing automation project if one exists. **Stop for approval** of the candidate list, layers and framework.

### 3. Design (before code)

Write a short design: scope per spec/class (one objective per test), project structure, page/screen objects to create or update (one per screen/component; locators + actions + state queries; **no assertions inside them**), fixtures (auth state reuse per role, API client for seeding/cleanup), test data strategy (per-test data via API or fixtures, unique identifiers per run, cleanup), locator strategy, wait strategy, assertion map (each expected-result line → one assertion), configuration (base URLs, app build, devices from environment variables), reporting (traces/screenshots/video on failure, machine-readable report). Details and patterns: `reference/automation-patterns.md`.

Locator priority: accessibility role/label or accessibility id → dedicated test id → stable native id → visible text (only if not localized/dynamic) → relative CSS/XPath as last resort with a `NEEDS_VERIFY` comment. Never absolute XPath, generated class names or pixel coordinates.

### 4. Script generation

- Mirror the existing automation project's conventions; otherwise the structure in the reference.
- Every test is tagged/named with its IDs (`<behavior> @TC-PAY-003 @AT-012`) so results map back to the suite and the traceability matrix.
- Test files contain flow and assertions only; no raw locators, no driver lookups.
- Wait on conditions (visible, enabled, URL, response, state); fixed sleeps are forbidden except with a written reason.
- Each test sets up and cleans up its own data; no order dependence; parallel-safe or explicitly serialized (shared account → serial).
- Assertions are strong: exact text/value/state/URL/response field, plus stored state where the case requires it. "No crash" or "some element exists" is not an assertion.
- A case that cannot be implemented yet is registered as pending/fixme with its tags and reason — never silently dropped.

### 5. Script review (self + independent)

Check structure, traceability (every candidate has a test or a recorded skip), locator stability, waits, isolation, data/secrets hygiene, assertion strength, and the flaky-risk checklist in the reference. Mark any test with known flaky risk as `Partial`. Prefer an independent reviewer (`sdlc-review` with this checklist).

### 6. Execution

1. Readiness: build/app version known, environment reachable, devices/emulators/browsers available, test data seeded, configuration set. Run a smoke test first; if it fails, stop — the environment is the problem.
2. Run the narrowest target (spec path or tag that cannot over-match, e.g. a tag pattern anchored so `@S1` does not match `@S10`).
3. Collect raw results (pass/fail/skipped/flaky/interrupted), the first failure and its evidence.

### 7. Failure triage

| Category | Evidence pattern | Next action |
|----------|------------------|-------------|
| Product defect | Behavior differs from the case's expected result; reproducible manually | `sdlc-qa-defect` |
| Script defect | Wrong selector, wrong assertion or data in the script; product behaves per spec | Fix script |
| Environment | Service down, network, seed data missing, device offline, setup/login failed before the test | Fix environment; rerun |
| Flaky | Passes on retry with no code change | Quarantine with ticket, fix the cause; never blind retries |

Cite evidence (message, step, trace/screenshot path) for every classification. If product vs script cannot be distinguished, classify as script defect and mark "needs human confirmation". Retries may surface flakiness in reports but never convert a real failure into a pass.

## Stop and ask

- After candidate selection/framework choice (approval point).
- A candidate needs a test-environment hook (fixed one-time code, test endpoint, test IDs in the app) that does not exist — ask the owning team; do not work around with production-like secrets.
- Execution needs devices, paid farms or shared environments you have not been granted.

## Output template

```markdown
## Automation — <feature>
### Candidate list
| AT-ID | TC-ID | Title | Rationale | Layer | Priority | Dependency | Status |
Totals: Candidate a · Partial b · Manual-only c · Deferred d · Sum = suite total N ✔
### Design summary
Framework · structure · page/screen objects · fixtures · data strategy · locators · waits · assertion map · config
### Files written
| File | Purpose | Tests (IDs) |
### Script review
| Check | Result | Notes |
### Execution
Command `…` · env/build … · total / passed / failed / skipped / flaky
### Failure triage
| Test (TC/AT) | Status | Category | Evidence | Action |
### Not run / pending (with reason) · Follow-ups
```

## Hand-off

- Product defects → `sdlc-qa-defect`; results → `sdlc-qa-test-report`.
- Automation code changes go through `sdlc-review` and `sdlc-quality-gate` like any code; CI wiring and commits only with approval (`sdlc-release`).
