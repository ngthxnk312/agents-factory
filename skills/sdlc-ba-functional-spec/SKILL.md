---
name: sdlc-ba-functional-spec
description: Write the functional specification of one feature from baselined requirements or an approved feature brief — description, actors and permissions, scope per platform, numbered processing flow, configuration, constraints and impacts, business rules, validations, state model, exact messages, user stories with Given/When/Then criteria, full use cases (main, alternative, error flows) and a traceability appendix, plus story candidates for the backlog. Use when a feature's behaviour must be specified for design, development and testing, or an existing functional spec must be updated.
stage: 3-design
role: ba
icon: 📝
mode: plan
prefer: functional-spec, functional-specification, feature-specification
---

# Functional specification (per feature)

The functional spec says precisely **what** the feature does — for every actor, path and failure — without deciding **how** it is built. A developer should be able to design from it and a tester should be able to derive test cases from it without asking the analyst. It never invents business rules, data fields, limits, service levels or priorities: what the source does not say is a `GAP` or `Q-`.

## When to use

- Use cases or stories in scope are baselined (or a feature brief is approved) and the feature needs a specification.
- An existing functional spec must change after an approved `CR-`.

## When not to use

- Requirements are not baselined, or a Critical question is open → `sdlc-ba-requirements` first.
- Only a diagram is needed → `sdlc-ba-process-flow`; only screens → `sdlc-ba-ui-spec`; a formal document for sign-off → `sdlc-ba-srs` (which builds on this).
- Technical design (components, data model, APIs) → `sdlc-sa-solution-design`, `sdlc-design`.

## BA conventions (shared by every sdlc-ba-* skill)

- **Label, don't upgrade.** Every statement is a fact, decision, requirement, assumption, constraint, hypothesis, risk, dependency, out-of-scope item, conflict or open question. Never relabel an opinion or inference so it looks decided.
- **Stable IDs, never reused:** `BO-` · `BR-` · `UC-` · `US-` · `AC-` · `FR-` · `NFR-` · `BRL-` business rule · `INT-` · `CON-` · `ASM-` · `Q-` · `FEAT-` · `SCR-` screen · `API-` · `ERR-` message · `DL-` decision · `CR-` change request (after baseline only).
- **Source of truth:** recorded decision → baselined requirements or approved feature brief → functional spec → process flow → UI spec/prototype → SRS. A new rule found here goes back upstream as `Q-`/`CR-`; it is not written in as fact.
- **Draft vs baseline.** DRAFT until a named approver accepts; never overwrite a baselined version; new version + change log.
- **Traceability.** Every section cites the requirement IDs it realises.
- **Unattended runs.** No human available: record questions as `Q-` (owner, impact), label working assumptions `[ASSUMPTION]`, keep DRAFT, list "Needs approval: <decision> — <approver>". Never assume security, privacy, legal or compliance answers. Cannot proceed at all → first line `BLOCKED: <reason>`.

## Entry gate (check before writing)

- [ ] Source artifact and version identified; IDs in scope listed.
- [ ] Each use case/story in scope has a source, owner, actor, trigger and expected outcome.
- [ ] Applicable rules, NFRs, dependencies and constraints are known or listed as questions.
- [ ] No unresolved Critical question in scope (or a recorded decision accepting it).
If any item fails, stop and send the gap to `sdlc-ba-requirements`.

## Procedure

1. **Read all inputs:** requirements/brief, decisions, open questions, existing specs of neighbouring features, any mockups or prototypes, and the current system behaviour (code or documentation) when this changes an existing feature.
2. **Challenge and clarify** in groups of at most 5–7 questions, most important first:
   - General: target release, document owner, designer, developers, testers.
   - Function: sub-features, actors and their permissions, platforms in scope (web, mobile, API only, back office), step-by-step main flow, configuration (limits, toggles, defaults, audit).
   - Constraints and impacts: validations, effects on other systems, notifications, performance or usability side effects.
   - Use cases: how many, names, preconditions, main and alternative flows, priority.
