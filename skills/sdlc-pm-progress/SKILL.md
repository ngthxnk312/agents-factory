---
name: sdlc-pm-progress
description: Measure real project progress against the baseline and report it — status counts, milestone forecasts and slippage, earned-value indicators, at-risk items, an evidence-based red/amber/green status, root causes, recommended actions, a diff against the previous report and an audience-appropriate status report that passes a numbers audit before anything is published. Use when someone asks "are we on track", wants a daily, weekly, monthly or milestone report, an executive summary, or a burndown/forecast.
stage: 4-build
role: pm
icon: 📊
mode: plan
prefer: status-report, progress-tracking, project-status-report
---

# Progress control and status reporting

You turn tracker data into an honest picture of where the project stands and what must be decided. A status report is only as good as its weakest number: every figure must trace to a source at a stated time, and the overall status must follow the numbers — never the mood.

## When to use

- "Are we on track?", "Will we make the deadline?", "Which tasks are late?"
- Daily, weekly, monthly or milestone status reports; an executive summary; a steering pack.
- Forecasting a milestone or computing schedule/cost indicators.

## When not to use

- No baseline exists → `sdlc-pm-project-plan` first (you can still report raw counts, but no variance).
- Sprint-internal mechanics (burndown inside one sprint, reminders) → `sdlc-pm-sprint`.
- Defect backlog and release readiness → `sdlc-pm-quality`.

## Inputs

Baseline (WBS, milestones, dates), tracker data (items with status and status-change history, due dates, assignees), as-of date, reporting period, audience, previous report (for the diff), and optionally effort or cost actuals for earned value. Ask for audience and period if missing.

## Procedure

1. **Fix the as-of date and scope** (project, release, sprint set, components). Record the exact query or filter you used.
2. **Count by status:** To do / In progress / Blocked / Done. Determine "done" from the status-change history at the as-of date — some workflows never set a resolution date, so counting by resolution silently undercounts. Show `% done = done / total` with numerator and denominator.
3. **Milestones:** for each, planned date vs forecast date and the variance in working days. Forecast from remaining work ÷ demonstrated throughput, not from hope.
4. **Earned value** (only when effort or cost actuals exist):
   - PV planned value, EV earned value (budget of completed work), AC actual cost.
   - `SPI = EV / PV`, `CPI = EV / AC`, `SV = EV − PV`, `CV = EV − AC`. SPI < 1 means behind schedule; CPI < 1 means over cost.
   - Forecast at completion: `EAC = BAC / CPI` when the current trend is expected to continue.
5. **At-risk items:** overdue, blocked (with blocker), aging (in progress beyond twice the estimate or with no update for N days), unassigned, unestimated, on the critical path with no slack. Give owner and age for each.
6. **Overall status (RAG)** by rule, not by feeling:
   - Green — variance within the remaining buffer and no milestone forecast to slip.
   - Amber — variance consumes 1–2× the remaining buffer, or a milestone is forecast to slip but recovery actions exist.
   - Red — variance exceeds 2× buffer, the next milestone is forecast to slip with no credible recovery, or a red risk/P1 issue is open on the critical path.
   - Never report green while a milestone is slipping.
7. **Root cause** for every amber/red point: dependency, capacity, scope growth, estimation error, quality/rework, environment, decision pending.
8. **Recommend actions** with their cost: fast-track (parallelise), crash (add people — note onboarding drag), re-plan, de-scope (via `sdlc-pm-change-control`), escalate (via `sdlc-pm-risk-issue`). Name the decision needed, who decides, and by when.
9. **Diff against the previous report:** new items, closed items, status changes, risks escalated or closed. If there is no previous report, write "first report — no diff".
10. **Tailor to the audience:** executives get one page — status, three key points, decisions needed, top risks; the team gets item-level detail; clients get commitments, delivered scope and what is needed from them.
11. **Run the report audit** (below), then present the draft. Publish or send only after approval.

## Report audit (all must pass before publishing)

- [ ] Every number traces to a named source and timestamp; nothing is estimated without saying so.
- [ ] Parts add up to totals; percentages show numerator/denominator; the diff equals new − closed and matches status changes.
- [ ] Data belongs to the requested period and scope only.
- [ ] RAG status is consistent with the numbers and rules above.
- [ ] Mandatory sections present: summary, progress, achievements, next period, risks/issues, decisions needed, sources and assumptions.
- [ ] Missing data is shown as "N/A — no data", never invented.
- [ ] No personal performance commentary or sensitive data in a broadly shared report.
- [ ] When publishing to the wiki: correct parent page (for example the right week's page), title follows the project convention.

If any check fails, fix the report; never publish around a failed check.

## Publishing

Show exactly what will be published where (space/page/parent, channel, recipients). Wait for approval. After publishing, return the link as evidence. If a previous page exists for the same period, update it only when the human confirms — do not create duplicates.

## Stop conditions

- The data source cannot be read, or the query returns obviously incomplete data — report what is missing; do not extrapolate.
- The numbers point to red but the requester wants green — present the evidence; the status follows the data.
- Any publish or send without approval.

## Output template

```markdown
# Status report — <project> — <period> · as of YYYY-MM-DD HH:mm
Overall: GREEN | AMBER | RED · Prepared by: … · Audience: …

## 1. Summary
- <3–5 bullets: conclusion and the most important numbers>

## 2. Progress
| Indicator | Value | Previous | Change |
|-----------|-------|----------|--------|
| Done | 68% (34/50) | 60% (30/50) | +4 items |
| SPI / CPI | 0.86 / 1.02 | … | … |

| Milestone | Planned | Forecast | Variance (wd) | Status |
|-----------|---------|----------|---------------|--------|

Diff vs previous: +<x> done · +<y> new issues · <z> status changes · risks escalated: …

## 3. Achievements this period
## 4. Plan for next period
- [ ] <work> — <owner> — <due>
## 5. Risks and issues (top)
| Level | Description | Impact | Owner | Action |
## 6. Decisions needed
| Decision | Options | Recommended | Decider | Needed by |
## 7. At-risk items
| Key | Item | Reason (overdue / blocked / aging) | Owner | Age |
## 8. Sources and assumptions
Source: <query / board / sheet> at <timestamp> · Assumptions: …
```

## Hand-off

Decisions needed go to `sdlc-pm-stakeholder-comms` (steering agenda or escalation); new risks and issues to `sdlc-pm-risk-issue`; scope trade-offs to `sdlc-pm-change-control`; quality figures come from `sdlc-pm-quality`.
