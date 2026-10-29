---
name: sdlc-qa-test-design
description: Design an executable manual test suite from an analyzed requirement set — risk-driven scenarios first (approved by a human), then detailed test cases using equivalence partitioning, boundary values, decision tables, state transitions, use-case, pairwise, error guessing and checklist techniques, a concrete test data specification, edge-case review, coverage check and a requirement-to-test traceability matrix, exported in a spreadsheet-friendly format. Use after QA requirement analysis and the draft test plan, when a feature needs manual or acceptance test cases.
stage: 3-design
role: qa
icon: ✍️
mode: acceptEdits
prefer: qa-tester, test-case-design, test-design
---

# QA test design (scenarios, cases, data, traceability)

Think before writing: **requirement → risk → test condition → technique → scenario → test case**. A test case that cannot be traced to a requirement, or that cannot be executed by someone else from its text alone, is not done.

## When to use

- A feature, change or release needs manual/acceptance test cases (new suite or extension of an existing one).
- Preparing the input for automation candidate selection (`sdlc-qa-automation`).

## When not to use

- No requirement analysis exists — run `sdlc-qa-requirement-analysis` first.
- Developer unit/integration tests inside the code base — `sdlc-test` (that skill owns the TDD loop; this one owns QA-level suites).
- Reviewing an existing suite — `sdlc-qa-testcase-review`.

## Inputs

Requirement register and summary, approved draft test plan, designs/prototype, `sdlc-qa-domain-checklists` for the domain, and the project's existing test case format if one exists (the project format wins over the template here).

## Procedure

### Part 1 — Scenarios (then stop for approval)

1. Group by module/flow. For each BR, FR, AC, flow branch and high risk derive **test conditions** (what must be shown true or false).
2. Pick techniques per group — do not use one technique for everything:

   | Group | Primary techniques |
   |-------|--------------------|
   | Happy path | Use-case testing, state transition |
   | Unhappy path | Equivalence partitioning, error guessing, decision table |
   | Boundary | Boundary value analysis (min−1, min, max, max+1; plus just-inside values; length, count, time, money) |
   | Validation | Equivalence partitioning, checklist-based |
   | Business rule | Decision table, risk-based |
   | Alternate / exception flow | State transition, error guessing |
   | Regression impact | Risk-based, checklist-based |
   | Edge cases | Pairwise, exploratory charters, error guessing |

3. Shape design by platform type: **web** — browser behavior, session, back/refresh/multi-tab, roles; **mobile** — navigation stack, background/foreground, kill and relaunch, network switch, permissions, device states; **backend/job/API** — triggers, schedules, data flow, stored state, idempotent re-runs, integration logs, contract errors.
4. Write the **scenario list** (`SC-nn`): one line each, requirement references, technique, risk level, planned depth. Cover at minimum: happy, unhappy, boundary, validation, business rule, alternate/exception, authorization (role allowed, role denied, user A vs user B's object), and regression impact.
5. **Stop.** Present the scenario list for human review. Record the outcome (approved / approved with comments / rejected, by whom, date, comments to apply). Do not write detailed cases on unapproved scenarios.

### Part 2 — Test data specification

6. Before writing steps, specify concrete data per scenario: boundary table for every rule with a threshold (min−1/min/max/max+1, timing T−1s/T/T+1s, attempt counts 1..limit+1), happy-path data sets, error-trigger data (one value per targeted failure), state-combination matrix (user state × account/object state × dependency state → expected), format-validation values, and the **stub/mock strategy** for anything external (one-time codes, payment providers, messaging, third-party APIs). Data that only exists in a real external system makes the case manual-only — say so.
7. Data rules: synthetic values only; never real customer data, real card numbers or real phone numbers (use documented test ranges); unknown formats are `TBD — confirm with <role>` with impact stated.

### Part 3 — Detailed test cases

8. One case per scenario aspect, each mapped to exactly one `SC-nn` and to its `REQ/BR/AC`. Columns are in `reference/templates.md`.
9. Writing rules:
   - **Title** states the behavior and outcome ("Rejects transfer when amount exceeds daily limit").
   - **Preconditions** numbered and complete: role, object states, configuration/flags, data, environment.
   - **Steps**: each step is an action **plus** what to verify after it; no "enter valid data", no "observe the result".
   - **Test data**: concrete values, each marked valid/invalid with the rule and source it exercises.
   - **Expected result** grouped by screen/dialog/response/stored state; every item observable; verify **system state** (stored record, balance, status, audit entry, emitted event), not only the message on screen.
   - **Technique**, **priority** (Critical/High/Medium/Low from risk), **type** (happy / unhappy / boundary / regression / edge), **requirement reference**.
10. **No invented behavior.** Every step and expected item must trace to a BR, AC, design element or confirmed answer. Common inventions to refuse unless specified: persistence after restart, timeouts with made-up durations, offline retry, confirmation dialogs, toasts, button labels, placeholder texts. Missing spec → `OPEN: <question>` in the case and an open question upstream.
11. Execution columns (actual result, status per platform, evidence, defect ID) stay empty until execution. Never pre-fill a status.

### Part 4 — Edge-case review

12. Review the draft as a user who makes mistakes and as an attacker: double submit / replay, concurrent actors on the same record, network loss or timeout mid-operation, session expiry mid-flow, app backgrounded or killed mid-flow, stale data vs backend state, dependency returns error or duplicate or out-of-order callback, partial failure and rollback, permission change during a session, very long / unicode / empty inputs, time zone and date boundaries. Add only high-value cases; financial and data-integrity edge cases (no duplicate effect, no negative balance, consistent final state, audit trail) are Critical.

### Part 5 — Coverage check and traceability

13. Build the matrix `REQ → BR/FR/AC → SC → TC` and compute coverage: testable = total − (NFR routed elsewhere + OOS); coverage = (covered + partial) / testable; full coverage = covered / testable. List every `Not covered` as a gap with reason.
14. Detect duplicates (same precondition, steps and expectation) and weak cases (vague expectation, no data, untestable). Fix or remove.
15. Request an independent review (`sdlc-qa-testcase-review`, ideally a fresh agent) before finalizing.
16. Export: the suite in the project's format; otherwise Markdown tables plus CSV (one row per case, steps joined with numbered line breaks) so it imports into spreadsheets and test-management tools. Do not upload to external tools without approval.

## Stop and ask

- After the scenario list (mandatory approval point).
- Expected behavior for a case is ambiguous or sources conflict.
- Required test data or environment does not exist and cannot be stubbed.

## Quality checks before hand-off

- [ ] Every testable requirement has ≥1 case or a documented gap; every case has a requirement reference.
- [ ] Every BR with a threshold has boundary cases on both sides.
- [ ] Authorization negatives and dependency-failure cases exist where applicable.
- [ ] No placeholder data, no vague expectations, no invented UI/behavior.
- [ ] Technique column filled and varied; priorities follow risk.
- [ ] Coverage numbers add up; gaps listed.

## Output

Use `reference/templates.md` for: scenario table, test case table, edge-case table, test data specification, traceability matrix with coverage metrics, and the suite summary. Report location of files written and the coverage summary in the reply.

## Hand-off

- Final suite + matrix → `sdlc-qa-automation` (candidate selection), `sdlc-qa-ui-ux` (optional UI/UX section — ask the human whether to run it), execution by testers, then `sdlc-qa-test-report`.
- Coverage and scope changes → refine the final plan in `sdlc-qa-test-plan`.