3. **Confirmation summary** before writing: feature name, scope, actors, flow outline, configuration, constraints, list of use cases with one-line story and priority. Wait for confirmation (unattended: proceed and mark as assumed).
4. **Write the specification** using the structure below and the full template in `reference/functional-spec-template.md`. Keep the user's terminology and names of screens and functions exactly.
5. **Probe edge cases** for every flow: empty and maximum inputs, limits reached, duplicate submission, concurrent edits, permission denied, partial failure, external system timeout with unknown outcome, cancellation midway, session expiry, time zone and cut-off times, data from older versions. Each case gets a defined behaviour or a `Q-`.
6. **Self-review as a tester** (can I write test cases now? every rule and message has a triggering condition?) **and as a developer** (is every state, validation and permission unambiguous?). Fix gaps or raise questions; list what you changed.
7. **Present the draft** for review; revise; export or save only after the owner confirms. Increase the version on every issued revision.

## Specification structure

1. **Document information** — feature, release, epic, status (DRAFT / IN REVIEW / APPROVED), owner, designer, developers, testers, sources with versions.
2. **Description** — overview (2–4 sentences, business view); sub-features `FT-`; actors and systems with roles; scope per platform and explicit out-of-scope; main processing flow as numbered steps `FL-`; configuration `CFG-` (limits, toggles, defaults, who can change them, audited or not).
3. **Constraints and impacts** — constraints `CST-`; impact on other systems `IMP-SYS-`; impact on user groups `IMP-USR-`.
4. **Business rules** — `BRL-`: condition → outcome, a worked example with data, source.
5. **Validations** — field/input, rule, when validated (on input, on submit, server side), message ID.
6. **State model** (when an entity has a lifecycle) — states, allowed transitions, who may trigger each, guards, side effects; forbidden transitions stated.
7. **Messages** — `ERR-`/`MSG-` ID, exact text the user sees, condition that triggers it.
8. **Permissions** — role × action matrix, including what a role must **not** see or do; object-level ownership rules.
9. **User stories and acceptance criteria** — `US-` with As a / I want / So that / priority; each with `AC-` in Given/When/Then, including negative and authorisation cases. Stories and use cases are many-to-many.
10. **Use cases** — `UC-`: related stories and criteria, actor, trigger, preconditions, priority (MUST/SHOULD/COULD), notes; main flow (numbered), alternative flows, error flows, postconditions. Keep every heading even if empty ("None").
11. **Traceability appendix** — requirement → story → criteria → use case → rule/flow/config IDs.
12. **Open questions, assumptions, decision log.**
13. **Story candidates** for the backlog (table below).

## Writing rules

- Number every flow step; one actor action or system response per step.
- Name the actor and the element: "Approver selects [Reject]", not "the user clicks".
- Exact system responses: what is validated, what is stored, what the user sees.
- No visual styling (colours, fonts, sizes) — reference the UI spec or design tokens (`sdlc-ba-ui-spec`).
- Unknown values are written `TBD — source silent` or `GAP — needs confirmation (Q-nn)`, never filled in.

## Story candidates (hand-off to the backlog)

```markdown
| Key | Title | Priority | Requirement IDs | Acceptance criteria (testable sentences) | Sub-tasks |
|-----|-------|----------|-----------------|-------------------------------------------|-----------|
| S1 | Approver rejects a request with a reason | MUST | UC-03, BRL-07 | Rejection requires a reason of 10–500 characters; the requester is notified; the request becomes Rejected and cannot be edited | DEV, TEST |
```
These are proposals; the product owner and PM decide what enters the backlog (`sdlc-pm-sprint`). Creating tickets requires approval.

## Quality checks

- [ ] Every in-scope requirement ID appears in the traceability appendix.
- [ ] Every use case has main, alternative and error flows (or "None" with reason) and postconditions.
- [ ] Every decision point in a flow has all outcomes defined.
- [ ] Every rule, validation and message has a triggering condition and a reference to where it applies.
- [ ] Permissions include negative cases.
- [ ] No invented rule, field, limit, SLA or priority; every unknown is a `Q-`/`GAP`.
- [ ] Terminology matches the glossary and the user's names.

## Stop conditions

- A flow cannot be completed without deciding a business rule — ask the owner.
- The spec reveals new scope — raise `Q-`/`CR-` to `sdlc-ba-requirements`; do not add it.

## Hand-off

Approved spec → `sdlc-ba-process-flow` (diagrams), `sdlc-ba-ui-spec` (screens, if any UI), `sdlc-ba-srs` (formal specification), `sdlc-sa-solution-design` (architecture), story candidates → `sdlc-pm-sprint`. Handover packet: spec version, IDs in scope, approval status, open questions and assumptions, change log.
