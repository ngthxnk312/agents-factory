---
name: sdlc-intake
description: Take in a ticket, bug report or request and turn it into a confirmed understanding — classification, task summary, testable acceptance criteria, affected areas, risks and a list of clarifying questions — before any design or code. Use as the first step of any non-trivial task, or whenever a request is vague, contradictory or missing data.
stage: 1-discover
role: ba
icon: 📥
mode: plan
prefer: intake, ticket-intake, requirements-intake
---

# Intake

Your job is to make sure everyone agrees on **what** is being asked before anyone decides **how**. Do not design, estimate in detail or write code here. Never fabricate missing input: if something is unknown, it becomes a question.

## When to use

- A new ticket, user story, bug report, support escalation or chat request arrives.
- A request is ambiguous, contradicts itself or existing behavior, or lacks acceptance criteria.
- Resuming a task whose context you do not have.

## When not to use

- Trivial, fully specified changes (typo, version bump, one-line config with an exact value) — go straight to `sdlc-implement`.
- Pure exploration of ideas with no concrete request yet — use `sdlc-ideate`.
- Live production incidents — use `sdlc-incident` first; do intake for the follow-up work.

## Inputs to gather

1. **The request itself:** ticket title, description, acceptance criteria, attachments, comments, linked tickets. If the ticket lives in a tracker you can read (through an available tool/integration), read it; otherwise ask the human to paste it. Identify the ticket key from the prompt, branch name or recent commits; if there is none, ask.
2. **Specifications:** linked specs, design docs, mockups, prototypes.
3. **Project context:** `CLAUDE.md`/`AGENTS.md`, the System Context if one exists (`sdlc-system-context`), ADRs, feature docs for the area.
4. **Existing reference knowledge** (prior analyses of this feature). Treat it as a starting point: report its age, and verify it against current code before relying on it.
5. **The code:** search for the area mentioned; read entry points and the main flow just enough to locate the change. Cite paths.
6. **For bugs:** environment (local, staging, production), version/build, exact steps, expected vs actual, frequency, first seen, logs or error ids, affected users/data.

## Procedure

1. **Classify** the request:
   - Type: `feature` · `enhancement` · `bug` · `refactor` · `chore` · `spike/research` · `docs` · `incident follow-up`.
   - Size guess: `XS` (< 1h) · `S` (≤ ½ day) · `M` (≤ 2 days) · `L` (> 2 days → will need `sdlc-breakdown`).
   - Risk flags: touches money, authentication/authorization, personal data, schema/data migration, public API contract, shared core module, external integration, performance-sensitive path, production data fix.
2. **Summarize your understanding** in one short paragraph in your own words: who needs what, why, and what changes for them. This is what the requester confirms.
3. **Extract or write acceptance criteria** as numbered, testable Given/When/Then statements. Keep the requester's criteria verbatim and add derived ones marked *(proposed)*. Include at least one negative criterion (what must not happen) and authorization criteria when user data is involved.
4. **Define scope:** in scope, out of scope, explicitly deferred.
5. **Locate impact:** modules, files, endpoints, screens, tables, jobs and integrations likely affected, with paths. Note dependants of shared modules.
6. **List risks and unknowns** with the risk flags from step 1.
7. **Write clarifying questions.** Each question is specific, answerable, and says why it matters and what you will assume if it stays unanswered. Group them by audience (product/requester, design, architecture/owner, operations). Prefer multiple-choice phrasing where possible.
8. **For bugs:** state whether you could reproduce it (or what is needed to), the suspected area, and whether production data may need correction (if so, flag it for `sdlc-incident` procedures).
9. **Recommend the next step:** `sdlc-ideate` (problem unclear, multiple solution directions), `sdlc-design` (clear problem, non-trivial solution), `sdlc-breakdown` (clear design, large work), `sdlc-debug` (bug), or `sdlc-implement` (small and clear).

## Stop conditions (clarity gate)

Stop and wait for the human when any of these hold:

- No acceptance criteria can be stated without guessing at business intent.
- The request contradicts current behavior, another ticket, a domain rule or a regulation.
- The ticket/spec cannot be read and the human has not provided its content.
- A risk flag is set for money, permissions, personal data or production data, and the expected behavior is not explicit.

Do not proceed on assumptions in these cases. For lower-risk gaps you may proceed with clearly labeled assumptions only if the human agrees.

## Output template

```markdown
## Intake — <ticket key or short title>

**Type:** <feature | bug | …>   **Size:** <XS–L>   **Risk flags:** <list or none>
**Sources:** <ticket, specs, docs (with age, verified yes/no), code paths read>

### Understanding
<one paragraph in plain language>

### Acceptance criteria
1. Given …, when …, then …
2. Given …, when …, then … *(proposed)*
3. Negative: Given user A, when requesting user B's <object>, then not found.

### Scope
- In: …
- Out: …
- Deferred: …

### Impacted areas
| Area | Path / identifier | Notes |
|------|-------------------|-------|

### Risks & unknowns
- …

### Clarifying questions (status: Open)
| # | Question | Audience | Why it matters | Default assumption if unanswered |
|---|----------|----------|----------------|----------------------------------|

### (Bugs) Reproduction status
<reproduced / not yet — what is needed; environment; version>

### Recommended next step
<skill name and why>
```

Track question status (`Open` → `Answered`) when the human replies, and update the acceptance criteria accordingly before moving on.
