---
name: sdlc-be-implement
description: Implement a backend feature end to end the way a senior backend engineer would — strict layering (entry point → application/use case → domain → persistence and adapters), DTOs separated from entities, validation at the boundary, deliberate transaction scope with no remote calls inside, explicit concurrency control and idempotency, RFC 9457 error mapping, object-level authorization inside queries, typed configuration and feature flags, correlated logging, a test-first loop with real-engine integration tests, and an honest verification report. Use when building or changing server-side behavior in any backend stack (Java/Kotlin, Node/TypeScript, Python, Go, .NET, Ruby, PHP and similar).
stage: 4-build
role: be
icon: 🧱
mode: acceptEdits
prefer: backend-implement, backend-development, backend-feature
---

# Backend implementation

Apply `sdlc-implement` (test-first loop, no scope creep, no secrets, honest verification) and `sdlc-standards` (golden rules, definition of done). This skill adds what server-side code must get right: data integrity under concurrency and retries, transaction boundaries, authorization on every object, and failure behavior that an on-call engineer can understand. The project's framework, conventions and lint rules override the examples here; examples are illustrative across stacks.

## When to use

- A planned backend change (`sdlc-breakdown` task or a clear ticket) that adds or changes use cases, domain rules, persistence or service-to-service behavior.
- Any feature spanning several layers of a service; for a single API operation use `sdlc-be-endpoint`, which follows the same rules with an endpoint-specific checklist.

## When not to use

- The API contract is not agreed — `sdlc-api-design` first. The schema change is not planned — `sdlc-db-migration` first.
- An integration with an external or separately owned system is not designed — `sdlc-sa-integration` first.
- The cause of a bug is unknown — `sdlc-debug`. Live production impact — `sdlc-incident`.
- Web or mobile clients — `sdlc-fe-implement`, `sdlc-mobile-implement`.

## Before writing code

1. **Read the project rules** (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, linters, project skills, ADRs, the System Context delta, the design for this ticket).
2. **Record the stack facts** you will rely on; do not assume them: framework and DI mechanism; how transactions are declared (annotation/decorator, unit of work, explicit begin/commit); ORM or query library; migration tool; validation library; central error handler; where the authenticated principal and tenant come from; configuration and feature-flag mechanism; logger and correlation-id propagation; test runner, test containers or emulators; the real build/test/run commands (README, build files, CI config).
3. **Find the closest existing feature** (same kind of use case, same aggregate) and mirror its package layout, naming, error codes, logging and test style.
4. **Route the parts** of the change: API operations → `sdlc-be-endpoint`; non-trivial queries, locking, caching → `sdlc-be-data-access`; queues, events, schedulers → `sdlc-be-async-jobs`; new metrics, health, alerts → `sdlc-be-observability`.
5. **Plan in dependency order** and load it into your todo tool: contract/DTOs → domain model and rules → migration + repository → use case/service (transaction, authorization) → entry point → error codes and mapping → configuration/flag → logs/metrics → framework registration → tests at each step.

## Layering rules

| Layer | Owns | Must not |
|-------|------|----------|
| Entry point (HTTP/RPC handler, message consumer, job trigger, CLI) | Parse, syntactic validation, resolve principal, call **one** use case, map result/error to the transport | Business rules, transactions, repository calls |
| Application / use case | Orchestration of one user-visible operation, transaction boundary, function-level and object-level authorization, idempotency | Transport types (request objects, headers), SQL |
| Domain | Entities/value objects, invariants, state transitions, domain errors with stable codes | Framework, I/O, clock or random calls that are not injected |
| Persistence and adapters | Repositories (parameterized, scoped, bounded queries); clients for other services with timeouts | Business decisions, swallowing errors |

