---
name: sdlc-test
description: Drive code with tests — the red/green/refactor TDD loop — and design test cases systematically from acceptance criteria and code (equivalence classes, boundaries, decision tables, state transitions, authorization and failure paths), automate them deterministically without real outbound effects, run them and report results and gaps. Use while implementing, when fixing a bug, when hardening a module, or when preparing QA.
stage: 5-verify
role: qa
icon: 🧪
mode: acceptEdits
prefer: test-driven-development, tdd, testing
---

# Test (TDD and test design)

Tests are executable acceptance criteria. Write them first when building, and design them deliberately rather than by habit.

## When to use

- Every implementation task (`sdlc-implement`) and every bug fix (`sdlc-debug`).
- Hardening an under-tested module before changing it.
- Producing a test plan or manual test script for QA or acceptance.

## When not to use

- Exploratory spikes whose code will be thrown away (say so explicitly).

## The TDD loop

1. **Red** — write one small test for the next behavior. Run it; confirm it fails **for the expected reason** (assertion failure, not a compile error or wrong setup).
2. **Green** — write the minimum production code that makes it pass. Run the test and its neighbors.
3. **Refactor** — clean up production and test code while everything stays green.
4. Repeat. Commit points (only if the human asked you to commit) fall after green or refactor, never on red.

For bugs: the first test reproduces the bug and must fail before the fix.

## Test design

Start from the acceptance criteria, then the code's branches. For each behavior, select cases with these techniques:

| Technique | Use it for | Example |
|-----------|------------|---------|
| Equivalence partitioning | Inputs with classes that behave the same | valid / invalid / empty email |
| Boundary values | Ranges and limits | 0, 1, max, max+1; length 255/256; midnight; month end; DST change |
| Decision tables | Combinations of conditions | role × status × amount threshold |
| State transitions | Workflows and lifecycles | draft → submitted → approved; invalid transitions rejected |
| Error guessing | Known failure families | nulls, duplicates, unicode, time zones, rounding, concurrency |
| Pairwise | Many configuration options | browser × locale × role |

Minimum set per feature:

- happy path for each acceptance criterion;
- validation failures (each rule);
- business-rule failures;
- boundaries;
- **authorization**: unauthenticated rejected; missing permission rejected; **user A cannot read or modify user B's object** (expect not found);
- each external dependency failing (timeout, error response, duplicate/out-of-order delivery);
- idempotency of retried operations and re-run jobs;
- concurrency where two actors can touch the same record.

## Choosing the level

- **Unit** — pure logic, calculations, validation, state machines. Fast; most tests live here.
- **Integration** — repositories against a real database engine (containers preferred over in-memory substitutes with different behavior), HTTP layer with serialization and error mapping, message handling.
- **Contract** — consumer/provider schemas for APIs used by other teams.
- **End-to-end / UI** — a few critical journeys; stable selectors; explicit waits on conditions, never fixed sleeps. Capture screenshots per state when verifying prototype fidelity (`sdlc-prototype`).
- **Manual** — only for what cannot reasonably be automated; write exact steps.

## Rules for test code

- Use the project's framework, fixtures, factories, naming and folder layout. Find an existing test for a similar component and mirror it.
- **Deterministic**: control clock, random seeds, locale, time zone; no dependency on test order or shared mutable state.
- **No real outbound effects**: tests never send real email, chat, SMS, webhooks, payments or tracker updates. Use fakes at the adapter boundary, a test base that fails closed on unexpected network calls, and test-mode flags.
- No real secrets in tests or fixtures; use obviously fake values.
- Synthetic data only — never copy production personal data into fixtures.
- Assert outcomes and side effects, not implementation details; one reason to fail per test where practical; descriptive names (`rejects_transfer_when_balance_insufficient`).
- Do not change production code just to make a test pass unless you found a real bug — then say so explicitly.
- Never delete, skip or loosen an existing test to get green without the human's agreement and a stated reason.
- Flaky test found: fix the cause or quarantine it with a ticket; do not add blind retries.

## Running and reporting

- Find the real test command (README, package scripts, Makefile, build files, CI config). If the repository has no automated tests, say so; propose the smallest harness rather than inventing a command.
- Run the narrowest relevant subset while iterating, then the affected module's full suite.
- Report the exact command and the result, plus coverage on changed code if the project measures it (default target ~70–80% on business logic; higher for money/security code; coverage is a floor, not the goal).

## Stop conditions

- Expected behavior for a case is ambiguous — ask; do not encode a guess as a test.
- A needed dependency (database, container runtime, emulator) is unavailable — report what could not run and what would be needed.

## Output template

```markdown
## Test report — <scope>

### Test cases
| ID | Level | Scenario | Precondition / input | Expected | Status |
|----|-------|----------|----------------------|----------|--------|
| T1 | unit | … | … | … | pass |
| T7 | integration | user A reads user B's order | … | 404 | pass |

### Commands and results
`<command>` → <N passed, M failed, coverage X% on changed files>

### Manual checks (if any)
1. …

### Gaps and risks
- <untested area and why>

### Bugs found
- <description, reproduction, severity>
```
