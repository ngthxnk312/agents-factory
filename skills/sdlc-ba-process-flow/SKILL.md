---
name: sdlc-ba-process-flow
description: Model business processes and system interactions as reviewable Mermaid diagrams — swimlane flowcharts for who-does-what, sequence diagrams for system interactions, state diagrams for entity lifecycles — with every decision branch labelled, every error path ending in a retry or a stop, lanes owned by real actors, and a step table that traces to use cases and rules. Use when a process, use case, approval chain or integration flow must be drawn, reviewed or updated, or when as-is and to-be processes need comparing.
stage: 3-design
role: ba
icon: 🔀
mode: plan
prefer: process-flow, flow-diagram, bpmn-diagram
---

# Process flows and diagrams

A diagram is a specification in picture form: reviewers find missing branches in a picture that they would miss in prose. Draw only what the sources say; a branch you cannot label is a question, not a guess.

## When to use

- A use case, approval chain or business process needs a swimlane diagram.
- System-to-system interactions need a sequence diagram (including failures).
- An entity has a lifecycle (draft → submitted → approved…) that needs a state diagram.
- As-is vs to-be comparison for discovery.

## When not to use

- Behaviour is not yet specified → `sdlc-ba-functional-spec` (or `sdlc-ba-requirements`) first.
- Technical architecture diagrams (containers, deployment) → `sdlc-sa-solution-design`.

## BA conventions (shared by every sdlc-ba-* skill)

- **Label, don't upgrade:** facts, decisions, requirements, assumptions, constraints, hypotheses, risks, dependencies, out-of-scope items, conflicts and open questions stay distinct.
- **Stable IDs:** reuse the IDs of the source (`UC-`, `FL-`, `BRL-`, `ERR-`, `SCR-`, `API-`, `Q-`); never invent new requirement IDs in a diagram.
- **Source of truth:** recorded decision → baselined requirements → functional spec → process flow → UI spec → SRS. A diagram that reveals a new rule or branch raises `Q-`/`CR-` upstream instead of drawing it as fact.
- **Draft vs baseline:** DRAFT until approved; revisions are new versions, never silent edits of an approved diagram.
- **Unattended runs:** no human available → draw what is supported, mark unknown branches with a `Q-` note, list "Needs approval: … — <approver>"; cannot proceed → first line `BLOCKED: <reason>`.

## Choose the diagram

| Question it answers | Diagram | Mermaid |
|---|---|---|
| Who does what, in which order, with which decisions? | Swimlane flowchart | `flowchart TB` with one `subgraph` per lane |
| Which system calls which, with what, and what if it fails? | Sequence diagram | `sequenceDiagram` with `alt`/`opt`/`loop` |
| Which states can an entity be in and how does it move? | State diagram | `stateDiagram-v2` |
| How does the end-to-end business process cross departments? | Swimlane flowchart at business level (one lane per department) | `flowchart LR` |

If the organisation mandates BPMN or a drawing tool, keep Mermaid as the reviewable source and state the mapping (start/end events, tasks, exclusive gateways, message flows); export only when asked.

## Procedure

1. **Read the sources:** use case or functional spec (flows, rules, validations, messages), UI spec if any, integration notes.
2. **Identify lanes** (real actors and systems: user role, front end, back end/service, external system, scheduler, notification service), the trigger, the main path, alternative paths and error paths.
3. **Clarify before drawing** (at most 5–7 questions, grouped): trigger type (user action, schedule, inbound call); every decision condition; what happens when validation fails (retry? abort?); approvals and confirmations; what is stored, audited and notified; timeouts and unknown outcomes with external systems; extra lanes needed.
4. **Confirm understanding** in a short summary (lanes, main path, exceptions, special points). Unattended: proceed and mark assumptions.
5. **Draw** following the conventions below; keep step IDs aligned with the functional spec (`FL-…` / use-case step numbers).
6. **Add the step table** so the diagram is reviewable in text and traceable.
7. **Self-check** with the checklist; present as DRAFT; revise as new versions.

## Conventions