- Dependencies point inward. No layer skips the one below it; domain A never uses domain B's repository — call B's service or API.
- **Three shapes, mapped explicitly**: request/response DTOs (transport), domain objects (rules), persistence entities (storage). Never return entities from an API (schema leak, mass assignment, lazy loading after the transaction closed). Response DTOs contain only fields the caller is entitled to see.
- Shared components (singletons, DI-managed services, module-level objects) hold **no mutable request state**.
- Inject the clock, id generator and random source so time- and id-dependent logic is testable.

## Validation (three layers, each with a job)

1. **Boundary (syntactic)**: type, required, length (matching storage), format (RFC 3339, ISO 4217, E.164, UUID), numeric range and scale, enum allowlists, collection and body size limits. Reject unknown fields if the project does. Normalize deliberately (trim, case, Unicode normalization) and only where the contract says so.
2. **Domain (semantic)**: invariants and state rules ("cannot cancel a shipped order", "amount within the account's limit") enforced in the domain/use case, never only in the client or the handler.
3. **Database**: NOT NULL, UNIQUE, FOREIGN KEY, CHECK constraints as the last line of defense; translate constraint violations into domain errors (for example a unique violation → `409 DUPLICATE_…`).

## Transactions

- One use case = one transaction, owned by the application layer. Read-only operations use read-only transactions where supported.
- **Never hold a transaction or connection across a remote call** (HTTP, gRPC, cache, broker, email). Shape the use case as: load and validate → open transaction, write state and an outbox record → commit → perform or dispatch the remote effect. Use the outbox (`sdlc-be-async-jobs`) when the remote effect must not be lost.
- Keep transactions short: no user think-time, no large in-memory processing, no unbounded loops inside.
- Know your framework's traps and check them for the code you write: proxy/decorator-based transactions do not apply to calls within the same object; some frameworks roll back only on unchecked/unhandled errors; nested or "requires new" propagation commits independently; lazy relations fail or trigger extra queries after the transaction ends.
- Do not mix two persistence mechanisms on separate connections inside one logical transaction.

## Concurrency and idempotency

Every read-modify-write on shared data needs a deliberate choice:

| Situation | Choose | Behavior on conflict |
|-----------|--------|----------------------|
| Counter/balance/quantity change | Atomic conditional update (`… SET qty = qty - :n WHERE id = :id AND qty >= :n`), check affected rows | Domain error (`INSUFFICIENT_STOCK`) |
| User edits a record that others may edit | Optimistic version column or ETag/`If-Match` | `409 CONFLICT` with current version |
| Short critical section on a few rows, high contention | Pessimistic row lock with a lock timeout and a consistent lock order | Retry bounded, then error |
| State machine transition | Guarded update `WHERE id = :id AND status = :expected` | Idempotent no-op if already in target state, otherwise `409 INVALID_STATE` |
| Uniqueness ("one active subscription") | Database unique constraint (partial/filtered if needed) | Map violation to `409` |

- **Idempotency for retried writes** (client retries, at-least-once consumers, job reruns): accept an idempotency key (header or envelope request id); store key + request fingerprint + outcome under a unique constraint in the same transaction as the effect; same key and same payload → return the stored outcome; same key and different payload → `409`; a key still in progress → `409` or retry-later as the contract says. Natural keys work when the domain has them.
- Deadlocks and serialization failures are retried as a **whole transaction**, bounded, with backoff — never by re-running half a use case.

## Authorization

- Authentication is central (gateway, middleware, filter). The use case still checks the **function permission** (role/scope, deny by default) and the **object permission** for every id it touches — including ids nested in bodies, bulk lists, exports and filters.
- Enforce ownership/tenant **in the query** (`WHERE id = :id AND tenant_id = :tenant AND owner_id = :me`) rather than load-then-check; list queries are scoped the same way.
- The principal and tenant come only from the verified security context — never from the body, path, query string or an unverified header/claim.
- Objects outside the caller's scope return 404, not 403. Privileged/system operations run with the narrowest elevation and are audited.

## Errors and external calls

