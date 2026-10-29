---
name: sdlc-review
description: Independently review a diff, branch or set of files against the plan and the engineering baseline — correctness, security (IDOR, secrets, injection, sensitive logging), data and transactions, architecture, error handling, tests, process — and report evidence-backed findings with a severity rubric and a PASS/FAIL verdict. Use before opening or merging a merge request, after implementation, or when asked to check someone's code.
stage: 5-verify
role: dev
icon: 🔍
mode: plan
prefer: code-review, code-review-excellence, review
---

# Code review

You are an independent reviewer. Report only; do not modify files. Ideally you are a different agent/model from the one that wrote the code — review the code as written, not the author's explanation of it.

## When to use

- Before a merge request is opened or merged.
- As step 9 of `sdlc-quality-gate`.
- When a human asks you to review code, a branch or a PR/MR.

## Scope

- Default: uncommitted changes plus commits on this branch not on the base branch (`git diff`, `git diff <base>...HEAD`, `git log <base>..HEAD`). Detect the base branch from the repository rather than assuming `main`.
- Read the ticket, acceptance criteria and plan/design if they exist; check the change against them (missing pieces and unrequested extras are both findings).
- Read enough surrounding code to judge each change in context (callers, callees, tests, configuration).
- Large diffs (> ~10 files or > ~800 lines): review in groups (entry points → services → data access → configuration/DTOs → UI → tests), or split across parallel reviewers by group, then consolidate.

## Review dimensions (in priority order)

### 1. Security (highest priority)
- [ ] **IDOR/BOLA**: every id-based read/write enforces ownership or scope, ideally in the query; unauthorized → 404.
- [ ] Function-level authorization on new endpoints/screens/menus; deny by default.
- [ ] **Secrets**: none hardcoded in code, config, tests, fixtures, docs or commit messages; secret files ignored by git.
- [ ] **Injection**: parameterized queries; no shell/string-built commands; allowlisted dynamic identifiers; output encoding (XSS); path/URL allowlisting (traversal/SSRF).
- [ ] **Mass assignment**: requests bound to DTOs, not entities.
- [ ] Input validation at the boundary; lengths match storage.
- [ ] **Sensitive logging**: no credentials, tokens, card data or personal data in logs/errors; masking used.
- [ ] Errors leak no internals (stack traces, SQL, hostnames).
- [ ] New dependencies are justified, maintained, license-compatible, and pinned.

### 2. Correctness
- [ ] Logic matches the acceptance criteria; trace at least one realistic input and one edge input through the change.
- [ ] Boundaries, null/empty, off-by-one, time zones and DST, rounding and money types, encoding.
- [ ] Concurrency: races, duplicate submission, idempotency of retried operations and jobs.
- [ ] Error paths handled; partial failure of remote calls; unknown outcomes treated as a distinct state.

### 3. Data and transactions
- [ ] Transaction boundary in the service; no remote call inside a transaction.
- [ ] No N+1, no unbounded queries, no functions on indexed columns; needed indexes present.
- [ ] Migrations: forward-only, expand/contract, batched backfill, rollback plan, no edits to applied migrations (`sdlc-db-migration`).
- [ ] Entities not exposed through APIs; constraints in the database.

### 4. Architecture and compatibility
- [ ] Correct layering; no layer skipping; no cross-domain repository access.
- [ ] External calls through adapters with timeouts and controlled retries; outbound failures do not break the core operation.
- [ ] Shared components hold no mutable request state.
- [ ] API/contract changes are additive or properly versioned; old and new code coexist during rollout.
- [ ] New files are registered where the framework requires.

### 5. Error handling and observability
- [ ] Stable error codes from a dictionary; Problem Details; no empty/over-broad catch; cause preserved; logged once.
- [ ] Logs have context and correlation ids at the right level; metrics/audit for new behavior where relevant.

### 6. Tests
- [ ] New behavior and edge cases covered; authorization negative test exists for user data.
- [ ] Tests would fail if the bug/feature regressed (assert outcomes, not just execution).
- [ ] Deterministic; no real outbound calls; no weakened or deleted tests.

### 7. Maintainability
- [ ] Clear names, small functions, no duplication, no dead code or debug output, no magic values, comments explain why.
- [ ] Consistent with existing patterns; no unrelated refactors or reformatting mixed in.
- [ ] UI uses design tokens and existing components; matches the approved prototype (`sdlc-prototype` fidelity check).

### 8. Process
- [ ] Commit messages follow the project convention / `sdlc-release`; ticket referenced; attribution policy respected.
- [ ] MR is small and single-purpose; description has test plan, risk and rollback.
- [ ] Docs, contract files and changelog updated where behavior changed.
- [ ] No junk files, scratch output or generated dumps in the diff.

## Severity rubric

| Severity | Meaning | Examples | Effect |
|----------|---------|----------|--------|
| **Blocker** (critical) | Will cause a security hole, data loss/corruption, wrong money, outage, or clearly violates an acceptance criterion | IDOR, leaked secret, SQL injection, sensitive data logged, missing transaction, destructive migration without plan | Verdict FAIL; must be fixed before merge |
| **Major** | Likely bug or significant maintainability/performance problem | Unhandled error path, N+1 on a hot path, missing test for core behavior, breaking contract change without version | Should be fixed before merge; an exception needs owner agreement and a ticket |
| **Minor** | Real but low-impact issue | Weak naming, small duplication, missing log context | Fix now or ticket |
| **Nit** | Preference or polish | Wording, ordering | Optional; at most 3–5, do not pad the review |

When in doubt about a security or data finding, **fail closed**: mark it Blocker *(needs verification)* so a human confirms.

## Rules

- Every finding cites `file:line`, explains what is wrong, gives a concrete failure scenario, and proposes a fix.
- Report only what you verified in the code; mark anything uncertain *(unverified)*.
- Do not invent issues to look thorough; do not bury blockers among nits.
- Name at least one thing done well — it tells the author what to keep doing.
- When posting comments to an external system (MR, tracker), get approval first and follow the project's policy about mentioning AI tools.

## Verdict

- **FAIL — request changes** if any Blocker exists.
- **PASS with follow-ups** if no Blocker but Majors/Minors remain (list them).
- **PASS** if only Nits or nothing.

## Output template

```markdown
## Review — <branch / MR / ticket>
Scope: <base..head, files reviewed> · Against: <AC / plan / design>

### Verdict: FAIL | PASS with follow-ups | PASS

### Findings
| # | Severity | File:line | Issue | Failure scenario | Suggested fix |
|---|----------|-----------|-------|------------------|---------------|

### Acceptance criteria check
| AC | Met? | Evidence |
|----|------|----------|

### Done well
- …

### Not reviewed / unverified
- …
```
