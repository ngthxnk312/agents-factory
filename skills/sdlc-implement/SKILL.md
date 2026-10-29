---
name: sdlc-implement
description: Implement a planned change in small, test-first, verified steps that mirror the codebase's existing conventions and the engineering baseline — layering, validation, authorization, error handling, safe data access, no secrets or sensitive logging — and finish with an honest verification report. Use when the ticket or plan is clear enough to code.
stage: 4-build
role: dev
icon: 🛠
mode: acceptEdits
prefer: executing-plans, implement
---

# Implement

You are a senior engineer shipping production code that a reviewer will read line by line. Apply `sdlc-standards`; the project's own rules override it.

## When to use

- The plan (`sdlc-breakdown`) or a small, clear ticket says exactly what to build.
- Executing one task from a larger plan.

## When not to use

- Requirements are unclear — `sdlc-intake`.
- The cause of a bug is unknown — `sdlc-debug` first.
- Schema changes not yet planned — `sdlc-db-migration` first.
- A contract change not yet agreed — `sdlc-api-design` first.

## Before writing code

1. **Read the project rules**: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, linters/formatters, project skills, the System Context delta, and the design/plan for this task.
2. **Orient in the environment**: which branch you are on and whether a branch for this scope already exists (`git status`, `git branch`, `git fetch` if allowed); uncommitted changes that are not yours (stop and ask before touching them); how to build, run and test locally (README, package scripts, Makefile, CI config). Do not invent commands.
3. **Find the closest existing example** of what you are building (a similar endpoint, screen, job, migration, test) and mirror its structure, naming, error handling, logging and test style.
4. **Load the plan into your todo tool** — one item per step, so progress is visible.

## The implementation loop (per task)

1. **Write a failing test first** for the behavior (TDD, see `sdlc-test`). For bug fixes, the test reproduces the bug.
2. **Write the minimum code** to make it pass, in the correct layer:
   - entry point: parse, validate, authorize the caller, delegate, map the response;
   - service: business rules, transaction boundary, **object-level authorization** for every id;
   - data access: parameterized queries, no N+1, bounded results;
   - UI: components render state; data fetching and rules live in services/state; design tokens, not literals.
3. **Refactor** while green: remove duplication, improve names, keep functions small.
4. **Run** the relevant tests, linter, formatter (on changed files only) and type checker. Keep the build green after every step.
5. **Mark the todo item done** and move to the next.

## Rules while coding

- **No scope creep.** Do not refactor, rename or reformat code unrelated to the task. Record follow-ups instead.
- **No hardcoded values.** Configuration, thresholds, URLs, ids and feature flags come from config; states and types are enums/constants; UI values come from design tokens.
- **Secrets**: never write a secret into code, tests, fixtures or config that is tracked. Use env vars or the project's secret mechanism. If a secret is needed to run something, ask the human to provide it through the environment.
- **Validation and errors**: validate at the boundary; domain errors with stable codes; Problem Details for HTTP; no empty catch blocks; log once with context and correlation id.
- **Logging**: never log credentials, tokens, card data or personal data; mask what must appear.
- **Data**: exact decimals for money; UTC instants; transaction closed before remote calls; batch writes.
- **External calls**: through an adapter, with timeout and controlled retry; outbound failures must not roll back the core operation; **no real outbound calls from tests or local runs against real endpoints**.
- **Jobs**: idempotent, scoped, time-zone correct; if the job is registered in a separate schedule file, update both.
- **Registration**: register new files wherever the framework requires (module manifests, DI, routes, migrations index, permissions/ACL entries, asset bundles). Verify the new code is actually loaded.
- **Backward compatibility**: keep existing contracts working unless the plan says otherwise; old and new code must coexist during rolling deploys.
- **Comments** explain why, not what. No `TODO` without a ticket.
- **No junk files**: scratch work goes in an ignored scratch directory or the OS temp dir and is deleted when done.
- **Environment footprint**: work in the existing checkout; do not create extra clones/worktrees, containers or databases unless needed, and clean up what you create.
- **Git**: do not commit, push or open merge requests unless explicitly asked. When asked, follow `sdlc-release` for messages.

## Stop conditions

- The plan turns out to be wrong or incomplete (a hidden dependency, a contract conflict, a missing permission model) — stop, explain, propose an adjustment.
- The change would touch production data, secrets, shared infrastructure or another team's module beyond the plan — ask first.
- Tests you did not touch start failing and the cause is unclear — investigate (`sdlc-debug`) before continuing; never delete or weaken a test to get green.
- You need a credential, environment or service you do not have — ask; do not mock your way to a false "verified".

## Verification before reporting

Run, for the affected scope: build/compile → lint/format/type check → unit tests → integration tests → start the app and smoke the changed path (request, screen, job run). If any step cannot be run here, say exactly which and why. For a full pre-merge check, run `sdlc-quality-gate`.

## Output template

```markdown
## Implementation — <task / ticket>

### Changes
| File | Change | Why |
|------|--------|-----|

### Tests added/updated
- `path/to/test` — <behavior proven>

### Verification
| Step | Command | Result |
|------|---------|--------|
| Build | `…` | pass |
| Tests | `…` | 42 passed |
| Smoke | `…` | 200 OK / screen renders |
Not verified: <items and reason, or "none">

### Acceptance criteria status
| AC | Status | Evidence |
|----|--------|----------|

### Follow-ups / known limitations
- …

Nothing was committed or pushed.
```
