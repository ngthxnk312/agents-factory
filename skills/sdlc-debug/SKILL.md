---
name: sdlc-debug
description: Find the root cause of a bug, failing test or wrong behavior systematically — orient on environment and version, reproduce, localize, form and test one hypothesis at a time — then fix the cause with a regression test and defense in depth for severe defects. Use for errors, failing tests, wrong results, flaky behavior and performance regressions; for live production impact start with sdlc-incident.
stage: 4-build
role: dev
icon: 🐞
mode: acceptEdits
prefer: systematic-debugging, debugging-strategies
---

# Debug

Find the cause before changing code. A fix without a proven root cause is a guess, and guesses ship new bugs.

## When to use

- An error, exception, failing or flaky test, wrong output, data inconsistency, or performance regression.
- A bug ticket after `sdlc-intake`.

## When not to use

- Users are actively impacted in production and mitigation is needed now — `sdlc-incident` first (mitigate, then debug).
- New behavior is being requested rather than broken behavior fixed — `sdlc-intake`.

## Phase 0 — Orient

1. **Which environment and version?** Local, CI, staging or production; build/commit/tag; configuration differences; data differences.
2. **Where to reproduce?** Locally first. If the bug needs production-like data, reproduce in staging with scrubbed data. **Never experiment on production.** Production access is read-only (logs, metrics, `SELECT` queries) — see `sdlc-incident` for data rules.
3. **Which code?** `git fetch`; is the faulty code on the branch you would fix? If the bug lives in code not yet on the integration branch, say so and ask where the fix should go.
4. **Read the evidence**: full error message and stack trace, logs around the time (search by correlation id), recent deployments and commits touching the area (`git log -p -- <path>`), related tickets, known pitfalls in the System Context anti-patterns.

## Phase 1 — Reproduce

- Build a reliable reproduction: a failing test (preferred), a command, a request, or exact UI steps with data.
- If you cannot reproduce, list what evidence is missing and how to get it (more logging in staging, a data sample, exact version). Do not proceed to a fix on speculation for anything involving money, permissions or data integrity.
- For flaky failures: run repeatedly, vary ordering/timing/time zone/locale, look for shared state, real clock, network, randomness, concurrency.

## Phase 2 — Localize

- Trace the code path end to end for the failing input.
- Narrow down by bisection: inputs (minimize the failing case), code (comment out/feature-flag halves locally), history (`git bisect` between a known good and bad commit).
- Compare working vs failing cases: environment variables, configuration, data shape, time zone, permissions, versions of dependencies.
- Typical root-cause families to check: null/absent values, off-by-one and boundaries, time zones and DST, floating-point money, encoding/locale, caching (including stale build/asset caches), concurrency and transaction isolation, missing registration (a file/route/permission/module not loaded), configuration drift between environments, permission inheritance chains, partial failure of remote calls.

## Phase 3 — Hypothesize and prove

- State one hypothesis at a time: "X happens because Y, so if I change Z, the failure disappears / changes in this way."
- Prove it with evidence (a log line, a debugger observation, a targeted test, a query result). Rule out at least one plausible alternative.
- If the hypothesis fails, discard it explicitly and form the next. Keep a short log of hypotheses tried.

## Phase 4 — Fix

1. **Write the regression test first** — it fails for the right reason before the fix.
2. **Fix at the root cause**, minimally, in the correct layer.
3. **Defense in depth for severe defects** (wrong money amounts, data loss or corruption, data exposure, authorization bypass): fix at **two or more layers**, e.g. boundary validation plus a database constraint, or a service check plus a query-level ownership filter.
4. **Search for the same pattern elsewhere** (same anti-pattern, same copy-pasted code) and list or fix occurrences within scope.
5. **Data repair**: if bad data was written, do not fix it ad hoc. Write a reviewed, idempotent correction script or migration and hand execution to a human (`sdlc-incident`, `sdlc-db-migration`).
6. **Verify**: the regression test passes, the original reproduction no longer fails, related tests pass, and the app starts and the path works. Then run `sdlc-quality-gate` before declaring the fix ready.

## Forbidden

- Swallowing the exception, adding a null check or a retry that hides the symptom without understanding the cause.
- Deleting, skipping or weakening a failing test to get green.
- Declaring "fixed" without reproducing the original failure and verifying it is gone.
- Changing production data or configuration to "try something".

## Stop conditions

- Cannot reproduce and evidence is insufficient — report findings and what is needed.
- The fix requires a contract change, data repair, or a change in another team's component — present options and ask.
- The root cause is a security vulnerability — report it to the human privately; do not describe exploit details in public tickets or commits.

## Output template

```markdown
## Debug report — <ticket / symptom>

**Environment / version:** … · **Reproduced:** yes (how) / no (what is missing)

### Symptom
### Evidence
- logs / traces / queries (sensitive data masked)
### Hypotheses tried
| # | Hypothesis | Test | Result |
|---|------------|------|--------|
### Root cause
<one paragraph with file:line references>
### Fix
<what changed, which layers; defense in depth if severe>
### Regression test
`path::test_name` — fails before, passes after
### Same pattern elsewhere
### Data repair needed
none / <script path, awaiting human execution>
### Verification
<commands and results; anything unverified>
```
