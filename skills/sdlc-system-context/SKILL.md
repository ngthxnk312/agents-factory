---
name: sdlc-system-context
description: Map an existing (brownfield) codebase into a small set of verified context documents — architecture, API catalog, business flows, data model, integrations, domain rules, known pitfalls — and keep them current with a per-change delta and a post-release merge. Use once when adopting AI on an undocumented codebase (init), at the start of each change on it (delta), and after that change ships (update).
stage: 0-foundation
role: sa
icon: 🗺
mode: acceptEdits
prefer: system-context, codebase-map, system-context-init
---

# System context (brownfield map)

AI agents and new engineers make the worst mistakes on large codebases they cannot see whole. A **System Context** is a compact, verified map of the existing system that every later skill (`sdlc-intake`, `sdlc-design`, `sdlc-api-design`, `sdlc-implement`) reads first. It is not a full specification; it is the minimum a capable engineer needs to avoid breaking things.

## When to use

- **init** — the project is brownfield (large, legacy, little architecture documentation) and has no System Context yet.
- **delta** — a new feature/change request starts on a project that has a System Context.
- **update** — a change that had a delta has been released; merge it into the main context.
- Periodic re-verification of documents that are stale.

## When not to use

- Greenfield projects: context grows naturally through `CLAUDE.md`/`AGENTS.md`, ADRs and git history. Write those instead.
- The project already has an equal or richer knowledge base (architecture docs, an API catalog, feature analyses). Do **not** create a thinner duplicate that will drift. Point the project's `CLAUDE.md`/`AGENTS.md` at the existing base and use it as the source, following the "reference knowledge" rules below.

## Reference knowledge rules (apply to any pre-existing docs)

Existing analyses, wikis and old context docs are a **fast starting point, not the truth**. Code is the highest-ranked source; documentation derived from it ranks lower.

1. Prefer a local checkout of a documentation repository over cloning a fresh copy; never overwrite local work.
2. If the docs are versioned by release, read the branch/tag matching the release the task targets; otherwise the default branch. Say which you used.
3. Read the index or coverage report before assuming something is covered; check that the specific module you need is actually in scope.
4. Report each document's age ("last verified 4 months ago") and verify facts against current code before relying on them.
5. When two documents contradict each other, show both; do not pick a winner silently.
6. If you find drift, do not rewrite someone else's knowledge base; flag it through that base's own mechanism (a drift section, an issue) and tell the human.
7. Record which sources you used and whether you verified them.

## The seven context documents

| File | Contents |
|------|----------|
| `architecture-overview.md` | Deployable units, runtime topology, datastores, queues, external systems; one diagram; dependency graph of core modules and which ones fan out widely |
| `api-catalog.md` | Table of endpoints/operations: method, path or name, purpose, auth, owner module, contract location, last verified date |
| `business-flows.md` | The 5–15 most important flows as sequence diagrams or numbered steps, with decision points and state machines |
| `data-model.md` | Core entities/tables, ownership per module, relationships, sync direction between stores, retention, which tables are large or time-growing |
| `integration-points.md` | External systems and partners: protocol, direction, auth, contract, timeouts/retries, failure behavior, environments |
| `domain-rules.md` | Business invariants, compliance/regulatory constraints, edge cases that are easy to get wrong (time zones, rounding, cut-off times) |
| `anti-patterns.md` | Known pitfalls and post-incident lessons: what went wrong, how to avoid repeating it, links to the incident/postmortem |

Each file starts with this header:

```
> Last verified: YYYY-MM-DD by <name or role>
> Sources: <code paths, config files, docs, tickets used>
> Status: VERIFIED | NEEDS_REVIEW | STALE
```

Location: the project's docs root (default `docs/system-context/`) unless the project defines another place. Pending deltas go in `docs/system-context/_pending/`, merged deltas in `docs/system-context/_archive/`.

## Procedure — init

1. Read `CLAUDE.md`/`AGENTS.md`/`README`, build files, deployment manifests and CI config. List deployable units and datastores.
2. Check for existing reference knowledge (rules above). Draft from it where it exists.
3. Explore the code systematically: entry points (routes, handlers, consumers, jobs, screens) → services → data access → schema/migrations → outbound clients. Search before reading; read selectively.
4. Draft all seven files from evidence. Cite file paths for every non-obvious claim. Mark anything inferred as *(inferred)*.
5. Ask the human a short batch of confirmation questions (10–15 maximum), only about what the code cannot tell you: business purpose of flows, compliance constraints, ownership, past incidents, what the existing docs got wrong. Include "is this still accurate?" for anything taken from older docs.
6. Incorporate answers; set `Status: VERIFIED` only for files a human confirmed, otherwise `NEEDS_REVIEW`.
7. Propose a short pointer section for the project's `CLAUDE.md`/`AGENTS.md` that links to the context. Do not edit those files without approval.

Stop and ask when you cannot identify the deployable units, the primary datastore, or the main integrations — do not invent them.

## Procedure — delta (start of each change)

1. Read the change request (via `sdlc-intake` output) and the current context documents.
2. Write `_pending/<change-id>-delta.md` (1–2 pages): what is new or modified in services, APIs, data, flows, rules and integrations; which use cases, APIs and tables are affected; which anti-patterns are relevant; open questions.
3. Hand the delta to `sdlc-design`. If no baseline exists, recommend running init first; if the change spec is missing, stop and ask.

## Procedure — update (after release)

1. Read the pending delta and the released code (merged commits/tag), not just the plan — what shipped may differ.
2. Produce a proposed diff for each affected context file; show it to the human before applying when the change is large or touches domain rules.
3. Apply, set `Last verified` to today and `Status: VERIFIED` for files you verified against code.
4. Move the delta to `_archive/`.
5. If the project snapshots context per release, propose a tag name; do not create tags without approval.

## Maintenance rules

- Documents not verified for ~6 months are re-verified against code or marked `STALE`.
- Large updates and changes to `domain-rules.md` need review by the technical owner.
- New incidents feed `anti-patterns.md` (see `sdlc-incident`).
- Never write secrets, production hostnames/IPs, credentials or personal data into context docs.

## Output

```
## System context — <init | delta | update> — <project>
Sources used: <list, with verified yes/no and age>
Files written/changed: <paths>
Coverage: <what is mapped / what is not yet>
Open questions for the owner: <numbered list>
Status per file: <file: VERIFIED | NEEDS_REVIEW | STALE>
```
