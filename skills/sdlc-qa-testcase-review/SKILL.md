---
name: sdlc-qa-testcase-review
description: Independently review a test suite — newly designed or inherited — for correctness against requirements, completeness of coverage (requirements, rules, flows, categories, domain risks, state combinations, integrations, security), clarity and executability, invented behavior and broken traceability; produce flagged findings, a coverage gap summary with priorities and a verdict. Use before approving a new suite, when inheriting or auditing an existing suite, and before automating a suite.
stage: 3-design
role: qa
icon: 🧐
mode: plan
prefer: testcase-review, test-case-review, test-suite-review
---

# Test case review

Review finds what the author is confident about but got wrong. It flags and recommends; it does **not** rewrite the suite. The best reviewer has not seen the author's reasoning: when you can, run this skill as a fresh agent that receives only file paths and this checklist.

## When to use

- Before the human approves a suite produced by `sdlc-qa-test-design` (scenarios and cases).
- Auditing an existing or inherited suite against current requirements.
- Before selecting automation candidates (`sdlc-qa-automation`) — automating a weak suite multiplies its weaknesses.

## When not to use

- Reviewing test **code** quality (assertions, waits, structure) — that is the script review in `sdlc-qa-automation` and `sdlc-review`.
- No requirement baseline — run `sdlc-qa-requirement-analysis` first; a review without a baseline is opinion.

## Inputs

Requirement register/summary (baseline), the suite (any format), the test plan, designs, `sdlc-qa-domain-checklists` for the domain. If the suite is empty, say so and go straight to the gap analysis (everything is a gap).

## Procedure

1. **Load the baseline first**: list of BR/FR/AC with thresholds, flows and branches, roles, risks, domain risk areas. Only then read the cases.
2. **Correctness — per case.** Flag:

   | Flag | Meaning | Severity |
   |------|---------|----------|
   | `WRONG_EXPECTED` | Expectation contradicts a rule or uses a wrong threshold/message | Critical |
   | `INVENTED_REF` | Cites a requirement/AC ID that does not exist | Critical |
   | `UNTESTABLE` | Expected result cannot be observed or verified | Critical |
   | `BEHAVIOR_NO_SPEC` | Step or expectation with no source (restart persistence, made-up timeout, dialog, toast) | High |
   | `UI_UNVERIFIED` | Label, text, control or dialog not present in the design/spec | High |
   | `STEP_MISSING` / `STEP_AMBIGUOUS` | Cannot be executed deterministically | High |
   | `PRECONDITION_INCOMPLETE` | Role, object state, configuration or data missing | High |
   | `DATA_GENERIC` | "valid amount", "test account" instead of concrete values | High |
   | `STATE_NOT_VERIFIED` | Checks only the screen message, not stored/derived state where it matters | High |
   | `DUPLICATE` | Same precondition, steps and expectation as another case | Medium |
   | `SCHEMA_INCOMPLETE` | Required column missing (ID, refs, preconditions, steps, data, expected, priority) | Medium |
   | `TECHNIQUE_MISSING` / `TECHNIQUE_MONOTONE` | Technique blank, or a whole group uses one technique | Medium |
   | `VAGUE` | Understandable but imprecise wording | Low |

3. **Completeness — four dimensions.**
   - *Requirements and rules*: per REQ/BR/AC → Covered / Weak (happy path only, no negative or boundary) / Missing. Rules with thresholds need both sides of every boundary; time rules need just-before/at/just-after; attempt limits need each count through limit+1; compound conditions need every branch.
   - *Flows*: main flow end-to-end; ≥1 case per alternate branch; ≥1 per exception (dependency error, timeout, rejection, rollback).
   - *Categories*: happy, unhappy, boundary, validation, alternate/exception, authorization/security (unauthenticated, wrong role, user A vs user B's object, injection on inputs for web/API, sensitive data masking, session reuse after logout), and non-functional only if in scope.
   - *Domain alignment*: apply the matching checklist from `sdlc-qa-domain-checklists` — risk areas covered and covered **deeply** (flag `RISK_SHALLOW` when only a happy path touches a risk), state combinations split rather than one "valid user", integration points tested for failure (`INTEGRATION_FAILURE_UNTESTED`).
4. **Traceability.** Orphan scenarios (no cases), orphan cases (no scenario/requirement), matrix totals that do not add up, coverage percentages computed against the full testable denominator.
5. **Prioritize gaps.**

   | Priority | Criteria | Target |
   |----------|----------|--------|
   | P1 | Gap in main flow, release-blocking rule, money/security/data-integrity risk | Before this release |
   | P2 | Important alternate flow, domain edge case | Next iteration |
   | P3 | Boundary or category weakly covered | Planned backlog |
   | P4 | Rare, nice-to-have | Long-term backlog |

   Each P1/P2 gap states how many cases are needed and **what exactly** they must test ("amount = limit + 0.01 rejected with error X", not "add timeout tests").
6. **Verdict.** `APPROVE` (no critical, gaps acceptable), `APPROVE WITH COMMENTS` (fixable issues, no critical), `REJECT` (any critical flag, missing core-flow coverage, or matrix arithmetic wrong). Consistency check of your own report: counts in the summary match the tables; every gap links to a requirement or domain checklist item.

## Stop and ask

- Baseline and suite disagree because the requirement changed — ask which version is authoritative before flagging.
- A domain convention you would cite is not in the requirements or the domain checklist — mark `NEEDS CONFIRMATION`, do not assert it.

## Guardrails

- Recommend Fix / Remove / Add; do not silently edit the suite. Apply fixes only when the human asks, via `sdlc-qa-test-design`.
- Do not propose cases outside the confirmed scope.
- Findings reference case IDs or state "no case exists".

## Output template

```markdown
## Test suite review — <feature> (<suite version>)
Reviewer: <agent/model, fresh context yes/no> · Baseline: <requirement analysis version>

### Verdict: APPROVE | APPROVE WITH COMMENTS | REJECT
Cases reviewed N · OK x · to fix y · to remove z · critical c · high h

### Distribution
| Category | Cases | Assessment (OK / weak / missing) |

### Findings
| TC-ID(s) | Flag | Severity | Finding | Recommendation |

### Coverage gap summary
Testable requirements T · covered a · weak b · missing m · coverage (a+b)/T = …%
| REQ / BR / AC / flow / risk | Status | Priority | Cases needed (what exactly) |

### Domain alignment
| Risk area / state combo / integration | Status (covered / shallow / missing) | Evidence |

### Questions needing confirmation
### Executive summary (for owner)
3–5 bullets, numbers, recommended next action, go / no-go for using the suite
```

## Hand-off

- `REJECT` / fixes → author applies via `sdlc-qa-test-design`, then re-review.
- `APPROVE` → automation selection (`sdlc-qa-automation`) and execution; gaps accepted by the owner are recorded in the test plan as known coverage limits.
