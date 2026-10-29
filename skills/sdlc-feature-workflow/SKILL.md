---
name: sdlc-feature-workflow
description: Orchestrate a feature or bug fix end to end — intake, system context, design (with API, migration and prototype sub-steps), breakdown, test-driven implementation, independent review, quality gate, release preparation, deployment and docs — with explicit checkpoints where the agent must stop for human approval. Use when starting a feature, enhancement or non-trivial bug fix from scratch and you want the full lifecycle followed without skipped steps.
stage: 0-foundation
role: lead
icon: 🧭
mode: acceptEdits
prefer: feature-workflow, feature-dev, new-feature
---

# Feature workflow (orchestrator)

Humans set intent and guardrails; the agent executes inside them; **humans keep the final say on scope, design, merge and deploy**. This skill chains the other `sdlc-*` skills in order. It does not repeat their content — apply each named skill at its step (if a skill is not loaded in your context, apply its intent as described here and say so).

## When to use

- A new feature, enhancement or non-trivial bug fix that will go through design, code, review and release.
- Resuming such work: find the furthest completed step from the evidence (docs, plan, branch, commits, gate report) and continue from there.

## When not to use

- Trivial changes (typo, copy change, a version bump): implement, run the relevant checks, prepare the commit message — a full workflow is overhead.
- Live production incidents: `sdlc-incident` first.
- Pure research: `sdlc-ideate`.

## Ground rules for the whole run

1. **Project rules override.** Read `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` and project skills first. If the project has its own feature workflow, use it and only fill gaps with this one.
2. **Track progress** in your todo/task tool: one item per step below, plus the tasks from the breakdown.
3. **Never** commit, push, merge, tag, deploy, run migrations on shared databases, change production data, or write to trackers/wikis/chat without explicit approval for that action.
4. **Do not expand scope** beyond what was confirmed at Checkpoint A. New ideas become follow-up tickets.
5. **Correctness over speed**: in money, permission or data paths, fail loudly rather than succeed wrongly.
6. **Never report "done"** before the quality gate passes and the human accepts.
7. At every checkpoint, **stop and wait**. Present a short summary, what you need decided, and your recommendation. Do not continue in the same turn.

## The flow

### Step 0 — Bootstrap (once per project, skip if already done)
- Identify stack, build/test/run commands, branching model, commit convention, docs location (`sdlc-standards`, `sdlc-docs` section 1).
- Brownfield with no context map → propose `sdlc-system-context` init (ask before spending the effort).

### Step 1 — Intake → `sdlc-intake`
Classify, summarize, write acceptance criteria, impacted areas, risks and questions.

> **Checkpoint A — Understanding.** Stop. The human confirms the summary and acceptance criteria and answers blocking questions. Do not design on unconfirmed criteria.

### Step 2 — Context → `sdlc-system-context` (delta)
Brownfield only: write the delta for this change. Read relevant anti-patterns.

### Step 3 — Design
- Direction unclear → `sdlc-ideate` first.
- UI involved and no approved design → `sdlc-prototype` (declare fidelity level).
- Technical design → `sdlc-design`.
- Interface changes → `sdlc-api-design`.
- Schema/data changes → `sdlc-db-migration` (plan only at this point).
Skip the formal design for small changes that follow an existing pattern; note the approach in the plan instead.

> **Checkpoint B — Design approval.** Stop. The human approves the design, API contract, migration plan and prototype (as applicable), and any ADR-level decisions (new dependency, service, datastore, breaking change).

### Step 4 — Plan → `sdlc-breakdown`
Vertical slices, tests per task, MR split, risks. The plan gate must pass.

> **Checkpoint C — Plan approval** (for work larger than about a day, or when the human asked to review plans; otherwise present the plan and continue).

### Step 5 — Build → `sdlc-implement` with `sdlc-test` (TDD)
- Confirm the branch: continue the existing scope branch or create one from the integration branch (creating a local branch is fine; pushing is not).
- For each task: red → green → refactor; keep the build green; update the todo list.
- Bugs found on the way → `sdlc-debug`; do not patch symptoms.
- Plan proves wrong → stop and return to Checkpoint B/C with a proposed change.

### Step 6 — Review → `sdlc-review`
Independent review (ideally a different agent/model). Fix all blockers through Step 5; re-review.

### Step 7 — Quality gate → `sdlc-quality-gate`
Run the ordered gate on the affected scope. Any blocking failure returns to Step 5. Warnings get follow-up tickets proposed.

### Step 8 — Release preparation → `sdlc-release`
Proposed commit grouping and messages, MR description, changelog entry, version decision, deploy and rollback notes.

> **Checkpoint D — Commit / push / MR approval.** Stop. Execute only the git and MR actions the human explicitly approves.

### Step 9 — Deploy → `sdlc-deploy`
Pre-flight, then deploy environment by environment, verifying each.

> **Checkpoint E — Deploy approval, per environment.** Stop before each shared environment (and before each migration run). Production requires its own explicit approval even if staging was approved.

### Step 10 — Close → `sdlc-docs`, `sdlc-system-context` (update)
Update feature docs, API contract, runbook and the traceability matrix; merge the context delta after release; draft the worklog with real commits.

> **Checkpoint F — Done.** Present the final summary. The human decides whether the ticket is done.

## Bug-fix path

Step 1 (intake, bug variant) → **Checkpoint A** → `sdlc-debug` (reproduce, root cause, regression test, fix) → Step 6 → Step 7 → Step 8 + **Checkpoint D** → Step 9 + **Checkpoint E** → Step 10. If production data was damaged, add a data-correction plan under `sdlc-incident` phase 4.

## Stop conditions (any step)

- Acceptance criteria contradict each other, the code, or a domain rule.
- A step needs a credential, environment or decision you do not have.
- The change starts touching areas not listed in the confirmed scope.
- A blocking gate or review failure cannot be fixed within the agreed design.

## Status report (use at every checkpoint)

```markdown
## <feature> — status at Checkpoint <X>
Step: <n — name> · Branch: <name> · Ticket: <key>

### Done since last checkpoint
- …
### Artifacts
- <intake / design / plan / prototype / gate report / MR draft — paths or inline>
### Decision needed
1. <question> — recommendation: <…>
### Risks / open issues
- …
### Next step after approval
<step and skill>
```
