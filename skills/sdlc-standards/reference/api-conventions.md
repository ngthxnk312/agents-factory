# API conventions and anchoring standards

Anchor interfaces to published standards instead of inventing conventions. The full design procedure is in `sdlc-api-design`.

## 1. Standards catalog

| Topic | Standard | Applies to |
|-------|----------|------------|
| Requirement levels in specs | RFC 2119 + RFC 8174 | `REQUIRED` / `RECOMMENDED` / `OPTIONAL` instead of ad-hoc "yes/no" |
| HTTP methods and status codes | RFC 9110 (HTTP Semantics) | REST endpoints |
| Machine-readable API description | OpenAPI 3.1 (JSON Schema 2020-12) | REST; generated or hand-written |
| Field types and constraints | JSON Schema vocabulary | `type`, `format`, `maxLength`, `minimum`, `pattern`, `enum` |
| Errors | RFC 9457 Problem Details | `application/problem+json` + `code` + `traceId` |
| Date/time | RFC 3339 (ISO 8601 profile) | All timestamps, with offset or `Z` |
| Currency | ISO 4217 | Currency codes next to every amount |
| Phone numbers | E.164 | `+84901234567` |
| Country / language | ISO 3166-1 alpha-2, BCP 47 | `VN`, `en-US` |
| Identifiers | RFC 9562 (UUID, supersedes RFC 4122) | Public ids |
| Auth | OAuth 2.1 / OpenID Connect | Delegated access, user identity |
| Idempotency | IETF `Idempotency-Key` header draft | Retry-safe POST |
| Signing | JWS RFC 7515 (detached), JWA RFC 7518, JWK RFC 7517, JCS RFC 8785 | Signed requests/responses |
| RPC over JSON | JSON-RPC 2.0 | Single-endpoint method-in-body APIs |
| Async/event APIs | AsyncAPI, CloudEvents | Message and event contracts |
| Rate limiting | `RateLimit` header fields draft / `Retry-After` (RFC 9110) | 429 responses |

## 2. Cross-style rules

These hold whatever the style (REST, RPC, GraphQL, gRPC, events):

- Every operation documents: purpose, caller/permission, object-level authorization rule, request and response fields with requirement level and constraints, errors with codes, idempotency behavior, and examples.
- Transport shapes are DTOs, never persistence entities.
- Names reflect domain concepts, not table names or internal class names.
- Breaking changes require a new version; old versions stay until clients migrate.
- Nested fields are documented with dot paths (`order.amount`, `order.items[].sku`).
- Lists are paginated with a maximum page size.
- Errors are structured with a stable code and correlation id.
- Every time/amount/phone/country field uses the standard format above.

## 3. Additive vs breaking changes

| Additive (non-breaking) | Breaking |
|-------------------------|----------|
| New optional request field | New required request field |
| New response field (clients must ignore unknown fields) | Removing or renaming a field |
| New endpoint/operation | Changing a field's type, format or meaning |
| New enum value **only if** clients were told to tolerate unknown values | Tightening validation on existing input |
| New error code for a new situation | Changing status codes or error codes for existing situations |
| | Changing authentication or authorization semantics |

## 4. Contract artifacts

- Keep the machine-readable contract (OpenAPI, protobuf, GraphQL SDL, AsyncAPI) in the repository next to the code and validate it in CI where possible.
- When the style cannot be expressed in a machine-readable spec (e.g. a single endpoint dispatching on a body field), a human-readable contract document is the primary specification and must be complete.
- Consumers (web, mobile, partners) receive a handoff contract that includes integration notes: call order, retries, timeouts, idempotency, state machine.
