# Testing, verification and quality gates

Commands differ by stack; the obligation to verify does not.

## 1. Verify before claiming "done"

Never report completion until all three pass for the affected scope:

1. **Build/compile** — clean, no new serious warnings. Interpreted languages: import/compile check, type check.
2. **Tests** — the relevant unit and integration tests pass.
3. **It actually starts and works** — the service/app/job starts without errors and a smoke check of the changed path succeeds (health endpoint, a real request, opening the screen, running the job on sample data).

If a step cannot be run in this environment, say so explicitly and list exactly what remains unverified. Never invent a command the project does not have; find the real one in the README, package scripts, Makefile, CI config or build files. If the repository has no automated tests, say so and propose the smallest useful harness instead of pretending.

## 2. Test strategy

- **Unit tests** — pure domain logic without framework context or I/O; fast and numerous. Mock or fake only at architectural boundaries (repositories, remote clients, clock, random).
- **Integration tests** — real I/O paths: the database (prefer a real engine in a container over an in-memory substitute whose behavior differs), HTTP layer, message broker, file system.
- **Contract tests** — for APIs consumed by other teams or services.
- **End-to-end / UI tests** — few, on critical user journeys; stable selectors; no sleeps.
- **TDD** (red → green → refactor) for core business logic and every bug fix (see `sdlc-test`).

Minimum cases for a feature:

- happy path;
- validation failures;
- business-rule failures;
- boundaries (empty, null, max length, zero, negative, very large, time-zone and date boundaries);
- **authorization**: user A cannot read or modify user B's object; a user without the permission is rejected;
- failure of each external dependency (timeout, error, duplicate).

## 3. Determinism and safety

- Tests control time, randomness, locale and time zone.
- **Tests never perform real outbound side effects** (email, chat, SMS, webhooks, payment, ticket creation). Protect in layers: test base classes that fail closed on outbound calls, fake adapters, a test-mode flag, and network blocking where available.
- Tests do not depend on execution order or on shared mutable fixtures.
- Flaky tests are fixed or quarantined with a ticket — never retried until green and forgotten.

## 4. Coverage

- Use the project's threshold. Without one, aim for ~70–80% line/branch coverage on new and changed business logic, and higher (~85%+) for financial, security-critical or regulated code.
- Coverage is a floor, not a goal: a test that executes code without asserting behavior is worthless. Prefer meaningful assertions on outcomes and side effects.

## 5. Quality gate (summary — full procedure in `sdlc-quality-gate`)

Ordered and incremental (affected modules only); steps that do not apply are `N/A` with a reason.

| # | Step | Class |
|---|------|-------|
| 1 | Build / compile | Blocking |
| 2 | Format, lint, type check | Blocking (errors) |
| 3 | Unit tests + coverage | Blocking |
| 4 | Integration / contract tests | Blocking |
| 5 | Start-up + smoke test | Blocking |
| 6 | Security checks (secrets, injection, sensitive logging, authz, dependency vulnerabilities) | Blocking for critical, warning otherwise |
| 7 | Deployment artifact validation (migrations, manifests, IaC, container build) | Warning / N/A |
| 8 | Performance regression vs baseline | Warning / N/A |
| 9 | Independent review verdict | Blocking on blocker findings |
| 10 | Docs, contract and changelog updated | Warning |

- A failed blocking step means: do not merge, do not report done.
- A failed warning step needs a tracked follow-up accepted by the owner — never a silent skip.
- "Never skip the gate" means always run it, not that every step blocks.

## 6. Static analysis in CI

- Formatter check, linter, type checker, and a bug/smell finder appropriate to the language.
- Dependency vulnerability scan and secret scanning.
- Optionally a quality platform gate that blocks merge on new critical issues or coverage drops.

## 7. No symptom fixes

Bugs are fixed at the root cause with a regression test (see `sdlc-debug`). Adding a try/catch or null check "to be safe" without understanding the cause is not a fix.

## Checklist before "done"

- [ ] Build, tests, start-up and smoke check pass for the affected scope (or unverified items are listed).
- [ ] New logic has unit tests; I/O paths have integration tests; authorization has negative tests.
- [ ] No real outbound side effects from tests.
- [ ] Quality gate run; blocking steps pass; warnings have accepted follow-ups.
- [ ] Bug fixes have a root cause and a regression test.
