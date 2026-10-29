---
name: sdlc-be-endpoint
description: Add or modify one API operation safely against an agreed contract — contract file first, thin handler, request DTO validation, use-case logic with function- and object-level authorization, scoped and bounded repository query, every error case mapped to RFC 9457, pagination/filtering/sorting from allowlists, backward compatibility for existing consumers, contract update and a test matrix (unit, integration, API, contract, authorization negative, idempotency, pagination boundaries). Use when adding a REST endpoint, an RPC-dispatch operation, a gRPC method or a GraphQL field, or when changing the request, response, errors or authorization of an existing one.
stage: 4-build
role: be
icon: 🛣
mode: acceptEdits
prefer: add-endpoint, backend-endpoint, api-endpoint-implementation
---

# Add or change one API endpoint

`sdlc-api-design` decides the contract; this skill builds one operation against it, the same way every time, so nothing is forgotten — not the authorization of a nested id, not the 404 for someone else's object, not the old mobile client still sending the previous field. Apply `sdlc-be-implement` for layering, transactions, concurrency and idempotency, and `sdlc-standards` for the baseline. The project's conventions override the examples here.

## When to use

- New operation in any style: REST endpoint, RPC-dispatch operation (one URL, operation name in the body), gRPC method, GraphQL query/mutation field.
- Change to an existing operation: new field, new error, new filter, changed validation, changed authorization, pagination added.

## When not to use

- The contract is not written or not agreed — `sdlc-api-design` first; this skill does not invent request/response shapes.
- A whole feature spanning several operations, jobs and data changes — `sdlc-be-implement` (it calls back here per operation).
- Webhooks we receive from partners — design with `sdlc-sa-integration`, then implement here.

## Step 0 — Classify the change

| Class | Examples | Rule |
|-------|----------|------|
| New operation | new resource or action | Proceed |
| Additive | new optional request field, new response field, new optional filter, new error code for a new situation | Proceed; check strict-parsing consumers |
| Behavior change, same shape | different validation, different default, different sort order | Treat as potentially breaking; list affected consumers |
| Breaking | remove/rename field, change type or meaning, make optional field required, tighten validation on existing input, change status codes, remove enum value accepted from clients | **Stop** — needs a new version or operation and an approved deprecation plan (`sdlc-api-design`) |

## Step 1 — Contract first

1. Locate the contract: machine-readable file (OpenAPI, protobuf, GraphQL SDL) and/or the markdown API spec. If the style cannot be expressed in a machine-readable format (RPC-dispatch on a body field), the markdown spec is the primary contract.
2. Update the contract **before** the code: path/operation name, method, request and response fields (type, requirement level, constraints, format, example), every error case with status and code, auth scheme and scope, pagination, idempotency, rate limits.
3. If the project generates server stubs or types from the contract, regenerate and build on the generated types; never hand-edit generated files.
4. Find the closest existing operation and list every place a new operation must be touched: route/dispatch registration, handler, request/response DTOs, validator, use case, repository, mapper, error codes and dictionary entries, permission/scope registry, contract file, tests, docs. Missing a registration means the code silently does nothing.

## Step 2 — Request DTO and validation

- [ ] Dedicated request type; no binding onto entities; fields the caller must not set (`ownerId`, `role`, `status`, `price`, `tenantId`) are absent from the DTO.
- [ ] Required/optional per contract; lengths match storage limits; formats validated (RFC 3339, ISO 4217, E.164, UUID, email per project rule).
- [ ] Numbers: range, scale for decimals, no floating point for money; strings: maximum length, allowed characters where the domain needs it.
- [ ] Enums and sort/filter keys validated against allowlists; unknown-field policy follows the project (reject or ignore, consistently).
- [ ] Collections: maximum item count; nested objects validated recursively.
- [ ] Path and query parameters validated with the same rigor as the body; ids parsed to the right type (malformed id → 400 or 404 per convention, never 500).
- [ ] Cross-field rules (`from < to`, "either A or B") produce field-level error details.
- [ ] Body size limit and content type enforced by the platform or explicitly.

## Step 3 — Handler (thin)

- Resolve the principal and tenant from the verified security context; call exactly one use case; map the result.
- Status codes per RFC 9110: `200` read/update with body, `201` + `Location` for creation, `204` without body, `202` + status resource for accepted asynchronous work, `304` when conditional GET applies.
- Headers: `ETag` for resources with optimistic concurrency; `Cache-Control: no-store` for responses with personal or sensitive data; correlation id echoed if the project does so.
- No try/catch formatting in the handler — the central error handler produces Problem Details.

## Step 4 — Use case and query

