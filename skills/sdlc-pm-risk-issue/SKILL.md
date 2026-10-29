---
name: sdlc-pm-risk-issue
description: Maintain the project RAID log — identify, score, respond to and monitor risks before they happen; log, prioritise, assign, escalate and close issues that are happening; track assumptions and external dependencies — with explicit thresholds, owners, due dates, triggers and an escalation package. Use when someone asks what could go wrong, reports a blocker or problem, wants a risk register or issue log, or needs to escalate.
stage: 2-plan
role: pm
icon: 🛡
mode: plan
prefer: risk-management, raid-log, risk-register
---

# Risks, issues, assumptions and dependencies (RAID)

A **risk** is uncertain and in the future; an **issue** is happening now. An **assumption** is something the plan treats as true without proof; a **dependency** is something the project needs from outside its control. Classify first — a mislabelled item gets the wrong treatment. Every entry has an owner and a date; an entry without both is a wish.

## When to use

- Building the initial risk list for a plan, or a periodic risk review.
- A blocker, incident, delay or conflict is reported and needs an owner and a path.
- Something must be escalated beyond the project manager's authority.
- Assumptions or external dependencies need validating or chasing.

## When not to use

- Production incidents → `sdlc-incident` (log a project issue only for the delivery impact).
- A request to change scope → `sdlc-pm-change-control` (the risk log records only the risk created by it).
- Code-level defects → the defect process in `sdlc-pm-quality` / `sdlc-debug`.

## Risks

1. **Identify** across categories: technical, requirements/scope, schedule, resources/skills, external dependencies/vendors, budget, people/organisation, security/compliance, operations/environment. Use the plan, the dependency list, past lessons and the team.
2. **Write the statement:** "If <cause>, then <event>, leading to <impact on objective>." Reject vague entries such as "tight timeline".
3. **Score** probability P (1–5) × impact I (1–5); calibrate impact against objectives:
   | I | Meaning (default anchors — replace with the project's) |
   |---|---|
   | 1 | Negligible; absorbed within a task |
   | 2 | Minor slip within buffer, or cost ≤ 2% |
   | 3 | Milestone slip ≤ 1 week, or cost ≤ 5%, or a feature degraded |
   | 4 | Milestone slip > 1 week, cost ≤ 10%, or a key feature lost |
   | 5 | Deadline, contract, regulatory or safety breach; cost > 10% |
   Score = P × I. Red ≥ 15 · Amber 8–14 · Green ≤ 7.
4. **Choose a response:** avoid (change the plan to remove the cause), mitigate (reduce P or I), transfer (contract, insurance, vendor SLA — the risk does not vanish, its owner changes), accept (actively with a contingency, or passively with a note). Accepting a red risk requires the sponsor's recorded decision.
5. **Plan the response:** concrete actions with owner and due date, the **trigger** (early-warning sign that the risk is materialising), the **contingency** (what you do if it fires), and the residual score after mitigation.
6. **Monitor:** review red risks weekly and all risks at least every two weeks; update status Open → Mitigating → Closed (or Occurred). When a risk occurs, open an issue and link the two.

## Issues

1. **Log** with ID, date found, reporter, description of the observed fact (not the guess), affected items.
2. **Classify:** technical, process, resource, dependency, requirement, environment, quality.
3. **Prioritise** severity (impact on objectives) × urgency (time until damage):
   | | Urgent | Not urgent |
   |---|---|---|
   | High severity | P1 | P2 |
   | Low severity | P3 | P4 |
4. **Impact:** which milestones, critical-path items and people are blocked.
5. **Assign** owner and target date. Default response targets (replace with the project's): P1 same day, P2 within 2–3 working days, P3 within the week, P4 backlog.
6. **Direction and workaround:** for blockers, propose a workaround that lets work continue (mock the dependency, re-sequence, temporary manual step) while the root cause is addressed.
7. **Escalate** when a P1 has no path within its target, any issue breaches its target, or the decision is beyond the project manager's authority. Escalation is a package, not a complaint (template below); record when, to whom, and the answer.
8. **Close** only with the resolution and root cause recorded. Recurring issues update the process or create a risk.

## Assumptions and dependencies

- Assumption: statement, owner who can confirm, confirm-by date, status (unvalidated / confirmed / invalid). An invalid assumption becomes an issue, a risk or a change request.
- Dependency: what, provider (team/vendor/client), need-by date, agreed date, status, impact if late, contact. Chase dependencies before their need-by date, not after.

## Guardrails

- Never assign an owner on someone's behalf in a shared tool without approval; propose owners in the draft.
- Never send escalations or update registers in the tracker/wiki without approval; draft them.
- Keep blame out: describe facts and impact, not people.

## Stop conditions

- Unsure whether something is a risk, an issue or a scope change — ask.
- A red risk or P1 has no owner willing to take it — escalate as a decision, do not silently assign.

## Output templates

```markdown
## RAID log — <project> · updated YYYY-MM-DD by <name>

### Risks (sorted by score)
| ID | Risk (If … then … leading to …) | Cat. | P | I | Score | Level | Response | Actions | Trigger | Contingency | Owner | Due | Residual | Status |

### Issues
| ID | Description | Cat. | Priority | Impact (milestones/items) | Owner | Target | Workaround | Status | Root cause |
P1/P2 issues first, each with the next 24-hour action.

### Assumptions
| ID | Assumption | Owner | Confirm by | Status | If invalid |

### Dependencies
| ID | Dependency | Provider | Need by | Agreed | Status | Impact if late | Contact |

### Closed / occurred
| ID | Outcome | Occurred? | Linked issue | Lesson |
```

```markdown
## Escalation — <ID>: <one-line problem>
To: <decider> · From: <PM> · Date: YYYY-MM-DD · Decision needed by: YYYY-MM-DD
Context: <facts, 3–5 lines> · Impact: <milestone/cost/quality, quantified>
Done so far: … · Options: | Option | Impact | Cost | Risk | · Recommendation: …
Decision requested: <exact question>
```

## Hand-off

Red risks and P1/P2 issues appear in the next status report (`sdlc-pm-progress`); decisions go to steering via `sdlc-pm-stakeholder-comms`; scope-driven issues go to `sdlc-pm-change-control`; mitigation tasks enter the plan (`sdlc-pm-project-plan`) or sprint (`sdlc-pm-sprint`).
