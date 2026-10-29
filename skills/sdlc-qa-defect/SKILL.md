---
name: sdlc-qa-defect
description: Report and triage defects professionally — confirm and minimize reproduction, separate product defects from test, data and environment problems, write a complete defect report, assign severity and priority with explicit rules, classify the root-cause area, and analyze a defect list into metrics, a module heat map, release blockers and an exit-criteria comparison. Use when a test fails, when a tester or user reports a bug, or when a defect list must be analyzed before a release decision.
stage: 5-verify
role: qa
icon: 🪲
mode: plan
prefer: defect-triage, bug-report, defect-analysis
---

# Defects — report, triage, analyze

A defect report is a reproducible claim backed by evidence. A defect analysis is the input to a release decision. Both must be honest: no inflated severity, no "0 bugs" when the data is simply missing.

## When to use

- A manual or automated test fails (after `sdlc-qa-automation` triage marks it a product defect).
- Someone reports unexpected behavior.
- A defect list (tracker export, spreadsheet, table) must be analyzed for `sdlc-qa-test-report` or a go/no-go meeting.

## When not to use

- Finding and fixing the root cause in code — `sdlc-debug` (this skill hands over a clean reproduction).
- Production incidents in progress — `sdlc-incident` first; file the defect afterwards.

## Part A — Single defect

1. **Confirm it is a product defect.** Re-run once on a clean state. Rule out: wrong test expectation (check the requirement — if the requirement is unclear it is a **requirement defect/question**, not a code bug), bad test data, environment outage or misconfiguration, outdated build, script defect.
2. **Minimize the reproduction.** Fewest steps, simplest data, one variable at a time. Find the boundary (works at 100.00, fails at 100.01). Check other platforms/browsers/roles to scope it. Note the reproduction rate (e.g. 3/3, 2/10).
3. **Collect evidence** with sensitive data masked: screenshot/video, request/response excerpt, log lines with correlation id and timestamp (UTC), build/version, environment, device/OS/browser, account role (never the password), test case ID.
4. **Write the report** (template below). Title = what is wrong + where + condition ("Transfer succeeds without second-factor confirmation when amount equals the threshold").
5. **Severity — impact on the system/user:**

   | Severity | Definition | Examples |
   |----------|------------|----------|
   | Critical | Core function unusable, data loss or corruption, money wrong or duplicated, security or privacy breach, legal/compliance breach, no workaround | Double debit; authorization bypass; personal data exposed; crash on launch |
   | High | Major function broken or wrong result, workaround exists but is unacceptable for users; severe UX breakage in a main flow | Status stuck "pending"; wrong fee shown; cannot submit on one supported browser |
   | Medium | Secondary function broken, or main function with acceptable workaround; incorrect but non-damaging display | Wrong date format in history; filter ignores one option |
   | Low | Cosmetic, wording, minor layout; no functional effect | Misaligned icon; typo |

   Auto-escalate to Critical anything touching money amounts/balances/duplicates, authentication or authorization, sensitive-data exposure, audit/compliance records, or inconsistency between the user-facing state and the system of record.
6. **Priority — urgency of fixing**, set with the owner: P1 fix before release / immediately, P2 this iteration, P3 planned, P4 backlog. Severity and priority differ (a Low-severity typo on the legal consent screen can be P1).
7. **Root-cause area (initial classification, refined by the fixer):** requirement (missing/ambiguous/contradictory), design, code logic, integration/contract, data/migration, configuration/environment, third-party, test (expectation wrong — close as not-a-bug and fix the test), usability. Root cause is confirmed by `sdlc-debug`, not guessed.
8. **Link** to test case IDs, requirement IDs, related defects (duplicates checked by searching the tracker by component and symptom first).

## Part B — Defect list analysis

1. **Normalize** columns: ID, title, severity, priority, status (New/Open/In progress/Fixed/Ready for retest/Verified/Closed/Reopened/Deferred/Won't fix/Duplicate/Not a bug), module, linked case, found-in build, fixed-in build, root-cause area. Missing severity → classify from the description and mark "inferred, confirm"; impossible → `Unknown`.
2. **Metrics**: totals by severity × status; open vs fixed-not-verified vs verified/closed; reopen rate; defects per module; found-in-phase if available; age of open critical/high defects; defect density per requirement or per case executed if useful.
3. **Release blockers:**

   | Condition | Classification |
   |-----------|----------------|
   | Open/reopened Critical | Blocker |
   | Open High without accepted workaround | Blocker |
   | Open High with workaround | Conditional — owner must accept explicitly |
   | Fixed but not verified (any Critical/High) | Risk — needs retest evidence |
   | Won't fix / deferred without recorded stakeholder approval | Conditional — confirm approval |
   | Verified / closed | Not a blocker |

4. **Heat map**: module × severity; flag modules with ≥2 Critical or ≥4 High (or the project's rule) as high-risk → recommend extra regression there.
5. **Compare with exit criteria** from the final test plan (`sdlc-qa-test-plan`): target vs actual, pass/fail per criterion.
6. **Conclusion**: release risk High/Medium/Low and recommendation Hold / Conditional release (list conditions) / Clear to release. No defect data → state `Defect data: missing` and refuse a confident conclusion.

## Stop and ask

- You cannot reproduce and have no evidence — report as "observed once, not reproducible" with what was tried, or ask for more information; do not fabricate steps.
- Changing a severity set by someone else — propose with reasons; the owner decides.
- Filing into the tracker, commenting on tickets or notifying people — only with approval.

## Defect report template

```markdown
### <ID or DRAFT> — <title>
Severity: <Critical|High|Medium|Low> (reason) · Priority: <P1–P4 proposed> · Status: New
Environment: <env> · Build: <version> · Platform: <OS/device/browser> · Role: <role>
Test case: <TC-ID> · Requirement: <REQ/BR/AC> · Reproduction rate: <x/y>

Preconditions
1. …
Steps to reproduce
1. …
Expected result (with source): … [BR-03]
Actual result: …
Evidence: <screenshot/video/log excerpt paths; correlation id; timestamp UTC>
Scope: also on <platforms> · not on <platforms>
Root-cause area (initial): <area> · Workaround: <none | description>
Notes: masked data, related defects
```

## Analysis output template

```markdown
## Defect analysis — <feature / release> (<date>, source: <export>)
Data quality: N records · normalized n · unknown severity/status u
| Severity | Open | Fixed (not verified) | Verified/Closed | Total |
Release blockers | Conditional items | Module heat map | Exit criteria comparison
Release risk: <level> · Recommendation: <Hold | Conditional | Clear> · Limitations: …
```

## Hand-off

- Reproduced code defect → `sdlc-debug` (root cause, regression test) → retest by QA, linked to the case.
- Analysis → `sdlc-qa-test-report`.
- Requirement defects → analyst via the questions list of `sdlc-qa-requirement-analysis`.