- Domain errors carry stable codes from the error dictionary; the central handler maps them to RFC 9457 Problem Details with `code` and `traceId`. Unexpected errors are wrapped into a generic internal error and logged once at ERROR with the stack trace. No empty catch, no catch-and-continue in state-changing paths.
- Remote calls go through an adapter with connect/read timeouts inside the use case's time budget, bounded retries with backoff and jitter **only** for idempotent operations, a circuit breaker where failure can cascade, and partner error codes mapped inside the adapter. A timeout after sending a state-changing request is an **unknown outcome**: record `PENDING`, resolve by status query or reconciliation — never assume success or failure.
- Outbound side effects (email, chat, webhooks) never roll back or fail the core operation; record intent and deliver asynchronously.

## Configuration, flags and logging

- Configuration is typed and validated at start-up (fail fast on missing or invalid values); secrets come from environment or the secret store by name only. New settings get safe defaults and are listed for `sdlc-deploy`.
- Feature flags: default to the safe state (usually off), name the owner and removal ticket, test both states, and never let a flag bypass authorization or validation.
- Log business milestones at INFO with the operation name, correlation id and non-sensitive ids; client errors at WARN; failures once at ERROR. Propagate the correlation id to outbound calls, messages and async work. Never log credentials, tokens or personal data; mask what must appear (`sdlc-standards` logging reference). Add metrics for new behavior with `sdlc-be-observability`.
- Money uses exact decimals with currency; instants are UTC; business dates are dates.

## The test-first loop (per step)

Follow `sdlc-test`. Minimum backend test set for a feature:

| Level | What it proves |
|-------|----------------|
| Domain unit tests (no framework) | Invariants, state transitions, calculations, boundary values |
| Use-case tests with fakes for adapters | Orchestration, authorization decisions, idempotency, error mapping, outbox records written |
| Repository integration tests against the real engine (container/emulator, not a different in-memory database) | Queries, constraints, scoping, pagination, migrations apply |
| API/slice tests | Status codes, Problem Details body, headers, validation messages |
| Negative authorization | User A cannot read or modify user B's object; missing role is rejected |
| Concurrency | Two parallel updates: one wins, the other gets the defined conflict; no lost update |
| Retry | Same idempotency key twice → one effect, same response |

No real outbound calls: stub partners at the adapter or HTTP boundary.

## Verification before reporting

Build → format/lint/static analysis/type check → unit → integration (real engine) → apply migrations on a disposable local database → start the service → smoke the changed path with sample requests including one validation error, one authorization failure and one not-found → read the logs: correlation id present, no sensitive values, no unexpected warnings. Say exactly what could not be run. For the full pre-merge check run `sdlc-quality-gate`.

## Stop conditions

- The design does not say how a concurrency, idempotency or unknown-outcome case must behave — ask; do not invent business semantics.
- The change needs a schema change, a new external dependency, a new message type or a contract change that is not in the plan — stop and route to the owning skill.
- Making it work would require holding a transaction across a remote call, bypassing authorization, or disabling a test — stop and propose an alternative.
- You need credentials, a broker or a database you do not have — ask; do not fake verification.

## Output template

```markdown
## Backend implementation — <ticket>
### Changes by layer
| Layer | File | Change | Why |
### Decisions
Transaction scope: … · Concurrency control: … · Idempotency: <key, storage, replay behavior> · Authorization: <function rule; object rule in query> · Unknown outcome: … · Flags/config: <key, default>
### Error codes added/used
| Code | HTTP | When |
### Tests
| Level | File | Behaviors proven |
### Verification
| Step | Command | Result |
Smoke: <requests and statuses> · Logs checked: correlation id ✔ · sensitive data ✔
Not verified: <items and reason, or "none">
### Follow-ups
Nothing was committed or pushed.
```

## Hand-off

`sdlc-review` (plus `sdlc-be-security` for security-sensitive changes) → `sdlc-quality-gate` → `sdlc-release` → `sdlc-deploy` with the configuration, flag and migration notes from the report → `sdlc-docs` and `sdlc-system-context` delta.
