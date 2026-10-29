---
name: sdlc-breakdown
description: Turn a confirmed request or approved design into an ordered, estimable plan of small vertical slices — each with goal, files, tests, estimate, dependencies and done criteria — plus risks, spikes and a merge-request split. Use after intake or design for any work larger than half a day, or whenever a plan must be reviewed before coding.
stage: 2-plan
role: dev
icon: 🧩
mode: plan
prefer: writing-plans, breakdown, planning
---

# Break down

You are a tech lead preparing work that another engineer (or agent) could execute without guessing. Do not write production code.

## When to use

- After `sdlc-intake` (and `sdlc-design` when needed) for any task estimated above ~half a day.
- When a plan needs approval before implementation starts.
- When a large ticket must be split into several merge requests or sub-tickets.

## When not to use

- Small, clear changes (≤ a few hours, one module) — go to `sdlc-implement` and track steps with the todo tool.
- Requirements still unclear — go back to `sdlc-intake`.

## Inputs

The intake summary and acceptance criteria, the design (if any), the System Context delta (brownfield), and the code areas involved. Read the code; plans that do not cite real files are guesses.

## Procedure

1. **Restate requirements.** Functional requirements as short "The system shall…" statements; non-functional ones (performance, security, compatibility, accessibility, observability) separately. Mark anything inferred as *(assumed)*.
2. **Confirm acceptance criteria** (Given/When/Then) — each one testable. Map each criterion to the task(s) that satisfy it.
3. **Fix scope:** in scope, out of scope, deferred.
4. **Slice vertically.** Each task delivers a thin, working, testable increment through all needed layers (data → service → API → UI), not "all the database work" then "all the API work". Exceptions: an expand-phase migration that must ship first (`sdlc-db-migration`), or shared groundwork that several slices need.
5. **Order the tasks** by dependency and risk: risky unknowns first (as spikes), then the walking skeleton, then the remaining slices, then hardening (observability, docs).
6. **Describe every task** with the fields in the template. Estimates: `S` ≤ 2h, `M` ≤ 1 day, `L` > 1 day → split it until no task is `L`.
7. **Plan tests per task**: which unit, integration and authorization tests prove it. TDD is the default (`sdlc-test`).
8. **Plan the merge requests.** Group tasks into MRs that are small (~400 changed lines guideline), single-purpose and independently reviewable/deployable. Keep refactors in separate MRs. Note feature flags if partially built features will reach production.
9. **List risks and unknowns**, each with a mitigation or a time-boxed spike task.
10. **Create the task list** in your todo/task tool so progress is visible, using the same numbering.

## Plan gate (check before presenting)

- [ ] **Who/what/where/when/why** are answered for the plan as a whole.
- [ ] No placeholders ("TBD", "handle errors", "add tests", "etc."); every task names concrete files or modules.
- [ ] Every acceptance criterion maps to at least one task and one test.
- [ ] No task is larger than `M`.
- [ ] Risky items are first or have a spike.
- [ ] Schema changes follow expand → migrate → contract and are ordered before the code that needs them.
- [ ] Authorization, validation, error handling, logging and observability are explicit tasks or explicit parts of tasks — not implied.
- [ ] Deployment/rollback considerations are noted for anything touching data, configuration or contracts.

If the gate fails, fix the plan or ask; do not hand over a plan that fails it.

## Stop conditions

- An acceptance criterion cannot be mapped to any implementable task — ask.
- The plan requires a decision reserved for the owner (new dependency, new service, breaking API change, data deletion) — present the options and wait.

## Output template

```markdown
## Plan — <ticket / feature>

### Requirements
- FR1 The system shall …
- NFR1 …  *(assumed)*

### Acceptance criteria → tasks
| AC | Covered by tasks | Proven by tests |
|----|------------------|-----------------|

### Scope
In: … · Out: … · Deferred: …

### Tasks
| # | Task (goal) | Files / modules | Tests | Est. | Depends on | Done when |
|---|-------------|-----------------|-------|------|------------|-----------|
| 1 | Spike: … (time-box 2h) | | | S | – | decision recorded |
| 2 | … | `src/orders/…` | unit: …; authz: … | M | 1 | AC1 passes |

### Merge request plan
| MR | Tasks | Purpose | Flag / deploy notes |
|----|-------|---------|---------------------|

### Risks & mitigations
| Risk | Likelihood / impact | Mitigation or spike |
|------|---------------------|---------------------|

### Definition of done
<link to sdlc-standards definition of done plus any task-specific items>
```
