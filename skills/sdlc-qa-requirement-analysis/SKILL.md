---
name: sdlc-qa-requirement-analysis
description: Analyze requirements from a QA perspective before any test is written — enumerate every requirement statement into a numbered register, classify it (business rule, functional, acceptance criterion, flow, non-functional, out of scope), assess testability, surface gaps, ambiguities and contradictions, assign risk, and send precise questions back to the analyst or product owner. Use when a story, spec, design or change request arrives for testing, or when an existing test suite must be re-baselined against requirements.
stage: 1-discover
role: qa
icon: 🔬
mode: plan
prefer: qa-requirement-analysis, testability-review, requirement-testability
---

# QA requirement analysis

Tests are only as good as the understanding behind them. This skill turns raw inputs into a **requirement register** that every later QA artifact traces to, and a list of questions that must be answered before tests can be trusted. It does not write test cases.

## When to use

- A user story, specification, use-case flow, design file, API contract or change request is handed to QA.
- Before `sdlc-qa-test-plan` and `sdlc-qa-test-design` — always.
- Before `sdlc-qa-testcase-review` of an existing suite, to establish the baseline it is reviewed against.

## When not to use

- Product-level discovery of what to build — that is `sdlc-intake` / `sdlc-ideate` / `sdlc-ba-discovery`. Writing and baselining the requirements themselves is `sdlc-ba-requirements`. This skill consumes their output and reviews it for testability.
- Pure developer unit-test design for code already understood — `sdlc-test`.

## Inputs and reading order

Read in this order so that intent frames detail: (1) user story / ticket and acceptance criteria (and the requirements baseline and its IDs from `sdlc-ba-requirements` if one exists — reuse those IDs rather than renumbering), (2) functional specification, (3) use-case or process flows, (4) designs, mockups and prototypes (`sdlc-prototype`), (5) API contracts and data models, (6) the System Context docs (`sdlc-system-context`) for affected components. Do not read mockups first: screens without rules produce cosmetic tests.

For each source record its status: **Available / Missing / Not applicable**, plus version or date. A missing critical source is a finding, not something to work around silently.

## Procedure

1. **Identify the object under test.** Feature, module, platform type (web UI, mobile app, backend service/API, batch job, data pipeline, integration), actors and roles, entry points and triggers. The platform type steers test design later (web: browser, session, roles; mobile: lifecycle, network, device state; backend/job: data flow, schedules, idempotency, logs).
2. **Enumerate before classifying.** Walk every source paragraph, bullet and table row. Every statement that constrains behavior becomes one register row `REQ-nn` with its source location and a faithful paraphrase. Split compound statements ("must be 6 digits and expire after 3 minutes") into separate rows. Skip pure context and examples. When in doubt, add the row as `Pending` — never drop a statement because it "probably needs no test".
3. **Classify each row** — exactly one type:

   | Type | Meaning | Becomes |
   |------|---------|---------|
   | BR | Business rule, constraint or condition the system must enforce | `BR-nn` |
   | FR | Capability the system must provide, not already expressed as BR/AC | `FR-nn` |
   | AC | Testable acceptance criterion stated by the analyst | `AC-nn` |
   | Flow | Step or branch of a process | Main / alternate / exception flow |
   | NFR | Performance, security threshold, availability, accessibility, compliance | `NFR-nn` (routed to the right test type, not functional cases) |
   | OOS | Explicitly out of scope | No test; recorded |
   | Pending | Cannot be classified yet | Becomes an open question |

4. **Integrity check.** `BR + FR + AC + Flow + NFR + OOS + Pending = total enumerated`, IDs unique and sequential. If the sum does not match, find the dropped row before continuing. Any `Pending` row must have a matching open question.
5. **Testability review** — for each BR/FR/AC/NFR ask:
   - Is the expected outcome observable (screen, response, stored state, log, message, event)?
   - Are values concrete? Flag vague words: "fast", "user-friendly", "appropriate", "valid", "etc.", "as usual", "should".
   - Are thresholds, units, time zones, rounding, limits and counts stated, including what happens exactly **at** the boundary?
   - Are error behaviors specified (message, code, state after failure, retry/rollback)?
   - Are roles and permissions defined for every action, including who must **not** be able to do it?
   - Are state lifecycles complete (all states, allowed and forbidden transitions)?
   - Are dependencies and their failure modes defined (timeout, error, duplicate, out-of-order)?
