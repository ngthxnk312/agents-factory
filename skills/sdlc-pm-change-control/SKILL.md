---
name: sdlc-pm-change-control
description: Control changes to an approved baseline through change requests — log, classify, assess impact on schedule, cost, quality, risk and contract, propose options (approve, reject, defer, approve with a trade-off), route to the right decision authority, and on approval update the baseline and notify — while stopping scope creep. Use when a stakeholder asks for something new or different after scope was agreed, when unplanned work appears, or when someone asks "can we also add…".
stage: 4-build
role: pm
icon: 🔁
mode: plan
prefer: change-request, change-control, scope-change-management
---

# Change control

Change is normal; **unmanaged** change is how projects fail quietly. Your job is not to say no — it is to make the cost of every change visible and have the right person decide before work starts. No work begins on a change until a decision is recorded.

## When to use

- A stakeholder asks for new or different scope after the baseline was approved.
- Work is happening that is not in the baseline (scope creep detected in the board, a merge request or a meeting).
- A requirement change request from analysis (`CR-` from `sdlc-ba-requirements`) needs a schedule and cost decision.
- A fixed constraint changes (deadline, budget, team).

## When not to use

- Clarification of agreed scope (same intent, more detail) — record it in the requirements, no CR needed. If in doubt, ask the business owner whether intent changed.
- Defects against agreed acceptance criteria — they are defects (`sdlc-pm-quality`), not changes. Disagreement about what was agreed is resolved first by checking the baselined documents.
- Before any baseline exists — it is still planning (`sdlc-pm-project-plan`).

## Decision authority (set this in the plan; defaults if absent)

| Impact of the change | Decides |
|---|---|
| Fits within remaining buffer, no milestone or budget change | Project manager with product owner |
| Moves a milestone, uses contingency budget, or changes a deliverable | Sponsor |
| Changes contract value, contractual dates or legal/regulatory scope | Change board / contract owners on both sides |

## Procedure

1. **Log the request:** ID (`CR-<nn>`), requester, date, description in the requester's words, reason/business value, urgency, source (meeting minutes, email, ticket).
2. **Classify:** mandatory (legal, regulatory, security, defect in a baseline document) · improvement · scope extension · scope reduction · constraint change.
3. **Confirm it is a change** by comparing with the baselined scope, requirements and acceptance criteria. Quote the baseline text that it differs from.
4. **Assess impact** — collect inputs, do not invent them:
   - Requirements: affected IDs (BR/UC/US/screens) from the analyst (`sdlc-ba-requirements` change handling).
   - Technical: components, data, integrations, rework of finished work, regression scope from the architect/tech lead (`sdlc-sa-solution-design`, `sdlc-design`).
   - Schedule: added effort, effect on the critical path and each milestone (working days).
   - Cost: effort × rate, licences, infrastructure; effect on budget and payment milestones (`sdlc-pm-resource-budget`).
   - Quality and risk: new risks, regression exposure, testing effort, technical debt.
   - Contract and stakeholders: obligations, other teams affected.
   Give ranges where uncertain and state the confidence.
5. **Prepare options:** approve as requested · approve with a trade-off (de-scope something of similar size, move a date, add budget) · defer to a later phase/release · reject with a reason. Recommend one and explain why.
6. **Route the decision** to the authority in the table. Present the CR pack; the agent never decides on behalf of the authority.
7. **Record the decision** with decider, date, conditions and evidence (minutes, approval message).
8. **If approved:** produce the updated baseline as a new version (scope, WBS, schedule, budget, risks), update the requirements and traceability (`sdlc-ba-requirements`), adjust the sprint/backlog (`sdlc-pm-sprint`), and draft the notification to affected stakeholders. Writes and sends require approval.
9. **Track the CR state:** Proposed → Under assessment → Awaiting decision → Approved / Rejected / Deferred → Implemented → Closed.
10. **Guard against creep:** when you see work without a baseline item or approved CR, flag it in the status report and ask for a CR. Small "while we're at it" additions accumulate; batch them into a CR rather than letting them slide.

## Guardrails

- Never start, schedule or assign work for an undecided CR.
- Never change a baseline in place; a new version is created with a change log entry.
- Never commit to a client or stakeholder on cost or date — present the assessment; the authority commits.
- Assessments missing an input say so explicitly ("technical impact not yet assessed by <role>").

## Stop conditions

- Impact cannot be assessed because requirements or technical inputs are missing — request them and pause.
- The requester pressures for immediate start without a decision — escalate to the decision authority.
- The change touches contract, legal or regulatory obligations — route to the contract owners.

## Output templates

```markdown
## Change request CR-<nn> — <title>
Requester: … · Date: YYYY-MM-DD · Source: … · Class: <mandatory | improvement | extension | reduction | constraint>
Baseline reference: <document, version, section — quoted text>
Requested change: …  · Reason / value: …

### Impact assessment (confidence: high | medium | low)
| Dimension | Impact | Source of estimate |
|-----------|--------|--------------------|
| Requirements | BR-04, UC-07 changed; new SCR-12 | analyst |
| Technical | … | architect / tech lead |
| Schedule | +4 wd; M3 moves 2026-09-10 → 2026-09-16 | PM |
| Cost | +6 pd (≈ <amount>); payment milestone 3 unaffected | PM |
| Quality / risk | regression on <area>; new risk R-12 | QA / PM |
| Contract | … | contract owner |

### Options
| Option | Effect | Recommended |
|--------|--------|-------------|
Decision authority: <role> · Decision needed by: YYYY-MM-DD

### Decision
<approved | rejected | deferred | approved with conditions> — by <name>, YYYY-MM-DD — evidence: …
Baseline updated to v<n>: yes/no · Notified: …
```

```markdown
## Change log — <project>
| CR | Title | Class | Schedule | Cost | Decision | Decider | Date | Status |
```

## Hand-off

Approved CRs update `sdlc-pm-project-plan` (new baseline version), `sdlc-ba-requirements` (requirements and traceability), `sdlc-pm-sprint` (backlog) and appear in `sdlc-pm-progress`; new risks go to `sdlc-pm-risk-issue`.
