---
name: sdlc-design
description: Produce a concise, reviewable technical design for a feature or change — context, proposed components, data and interface changes, flows per user story, edge cases, security, observability, alternatives and rollout — that fits the existing codebase. Use before implementing anything that touches several modules, persistent data, public interfaces, security or external integrations.
stage: 3-design
role: sa
icon: 📐
mode: plan
prefer: technical-design, system-design, architecture-design
---

# Technical design

You are the engineer writing the design that reviewers approve before code is written. It must be reviewable in about ten minutes. Do not write production code.

## When to use

- The change spans several modules or layers, adds or changes persistent data, changes a public interface, touches authentication/authorization, money or personal data, or adds an external integration.
- A reviewer or owner needs to approve the approach.

## When not to use

- Small, local changes that follow an obvious existing pattern — note the approach in the plan and move on.
- The direction is still open — use `sdlc-ideate` first.
- Pure API contract work — `sdlc-api-design` (call it from here when the design includes API changes).

## Inputs

Intake output (`sdlc-intake`), chosen option (`sdlc-ideate`), System Context and its delta (`sdlc-system-context`), approved prototype if UI is involved (`sdlc-prototype`), project rules, and the relevant code.

## Procedure

1. **Read before designing.** Trace the current code path end to end for the affected flows. Find the closest existing feature and how it is structured. Summarize current behavior with file references.
2. **Propose the design**:
   - components and their responsibilities, placed in the correct layer (`sdlc-standards` → architecture);
   - data flow per user story (numbered steps or a sequence diagram);
   - data model changes (entities, columns, indexes, constraints, ownership) — hand migration mechanics to `sdlc-db-migration`;
   - interface changes (endpoints, events, UI routes, CLI) — hand contract detail to `sdlc-api-design`;
   - configuration, feature flags and secrets (names only, never values).
3. **Show fit.** Explain how it follows existing patterns. Any new dependency, pattern, service or datastore needs a justification and usually an ADR.
4. **Edge cases and failure modes**: validation failures, empty/large inputs, concurrency and duplicate submission, partial failure and retries, remote timeouts with unknown outcome, time zones and cut-offs, backward compatibility, behavior during rolling deploys (old and new code running together).
5. **Security and privacy**: who may call/see what; the object-level authorization rule for every id-based access; input validation; sensitive data stored, logged or returned; secrets needed; abuse cases (enumeration, replay, mass assignment).
6. **Observability**: logs (with correlation id, without sensitive data), metrics and alerts that would tell on-call it works or is failing; audit records for sensitive actions.
7. **Performance and scale**: expected volumes, query patterns and indexes, pagination, caching, time-growing tables (partitioning decision).
8. **Alternatives considered** — one or two, and why they lost.
9. **Rollout and rollback**: order of deployment (migration expand before code), feature flag, data backfill, how to roll back or roll forward, what cannot be undone.
10. **Testing approach**: which levels prove which acceptance criteria; what needs integration tests against real dependencies; authorization negative tests.
11. **Decisions** — record significant ones as ADRs (template below) and list open questions for the reviewer.

Use a small Mermaid or ASCII diagram when it explains faster than prose. Keep the main document short; put per-story flows in separate sections.

## Stop conditions

- A decision requires owner approval (new service or datastore, new external dependency, breaking change, data deletion, security trade-off) — present options and wait.
- Required behavior for an edge case involving money, permissions or personal data is unspecified — ask; do not choose silently.

## Output template

```markdown
## Design — <feature> (<ticket>)
Status: DRAFT | IN REVIEW | APPROVED   ·   Last verified: YYYY-MM-DD

### 1. Context
<problem, current behavior with file references, constraints>

### 2. Proposed design
<components and responsibilities; diagram>

### 3. Flows (one per user story)
#### <US-id>: <title>
Actor · Preconditions · Related AC
1. Client → <interface>
2. Entry point validates → calls <use case/service>
3. Service: <rules, transactions, remote calls (outside the transaction)>
4. Persist / publish
5. Response
Business rules: … · Data touched: … · Idempotency: …
| Edge case | Handling | Error code |
|-----------|----------|------------|

### 4. Data model changes
### 5. Interface changes  (details: sdlc-api-design)
### 6. Security & privacy
### 7. Observability
### 8. Performance & scale
### 9. Alternatives considered
### 10. Rollout & rollback
### 11. Test approach
### 12. Decisions & open questions
```

ADR template (one file per significant decision):

```markdown
# ADR-<NNN>: <decision in one line>
Status: PROPOSED | ACCEPTED | SUPERSEDED by ADR-<x>   ·   Date: YYYY-MM-DD
## Context      <problem, forces, constraints>
## Options      | Option | Pros | Cons |
## Decision     <chosen option and why>
## Consequences <trade-offs accepted, follow-up work, risks to watch>
```

Hand off to `sdlc-breakdown` once the design is approved.