6. **Detect gaps and conflicts.** Contradictions between sources (story vs spec vs design vs API), rules that exist in the design but not the spec (or the reverse), missing negative paths, missing empty/loading/error states, undefined data migration or backward compatibility, missing audit/logging requirements for sensitive actions. Use `sdlc-qa-domain-checklists` to find risks typical for the domain that the spec forgot.
7. **Assess risk.** For each risk: likelihood, impact (money, security, data integrity, legal, user reach), level High/Medium/Low, and its **impact on test design** (depth, data, environments, automation). Risk drives depth in `sdlc-qa-test-plan`.
8. **Write questions back.** One question per issue, closed where possible, with the options you see, the affected `REQ`/`BR`/`AC`, and what coverage is blocked until answered. Do not answer your own questions. An assumption is allowed only when it is labelled, scoped, and states what breaks if it is wrong.
9. **Map requirement to test direction** — the bridge to test design: BR → rule condition to verify; FR → capability check; AC → acceptance scenario; validation rule → negative and boundary direction; flow branch → scenario; NFR → test type and owner (performance, security, accessibility).
10. **Request an independent review** of the register and summary before hand-off — ideally a fresh agent with no conversation history, given only the files and this checklist: does every rule in the spec appear in the register; are flow branches complete; are assumptions sourced; are happy, unhappy, boundary and security directions all present; are questions specific and impact-tagged.

## Stop and ask

- No source states what the feature must do, or sources contradict each other on core behavior — stop; send the questions; do not design tests on guesses.
- Platform type, roles or the domain cannot be determined.
- A requirement implies irreversible or regulated effects (payments, deletions, notifications to real people) and the expected safeguards are not specified.

## Guardrails

- Never invent a business rule, threshold, message text or UI element. Unknown means open question.
- Keep source references for every row so anyone can verify the paraphrase.
- Do not generate test cases here; directions only.
- Non-functional items are never silently dropped — they are routed with an owner.

## Output template

```markdown
## QA requirement analysis — <feature> (<version/date>)

### Input sources
| Source | Status | Version / location | Notes |
|--------|--------|--------------------|-------|

### Object under test
Platform type · Actors/roles · Entry points · In scope · Out of scope · Dependencies

### Requirement register
Total N — BR x · FR y · AC z · Flow w · NFR p · OOS q · Pending 0 · Integrity: PASS
| REQ-ID | Source | Statement (faithful paraphrase) | Type | Classified as | Priority | Testability | Notes |
|--------|--------|---------------------------------|------|---------------|----------|-------------|-------|

### Flows
Main flow (happy path) · Alternate flows · Exception flows (each branch numbered)

### Testability findings and conflicts
| # | REQ | Issue (vague / missing / conflict / untestable) | Impact on testing |
|---|-----|-----------------------------------------------|-------------------|

### Risks
| Risk | Level | Impact on test design | Impact on regression/automation |
|------|-------|-----------------------|----------------------------------|

### Assumptions (each with "if wrong, then …")
### Questions for analyst / product owner
| Q-ID | Question | Options seen | Affects | Coverage blocked until answered |
|------|----------|--------------|---------|----------------------------------|

### Requirement → test direction
| REQ / BR / AC | Test direction | Techniques hinted | Test type |
|---------------|----------------|-------------------|-----------|
```

## Hand-off

- Register and directions → `sdlc-qa-test-plan` (scope, risk-based priority) and `sdlc-qa-test-design` (scenarios and cases). The register's IDs are the traceability keys for the whole QA chain.
- Questions → the human, who routes them to the analyst/product owner; record answers in the register and re-run the integrity check.
- Requirement defects found here (contradictions, untestable criteria) are reported like any defect via `sdlc-qa-defect` if the project tracks them.
