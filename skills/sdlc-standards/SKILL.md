---
name: sdlc-standards
description: The engineering baseline every other sdlc-* skill relies on — architecture and layering, coding, error handling, security (secrets, IDOR, PII), logging and observability, data and database, API conventions, testing gates, git flow and commit messages, and the definition of done. Use whenever you write, change or review code and need the default rule for something the project does not already define.
stage: 0-foundation
role: dev
icon: 📏
mode: plan
prefer: engineering-standards, project-standards, coding-standards
---

# Engineering standards (baseline)

This is the default engineering baseline for any stack: backend, frontend, mobile, data or infrastructure code. It is deliberately framework-neutral. Stack-specific examples are illustrations, not requirements.

## Precedence — read this first

1. **Project rules win.** Before applying anything here, read the project's own rules: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.editorconfig`, linter/formatter configs, project skills under `.claude/skills/`, ADRs and the existing code. Where they define a rule, follow it.
2. **Never loosen safety by override.** A project rule may change *how* something is done (naming, layout, tooling), but you must not use it as a reason to weaken security, data-safety or human-approval rules below unless the project states that exception explicitly.
3. **Target state, not current state.** Legacy code may violate these rules. Do not copy a legacy anti-pattern into new code because "the file already does it"; do not refactor legacy code you were not asked to touch either. Note it as a follow-up.
4. When a rule here conflicts with the codebase's consistent, deliberate convention, follow the codebase and mention the divergence.

## Golden rules (normative summary)

These apply even if you cannot open the reference files.

1. **Layered, no skipping.** Entry points (controllers, handlers, UI components, CLI commands, jobs) stay thin: parse, validate, delegate, respond. Business rules live in a domain/service layer. Data access lives behind repositories/gateways. No layer reaches past the one below it; one domain does not read another domain's storage directly. → `reference/architecture.md`
2. **Never trust input; never leak internals.** Validate every external input at the boundary (type, length, format, range, allowlists). Errors returned to clients are structured (RFC 9457 Problem Details for HTTP APIs) with a stable code and a correlation id — never stack traces, SQL, table names, file paths or framework versions. → `reference/errors.md`, `reference/security.md`
3. **Authorize every object access (IDOR/BOLA).** Being logged in is not authorization. Every read or write of an object identified by an id must verify that the caller owns it or has scoped rights to it, preferably inside the query itself. Return "not found" for objects the caller may not see. → `reference/security.md`
4. **No hardcoded secrets or magic values.** Secrets live in environment variables, an untracked local env file, or a secret manager — never in source, tracked config, tests, docs, commit messages or chat. A leaked secret is rotated, not just deleted. Magic numbers/strings become named constants, enums or configuration. → `reference/security.md`, `reference/coding.md`
5. **Never log secrets or sensitive personal data.** No passwords, tokens, keys, OTPs, card data, government IDs or full contact details in logs at any level. Mask what you must log; log presence/state instead of values. Every log line carries context and a correlation id. → `reference/logging-observability.md`
6. **Data safety first.** Parameterized queries only. Exact decimal types for money. Transactions owned by the service layer and closed before calling remote systems. Schema changes are forward-only, reviewed, and follow expand → migrate → contract. Agents do not run DDL or bulk data changes against shared environments. → `reference/data.md`, skill `sdlc-db-migration`
7. **Do not swallow errors.** No empty catch blocks, no catch-and-ignore, no catch-all that hides the cause. Re-throw domain errors unchanged; wrap unexpected ones into a generic internal error and log them once with the stack trace. → `reference/errors.md`
8. **Tests and verification before "done".** Build, tests and a real start-up/smoke check must pass for the affected scope before you claim completion. If you could not run something, say exactly what was not verified. → `reference/testing.md`, skill `sdlc-quality-gate`
9. **Humans own irreversible actions.** Never commit, push, merge, tag, deploy, run migrations against shared databases, change production data, or write to external systems (trackers, wikis, chat) unless the human explicitly asked for that specific action in this session. → `reference/git-workflow.md`
10. **Small, traceable changes.** Short-lived branches, focused merge requests, conventional commit messages that reference the ticket, no unrelated refactors mixed with features. → `reference/git-workflow.md`
11. **No junk in the repository.** Scratch work goes in an ignored scratch directory (for example `.scratch/`) or the OS temp dir and is cleaned up. Never leave files named `tmp_*`, `temp_*`, `test123*`, `*_bak`, `copy*`, `Untitled*` in the tree. Never commit generated analysis dumps.
12. **English identifiers.** Code identifiers, file names and commit types are in clear English. User-facing strings may be localized through the project's i18n mechanism.

