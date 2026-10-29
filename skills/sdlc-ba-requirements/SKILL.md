---
name: sdlc-ba-requirements
description: Own the requirements baseline — synthesise meeting notes or transcripts into sourced, classified and ID'd items; review a client-provided requirements document for gaps with severity, evidence and clarification questions; write testable requirements, user stories and acceptance criteria; prioritise with MoSCoW; maintain the user requirements document (URD), decision log, open questions, change requests after baseline and the requirements traceability matrix. Use after an elicitation meeting, when a client sends a requirements document, or when requirements must be written, prioritised, baselined, changed or traced.
stage: 1-discover
role: ba
icon: 📋
mode: plan
prefer: requirements-analysis, requirements-synthesis, user-requirements
---

# Requirements (synthesis, review, baseline, traceability)

This skill is the **single owner of the requirements baseline** (the URD — user requirements document — and its versions). Every later artifact — functional spec, flows, UI spec, SRS, design, tests — traces back to the IDs created here. Quality here is cheap; ambiguity here is paid for at every later step.

## When to use

- Notes, transcripts or minutes from elicitation must become structured requirements.
- A client sent a requirements document (URD/BRD/RFP annex) that must be reviewed before we accept it.
- Requirements, user stories or acceptance criteria must be written, prioritised or baselined.
- A change arrives after baseline, or a downstream artifact found a gap (`Q-`/`CR-` returned upstream).
- A traceability matrix is needed.

## When not to use

- Preparing the meeting itself, or discovery from a vague brief → `sdlc-ba-discovery`.
- Detailed behaviour of one feature (flows, rules, states, messages) → `sdlc-ba-functional-spec`.
- A single engineering ticket → `sdlc-intake`.

## BA conventions (shared by every sdlc-ba-* skill)

- **Label, don't upgrade.** Every statement is a fact, decision, requirement, assumption, constraint, hypothesis, risk, dependency, out-of-scope item, conflict or open question. Never relabel an opinion or inference so it looks decided.
- **Stable IDs, never reused:** `BO-` objective · `BR-` business requirement · `UC-` use case · `US-` user story · `AC-` acceptance criterion · `FR-` functional requirement · `NFR-` · `BRL-` business rule · `INT-` integration · `CON-` constraint · `ASM-` assumption · `Q-` open question · `FEAT-` feature proposal · `SCR-` screen · `API-` · `ERR-` message · `DL-` decision · `CR-` change request (after baseline only).
- **Source of truth** when artifacts disagree: recorded decision → baselined requirements or approved feature brief → functional spec → process flow → UI spec/prototype → SRS. Downstream never silently overrides upstream.
- **Draft vs baseline.** Everything is DRAFT until a named approver accepts it. Never overwrite a baseline; changes create a new version with a change-log entry (what, why, source, owner, date).
- **Traceability.** Every item cites its source: document + version + section, or meeting + date + speaker/decider.
- **Unattended runs.** If no human can answer in this session, record questions as `Q-`, label working assumptions `[ASSUMPTION]`, keep everything DRAFT and list "Needs approval: <decision> — <approver>". Never assume answers to security, privacy, legal or compliance questions. If the task cannot be done at all, the first line is `BLOCKED: <reason>`.

## Path A — Synthesis from meetings

1. Read every note/transcript fully. Extract separately: requirements, decisions, assumptions, constraints, out-of-scope items, dependencies, conflicts and open questions.
2. Tag each item with its source: meeting, date, speaker, and — for decisions — the person with authority who decided. "Someone said" is not a decision.
3. Compare with existing artifacts and earlier decisions: flag contradictions, changed positions and gaps. Do not pick a side; a conflict becomes a `Q-` addressed to the decision owner.
4. Present the extraction grouped by type and ask the BA to dispose each group: confirm as requirement · move to open question · keep as assumption · drop. In unattended runs, leave the disposition as proposed.
5. Assign IDs; write items using the quality rules below.
6. Produce or update the URD draft (template in `reference/urd-template.md`), the decision log, the open-question list and the change log.

## Path B — Review of a client-provided document

