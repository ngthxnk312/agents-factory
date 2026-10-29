# Error handling and error contracts

## 1. Error codes are data, not literals

- Declare error codes and messages in one place: an enum/constant set plus an error dictionary (localizable). Do not scatter literal message strings through code.
- Organize by origin: codes shared across services in a shared module; integration/partner errors in their own group; the rest per domain (`<Domain>ErrorCode`).
- Codes are stable identifiers clients can switch on (`ACCOUNT_LOCKED`, `ORD-0409`). Never change the meaning of an existing code; add a new one.

## 2. Exception hierarchy

- Distinguish **domain errors** (expected business outcomes: insufficient balance, invalid state transition, not found) from **technical errors** (I/O failure, bug, timeout).
- Domain errors carry a code. Technical errors are wrapped into a generic internal error at the boundary.
- Catch at the right level:
  - re-throw domain errors unchanged;
  - wrap unknown/technical errors into a generic `INTERNAL_ERROR`, logging once at ERROR with the stack trace and correlation id;
  - catch the most specific type possible.
- Forbidden: empty catch blocks; catch-and-continue that hides failure; wrapping that discards the cause; returning a "success" result after a failure in a financial or state-changing operation.

Example (pseudocode, any language):

```
try:
    return transferService.transfer(command)
except DomainError as e:
    raise e                                   # keep the business code
except Exception as e:
    log.error("transfer failed refId=%s", ref_id, exc_info=e)   # log once, full detail, server-side
    raise DomainError(ErrorCode.INTERNAL_ERROR)                  # nothing internal reaches the client
```

## 3. HTTP error contract — RFC 9457 Problem Details

Every HTTP API error uses `application/problem+json`:

```json
{
  "type": "https://errors.example.com/transfer/insufficient-balance",
  "title": "Insufficient balance",
  "status": 422,
  "detail": "The account balance is too low for this transfer.",
  "instance": "/api/v1/transfers",
  "code": "TRF-0402",
  "traceId": "4bf92f3577b34da6"
}
```

- `code` (stable, machine-readable) and `traceId` (joins the response to server logs) are always present.
- `detail` is safe for end users: no stack traces, SQL, table/column names, file paths, hostnames, framework versions, or personal data.
- Status codes follow RFC 9110 semantics:

| Status | Use for |
|--------|---------|
| 400 | Malformed request, validation failure |
| 401 | Not authenticated / invalid credentials or signature |
| 403 | Authenticated but lacks the function-level permission |
| 404 | Not found — **also** for objects that exist but the caller may not see (prevents id enumeration) |
| 409 | Conflict: concurrent modification, duplicate idempotency key with different payload, invalid state |
| 422 | Well-formed but violates a business rule (if the project uses 422; otherwise 400 with a specific code) |
| 429 | Rate limited |
| 5xx | Server-side failures only |

- Non-HTTP interfaces (RPC envelopes, message replies, GraphQL errors, CLI exit codes) carry the same information: stable code, safe message, correlation id.

Implementation examples: a central exception handler/advice class in Spring or ASP.NET; an error middleware in Express/FastAPI/Django; an `ExceptionMapper` in JAX-RS; an error boundary plus a typed API-error model on the client side.

## 4. Principles

- Handle errors centrally (middleware/advice/mapper). Do not repeat formatting try/catch blocks in every handler.
- Log client errors (4xx) at WARN without stack traces; server errors (5xx) at ERROR with stack traces. See `logging-observability.md`.
- Prefer failing loudly to silently producing wrong results, especially for money, permissions and data integrity.
- User-facing messages go through the i18n dictionary; codes stay stable for machines.
- Client code (frontend/mobile) maps codes to user messages and keeps the `traceId` visible in support/debug views so users can report it.

## Checklist

- [ ] Codes and messages come from an enum/dictionary, not literals.
- [ ] Domain errors re-thrown; unexpected errors wrapped and logged once.
- [ ] No empty or over-broad catch; cause preserved.
- [ ] Problem Details (or equivalent) with `code` and `traceId`; nothing internal leaked.
- [ ] Status codes semantically correct; 404 for unauthorized object access.
- [ ] Central handling; 4xx → WARN, 5xx → ERROR.
