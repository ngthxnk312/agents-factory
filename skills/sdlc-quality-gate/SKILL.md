---
name: sdlc-quality-gate
description: Run the ordered pre-merge quality gate on the affected scope — build, format/lint/types, unit tests with coverage, integration tests, start-up and smoke, security checks, deployment artifact validation, performance regression, independent review, docs — classify each step as blocking or warning, and produce a gate report with an overall PASS/FAIL. Use before declaring work done, before opening or merging a merge request, and after any bug fix.
stage: 5-verify
role: qa
icon: 🚦
mode: acceptEdits
prefer: quality-gate, verification-before-completion, verify
---

# Quality gate

The gate is how "done" is proven rather than claimed. It is run every time; not every step blocks. You run checks and report — you do not change production code inside the gate. If a step fails, stop the gate, fix through `sdlc-implement`/`sdlc-debug`, then re-run the gate.

## When to use

- Before telling the human a task is complete.
- Before opening or merging a merge request.
- After every bug fix.

## Principles

- **Incremental**: run on the affected modules/packages and their dependants, not necessarily the whole monorepo — but say what scope you used and why it is sufficient.
- **Real commands only**: discover them from the README, package scripts, Makefile/task runner, build files and CI configuration. Prefer running the same commands CI runs. Never invent a command or report a step as passed without running it.
- **N/A needs a reason** ("no migrations in this change", "no performance baseline exists").
- **Never skip the gate.** A warning-level failure is allowed through only with a tracked follow-up that the owner accepts; it is never silently ignored.
- Do not weaken configuration (lowering coverage thresholds, disabling lint rules, skipping tests) to pass.

## The steps (in order)

| # | Step | Class | Pass condition |
|---|------|-------|----------------|
| 1 | **Build / compile** | Blocking | Clean build of affected modules; no new serious warnings |
| 2 | **Format, lint, type check** | Blocking (errors) | Formatter check clean on changed files; no new lint errors; type checker passes |
| 3 | **Unit tests + coverage** | Blocking | All pass; coverage on changed code meets the project threshold (default ~70–80%, higher for money/security code) |
| 4 | **Integration / contract tests** | Blocking (N/A if none apply) | All pass against real dependencies (containers/emulators) where the project supports it |
| 5 | **Start-up + smoke** | Blocking | App/service/job starts without errors in the logs; the changed path works with sample input (request, screen, job run); for UI, key states render |
| 6 | **Security checks** | Blocking for critical, warning otherwise | No hardcoded secrets (scan the diff and use a secret scanner if available); no injection patterns; no sensitive data logged; authorization negative tests present; dependency vulnerability scan has no new critical/high issue |
| 7 | **Deployment artifacts** | Warning (N/A if none) | Migrations validated on a disposable database (`sdlc-db-migration`); container build, manifests/charts/IaC lint and template cleanly; config/env changes documented |
| 8 | **Performance regression** | Warning (N/A without baseline) | No degradation beyond ~10% versus baseline on affected benchmarks/critical queries; query plans checked for new queries on large tables |
| 9 | **Independent review** | Blocking on blocker findings | `sdlc-review` verdict is not FAIL; preferably performed by a different agent/model than the author |
| 10 | **Docs, contract, changelog** | Warning | API contract files, user/ops docs, changelog entry and system-context delta updated where behavior changed (`sdlc-docs`, `sdlc-release`) |

**Overall PASS** = every blocking step passes **and** every warning step either passes or has a follow-up ticket accepted by the owner.

A one-line change in a service with no migrations or baseline will typically mark steps 7–8 `N/A`, run steps 1–5 on one module quickly, and still run 6, 9 and 10.

## Procedure

1. Determine the affected scope from the diff (`git diff --stat <base>...HEAD` plus uncommitted changes) and the dependency graph.
2. Discover the real commands for each step. Note any step the environment cannot run (missing runtime, no container engine, no credentials).
3. Run steps 1–8 in order. On the first blocking failure, stop, record it, and hand back for fixing; do not continue piling up results on a broken build.
4. Run or request step 9 (`sdlc-review`). Fix blockers, then re-run affected steps.
5. Check step 10.
6. Write the gate report. Attach or post it where the project keeps such reports (MR description/comment, ticket) **only with approval**; otherwise return it in your reply. Do not commit gate reports into the repository unless the project does so.

## Stop conditions

- A blocking step fails — stop and report; the task is not done.
- A step cannot be run in this environment and it is blocking — report the task as **not verified**, list exactly what the human must run, and do not claim PASS.
- Fixing a failure would require changing the scope or the design — go back to the plan.

## Output — gate report template

```markdown
## Quality gate report — <ticket / branch>
Date: YYYY-MM-DD · Scope: <modules> · Base: <branch@sha> · Head: <sha or "uncommitted">

### Blocking
| # | Step | Result | Command | Notes |
|---|------|--------|---------|-------|
| 1 | Build | PASS | `…` | |
| 2 | Format / lint / types | PASS | `…` | |
| 3 | Unit tests + coverage | PASS | `…` | 128 passed; changed-code coverage 82% (threshold 75%) |
| 4 | Integration / contract | N/A | – | no I/O path changed |
| 5 | Start-up + smoke | PASS | `…` | health 200; POST /orders → 201 |
| 6 | Security (critical) | PASS | `…` | no secrets; authz negative test present |
| 9 | Review | PASS with follow-ups | sdlc-review | 0 blockers, 2 minor |

### Warning
| # | Step | Result | Follow-up ticket |
|---|------|--------|------------------|
| 6 | Security (non-critical) | WARN | ABC-456 (medium CVE in transitive dep) |
| 7 | Deployment artifacts | PASS | |
| 8 | Performance | N/A | no baseline |
| 10 | Docs / contract / changelog | PASS | |

### Not run in this environment
- <step: reason; what the human should run>

### Overall: PASS | FAIL
```
