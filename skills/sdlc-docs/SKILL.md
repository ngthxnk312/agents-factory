---
name: sdlc-docs
description: Write and maintain the documentation a change leaves behind — feature index, API handoff spec, per-story flows, ADRs, runbooks, install guides — with traceability headers and versioning, publish it only where the project says, keep scratch work out of the repo, and record an honest worklog linking time and real commits to the ticket. Use after a change is implemented or released, when handing over to other teams, or at the end of a work session.
stage: 7-operate
role: dev
icon: 📚
mode: acceptEdits
prefer: doc-publish, documentation
---

# Documentation and worklog

Documentation is part of the deliverable: the next engineer (or agent) must be able to understand, operate and change the feature without the author. Write less, but make it correct, current and findable.

## When to use

- A feature or change is implemented/released and its docs, contract or runbook must be created or updated.
- Handing an API or flow to web, mobile, partner or operations teams.
- Recording a significant decision (ADR).
- Ending a task or work session (worklog).

## When not to use

- Process reports that belong elsewhere (quality gate report → MR/ticket; review findings → MR comments). Do not turn them into repository docs.
- User-facing product help that the application itself displays.

## 1. Where documentation lives (decide first)

Read the project's configuration for docs (`CLAUDE.md`, `AGENTS.md`, a docs config file, the existing `docs/` layout). The project defines:

- **docs mode** — `publish` (write locally and publish to the team's wiki/portal), `local` (repository/local files only), or `off` (prototype/throwaway projects; skip docs). Regulated or customer-facing projects should not use `off`.
- **docs root** — default `docs/<feature>/` (feature-centric: everything about a feature in one folder).
- **whether docs are committed** to the repository or only published.
- **publishing target** — wiki space/page or portal; never hardcode it in these instructions. If the mode is `publish` and the target is not configured, ask once and suggest recording it in the project config.

If a publishing tool/integration is not available, write the files locally and tell the human exactly what to upload where. **Never claim something was published when it was not.**

## 2. Principles

- **Feature-centric.** One folder per feature holds its docs and its feature-specific operational assets (deploy/migration scripts, infrastructure definitions). Only truly shared assets live in repo-wide folders.
- **Everything operational is in version control.** Scripts that deploy, migrate or operate a feature are code; no one-off scripts living only on a server.
- **Single source of truth.** Each fact lives in one place; link instead of copying. Do not duplicate what the application already shows or what another doc owns.
- **Traceable and dated.** Every document starts with a header (below); bump its version and record the change on every update.
- **Written from facts.** Fill templates with the real behavior read from code and config; never copy template placeholders or examples (algorithms, field orders, URLs) as if they were real.
- **Safe.** No secrets, credentials, production hostnames/IPs, or personal data — use placeholders like `<db-host>`.
- **No junk.** Drafts go in an ignored scratch directory (e.g. `.scratch/`) and are cleaned up; no `tmp_*`, `copy*`, `*_bak`, `Untitled*` files.

Header for every document:

```
> Feature: <name> (<code/ticket>) · Doc: <type> · Version: vX.Y · Status: DRAFT | ACTIVE | PAUSED | STALE
> Last verified: YYYY-MM-DD · Trace: ticket <KEY> · repo <name> · commit <short sha> · published at <link or "local only">
```

## 3. Document types (use the meaning, not just the name)

| Doc | Purpose | Key contents |
|-----|---------|--------------|
| `README.md` (feature index) | Read first | Overview; table of docs (doc, stage, purpose, version, updated, last change, link); **traceability matrix** story → acceptance criteria → API → flow doc; status and blockers |
| `master-plan.md` (or the project's equivalent) | Source of truth while building | Goal; context and scope in/out; design summary; decisions; data model; steps and status; risks; acceptance criteria; prototype link; coding and test plan |
| `api-spec.md` | Contract handoff to consumers | From `sdlc-api-design` template |
| `flow-<story>.md` | Processing flow per user story | Actor, preconditions, numbered steps or sequence diagram, business rules, data touched, idempotency, edge cases with error codes, dependencies |
| `adr-<nnn>-<slug>.md` | One significant decision | Context, options, decision, consequences, status |
| `deploy-runbook.md` | How to deploy and verify | From `sdlc-deploy` template; points to versioned scripts |
| `install-guide.md` | How to install/configure the feature (for operators) | Prerequisites, steps, configuration, verification — not end-user help |
| `<feature>-standard.md` | Feature-specific conventions | Scope, conventions, compliance checklist, CI checks |

Default set for a typical feature: README + API spec (if there is an API) + one flow per non-trivial story. ADRs, runbooks, install guides and standards only when needed. For brownfield context documents use `sdlc-system-context`.

## 4. Procedure — documentation

1. Determine docs mode, root and target (section 1). If mode is `off`, stop here.
2. List which documents the change creates or affects; read the current versions.
3. Write or update each from the real code, contract files and approved design. Keep the header current: bump version, today's date, status, commit.
4. Update the README index table and the traceability matrix.
5. Update repository-level artifacts that must stay in sync: machine-readable API contract, `CHANGELOG.md` (via `sdlc-release`), configuration examples (`.env.example` with names only).
6. Publish per the project config — only with approval if it writes to an external system. Report paths and links.
7. If the change made a System Context delta, run `sdlc-system-context` update after release.

## 5. Procedure — worklog (end of task or session)

1. Identify the ticket from commit messages, the branch name or the prompt. If the work deliberately has no ticket (the project's explicit placeholder), there is nothing to log — skip without error.
2. Collect the **real** commits for this ticket and session (`git log --oneline --grep "<TICKET>"` or the commits created in this session). Never invent hashes or subjects.
3. Summarize what was done, honestly and briefly; record actual time spent as the human states it — never inflate or guess hours.
4. Draft the worklog/comment: time, summary, commit list (hash + subject + link if known), status, next steps. Post it to the tracker only with approval and per the project's policy about mentioning AI tools.
5. A ticket may move to Done only when the quality gate is PASS and the report is attached where the project requires it.

## Stop conditions

- Docs mode is `publish` but no target is configured — ask once.
- Feature name/code or the story id (for flow docs) is unknown — ask.
- The real behavior cannot be determined from code (e.g. signing rules) — ask; do not fill from examples.

## Output

```markdown
## Docs update — <feature>
Mode: publish | local | off · Root: <path>
| Doc | Action | Version | Path | Published |
|-----|--------|---------|------|-----------|
Traceability matrix updated: yes/no · System-context delta: <path or n/a>

## Worklog draft — <ticket>
Time: <as stated> · Summary: … · Commits: <hash subject> … · Next: … · Posted: no (awaiting approval)
```
