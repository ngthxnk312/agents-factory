---
name: sdlc-qa-test-report
description: Produce a test summary report for a feature or release from the final test plan, executed test case results, defect data and optional automated run results — scope actually tested, environments, run and pass rates, coverage, defect metrics, exit-criteria comparison, open issues and risks, deliverables, and a data-backed release recommendation (go, conditional go, no-go) with sign-off placeholders. Use at the end of a test cycle, before a release decision, or when stakeholders ask for test status.
stage: 5-verify
role: qa
icon: 📈
mode: acceptEdits
prefer: test-summary-report, test-report, qa-report
---

# Test summary report

The report answers one question for decision makers — **is this release ready, and what risk remains?** — and proves the answer with numbers that trace back to executed tests and recorded defects. Optimism is not data.

## When to use

- End of a test cycle or sprint testing; before a release go/no-go.
- Status reporting mid-cycle (mark the report `Interim`).

## When not to use

- Reporting a single automated run's mechanics (environment, command, triage) — that is the execution section of `sdlc-qa-automation`; the summary report consumes it.
- The pre-merge engineering gate — `sdlc-quality-gate`.

## Required inputs (stop if missing)

1. **Final test plan** (`sdlc-qa-test-plan`): scope, environments, exit criteria. A draft plan may be used only if the human confirms; the report then states the limitation.
2. **Executed test results**: per case status `Pass / Fail / Blocked / Not Run / N/A`, platform, build, evidence link, defect ID. Without it run rate and pass rate cannot be computed — stop.
3. **Defect data**: export or table; analyze it with `sdlc-qa-defect` Part B first. Without it, no confident release conclusion.
4. Optional: automated run results and triage (`sdlc-qa-automation`), UI/UX findings (`sdlc-qa-ui-ux`), traceability matrix (`sdlc-qa-test-design`). Ask before including data the human has not pointed you to.

## Procedure

1. **Validate the data.** Totals per status add up to the planned case count; every Fail has a defect ID or a reason; every Blocked has a cause; Not Run has a reason and a risk statement; results belong to the build being released (results from older builds are labelled). List any inconsistency as a limitation.
2. **Compute metrics** (show formulas):
   - Run rate = executed / planned, where executed = Pass + Fail (+ Blocked only if the project counts it; state the convention).
   - Pass rate = Pass / executed; also for Critical/High-priority cases separately.
   - Requirement coverage = covered testable requirements / testable requirements (from the matrix); list requirements with failing or unexecuted cases.
   - Automation share and automated pass/flaky counts if available.
   - Defect metrics: by severity × status, blockers, reopen rate, heat map (from `sdlc-qa-defect`).
3. **Compare with exit criteria**, criterion by criterion: target, actual, met / not met, evidence.
4. **Scope reality check.** What was planned vs actually tested; descoped areas and why; untested risk areas called out explicitly.
5. **Issues and risks.** Open blockers, conditional items awaiting owner acceptance, untested or weakly tested high-risk areas, environment limitations that may hide defects (stubs instead of real integrations, missing devices), known flaky tests. Each with impact and mitigation.
6. **Recommendation — decision rules:**
   - **Go**: all exit criteria met; no open Critical; no open High without accepted workaround; remaining risks accepted.
   - **Conditional go**: criteria met except items with an explicit owner acceptance or a time-boxed mitigation (feature flag off, staged rollout, hot-fix plan) — list each condition.
   - **No-go / hold**: any open blocker; run/pass rate below target in critical areas; missing data making the conclusion unreliable.
   The recommendation is advice; the decision belongs to the named owner.
7. **Executive summary last**, written for non-testers: release/feature, verdict, 3–5 key numbers, top risks, recommended decision and conditions.
8. **Export.** Markdown by default. If the project needs other formats, add a CSV of per-case results and/or a self-contained HTML (inline CSS, status banner, metric cards, exit-criteria table with pass/fail colors, print styles) — no external network resources. Use spreadsheets only via the project's tooling; write values, not formulas, so the file opens anywhere. Save under the project's QA folder or a scratch directory as the project prefers.

## Stop and ask

- Required input missing or inconsistent beyond repair.
- The data supports No-go but the human asks for a Go wording — present the facts; do not soften numbers.
- Publishing the report (wiki, tracker, chat) — only with approval.

## Guardrails

- Never invent results or mark cases passed that have no execution record.
- Never fill sign-off/approval fields; leave placeholders.
- Keep IDs (cases, requirements, defects) so every number can be traced.
- No personal data or secrets in evidence excerpts.

## Output template

```markdown
# Test summary report — <feature / release> (<Final | Interim>)
Document id: TR-<project>-<version> · Build: <version> · Period: <from–to> · Author: <role>

## 1. Executive summary
Verdict: **<GO | CONDITIONAL GO | NO-GO>** · Key numbers · Top risks · Conditions

## 2. Project information
Feature/release · test period · team roles

## 3. Scope
In scope (tested) · Out of scope · Planned but not tested (reason, risk)

## 4. Environments
| Environment | Build | Platforms/devices/browsers | Integrations (real/sandbox/stub) | Limitations |

## 5. Results and metrics
| Status | Count | % | Notes |
| Pass | | | |
| Fail | | | |
| Blocked | | | |
| Not Run | | | |
| N/A | | | |
| Total planned | | 100% | |
Run rate = … · Pass rate = … · Critical/High pass rate = … · Requirement coverage = …
### Results by module / story
| Module | Planned | Pass | Fail | Blocked | Not Run |
### Automation (if used)
### Defects
| Severity | Open | Fixed not verified | Verified/Closed | Total |
Blockers list · Heat map

## 6. Exit criteria
| Criterion | Target | Actual | Met? | Evidence |

## 7. Issues and risks
| Item | Type (blocker/conditional/risk/limitation) | Impact | Mitigation | Owner |

## 8. Deliverables
| Artifact | Location | Status |

## 9. Sign-off
| Role | Name | Decision | Date |  ← placeholders, filled by humans
```

## Hand-off

- Recommendation → release owner (project-level readiness and handover: `sdlc-pm-quality`); on Go/Conditional go → `sdlc-release` and `sdlc-deploy` (mobile: `sdlc-mobile-release`).
- No-go items → `sdlc-debug` / `sdlc-implement` fixes → retest → updated report.
- Lessons (escaped defects, flaky areas, gaps) → test plan and suite updates.
