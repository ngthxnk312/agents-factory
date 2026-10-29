# Architecture and layering

Target architecture, not a description of any legacy system. Apply to new code; refactor legacy only when asked.

## 1. Mandatory layering

```
Entry point  →  (Use-case / orchestration)  →  Domain / service  →  Data access  →  Storage / remote
```

| Layer | Responsibility | Must not |
|-------|----------------|----------|
| Entry point (HTTP controller, RPC handler, message consumer, CLI command, scheduled job, UI route/screen) | Parse and validate input, call one use case, map the result to a response | Contain business rules; touch storage directly |
| Use-case / orchestration (optional) | Coordinate several domain services for one user-visible operation | Hold reusable domain logic; access storage directly |
| Domain / service | Business rules, invariants, transaction boundaries | Know about HTTP, UI widgets or transport formats |
| Data access (repository, gateway, DAO, API client) | Read/write storage or remote systems | Contain business decisions |

**Iron rule:** no layer skips the one below it. An entry point never calls a repository; an orchestrator never opens a database connection.

### The same idea in other kinds of code

- **Frontend / mobile:** view components render and emit events; state containers/view-models hold UI state and call services; services/API clients talk to the network. Components do not call `fetch`/HTTP clients directly, and business rules (pricing, eligibility, permissions) are not computed only in the UI — the server re-validates.
- **Data pipelines:** extract → validate/clean → transform (pure, testable functions) → load. Transformations do not perform I/O; I/O steps do not embed business rules.
- **Infrastructure as code:** reusable modules hold the resource logic; environment stacks only compose modules with parameters.

## 2. Domain boundaries

- A service in domain A does not inject the repository of domain B. It calls domain B's service (in-process) or its internal API (cross-process). Each domain owns its data.
- Shared reference data (error dictionaries, global configuration, feature flags) is read through the component that owns it, not by reading its tables.
- Check the dependency graph before changing a widely depended-on module (a core "users"/"accounts"/"HR" module, a shared UI kit, a base library). Changes there fan out; list the dependants in the design.

## 3. External calls

- Wrap every third-party or cross-service integration (payments, email, chat, AI APIs, partner systems) behind a dedicated adapter/connector. Do not scatter raw HTTP calls across services.
- Every remote call has an explicit **timeout**, bounded **retries with backoff** only for idempotent operations, and a **circuit breaker** or equivalent when failure can cascade.
- Design for failure: timeouts, partial failure, duplicates, out-of-order delivery. For money or state-changing operations an unknown outcome is a distinct state (`PENDING`/`UNKNOWN`), not success or failure.
- **Close the database transaction and release the connection before calling a remote system.** Holding a connection while waiting on the network exhausts pools and causes deadlocks.
- Outbound side effects (email, chat, webhooks, tickets) must not roll back or break the core business operation when they fail: record the intent and deliver asynchronously or retry later.
- Configuration for integrations (URLs, tokens, webhook endpoints, thresholds) comes from configuration or secrets, never literals.

## 4. Scheduled and background jobs

- Jobs are **idempotent**: running twice must not duplicate data or side effects.
- Scope every job explicitly (tenant/company/account) and log start, end, counts and failures.
- Time zones: schedulers often run in UTC. Convert explicitly when comparing to local business dates or cut-off times; add a test around midnight and DST boundaries.
- If a job's behavior is defined in two places (code plus a schedule/registration file), change both together.
- Jobs must be safe in non-production: staging should run with outbound delivery disabled or redirected.

## 5. Concurrency and state

- Shared components (singletons, module-level objects, service instances in a DI container) must be thread-safe. Do not keep mutable request state in instance fields; pass it through parameters or local variables.
- Prefer immutable data for DTOs and value objects. Share mutable state across threads only through well-understood concurrent structures.
- Guard read-modify-write sequences on shared rows with optimistic locking, conditional updates or explicit locks — choose deliberately and document it.

## 6. Data shapes across boundaries

- Separate transport shapes (request/response DTOs, view models) from persistence entities. Never return ORM entities from an API: it leaks schema, enables mass assignment and triggers lazy loading outside transactions.
- Map explicitly at the boundary; keep mapping code close to the entry point.

## 7. Project structure

- Keep a consistent, predictable layout per service/package (for example `api/`, `application/`, `domain/`, `infrastructure/`, `config/`). Follow what the repository already does.
- Register new components wherever the framework requires it (module manifests, DI registration, route tables, migration indexes, access-control lists, asset bundles). A file that is not registered silently does nothing — check after adding one.
- No wildcard imports, no dead code, no experiment files left behind.
- Shared base configuration is inherited, not copy-pasted.

## 8. When to go further (hexagonal / clean architecture)

Plain layering is enough for most services. Consider ports and adapters when the domain is rich and must be isolated from frameworks:

- `domain` (pure model and rules, no framework annotations) · `application` (use cases, port interfaces) · `infrastructure` (adapters for persistence, web, messaging).
- Benefit: domain tests need no framework context; storage or broker can change without touching the core.
- Use it for new services with rich domains. Do not big-bang refactor existing code into it.

## Checklist

- [ ] Entry points are thin; no business logic, no direct storage access.
- [ ] No layer skipping; no cross-domain repository access.
- [ ] Remote calls have timeout, bounded retry (idempotent only) and failure handling; transaction closed before the call.
- [ ] Outbound side effects cannot break the core operation.
- [ ] Jobs are idempotent, scoped, logged and time-zone correct.
- [ ] Shared components hold no mutable request state.
- [ ] DTOs separated from entities; nothing persistent leaks through the API.
- [ ] New files registered wherever the framework requires.
