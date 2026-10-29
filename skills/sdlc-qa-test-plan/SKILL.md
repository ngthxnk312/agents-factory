---
name: sdlc-qa-test-plan
description: Write a risk-based test plan for a feature or release — product analysis, scope in/out, strategy and test levels/types, objectives, entry/suspension/exit criteria, roles, environments and test data, schedule and estimates, project risks and deliverables — first as a draft before test design, then refined into a final plan once the suite and coverage are known. Use after QA requirement analysis and before writing test cases, and again before execution sign-off.
stage: 2-plan
role: qa
icon: 📝
mode: plan
prefer: test-plan, test-planning, qa-test-plan
---

# QA test plan

A test plan is a management document: it answers **what** will be tested, **how**, **with whom, where and when**, and **what result allows us to stop or proceed**. It is not a list of test cases and not a re-wording of the requirements.

## When to use

- After `sdlc-qa-requirement-analysis`, before `sdlc-qa-test-design` → **draft plan**.
- After the suite is finalized and coverage reviewed → **final plan** (refined, same structure).
- When scope, environments or dates change materially during a test cycle.

## When not to use

- A one-line fix whose verification fits in the `sdlc-test` report — a full plan is overhead. Say so and record exit criteria in the ticket instead.
- Developer-level TDD planning — `sdlc-breakdown` / `sdlc-test`.

## Lifecycle

| Version | Built from | Purpose |
|---------|-----------|---------|
| Draft | Requirement register, risks, questions, design/architecture notes | Agree scope and approach **before** test design; stakeholder review |
| Final | Draft + approved scenarios + finished suite + coverage review | Reflect real scope, real environments, real exit criteria; basis for the test report |

Keep the same eight sections in both. Mark anything not yet decided as `Draft`, `Assumption` or `Open question` inside the section — never leave a section silently empty.

## Procedure — the eight sections

1. **Analyze the product.** Users/roles, business purpose (1–2 lines), high-level behavior, platform and technical context (web, mobile OS/device matrix, backend services, jobs), upstream/downstream dependencies, assumptions and open questions that affect the plan.
2. **Strategy.**
   - *Scope*: in scope and out of scope, explicitly — out of scope prevents false confidence.
   - *Approach*: risk-based by default; add use-case, validation-heavy, exploratory or checklist-based where they fit.
   - *Levels*: which behavior is verified at unit, integration/contract, API, UI end-to-end, and manual level (push checks down the pyramid; see `sdlc-test`).
   - *Types*: only those that truly apply — functional, regression, integration, security, performance, accessibility (`sdlc-qa-ui-ux`), compatibility, localization, data migration, recovery/resilience, usability. Each listed type names an owner and an approach.
   - *Risk-based priority*: table linking each risk to depth of testing, data needs and automation intent.
   - *Regression scope*: which existing areas are touched (from the impact analysis) and how they are re-verified.
3. **Objectives.** Each objective is tied to a behavior or business outcome and is checkable later ("rejects transfers above the daily limit with error X", not "test thoroughly").
4. **Criteria.**
   - *Entry*: build deployed and smoke-passed, requirement questions answered or assumptions accepted, test data and accounts ready, environment dependencies reachable.
   - *Suspension / resumption*: environment down, blocker in a core flow, unstable build (smoke fails), requirement change mid-cycle; and what must happen to resume.
   - *Exit*: run rate (e.g. 100% of planned cases executed or consciously descoped), pass rate (e.g. ≥95% overall and 100% of critical-priority cases), no open critical defects and no open high defects without an accepted workaround, all high-risk requirements covered, regression suite green, known issues documented and accepted by the owner. Use the project's thresholds when they exist.
5. **Resources.** Roles rather than names until staffed: QA lead/analyst, manual testers, automation engineer, developer and analyst support, domain expert, environment owner. Responsibility per role.
6. **Environments and test data.** Environment name and purpose, build/version, platform matrix (browsers, OS versions, devices, screen sizes, locales), integrated systems and whether each is real, sandboxed or stubbed, setup prerequisites (feature flags, configuration, seeded accounts), test data needs per risk area (states, boundaries, roles), and constraints that may distort results (shared environments, rate limits, data refresh schedules, stubs that hide real behavior). **Production data is never used for testing**; synthetic or properly anonymized data only.
7. **Schedule and estimates.** Phases (analysis, plan, design, data/environment preparation, execution cycles, retest/regression, reporting/sign-off) with effort, owner and dependencies. Mark estimates as draft until test design is done. Project/test-execution risks (late build, environment instability, unanswered questions, key person unavailable) with likelihood, impact, mitigation, owner and buffer.
8. **Deliverables.** Before testing (plan, scenarios, suite, data spec, traceability matrix), during (execution logs, defect reports, daily status), after (test report, final traceability, automation results, lessons learned). List only artifacts the team will actually produce.

## Final-plan refinement

Refine strongly when scenario review changed scope, coverage review found significant gaps, the real case count invalidates estimates, environment reality differs from assumptions, or deliverables changed. The final plan must show: real scope after design, chosen types, exit criteria tied to the actual suite, real risks, and an explicit statement if exit criteria are not yet achievable.

## Stop and ask

- Scope boundary, release date or target environments are unknown and change the strategy.
- An exit criterion would require a decision only the owner can make (accepting known defects, descoping a risk area).
- The plan needs a shared or production-like environment, real third-party sandbox credentials or paid device-farm time — ask before assuming availability.

## Guardrails

- Do not copy the requirement analysis into the plan; reference it.
- Do not list test types "for completeness"; each must have an owner and approach or be out of scope.
- Do not mark sign-off or approvals; leave placeholders for the humans.

## Output template

```markdown
# Test plan — <feature / release> (Draft | Final, v<n>, <date>)
Sources: <requirement analysis link, spec versions> · Platform: <web | mobile | backend | mixed>

## 1. Product analysis
Users/roles · Purpose · Behavior (high level) · Technical context · Dependencies · Assumptions / open questions

## 2. Strategy
### Scope — In | Out
### Approach and levels
| Behavior / area | Unit | Integration/API | UI E2E | Manual | Notes |
### Test types
| Type | Applies? | Approach | Owner |
### Risk-based priority
| Risk | Level | Test depth | Data needs | Automation intent |
### Regression scope

## 3. Objectives
- OBJ-1 …

## 4. Criteria
Entry · Suspension / resumption · Exit (measurable)

## 5. Resources
| Role | Count | Responsibility |

## 6. Environments and test data
| Environment | Build | Matrix | Integrations (real / sandbox / stub) | Setup | Constraints |
Test data needs per risk area

## 7. Schedule, estimates, project risks
| Phase | Effort | Owner | Depends on |
| Risk | Likelihood | Impact | Mitigation | Owner |

## 8. Deliverables — before | during | after

Approvals: <placeholder — not filled by the agent>
```

## Hand-off

- Draft plan → human review → `sdlc-qa-test-design`.
- Final plan → basis of `sdlc-qa-test-report` (exit criteria comparison) and of automation scope in `sdlc-qa-automation`.
