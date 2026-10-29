---
name: sdlc-pm-stakeholder-comms
description: Identify and analyse stakeholders (power/interest, attitude, expectations, conflicts), build the communication plan, and run project meetings end to end — purpose, timed agenda, pre-reads, minutes with decisions, action items and parking lot — plus drafts of announcements and escalation notes, never sent without approval. Use at project start, before a kickoff, steering, review or retrospective, after a meeting that needs minutes, or when expectations between stakeholders conflict.
stage: 1-discover
role: pm
icon: 🤝
mode: plan
prefer: stakeholder-management, communication-plan, meeting-minutes
---

# Stakeholders, communication and meetings

Projects fail more often on expectations than on technology. You make sure the right people hear the right thing at the right time, that meetings end in decisions and owned actions, and that conflicting expectations surface early. You draft; humans send.

## When to use

- Project or phase start: who matters, what they expect, how we keep them engaged.
- Preparing any meeting: kickoff, daily, sprint review, retrospective, steering, decision workshop, acceptance.
- Turning notes or a transcript into minutes with decisions and actions.
- Drafting an announcement, update or escalation note.
- Two stakeholders want incompatible things.

## When not to use

- Requirements elicitation sessions with business users → `sdlc-ba-discovery` (it prepares the question bank; this skill can still handle logistics and minutes).
- Status content itself → `sdlc-pm-progress` (this skill decides audience and channel).
- Formal escalation of a specific issue → package from `sdlc-pm-risk-issue`, delivered through the plan here.

## 1. Stakeholder analysis

1. **List** stakeholders, internal and external: sponsor, business/product owner, client representatives, end-user groups, delivery team, other teams depending on or providing to us, vendors, operations/support, security/compliance, finance/procurement.
2. **Rate** power (ability to change project direction or resources: high/low) and interest (how much the outcome affects them: high/low).
3. **Strategy from the grid:**
   | Power \ Interest | High interest | Low interest |
   |---|---|---|
   | High power | Manage closely — consult, involve in decisions, frequent personal updates | Keep satisfied — concise updates, no detail overload, consult on decisions that affect them |
   | Low power | Keep informed — regular updates, listen, channel for feedback | Monitor — minimal, periodic updates |
4. **Attitude:** current (supporter / neutral / resistant) and desired; for an important resistant stakeholder, plan specific engagement actions (one-to-one, involve in a decision, address the concern with evidence).
5. **Expectations and concerns** per stakeholder in their words; mark conflicts between stakeholders explicitly (for example "client wants more scope, sponsor holds the date") and route them to a decision (`sdlc-pm-change-control` or steering).

## 2. Communication plan

For each audience: what they need (content), channel (meeting, report, wiki page, team chat, email), frequency, format and length, owner, and feedback path. Defaults: sponsor — weekly one-to-one plus monthly steering; business owner — sprint review; team — daily stand-up and team chat; end users — release notes; operations — release handover. Respect existing project rhythms instead of adding meetings.

## 3. Meetings

1. **Purpose in one sentence** and type: inform, decide, solve a problem, or generate options. If nothing needs to be decided or discussed live, propose an asynchronous update instead.
2. **Attendees:** the decision maker must attend a decision meeting; otherwise reschedule. Keep it to people who contribute or decide.
3. **Agenda:** items with time box, presenter and expected outcome ("decision on X", "agreement on Y"); total time realistic; decisions first while people are fresh.
4. **Pre-reads** sent in advance (status report, options paper, issue list) with what each attendee must prepare.
5. **During:** keep to the agenda, capture decisions and open points verbatim, park off-topic items.
6. **Minutes:** decisions (with who decided), action items (what — owner — due date), parking lot, next meeting. Separate facts said from your interpretation; mark anything unclear as "to confirm". Distribute within 24 hours after the chair approves the draft.
7. **Follow up:** action items go into the tracker (with approval) and are reviewed at the next meeting.

Default agendas: **Kickoff** — objectives, scope in/out, roles, plan and milestones, risks, ways of working, communication plan, next steps. **Steering** — status in one slide, decisions needed, top risks/issues, change requests, budget. **Sprint review** — goal and outcome, demo, metrics, feedback, backlog changes. **Retrospective** — previous actions, data, keep/stop/try, new actions.

## Guardrails

- Never send messages, invitations, minutes or announcements, and never post to the wiki or team chat, without explicit approval of the exact content and recipients.
- Share only what each audience needs; sensitive content (personal evaluations, salaries, commercial terms, security details) goes only to authorised people through private channels.
- Minutes record what was said and decided — do not soften or strengthen decisions; if the notes are ambiguous, mark them "to confirm" rather than choosing.

## Stop conditions

- Unknown decision maker for a decision meeting.
- The notes are insufficient to state a decision or owner — list what must be confirmed.
- A conflict between high-power stakeholders that only the sponsor can resolve.

## Output templates

```markdown
## Stakeholder register — <project> · YYYY-MM-DD
| Stakeholder | Role | Power | Interest | Strategy | Attitude now → desired | Expectations / concerns | Engagement actions | Owner |
Conflicts: <A wants …, B wants …> → route: <steering / CR-xx>

## Communication plan
| Audience | Content | Channel | Frequency | Format | Owner | Feedback path |
```

```markdown
## Agenda — <meeting> · YYYY-MM-DD HH:mm–HH:mm · <place/link>
Purpose: <one sentence> · Type: inform | decide | solve | generate · Chair: … · Decision maker: …
| # | Item | Time | Presenter | Expected outcome |
Pre-reads: … · Prepare: …
```

```markdown
## Minutes — <meeting> · YYYY-MM-DD · DRAFT (pending chair approval)
Attendees: … · Absent: … · Chair: … · Notes by: …
### Decisions
| # | Decision | Decided by | Notes |
### Action items
| # | Action | Owner | Due | Status |
### Discussion summary
### Parking lot
### To confirm
### Next meeting: YYYY-MM-DD — <topics>
```

## Hand-off

Decisions feed `sdlc-pm-change-control`, `sdlc-pm-risk-issue` and the analyst's decision log (`sdlc-ba-requirements`); actions go to the tracker via `sdlc-pm-sprint`; reporting rhythm is used by `sdlc-pm-progress`.
