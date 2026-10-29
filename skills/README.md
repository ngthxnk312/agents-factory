# Factory SDLC skills

Generic, stack-agnostic skills that guide AI coding agents (Claude Code, Codex, Gemini, Antigravity) through the software lifecycle: discover → plan → design → build → verify → ship → operate. They are written for any kind of project — backend, frontend, mobile, data, infrastructure — and are **fallbacks**: your own project and machine skills always take precedence.

## Index

55 skills, grouped by role and ordered by lifecycle stage. `mode` is the permission mode the dashboard suggests (`plan` = read-only / drafts, `acceptEdits` = writes files).

### Lead / orchestration

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🧭 `sdlc-feature-workflow` | 0-foundation | acceptEdits | Orchestrator: chains the skills below with human approval checkpoints |

### Project management (PM)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🤝 `sdlc-pm-stakeholder-comms` | 1-discover | plan | Identify and analyse stakeholders (power/interest, attitude, expectations, conflicts), build the communication plan, and run project meetings end to end — purpose, timed agenda, pre-reads… |
| 📅 `sdlc-pm-project-plan` | 2-plan | plan | Turn a project goal into an approvable baseline plan — SMART objectives, in/out scope, assumptions and constraints, a work breakdown structure with estimates, dependencies and critical pa… |
| 💰 `sdlc-pm-resource-budget` | 2-plan | plan | Plan and control people and money — per-person capacity, allocation and load, skill fit and single points of failure, rebalancing and shortfall options; budget versus actuals, burn versus… |
| 🛡 `sdlc-pm-risk-issue` | 2-plan | plan | Maintain the project RAID log — identify, score, respond to and monitor risks before they happen; log, prioritise, assign, escalate and close issues that are happening; track assumptions … |
| 🏃 `sdlc-pm-sprint` | 2-plan | plan | Run the sprint cycle — capacity- and velocity-based sprint planning with a sprint goal, in-sprint tracking (burndown, blocked and aging items, scope changes), safe spreadsheet-to-tracker … |
| 🔁 `sdlc-pm-change-control` | 4-build | plan | Control changes to an approved baseline through change requests — log, classify, assess impact on schedule, cost, quality, risk and contract, propose options (approve, reject, defer, appr… |
| 📊 `sdlc-pm-progress` | 4-build | plan | Measure real project progress against the baseline and report it — status counts, milestone forecasts and slippage, earned-value indicators, at-risk items, an evidence-based red/amber/gre… |
| ✅ `sdlc-pm-quality` | 5-verify | plan | Manage delivery quality at project level — definition of done per level, measurable acceptance criteria, quality gates per milestone, defect metrics and a daily defect-backlog report with… |

### Business analysis (BA)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🔎 `sdlc-ba-discovery` | 1-discover | plan | Start business analysis on solid ground — establish the project context (documents, versions, templates, glossary, owners), route the work by what input actually exists, prepare requireme… |
| 📋 `sdlc-ba-requirements` | 1-discover | plan | Own the requirements baseline — synthesise meeting notes or transcripts into sourced, classified and ID'd items; review a client-provided requirements document for gaps with severity, evi… |
| 💡 `sdlc-ideate` | 1-discover | plan | Explore the problem and compare distinct solution options; recommend one |
| 📥 `sdlc-intake` | 1-discover | plan | Classify a ticket/request; summary, acceptance criteria, impact, risks, clarifying questions |
| 📝 `sdlc-ba-functional-spec` | 3-design | plan | Write the functional specification of one feature from baselined requirements or an approved feature brief — description, actors and permissions, scope per platform, numbered processing f… |
| 🔀 `sdlc-ba-process-flow` | 3-design | plan | Model business processes and system interactions as reviewable Mermaid diagrams — swimlane flowcharts for who-does-what, sequence diagrams for system interactions, state diagrams for enti… |
| 📘 `sdlc-ba-srs` | 3-design | plan | Author, review or update a software requirements specification (SRS) that developers can build from and testers can write test cases from without further questions — screen, API, integrat… |
| 🖼 `sdlc-ba-ui-spec` | 3-design | plan | Specify screens so they can be built and tested without guessing — screen inventory, display conditions, component and field tables (type, format, required, default, validation, message),… |

### Solution architecture (SA)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🗺 `sdlc-system-context` | 0-foundation | acceptEdits | Map a brownfield codebase into seven verified context docs; per-change delta; post-release update |
| 🔌 `sdlc-api-design` | 3-design | plan | Contract-first API design: style, DTOs, object authorization, RFC 9457 errors, pagination, idempotency, versioning, signing |
| 📐 `sdlc-design` | 3-design | plan | Reviewable technical design: flows, data, interfaces, edge cases, security, observability, rollout, ADRs |
| 🔗 `sdlc-sa-integration` | 3-design | plan | Design an integration with an external or separately owned system — inventory and ownership, pattern choice (synchronous API, messaging, webhook, file batch, change data capture), adapter… |
| 🎯 `sdlc-sa-nfr-review` | 3-design | plan | Turn vague quality expectations into measurable non-functional requirements and check an architecture against them — quality-attribute scenarios with thresholds and measurement methods, a… |
| 🏛 `sdlc-sa-solution-design` | 3-design | plan | Produce the solution architecture for an epic, product or initiative from an approved functional specification — intake, evidence-based discovery of the current landscape, top non-functio… |

### Engineering (Dev, any stack)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 📏 `sdlc-standards` | 0-foundation | plan | Engineering baseline (architecture, coding, errors, security, logging, data, API, testing, git, definition of done); depth in `reference/` |
| 🧩 `sdlc-breakdown` | 2-plan | plan | Ordered vertical-slice plan with tests, estimates, MR split and a plan gate |
| 🗄 `sdlc-db-migration` | 3-design | acceptEdits | Safe schema/data migrations: expand/migrate/contract, batched backfills, lock awareness, rollback plan |
| 🐞 `sdlc-debug` | 4-build | acceptEdits | Root cause first: orient, reproduce, localize, prove, fix with regression test and defense in depth |
| 🛠 `sdlc-implement` | 4-build | acceptEdits | Small, test-first, convention-matching implementation with an honest verification report |
| 🔍 `sdlc-review` | 5-verify | plan | Independent review with checklist, severity rubric and PASS/FAIL verdict |
| 📚 `sdlc-docs` | 7-operate | acceptEdits | Feature docs with traceability headers, ADRs, runbooks, publishing per project config, honest worklog |

### Backend (BE)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 📬 `sdlc-be-async-jobs` | 4-build | acceptEdits | Jobs, queues and events: at-least-once delivery, transactional outbox, idempotent consumers, retry vs dead-letter, ordering, timeouts, graceful shutdown, single-run scheduled jobs |
| 💾 `sdlc-be-data-access` | 4-build | acceptEdits | Persistence layer: query design, ORM pitfalls, indexes proven with plans, pagination, isolation and locking, upserts, batching, pool sizing, authorization-aware caching, read replicas |
| 🛣 `sdlc-be-endpoint` | 4-build | acceptEdits | Add or change one API operation against an agreed contract: contract first, request validation, thin handler, scoped query, pagination/filter/sort allowlists, error table, backward compatibility, test matrix |
| 🧱 `sdlc-be-implement` | 4-build | acceptEdits | Backend feature end to end: strict layering, DTO/domain/entity split, validation, transaction scope (no remote calls inside), concurrency and idempotency, object-level authorization in queries, RFC 9457 errors, test-first with real-database tests |
| ⚡ `sdlc-be-performance` | 5-verify | acceptEdits | Evidence-based performance work: target, reproducible baseline, cause → fix, before/after proof, regression guard, safe load-test plan |
| 🔐 `sdlc-be-security` | 5-verify | plan | Read-only backend security review in 13 categories with severity scale and findings template |
| 📡 `sdlc-be-observability` | 6-ship | acceptEdits | Make a service operable before it ships: logged events, RED/USE metrics, tracing, health checks, SLOs, burn-rate alerts, dashboard, runbook |

### Frontend (FE)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🎨 `sdlc-prototype` | 3-design | acceptEdits | Clickable prototype at a declared fidelity level for stakeholder approval; fidelity check after build |
| 🖥 `sdlc-fe-implement` | 4-build | acceptEdits | Implement web frontend changes the way a senior frontend engineer would — component architecture that matches the codebase, clear state ownership (server cache vs client vs URL vs form st… |

### Mobile

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 📱 `sdlc-mobile-implement` | 4-build | acceptEdits | Implement mobile app features (native or cross-platform) following the project's layered architecture — presentation, state holder, domain, data/adapter — with lifecycle-safe async work, … |
| 📦 `sdlc-mobile-release` | 6-ship | acceptEdits | Prepare and run a mobile app release safely — version name and build number rules, production flavor configuration checks, release build hardening (non-debuggable, shrinking/obfuscation, … |

### Quality assurance (QA)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🗂 `sdlc-qa-domain-checklists` | 0-foundation | plan | Apply reusable domain risk checklists to QA work — payments and fintech, digital banking (retail and business), CRM, AI chatbots and LLM features, e-commerce, plus cross-cutting concerns … |
| 🔬 `sdlc-qa-requirement-analysis` | 1-discover | plan | Analyze requirements from a QA perspective before any test is written — enumerate every requirement statement into a numbered register, classify it (business rule, functional, acceptance … |
| 📝 `sdlc-qa-test-plan` | 2-plan | plan | Write a risk-based test plan for a feature or release — product analysis, scope in/out, strategy and test levels/types, objectives, entry/suspension/exit criteria, roles, environments and… |
| ✍️ `sdlc-qa-test-design` | 3-design | acceptEdits | Design an executable manual test suite from an analyzed requirement set — risk-driven scenarios first (approved by a human), then detailed test cases using equivalence partitioning, bound… |
| 🧐 `sdlc-qa-testcase-review` | 3-design | plan | Independently review a test suite — newly designed or inherited — for correctness against requirements, completeness of coverage (requirements, rules, flows, categories, domain risks, sta… |
| 🤖 `sdlc-qa-automation` | 4-build | acceptEdits | Turn an approved manual suite into reliable automated tests — select candidates with explicit rationale, assess readiness, choose the layer (API, UI, unit) and framework, design page/scre… |
| 🪲 `sdlc-qa-defect` | 5-verify | plan | Report and triage defects professionally — confirm and minimize reproduction, separate product defects from test, data and environment problems, write a complete defect report, assign sev… |
| 📈 `sdlc-qa-test-report` | 5-verify | acceptEdits | Produce a test summary report for a feature or release from the final test plan, executed test case results, defect data and optional automated run results — scope actually tested, enviro… |
| 👁 `sdlc-qa-ui-ux` | 5-verify | acceptEdits | Test the user interface and experience of web and mobile screens — visual fidelity to the design system or approved prototype, responsive layouts across breakpoints and devices, all UI st… |
| 🚦 `sdlc-quality-gate` | 5-verify | acceptEdits | Ordered 10-step pre-merge gate (blocking vs warning) with a gate report |
| 🧪 `sdlc-test` | 5-verify | acceptEdits | TDD loop and systematic test design; deterministic tests with no real outbound effects |

### Release & operations (DevOps)

| Skill | Stage | Mode | Purpose |
|-------|-------|------|---------|
| 🛫 `sdlc-deploy` | 6-ship | acceptEdits | Pre-flight, approved execution, post-deploy verification, rollback/roll-forward, runbook |
| 🚀 `sdlc-release` | 6-ship | acceptEdits | Conventional commits, MR description, semver, changelog, release by scope, rollback strategy |
| 🚨 `sdlc-incident` | 7-operate | plan | Production triage, read-only diagnostics, approved mitigation, safe data correction, postmortem |

### Role hand-offs

- **BA chain:** `sdlc-ba-discovery` → `sdlc-ba-requirements` (single owner of the requirements baseline) → `sdlc-ba-functional-spec` → `sdlc-ba-process-flow` / `sdlc-ba-ui-spec` → `sdlc-ba-srs`.
- **BA → SA:** the approved functional spec / SRS feeds `sdlc-sa-solution-design`, which uses `sdlc-sa-nfr-review` and `sdlc-sa-integration`, then hands over to `sdlc-design`, `sdlc-api-design`, `sdlc-db-migration` and `sdlc-breakdown`.
- **Build:** `sdlc-implement` (any stack) / `sdlc-be-implement` (+ `sdlc-be-endpoint`, `sdlc-be-data-access`, `sdlc-be-async-jobs`) / `sdlc-fe-implement` / `sdlc-mobile-implement` (+ `sdlc-debug`), always under `sdlc-standards`; backend changes are verified with `sdlc-be-security` and `sdlc-be-performance` and made operable with `sdlc-be-observability`.
- **QA chain:** `sdlc-qa-requirement-analysis` → `sdlc-qa-test-plan` → `sdlc-qa-test-design` → `sdlc-qa-testcase-review` → `sdlc-qa-automation` → `sdlc-qa-defect` → `sdlc-qa-test-report`, with `sdlc-qa-ui-ux` and `sdlc-qa-domain-checklists` alongside; feeds `sdlc-quality-gate`.
- **PM** skills run in parallel across the lifecycle: `sdlc-pm-change-control` pairs with BA change requests, `sdlc-pm-quality` with `sdlc-quality-gate`, `sdlc-release` / `sdlc-mobile-release` and `sdlc-deploy`.
- **`sdlc-feature-workflow`** orchestrates the engineering path end to end with human approval checkpoints.

## How they chain (feature workflow)

```
            ┌──────────────── sdlc-standards (applies everywhere) ────────────────┐
 bootstrap: sdlc-system-context (init, brownfield, once)

 sdlc-intake ──[A: understanding]──► sdlc-system-context (delta)
     │
     ▼
 sdlc-ideate? ► sdlc-prototype? ► sdlc-design ► sdlc-api-design? ► sdlc-db-migration?
                                        │
                              [B: design approval]
                                        ▼
                                 sdlc-breakdown ──[C: plan approval]
                                        ▼
                    sdlc-implement ⇄ sdlc-test (TDD)   (bugs: sdlc-debug)
                                        ▼
                                  sdlc-review
                                        ▼
                               sdlc-quality-gate
                                        ▼
                                 sdlc-release ──[D: commit / push / MR approval]
                                        ▼
                                  sdlc-deploy ──[E: approval per environment]
                                        ▼
                    sdlc-docs + sdlc-system-context (update) ──[F: done]

 production problems: sdlc-incident ─► sdlc-debug ─► (back into review / gate / release)
```

Letters are the human checkpoints defined in `sdlc-feature-workflow`; the agent stops and waits at each one. Bug fixes take the short path: intake → debug → review → quality gate → release → deploy → docs.

## Precedence

For each skill, the dashboard resolves the version to use in this order:

1. **Project skills** — `<project>/.claude/skills/<name>/SKILL.md` (matching the skill's name or any name in its `prefer:` list).
2. **User / machine skills** — `~/.claude/skills/**/<name>/SKILL.md` (same matching).
3. **Native or plugin equivalents** listed in the skill's `prefer:` field (installed plugin skills and the CLI's slash commands).
4. **These factory defaults.**

Inside every skill the same principle applies to content: the project's own rules (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, linters, project skills, ADRs) override the generic guidance here — except that safety rules (secrets, authorization, data protection, human approval for irreversible actions) are never loosened by an override unless the project states that exception explicitly.

## How factory skills are delivered

A factory skill's body is injected into the agent's context (system prompt or wrapped message). Files next to it, such as `sdlc-standards/reference/*.md`, are not injected automatically; each skill therefore contains its essential rules inline and points to the reference files for depth. Keep that property when editing: a skill must be usable on its own.

## Adding a skill

1. Create `skills/sdlc-<name>/SKILL.md`. Use kebab-case; the folder name equals `name`.
2. Frontmatter is **line-based** (one `key: value` per line; no YAML lists, no multi-line values, no comments):

   ```
   ---
   name: sdlc-<name>
   description: <what it does and when to use it — the first sentence is what agents read to decide>
   stage: <0-foundation | 1-discover | 2-plan | 3-design | 4-build | 5-verify | 6-ship | 7-operate>
   icon: <one emoji>
   mode: <plan | acceptEdits>
   prefer: <comma-separated names of equivalent skills that should win if installed>
   ---
   ```

3. Body structure (aim for 80–250 lines): purpose; **When to use / When not to use**; hard guardrails if the skill can cause irreversible effects; a numbered procedure with checklists and decision rules; **stop conditions** (when to stop and ask the human); an **output template**.
4. Keep it generic: no company names, internal URLs, framework-specific APIs as requirements, or tool flags you have not verified. Express stack-specific practice as a principle plus one or two short examples from different stacks. Refer to tools generically ("your todo tool", "the project's test runner").
5. Choose `prefer:` names carefully. They match project/user skills by exact name and native commands by name or `<plugin>:<name>` suffix, so a too-generic name (for example `docs`) can capture an unrelated skill.
6. Cross-reference other skills by name (`apply sdlc-standards`) instead of copying their content.
7. Never instruct agents to commit, push, merge, deploy, run destructive commands or write to external systems without explicit approval.
8. Add the skill to the index table and, if it belongs to the feature flow, to the chain diagram above and to `sdlc-feature-workflow`.
9. If the dashboard is running, it re-reads skills on demand; verify the new skill appears with the right stage, icon and mode.

## Versioning of this skill set

Treat changes like code: one purpose per change, a clear commit message, and a note in the project changelog when behavior of a skill changes materially (new guardrail, removed step, renamed skill). Renaming a skill is a breaking change for anyone who references it by name.
