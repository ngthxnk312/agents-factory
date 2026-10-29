---
name: sdlc-pm-resource-budget
description: Plan and control people and money — per-person capacity, allocation and load, skill fit and single points of failure, rebalancing and shortfall options; budget versus actuals, burn versus progress, cost performance, estimate at completion and payment milestones; and, when asked, an evidence-based, privately delivered contribution review of team members. Use when asking who is overloaded or free, whether the team can absorb more work, how the budget stands, whether a payment milestone is due, or to prepare a periodic member review.
stage: 2-plan
role: pm
icon: 💰
mode: plan
prefer: resource-planning, capacity-planning, budget-tracking
---

# Resources and budget

Capacity and money are the two hard limits of every plan. You make them visible early enough that trade-offs are choices, not emergencies. You work from data with stated sources; anything you estimate is labelled as an estimate.

## When to use

- "Who is overloaded?", "Who has room?", "Can we take on X?", "Do we need another person?"
- Planning allocation for a period, sprint or phase.
- Budget status, forecast at completion, overrun warning, payment milestone status.
- Preparing a periodic contribution review for a manager (sensitive — see section 4).

## When not to use

- Building the schedule itself → `sdlc-pm-project-plan` (it uses the capacity rules here).
- Sprint commitment → `sdlc-pm-sprint`.
- Pricing a change request → `sdlc-pm-change-control` (it uses the cost rules here).

## 1. Capacity and load

1. **Capacity** per person per period: `working days × hours per day × focus factor` minus leave, holidays, recurring meetings, support/on-call rotation and other-project allocation. Default focus factor 0.7–0.8; use the team's measured value when available.
2. **Allocation:** sum of remaining estimates of the work assigned to the person in the period.
3. **Load** = allocation ÷ capacity:
   | Load | Status |
   |---|---|
   | < 50% | Under-used — check whether work is missing or the person is blocked |
   | 50–85% | Healthy |
   | 85–100% | Full — no room for interrupts |
   | > 100% | Overloaded — the plan will slip or quality will drop |
4. **Skill fit:** each item is assigned to someone with the needed skill; mark **single points of failure** (only one person can do a critical area) and plan pairing or documentation as mitigation.
5. **Rebalance:** move not-started items first, to people with matching skills and room; never move half-finished work without the owner agreeing; recompute load after each move and show before/after.
6. **Shortfall:** if total allocation exceeds total capacity, present options — add people (note onboarding time and reduced output for the first weeks), reduce or defer scope (via `sdlc-pm-change-control`), extend the date — with their impact. The sponsor chooses.
7. **Changes to assignments** are proposals until approved; notify affected people only after approval.

## 2. Budget

1. **Structure:** budget at completion (BAC) by category — people, licences, infrastructure, third parties, travel, contingency reserve (known risks), management reserve (unknowns).
2. **Actuals** to the as-of date by category, from the finance or time-tracking source with a timestamp.
3. **Indicators:** remaining = budget − actual; `% spent = actual ÷ budget`; compare % spent with % complete (from `sdlc-pm-progress`) — spending faster than progressing is an early warning. With earned value: `CPI = EV ÷ AC`; CPI < 1 means over cost.
4. **Forecast:** `EAC = BAC ÷ CPI` when the current cost efficiency is expected to continue; `EAC = AC + bottom-up estimate to complete` when past variance was a one-off. `VAC = BAC − EAC`. Show both when unsure and say which you trust.
5. **Contingency use:** every draw on contingency is linked to the risk that consumed it.
6. **Payment milestones** (contract projects): milestone, acceptance condition, amount, due date, status — Not due / Eligible (acceptance evidence complete) / Invoiced / Paid / On hold (with reason). Flag milestones whose acceptance condition is at risk early enough to fix it before the invoice date.
7. **Warnings:** forecast overrun, a payment milestone at risk, or unplanned spend — each with cause and proposed action.

## 3. Rules for numbers

Every figure carries its source and as-of date; percentages show numerator/denominator; currency and units are explicit; no figure is invented — missing data is shown as missing.

## 4. Contribution review (sensitive, only when asked)

A periodic, data-informed input for the manager who owns the evaluation. The agent drafts; the manager decides.

1. Confirm period, people, criteria and weights. Defaults: volume 25%, timeliness 30%, quality 30%, initiative and collaboration 15%.
2. Collect objective data per person: items assigned/completed, on-time rate (done by due date, using status-change history), defects attributed and reopened items, help given, updates kept current.
3. Score each criterion 1–5 with written anchors: volume relative to capacity and team norm (not raw counts); timeliness as on-time %; quality inversely to reopen/defect rate and definition-of-done adherence; initiative from evidence (raised risks early, unblocked others).
4. **Fairness checks:** same yardstick for everyone in the same role; remove effects outside the person's control (blocked by others, scope changes, leave, support duty); never rank by tracker counts alone; note data gaps.
5. Total = Σ(score × weight) → band: ≥ 4.5 outstanding · 3.5–4.4 strong · 2.5–3.4 meets expectations · < 2.5 needs improvement. The band is a suggestion.
6. Balanced comments: strengths, areas to improve, one or two development actions — consistent with the scores.
7. Deliver privately to the requesting manager only. Never post to shared pages, channels or tickets. Never message the person being reviewed.

## Stop conditions

- Capacity data (leave, allocation to other projects) is unknown — ask; do not assume full availability.
- Financial actuals are unavailable — report indicators as N/A rather than estimating spend.
- A contribution review is requested about people outside the requester's authority, or for publication — decline and explain.

## Output templates

```markdown
## Team load — <period> · as of YYYY-MM-DD · source: …
| Member | Role | Capacity (h) | Allocation (h) | Load | Status |
Single points of failure: … · Rebalancing proposal: move <key> (<h>, not started) A → B — reason; A 128% → 112%
Shortfall: <h> → options: | Option | Impact | Cost |

## Budget — <project> · as of YYYY-MM-DD · source: …
| Category | Budget | Actual | Remaining | % spent |
% complete: 68% (34/50) · CPI: 1.05 · EAC: … (method) · VAC: …
| Payment | Milestone | Acceptance condition | Amount | Due | Status |
Warnings: …
```

```markdown
## Contribution review — <name> · <period> · CONFIDENTIAL (for <manager> only)
| Data | Value |  (assigned/completed, on-time %, reopened, help given)
| Criterion | Weight | Score | Evidence |
Total: <x.x> → suggested band: … · Adjustments for factors outside their control: …
Strengths: … · To improve: … · Development actions: …
```

## Hand-off

Capacity feeds `sdlc-pm-project-plan` and `sdlc-pm-sprint`; budget indicators feed `sdlc-pm-progress`; overruns and single points of failure become risks in `sdlc-pm-risk-issue`; contribution reviews go only to the requesting manager.
