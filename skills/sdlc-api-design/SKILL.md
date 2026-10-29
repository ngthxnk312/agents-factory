---
name: sdlc-api-design
description: Design or extend an API contract-first — choose the style that matches the real system, define resources or operations, DTOs, validation, authorization per object, RFC 9457 errors, pagination, idempotency, versioning and signing — and produce a handoff spec consumers can build against. Use when adding or changing any endpoint, RPC operation, event or other public interface.
stage: 3-design
role: sa
icon: 🔌
mode: plan
prefer: api-design, api-design-principles, api-contract
---

# API design (contract first)

Define the contract before the implementation, and anchor it to published standards (`sdlc-standards` → `reference/api-conventions.md`). Do not write the implementation here; `sdlc-implement` does that against this contract.

## When to use

- Adding an endpoint, RPC operation, GraphQL field, gRPC method, webhook, or event/message type.
- Changing request/response fields, errors, auth or pagination of an existing one.
- Writing the handoff spec for web, mobile or partner teams.

## When not to use

- Internal function signatures inside one module.
- Pure UI changes with no contract change.

## Procedure

0. **Check what exists.** Read the current API surface, existing contract files (OpenAPI, protobuf, SDL, AsyncAPI), the API catalog in the System Context, and any prior analysis of this feature (verify its age against code). Find the closest existing operation and mirror its conventions.
1. **Identify the real style** of the service and stay consistent with it. Do not force one style onto another architecture.

   | Style | Shape | Anchor | Typical fit |
   |-------|-------|--------|-------------|
   | REST | Many URLs; URL = resource; HTTP method carries meaning | RFC 9110 | Resource-oriented CRUD and actions |
   | RPC-dispatch | One URL, always POST, a body field selects the operation inside a fixed envelope | JSON-RPC 2.0-like | Gateways and legacy integration hubs |
   | gRPC / GraphQL | Schema-defined services or graph | protobuf / SDL | Internal service mesh / client-driven queries |
   | Events | Messages on a broker | AsyncAPI / CloudEvents | Asynchronous integration |

   If the style is unclear and the service has no precedent, ask rather than guess.
2. **Name and shape the operation.**
   - REST: plural nouns for domain concepts, no verbs, no table names (`GET /api/v1/customers/{id}`, not `POST /getCustomer`). `GET` is safe and idempotent; `POST` creates; `PUT` replaces; `PATCH` partially updates; `DELETE` removes. Domain actions that are not CRUD become sub-resources (`POST /orders/{id}/cancellation`).
   - RPC-dispatch: a single shared envelope (operation name, request id, timestamp, signature, `data` payload). Never invent a new envelope per operation — only `data` varies. Document each operation as if it were its own endpoint.
3. **Define DTOs.** Separate request/response types; never expose persistence entities; bind requests to DTOs to prevent mass assignment (no settable `role`, `ownerId`, `balance`, `status` unless the operation is meant to set them). Each field: type, requirement level (RFC 2119), constraints (JSON Schema vocabulary), format standard (RFC 3339, ISO 4217, E.164, UUID), description, example. Nested fields use dot paths.
4. **Authorization.** For every operation: who may call it (role/scope), and the **object-level rule** for every id it accepts — how ownership or scope is enforced (in the query). Unauthorized objects return 404.
5. **Validation.** Boundary validation rules; maximum lengths consistent with storage; allowlists for enums and sort/filter fields.
6. **Errors.** RFC 9457 Problem Details with stable `code` and `traceId`; list every error case with status and code. For RPC-dispatch, document whether errors use HTTP status codes or a code inside a 200 response — whichever the system really does.
7. **Pagination, filtering, sorting.** Every collection is paginated with a maximum page size. Cursor-based for large or frequently changing data; offset for small, stable sets. Return the next cursor or `page/size/total`. Filters and sort keys come from an allowlist.
8. **Idempotency and concurrency.** Retry-safe creation via an `Idempotency-Key` header (REST) or the envelope's request id (RPC): same key + same payload → same result; same key + different payload → 409. Concurrent updates use version/ETag (`If-Match`) or an explicit conflict error.
9. **Versioning and compatibility.** REST: URL major version (`/api/v1`) from day one, unless the project uses header/media-type versioning. RPC-dispatch: a version field in the envelope or a new operation name for breaking changes (`PAYMENT_CREATE_V2`). Classify the change as additive or breaking (see the conventions reference); breaking changes need a new version and a deprecation plan for the old one.
10. **Signing and integrity** (only if the system signs messages): specify algorithm, key management, exact canonicalization and field order, encoding and null handling, which field carries the signature and is excluded from signing, and the error on failure. Prefer JWS/JCS. **Read the real implementation**; never copy an example algorithm or field order from a template.
11. **Rate limits, timeouts, size limits** visible to clients.
12. **Machine-readable contract.** Update OpenAPI/protobuf/SDL/AsyncAPI in the repository when the style supports it. When it cannot express the style (single endpoint dispatching on a body field), the markdown spec is the primary contract and must be complete.
13. **Tests to write** (for `sdlc-test`): happy path, each validation error, each business error, authorization negative test (user A vs user B), idempotent retry, pagination boundaries, contract/schema test.

## Stop conditions

- A breaking change to an existing consumer-facing operation — get explicit owner approval and a migration plan.
- Signing, authentication or authorization semantics are unknown — ask; do not invent them.
- The spec would need data the caller should not see — redesign or ask.

## Output — API spec template

```markdown
## API spec — <feature> (<ticket>)
Version: v0.1 · Status: DRAFT · Last verified: YYYY-MM-DD
Style: REST | RPC-dispatch | … · Base: /api/v1 · Auth: <mechanism> · Content-Type: application/json
Conventions: RFC 2119 levels · JSON Schema constraints · RFC 3339 / ISO 4217 / E.164 / UUID · RFC 9457 errors · Idempotency-Key

### Operations
| # | Method + path / operation name | Purpose | Caller (role/scope) | Story |
|---|--------------------------------|---------|---------------------|-------|

### <#>. <METHOD /api/v1/path | operation = NAME>
Purpose · Story · **Object authorization:** <rule, enforced how>
Idempotency: <key, behavior> · Pagination: <cursor/offset, max size> · Rate limit: <…>

Request
| Field | Type | Level | Constraints | Description |
|-------|------|-------|-------------|-------------|
| `order.amount` | string (decimal) | REQUIRED | > 0, scale ≤ 2 | amount in `order.currency` |

Response 200/201
| Field | Type | Level | Description |
|-------|------|-------|-------------|

Errors
| HTTP | code | When |
|------|------|------|
| 400 | … | validation |
| 404 | … | not found or not owned by caller |
| 409 | … | conflict / idempotency key reuse with different payload |

Examples: request and response JSON (no real personal data)

### Signature (only if applicable)
### Compatibility
Change class: additive | breaking · Deprecation plan: …
### Integration notes for consumers
Call order, state machine, retries and timeouts, idempotency usage, sample curl.
```