- Function-level authorization (scope/role, deny by default) and **object-level authorization for every id** in path, query and body (including nested and bulk ids) — enforced in the query (`WHERE id = :id AND tenant_id = :t AND owner_id = :me`). Bulk operations check every element; decide and document all-or-nothing vs per-item results.
- Transaction scope, concurrency control and idempotency per `sdlc-be-implement`; state-changing `POST` operations that clients may retry accept an idempotency key.
- Repository query parameterized, scoped, bounded, selecting only needed columns; new query on a large table → check the plan and add the index through `sdlc-db-migration` (`sdlc-be-data-access`).
- Response mapped from domain objects to the response DTO with only fields the caller may see (no internal flags, no other users' data, no secrets).

## Step 5 — Collections: pagination, filtering, sorting

- Every collection is paginated. Decision: **cursor/keyset** for large or frequently changing data and infinite scroll; **offset** only for small, stable sets or when random page access is required.
- Enforce a maximum page size (clamp or reject — follow the existing convention consistently) and a default.
- Sorting is stable: always append a unique tie-breaker (usually the id) so pages do not overlap or skip rows.
- Cursors are opaque (encoded, and signed or validated so clients cannot tamper them into other tenants' data), bound to the same filter and sort they were issued for.
- Filters and sort keys map from an allowlist of public names to columns — never interpolate raw input into a query.
- Total counts are expensive on large tables; return them only if the contract requires, or provide `hasMore`.

## Step 6 — Errors

List every error case and make sure each has a code, a status, a test and a dictionary message:

| Case | Status | Typical code |
|------|--------|--------------|
| Validation failure (with field details) | 400 | `VALIDATION_FAILED` |
| Missing/invalid credentials | 401 | `UNAUTHENTICATED` |
| Missing function permission | 403 | `FORBIDDEN` |
| Not found **or not owned by the caller** | 404 | `<RESOURCE>_NOT_FOUND` |
| Version conflict, invalid state, idempotency key reused with a different payload | 409 | `CONFLICT`, `INVALID_STATE` |
| Business rule violation | 422 (or 400 with a specific code, per project) | domain code |
| Rate limited | 429 + `Retry-After` | `RATE_LIMITED` |
| Dependency failure / unexpected | 502/503/504 or 500 | generic code; details only in logs |

For RPC-dispatch or GraphQL, follow the system's actual error convention (status inside the envelope, `errors[]` with extensions) while carrying the same code and trace id.

## Step 7 — Cross-cutting concerns

- Register the operation's permission/scope; confirm it is denied for roles that should not have it.
- Rate limiting for authentication, OTP, search, export and other expensive or abusable operations.
- Audit record for sensitive actions (who, what, which object, when — no sensitive values).
- Metrics labelled by **route template** (`/orders/{id}`), never the raw path or user ids (`sdlc-be-observability`).
- Logs: one INFO milestone for state changes with correlation id and non-sensitive ids; no request/response body dumps.

## Step 8 — Backward compatibility and rollout

- Old and new instances serve traffic together during a rolling deploy: a new field must be optional on input until every producer sends it; never start requiring it in the same release.
- Be tolerant on input (ignore unknown optional fields if the project does) and conservative on output; adding enum values to responses can break strict clients — check consumers or document it.
- Deprecations: keep the old behavior, signal it (`Deprecation`/`Sunset` headers or the project's mechanism), record removal in a ticket.
- Mobile clients stay in the field for months; assume old app versions will keep calling the old shape.
- Risky behavior changes go behind a feature flag with a safe default.

## Step 9 — Tests

| Test | Must cover |
|------|-----------|
| Unit | Validation rules, mapping, domain decisions |
| Repository integration (real engine) | Scoping by owner/tenant, filters, sort stability, pagination boundaries |
| API/slice | Every status in Step 6, Problem Details body has `code` and `traceId`, headers (`Location`, `ETag`) |
| Authorization negative | User B gets 404 on user A's object; missing scope gets 403; unauthenticated gets 401 |
| Idempotency | Same key twice → one effect, same response; same key different payload → 409 |
| Pagination | Empty, exactly one page, last partial page, page size above maximum, tampered cursor |
| Contract | Response validates against the contract schema; consumer-driven contract tests if the project uses them |
| Compatibility | A request in the previous shape still works (for changes to existing operations) |

## Verification before reporting

Build, lint, tests; start the service; call the operation for: happy path, one validation error, unauthenticated, missing permission, another user's id, and (if applicable) an idempotent retry. Check each response body and the logs (correlation id, no sensitive data). Confirm the contract file and the implementation agree. List anything not run.

## Stop conditions

- The change is breaking or the contract is silent about a case you must handle (an error, a field's meaning, who may call it).
- Authorization or tenant rules for an id are unknown.
- The operation needs a schema change, a new external call or async processing not in the plan.

## Output template

```markdown
## Endpoint — <METHOD /path | operation name> (<ticket>)
Change class: new | additive | behavior change · Contract updated: <file/section>
Auth: <scope/role> · Object rule: <enforced in which query> · Idempotency: <key or N/A> · Pagination: <type, default/max>
### Files
| File | Change |
### Error cases
| Case | Status | Code | Test |
### Tests
| Level | File | Behaviors |
### Verification
| Call | Expected | Actual |
Compatibility notes: … · Not verified: …
Nothing was committed or pushed.
```

## Hand-off

`sdlc-review` → `sdlc-quality-gate` → `sdlc-docs` (API spec, consumer notes) and `sdlc-release` (changelog entry for consumers); frontend/mobile consumers via `sdlc-fe-implement` / `sdlc-mobile-implement`; QA API tests via `sdlc-qa-automation`.