1. Map every section of the client document to our structure, keeping trace to the original section/page.
2. Check coverage: scope, stakeholders/actors, as-is/to-be, requirements, business rules, non-functional requirements, integrations, data, compliance, constraints, assumptions, open questions, approval/ownership.
3. Flag findings: missing section · ambiguous or untestable statement · NFR without a metric · contradiction · missing owner or dependency · unverified compliance claim · unrealistic constraint.
4. Severity by go/no-go impact: **Critical** (blocks scope, compliance or contract), **High** (changes scope, NFR, integration or outcome), **Medium** (needs clarification before specification), **Low** (wording, consistency). Each finding has evidence (quoted text or "absent") and a proposed clarification question.
5. Keep three things visibly separate: the client's original text, the analyst's observation, and the analyst's proposal. Never silently edit or "fix" the client's text.
6. Deliverables: review report, requirement mapping, clarification list (template in `reference/document-review-template.md`). Critical and High findings that affect scope, compliance, NFR, integration or outcome must have a recorded answer before the URD can be baselined. Review findings never go straight to functional specification — they come back through Path A.

## Writing requirements that survive

- **Quality criteria:** atomic (one need), unambiguous, testable, feasible, necessary (traces to an objective), consistent, prioritised, sourced.
- **Banned vagueness** unless quantified: fast, user-friendly, flexible, robust, secure, etc., and/or, as appropriate, support, handle, optimal, minimal, real-time. Replace with numbers, conditions, or a `Q-`.
- **Forms:** "The system shall <capability> <condition> <constraint>" for system requirements; "As a <role>, I want <capability> so that <benefit>" for user stories (INVEST: independent, negotiable, valuable, estimable, small, testable). Use cases for multi-step interactions with alternatives and errors (`sdlc-ba-functional-spec` details them).
- **Acceptance criteria:** numbered Given/When/Then; include at least one negative criterion and, wherever data belongs to someone, an authorisation criterion (user A cannot see or change user B's data).
- **Non-functional needs** must carry a metric, threshold and measurement method; hand quantification to `sdlc-sa-nfr-review` when the business cannot state them.
- **Business rules** are stated separately (`BRL-`) and referenced by requirements, not buried in them.

## Prioritisation (MoSCoW)

Must (no release without it) · Should (important, workaround exists) · Could (desirable) · Won't this time (explicitly out, kept for later). The business owner sets priority; the analyst facilitates and challenges. Warn when Must exceeds about 60% of estimated effort — there is no contingency left.

## Baseline and change

- Baseline only when the named approver has accepted; record approver, date and version in the decision log. Drafts are labelled "DRAFT — not approved".
- No baseline while a Critical open question is unresolved, unless the approver accepts the condition in a recorded decision.
- After baseline, any change is a `CR-`: record source, reason, affected IDs, impact on downstream artifacts (functional spec sections, flows, screens, APIs, SRS sections, tests) and create a new URD version only after approval. Schedule and cost impact go to `sdlc-pm-change-control`.
- Downstream skills that discover a new rule, scope item or requirement send it back here as `Q-`/`CR-`; they never legitimise it themselves.

## Traceability matrix (RTM)

The RTM only aggregates IDs and statuses that already exist in source artifacts — it creates no new IDs or decisions.

| Requirement (BR/FEAT) | Use case / story | Functional spec section | Flow step | Screen / API | SRS section | Test candidate | Status | Q / CR |
|---|---|---|---|---|---|---|---|---|

A requirement without downstream coverage shows the gap in the last column; never leave it blank as if covered. Update the RTM whenever a source artifact is baselined or a `CR-` changes a mapping, as a new version.

## Open questions and decision log formats

```markdown
| ID | Question | Severity (Critical/High/Medium/Low) | Type (business/scope/nfr/integration/data/compliance/security/legal/owner) | Owner to answer | Impact if wrong | Status (Open/Answered) | Answer + source |
| ID | Decision | Decided by (person/role with authority) | Source | Date | Status |
```

The agent never closes a question or creates a decision on its own; it records answers that arrive with their source.

## Stop conditions

- Unclear whether a statement is a confirmed requirement or background narrative — ask.
- Conflicting statements without a decision owner.
- Baseline requested while Critical questions are open and no recorded acceptance exists.

## Output

The URD draft per `reference/urd-template.md`, plus a short summary for the reviewer: counts per item type, new/changed/removed IDs since the previous version, open Critical/High questions, decisions needed and their owners, and the recommended next step.

## Hand-off

Baselined use cases and stories → `sdlc-ba-functional-spec` (handover packet: source artifact and version, IDs in scope, owner and approval status, rules/NFRs/dependencies/constraints, open questions and assumptions, change log, expected output). Open questions → the next meeting via `sdlc-ba-discovery`. NFRs needing numbers → `sdlc-sa-nfr-review`. Scope change decisions → `sdlc-pm-change-control`.