- Exactly one start; every path reaches an end (`Done`, `Cancelled`, `Rejected`…) — no dangling nodes.
- Node text: verb + object ("Validate amount", "Create transfer"). Decisions are questions ("Amount ≤ daily limit?") with **every** outgoing edge labelled; the labels cover all outcomes.
- Every error node leads to a retry/correction step or to a terminal outcome — never nowhere.
- Show where data is persisted, audited and where notifications are sent.
- External calls show the failure branch (error, timeout, unknown outcome → status check or reconciliation).
- Keep one diagram ≤ about 25 nodes; split by phase or sub-flow and link them by name.
- Style classes: `decision`, `error`, `external`, `done` — consistent across diagrams. No colours carry meaning without a legend.
- Mermaid hygiene: quote labels containing punctuation (`A["Check: limit?"]`); do not use the bare word `end` as a node id; keep ids short and unique (`U1`, `FE2`, `BE3`).

## Skeletons

```mermaid
flowchart TB
  start((Start)) --> U1
  subgraph User["Requester"]
    U1["Fill request form"] --> U2["Submit"]
    U4["Correct the data"]
  end
  subgraph FE["Front end"]
    F1{"Form valid?"}
    F2["Show field errors (ERR-REQ-01)"]
  end
  subgraph BE["Back end"]
    B1["Check daily limit (BRL-REQ-02)"] --> B2{"Within limit?"}
    B3["Save request, status Submitted, audit"]
    B4["Reject (ERR-REQ-03)"]
  end
  U2 --> F1
  F1 -- "No" --> F2 --> U4 --> U2
  F1 -- "Yes" --> B1
  B2 -- "Yes" --> B3 --> done((Done))
  B2 -- "No" --> B4 --> stop((Rejected))
  classDef decision fill:#fff2cc,stroke:#d6b656
  classDef error fill:#f8cecc,stroke:#b85450
  class F1,B2 decision
  class F2,B4 error
```

```mermaid
sequenceDiagram
  autonumber
  actor U as Customer
  participant App
  participant API as Orders service
  participant PSP as Payment provider
  U->>App: Confirm payment
  App->>API: POST /payments (idempotency key)
  API->>PSP: Charge
  alt approved
    PSP-->>API: approved
    API-->>App: 201 Paid
  else declined
    PSP-->>API: declined (code)
    API-->>App: 422 ERR-PAY-02
  else timeout / unknown outcome
    API->>PSP: Query status (retry with backoff)
    API-->>App: 202 Pending — resolved by reconciliation
  end
```

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Submitted: submit [form valid]
  Submitted --> Approved: approve [approver ≠ requester]
  Submitted --> Rejected: reject [reason given]
  Rejected --> Draft: revise
  Approved --> [*]
```

## Step table

```markdown
| Step | Lane | Action / decision | Rule / message refs | Next (condition → step) | Source |
|------|------|-------------------|---------------------|-------------------------|--------|
| 1 | Requester | Submit form | — | → 2 | UC-REQ-01 step 1 |
| 2 | Front end | Form valid? | ERR-REQ-01 | Yes → 3 · No → 2a | FL-REQ-01-02 |
```

## Checklist

- [ ] One start; every path ends in a named outcome.
- [ ] Every decision has labelled branches covering all outcomes.
- [ ] Every error path goes to retry/correction or a terminal outcome.
- [ ] Lanes are real actors/systems with owners; no "misc" lane.
- [ ] External calls show failure and timeout handling.
- [ ] Persistence, audit and notifications are visible where they happen.
- [ ] Step table matches the diagram and cites sources; unknowns are `Q-` notes.
- [ ] Mermaid renders (balanced subgraphs, quoted labels, unique ids).

## Stop conditions

- A decision condition or error behaviour is undefined in the sources — ask; do not invent a branch.
- The flow needs a lane or step that adds scope — raise `Q-`/`CR-` upstream.

## Hand-off

Approved flows go to `sdlc-ba-ui-spec` (screens follow the front-end lane and user actions), `sdlc-ba-srs` (business process section), `sdlc-sa-solution-design` and `sdlc-sa-integration` (sequence diagrams as the starting point), and testers (each path is a test scenario).
