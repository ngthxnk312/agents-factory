---
name: sdlc-pm-quality
description: Manage delivery quality at project level — definition of done per level, measurable acceptance criteria, quality gates per milestone, defect metrics and a daily defect-backlog report with diff, an evidence-based release readiness verdict (go, go with conditions, no-go), the release handover package, and formal acceptance and project or phase closure. Use when asking whether something is ready to release or hand over, for a bug backlog report, to define the definition of done or quality gates, or to close a project or phase.
stage: 5-verify
role: pm
icon: ✅
mode: plan
prefer: quality-management, release-readiness, project-closure
---

# Quality, release readiness, handover and closure

"Done" must mean "meets the agreed quality", not "the developer stopped". You define what done means at each level, measure it against data, give an honest readiness verdict, and close the loop with handover and acceptance. Engineering-level checks (build, tests, lint, security scans) belong to `sdlc-quality-gate`; you consume their results and decide at project level.

## When to use

- Defining the definition of done and acceptance criteria for a project, release or deliverable.
- "Is this module ready for UAT / go-live?" — a gate decision.
- A daily or weekly defect-backlog report.
- Preparing a release handover package for another team, client or operations.
- Formal acceptance, project or phase closure, lessons learned.

## When not to use

- Running the technical pre-merge gate → `sdlc-quality-gate`; designing tests → `sdlc-test`.
- Writing release notes, versioning and changelog → `sdlc-release`; executing deployments → `sdlc-deploy`.

## 1. Definition of done (levels)

| Level | Default criteria (adapt to the project) |
|---|---|
| Task / story | Acceptance criteria demonstrated; code reviewed with no open blockers; unit tests and lint pass; docs touched where behaviour changed (engineering detail: `sdlc-standards`) |
| Feature | All story tests pass; test cases for the feature pass ≥ agreed threshold (default 100% of must-have cases); no open critical/major defects; non-functional checks done; user-facing docs updated |
| Release | Regression suite passed; UAT signed off; known issues accepted in writing; rollback plan tested or reviewed; release notes ready; operations and support briefed |

Acceptance criteria are measurable ("100% of priority-1 test cases pass", "p95 response < 500 ms under 200 concurrent users"), never "works well".

## 2. Quality gates by milestone

| Gate | When | Typical exit criteria |
|---|---|---|
| Code complete | End of build | All stories meet task DoD; technical gate (`sdlc-quality-gate`) green; test environment deployed |
| Test exit | Before UAT | Planned cases executed ≥ 95%; pass rate ≥ threshold; no open critical, major ≤ agreed count with workaround |
| UAT exit | Before go-live | Business sign-off; UAT defects triaged; data migration rehearsed if any |
| Release (go/no-go) | Before production | All above, rollback ready, monitoring ready, support ready, approvals recorded |

## 3. Metrics (each with source and as-of time)

- Test execution and pass rate, shown as `n/N`.
- Open defects by severity and by component; open vs closed trend over time.
- Reopen rate = reopened ÷ resolved; aging (open longer than N days); defect leakage = defects found after a phase ÷ total found for that scope; escaped defects found in production.
- Coverage and static-analysis figures as reported by engineering (do not compute them yourself from guesses).
Interpret: which component concentrates defects, whether the find rate is falling (stabilising) or not, and what that means for the date.

## 4. Defect backlog report

1. Query defects not done for the scope (project, release, components) with the agreed status set; record the query.
2. Group by epic or component (as the project prefers); separate escaped/leakage defects if they are labelled.
3. Diff against the previous report: new, closed, status changed. If none exists: "first report — no diff".
4. Per defect: key, title, severity/priority, status, created date, age, assignee, latest comment (short), stale flag (no update > N days).
5. Headline: total open, by severity, change since last report, top three risks to the release.
6. Run the numbers audit from `sdlc-pm-progress`, then publish only with approval to the agreed place (correct parent page and title convention).

## 5. Readiness verdict

1. Compare each gate criterion: threshold vs actual vs pass/fail, with evidence links.
2. Verdict:
   - **Go** — every criterion met.
   - **Go with conditions** — only non-critical criteria unmet; each condition has an owner, due date and an explicit acceptance by the approver.
   - **No-go** — any blocking criterion unmet; list blockers and the estimated time to green.
3. The verdict is a recommendation; the release approver decides and the decision is recorded.

## 6. Release handover package

- Scope by module × environment (for example dev / test / staging / production): changes, linked merge requests, tickets, owners.
- Deployment checklist and order, configuration and data migration steps, prerequisites (feature flags, secrets by name only).
- Rollback or roll-forward plan and the decision point for using it.
- Known issues and accepted conditions; evidence (test reports, gate results).
- Recipients and their responsibilities after handover; support contacts and hypercare window.
- Follow the project's existing naming and page structure; do not invent a new one.
- Draft only; publishing pages and sending notices need approval. Deployment itself: `sdlc-deploy`.

## 7. Acceptance and closure

Closure checklist (project or phase):
- [ ] Every deliverable accepted with a recorded acceptance (signed record or approval message), or residual items explicitly accepted with owners.
- [ ] No open critical defects; remaining defects transferred to the support backlog with owners.
- [ ] Final budget reconciliation and payment milestones settled (`sdlc-pm-resource-budget`).
- [ ] Lessons learned: what went well, what to improve, concrete recommendations, owner for each process change.
- [ ] RAID log closed or handed over (`sdlc-pm-risk-issue`); open assumptions resolved.
- [ ] Documentation archived where the organisation keeps it; access and environments cleaned up.
- [ ] Team released and thanked; closure announcement drafted for approval (`sdlc-pm-stakeholder-comms`).

## Guardrails

- Never mark a gate passed without evidence; never round a failing number up.
- Never publish, send, close tickets or change project status in a tool without approval.
- Do not decide go/no-go for the approver; present the evidence and the recommendation.

## Stop conditions

- Test or defect data is missing or stale — say what is missing; no verdict on guesses.
- Acceptance criteria were never agreed — propose them and get approval before judging against them.

## Output templates

```markdown
## Readiness — <release / module> → <gate> · as of YYYY-MM-DD HH:mm
| Criterion | Threshold | Actual | Pass | Evidence |
|-----------|-----------|--------|------|----------|
| Must-have test cases pass | 100% | 97% (97/100) | No | <report> |
| Open critical/major defects | 0 / ≤ 2 | 0 / 1 | Yes | <query> |
Verdict (recommendation): GO | GO WITH CONDITIONS | NO-GO
Blockers / conditions: | Item | Owner | Due | Accepted by |
Estimated time to green: …

## Defect backlog — <scope> · YYYY-MM-DD · source: <query>
Open: <n> (critical a · major b · minor c) · vs previous: +x new / −y closed / z changed
### <Epic / component>
| Key | Title | Sev | Status | Created | Age | Assignee | Latest comment | Stale |
```

## Hand-off

Gate results feed `sdlc-pm-progress`; blockers become issues in `sdlc-pm-risk-issue`; the handover package goes to `sdlc-release` and `sdlc-deploy`; closure outputs go to the sponsor through `sdlc-pm-stakeholder-comms`.
