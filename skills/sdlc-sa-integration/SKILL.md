---
name: sdlc-sa-integration
description: Design an integration with an external or separately owned system — inventory and ownership, pattern choice (synchronous API, messaging, webhook, file batch, change data capture), adapter boundary, field mapping and error mapping, timeouts, retries, idempotency, unknown-outcome handling and reconciliation, security of the channel, observability, test strategy with stubs and sandboxes, and cutover. Use when adding or changing an integration with a partner, vendor, payment or identity provider, legacy system, another team's service, or a message broker.
stage: 3-design
role: sa
icon: 🔗
mode: plan
prefer: integration-design, system-integration, sa-integration
---

# Integration design

Integrations are where most production incidents start: the other side is slow, down, changes without notice, or returns something you did not expect — and sometimes you cannot tell whether your request succeeded. Design for that from the first line. The partner's documentation is a claim; your design must survive it being wrong.

## When to use

- A new external or separately owned system must be called, must call us, or exchange data with us.
- An existing integration changes version, partner, volume or criticality.
- Integration incidents keep recurring and the design needs hardening.

## When not to use

- Designing our own public API contract → `sdlc-api-design` (this skill references it for inbound interfaces).
- Whole-solution architecture → `sdlc-sa-solution-design` (it delegates each interface here).

## Inputs

Partner specification and version, contract/SLA (availability, latency, rate limits, support hours), sandbox/test environment details, the functional spec flows that use the integration, data classification, volumes and peaks, existing integration code and patterns in the codebase (cite paths). Missing partner facts become questions to the partner owner, not guesses.

## Procedure

1. **Inventory each interface** as `INT-<nn>`: purpose, direction (outbound, inbound, both), counterpart and owner contact, business criticality, volume and peak, data exchanged and its classification, contract source and version, environments available (sandbox, staging), SLA and rate limits, authentication method.
2. **Choose the pattern** and record why:
   | Pattern | Use when | Watch out for |
   |---|---|---|
   | Synchronous request/response | The user or process needs the answer now; partner is reliable and fast | Latency coupling, cascading failure, unknown outcome on timeout |
   | Asynchronous messaging / events | Decoupling, absorbing spikes, several consumers, eventual consistency acceptable | Ordering, duplicates, poison messages, schema evolution |
   | Webhook / callback | The partner reports status changes to us | Signature verification, replay, out-of-order and missing callbacks — always have a status query fallback |
   | File / batch exchange | High volume, periodic, legacy counterpart | Partial files, re-runs, cut-off times, encoding, large-file handling |
   | Change data capture / replication | Only for systems we own or with explicit agreement | Coupling to internal schema |
   | Polling | Last resort when nothing else exists | Cost, rate limits, latency |
3. **Isolate the partner behind an adapter** (anti-corruption layer): one adapter per external system, exposing a neutral interface in our domain language; partner-specific codes, formats and quirks never leak beyond it (`sdlc-standards` architecture rules).
4. **Map data:** field-level mapping table (source → target, type, transformation, mandatory, default, validation); validate at the boundary on both send and receive; define behaviour for unknown fields and missing optional fields; reference data and code lists with an owner.
5. **Map errors:** partner code/status → internal error code → retryable or not → user-facing message → alert or not. Unknown partner codes map to a safe default and are logged for review.
6. **Reliability:**
   - Timeouts on connect and read, inside an overall time budget for the user operation.
   - Retries only for transient failures on idempotent operations, with exponential backoff, jitter and a maximum; never blind-retry a non-idempotent operation that moves money or changes state.
   - Idempotency keys on outbound writes where the partner supports them; deduplication of inbound messages and callbacks by a stable key.
   - **Unknown outcome** (timeout after sending): mark the operation pending, query the partner's status, and resolve via reconciliation — never assume success or failure.
   - Circuit breaker and bulkhead so a failing partner cannot exhaust our resources; define degraded behaviour for users.
   - Publish-after-commit through an outbox when a database change and a message must both happen; dead-letter queue with replay procedure; ordering rules where they matter.
   - **Reconciliation:** periodic comparison of our records with the partner's (reports, statements, status APIs); define mismatch handling and owner.
   - Compensation steps for multi-step processes that cannot be one transaction.
7. **Security:** channel protection (TLS, mutual TLS where required), authentication (OAuth client credentials, signed requests with timestamp and nonce, API keys only if nothing better), secrets from the secret store or environment by name only, host allowlisting, inbound signature verification and replay protection, least data sent, sensitive fields masked in logs, contractual data-processing obligations.
8. **Observability:** per-interface metrics (calls, latency percentiles, errors by mapped code, retries, circuit state), correlation id propagated to the partner where supported, structured logs without sensitive payloads, alerts tied to SLA breaches and error-rate thresholds, health checks that do not hammer the partner, an audit trail of business-relevant exchanges.
9. **Versioning and change:** which partner version we target, how we detect deprecations, tolerance for additive changes, our own backward compatibility for inbound interfaces.
10. **Testing:** contract tests against the agreed schema; a stub/simulator of the partner for automated tests (no real outbound calls in tests); sandbox end-to-end scenarios; fault injection (timeouts, 5xx, malformed payloads, duplicates, out-of-order callbacks); volume test at expected peak; reconciliation test.
11. **Cutover and operations:** feature flag or routing switch, parallel run or shadow traffic if risky, partner coordination and communication plan, rollback path, runbook for the top failure modes, support contacts and escalation with the partner.

## Stop conditions

- No contract or specification from the counterpart — list exactly what is needed and from whom.
- Semantics of money movement, personal data or legal obligations are unclear (for example whether a timeout can mean "executed").
- No test environment exists and the integration is critical — escalate as a risk; do not plan to test against production.

## Output template

```markdown
## Integration design — INT-<nn> <counterpart> · v<N> · DRAFT
Purpose · direction · criticality · owner contacts · contract source/version · environments · SLA / rate limits
Pattern: <choice> — because … · Adapter: <module/path>
### Flow
<sequence diagram with success, business error, technical error, timeout/unknown outcome>
### Field mapping
| Source field | Target field | Type | Transformation | Mandatory | Default | Validation |
### Error mapping
| Partner code | Internal code | Retryable | User message | Alert |
### Reliability
Timeouts · retry policy · idempotency key · unknown-outcome handling · circuit breaker · DLQ/replay · reconciliation (frequency, owner)
### Security
Channel · authentication · secrets (names) · signature/replay · data minimisation · log masking
### Observability
Metrics · logs · alerts · health check · audit
### Testing
Contract · stub · sandbox scenarios · fault injection · volume · reconciliation
### Cutover and runbook
Flag/switch · parallel run · rollback · partner communication · top failure modes and actions
### Open questions
| ID | Question | Partner/owner | Impact | Assumption meanwhile |
```

## Hand-off

The design feeds `sdlc-sa-solution-design` section 7, `sdlc-api-design` for any inbound contract we expose, `sdlc-ba-srs` integration variant (mapping, retry, validation, monitoring), `sdlc-design` and `sdlc-implement` for the adapter, `sdlc-test` for stubs and contract tests, `sdlc-deploy` for cutover, and `sdlc-pm-risk-issue` for partner dependencies.