## Reference map (progressive disclosure)

The files below live in the `reference/` folder next to this SKILL.md (in an Agents Factory install: `skills/sdlc-standards/reference/`). Read only the one you need. If this skill was delivered to you inline and you cannot locate the folder, the golden rules and definition of done in this file are normative on their own; ask the human for the path only when you need the depth.

| File | Read when |
|------|-----------|
| `reference/architecture.md` | Designing modules, splitting layers, cross-domain calls, external integrations, concurrency |
| `reference/coding.md` | Writing or refactoring code; naming; null safety; code smells; static analysis |
| `reference/errors.md` | Exception design, error contracts, HTTP status mapping, RFC 9457 |
| `reference/security.md` | Authorization/IDOR, input validation, injection, secrets, dependencies, headers, signing |
| `reference/logging-observability.md` | Logging, masking, correlation ids, metrics, traces, audit trails |
| `reference/data.md` | Queries, transactions, types, entities vs DTOs, soft delete, partitioning, migrations |
| `reference/api-conventions.md` | Public interface conventions and the external standards we anchor to |
| `reference/testing.md` | Test strategy, test pyramid, coverage, verify pipeline, quality gates |
| `reference/git-workflow.md` | Branching, commit messages, merge requests, CI stage order, approvals |

## Definition of done (default)

A change is done only when every applicable item is true. Mark non-applicable items `N/A` with a reason; never silently drop one.

- [ ] Acceptance criteria are met and each is demonstrated by a test or a recorded manual check.
- [ ] Code follows the project conventions and the golden rules above; no hardcoded secrets or magic values.
- [ ] Every object access by id is authorization-checked; inputs are validated at the boundary.
- [ ] No sensitive data in logs, errors, docs or commit messages.
- [ ] Unit tests cover new logic and edge cases; integration tests cover new I/O paths; authorization has a negative test (user A cannot reach user B's data).
- [ ] Build, lint/format, type checks, tests, start-up and smoke checks pass for the affected scope (`sdlc-quality-gate`).
- [ ] Independent review has no open blocker findings (`sdlc-review`).
- [ ] Schema/data changes have a written rollback or compensation plan (`sdlc-db-migration`).
- [ ] Docs, API contract, changelog and system-context deltas are updated where behavior changed (`sdlc-docs`, `sdlc-system-context`).
- [ ] Commit messages and the merge request description follow `sdlc-release`; nothing was pushed, merged or deployed without explicit approval.
- [ ] Follow-ups (warnings accepted, debt noticed, out-of-scope issues) are recorded as tickets, not left as `TODO` comments without a tracking reference.

## Process gates used across the sdlc-* skills

| Gate | Where | Pass condition |
|------|-------|----------------|
| Clarity | `sdlc-intake` | Acceptance criteria are testable; open questions answered or explicitly assumed with the requester's consent |
| Plan | `sdlc-design`, `sdlc-breakdown` | Who/what/where/when/why are answered; no placeholders; risks have mitigations |
| Debug | `sdlc-debug` | Root cause proven with evidence before any fix is called done |
| Security | `sdlc-review` | No blocker-level security finding (secret, IDOR, injection, sensitive logging, data loss) |
| Quality | `sdlc-quality-gate` | All blocking steps pass; every warning has an owner-accepted follow-up |
| Release | `sdlc-release`, `sdlc-deploy` | Human approval recorded for every push, merge, tag and deploy |

## How to apply this skill

- When writing code: skim the golden rules, open the one or two reference files relevant to the change, then follow the project's conventions.
- When reviewing: use each reference file's checklist as the review checklist for that dimension.
- When something here is ambiguous for the stack at hand, choose the safer interpretation and state the assumption in your output.
