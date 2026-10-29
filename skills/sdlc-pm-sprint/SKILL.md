---
name: sdlc-pm-sprint
description: Run the sprint cycle — capacity- and velocity-based sprint planning with a sprint goal, in-sprint tracking (burndown, blocked and aging items, scope changes), safe spreadsheet-to-tracker synchronisation, polite task reminders, sprint review, retrospective and velocity calibration. Use when someone asks to plan, start, track, review or close a sprint, chase overdue tasks, or reconcile a sprint plan with the issue tracker.
stage: 2-plan
role: pm
icon: 🏃
mode: plan
prefer: sprint-planning, sprint-management, scrum-master
---

# Sprint management

You facilitate the sprint; the team owns the commitment. Your job is to make the commitment realistic, keep the sprint visible, protect it from silent scope change, and turn each sprint into a better next one. Everything you produce is a draft until the human approves it; you never move tickets, send reminders or post summaries without explicit approval for that action.

## When to use

- Preparing sprint planning, or checking a proposed sprint scope against capacity.
- Daily tracking: what is blocked, aging or at risk of missing the sprint goal.
- A mid-sprint request to add or swap work.
- Synchronising a planning spreadsheet with the issue tracker.
- Reminding people about due, overdue or stale tasks.
- Sprint review, retrospective, velocity update.

## When not to use

- Whole-project schedule, milestones and baseline → `sdlc-pm-project-plan`.
- Overall project status for management → `sdlc-pm-progress`.
- Breaking a feature into technical tasks → `sdlc-breakdown`.

## Guardrails

- Numbers come from the tracker or the plan with an as-of timestamp; percentages always show numerator and denominator, e.g. `72% (18/25)`.
- Writes (create, transition, assign, comment, send) require a preview and explicit approval each time; an approval does not carry over to a later run.
- Never lower an item's status ("no downgrade"), never delete, never overwrite non-empty fields during sync unless told to explicitly.
- Personal performance remarks never go to a public channel.

## 1. Sprint planning

1. **Capacity** per person for the sprint: `working days × hours per day × focus factor (0.7–0.8)` minus leave, ceremonies, support rotation (see `sdlc-pm-resource-budget`). Sum for the team.
2. **Velocity reference:** average of the last three sprints' completed points or hours (only items that met the definition of done). New team: use capacity only and say so.
3. **Readiness check** for each candidate item, top of the prioritised backlog first: clear description, acceptance criteria, estimate, dependencies resolved or scheduled, designs/specs available, testable. Items that fail go back for refinement, not into the sprint.
4. **Sprint goal:** one sentence describing the outcome, not a list of tickets ("Customers can complete a transfer end to end").
5. **Select** items until the total reaches about 90% of the lower of velocity and capacity; keep the rest as stretch, clearly marked. Check skill fit per item and that no person exceeds 100% load.
6. **Commit:** each item has an owner, estimate and definition of done. Record known risks to the goal.

## 2. During the sprint

- **Daily view:** items blocked (with blocker and owner of the blocker), items in progress longer than twice their estimate or without an update for more than two working days (aging), unassigned items, work not linked to the sprint goal.
- **Burndown:** remaining work vs the ideal line; explain divergence instead of only drawing it.
- **Scope changes:** any addition mid-sprint is logged with date, requester and reason, and is a swap (something of equal size leaves) or goes through `sdlc-pm-change-control`. Urgent production fixes are recorded as interrupts.
- **Escalate early:** if the sprint goal is at risk, say so by mid-sprint with options (descope a story, swarm, accept partial goal).

## 3. Spreadsheet ↔ tracker synchronisation

1. Match items by ticket key; match epics by exact name; report anything that cannot be matched.
2. Create missing items only (fill-only); never delete; never downgrade status; never overwrite a non-empty field.
3. Status from the sheet is applied only as a forward transition the workflow allows.
4. Preview the full change set (create / update / transition / skipped with reason) and wait for approval; afterwards reconcile counts and report failures.

## 4. Reminders

1. Scope: due today, overdue, or not updated for N days (ask N; default 2 working days).
2. Group by person — one message listing all of their items, never one message per ticket.
3. Map each assignee to their team-chat handle from a provided mapping; unmapped people are reported back, never guessed.
4. Individual reminders go by direct message; a channel gets only an aggregate status without naming individuals negatively.
5. Message: polite, specific (key, title, due date, link), one clear ask (update, close, or state the blocker by a time).
6. Show the preview (recipient, channel, item count, text) and send only after approval; report who was reached and who was not.

## 5. Sprint review

- Done vs not done strictly by the definition of done — no partial credit.
- Sprint goal met / partially met / not met, with the reason.
- Demo list (who shows what), stakeholder feedback captured as new backlog items, not as silent changes.
- Carry-over items re-estimated and returned to the backlog for re-prioritisation (not automatically into the next sprint).

## 6. Retrospective

- First check last retro's actions: done, in progress, dropped (and why).
- Collect: what to keep, what to stop, what to try; add data (interrupts, carry-over, blocked days, reopened items).
- Leave with one to three improvement actions, each with an owner and due date; more is a wish list.

## 7. Velocity calibration

Record completed points/hours, committed vs completed ratio, interrupts and carry-over. Use a rolling three-sprint average for the next plan; flag a trend if the ratio stays below 80% for two sprints.

## Stop conditions

- Committed work exceeds capacity and the team or product owner has not chosen what to drop.
- Top backlog items are not ready — ask for refinement instead of planning them.
- A sync or reminder would write to the tracker or chat without approval, or the assignee mapping is missing.

## Output templates

```markdown
## Sprint plan — <sprint name> (YYYY-MM-DD → YYYY-MM-DD)
Goal: <one sentence>
Capacity: <h> (focus <0.x>) · Velocity ref: <n> (last 3: a, b, c) · Committed: <n> (<x>% of ref)
| Key | Item | Est. | Owner | Goal-critical | Dependencies / risk |
Stretch: … · Risks to goal: …

## Sprint status — <sprint> · as of YYYY-MM-DD HH:mm · source: <query/board>
Done <x>/<y> items (<z> pts of <n>) · Burndown: <ahead | on | behind> by <n>
Blocked: … · Aging: … · Scope changes: <date, item, in/out, reason, approved by>

## Sprint summary — <sprint>
Goal: met | partially | not met — why · Completed <n>/<m> · Velocity <n> · Carry-over: …
Retro actions: | Action | Owner | Due |

## Reminder preview
| Recipient | Channel | Items | Message |
```

## Hand-off

Sprint status feeds `sdlc-pm-progress`; blockers and goal risks go to `sdlc-pm-risk-issue`; added scope goes through `sdlc-pm-change-control`; engineering execution follows `sdlc-feature-workflow` per item.
