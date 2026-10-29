# Logging and observability

A single careless log line can leak credentials or personal data and create a reportable incident. Rules here are independent of the logging library.

## 1. Never log (hard ban, any level, even temporarily)

| Category | Examples |
|----------|----------|
| Credentials | passwords (plain or hashed), OTPs, PINs, session ids, access/refresh tokens, JWTs, API keys, cookies, authorization headers |
| Keys and secrets | private keys, signing secrets, connection strings with passwords, webhook URLs with tokens |
| Payment card data | full card number, CVV/CVC, PIN blocks, magnetic-stripe/track data, expiry together with the number |
| Personal data | government ID numbers, passport numbers, full date of birth, home address, full email/phone, bank account numbers, health data |
| Sensitive bodies | full request/response payloads of login, payment, password/PIN change and profile endpoints |

Treat every request/response field as potentially sensitive. Log an explicit allowlist of safe fields; never dump whole objects or payloads.

## 2. Masking (when a value is needed for tracing)

| Type | Logged form | Rule |
|------|-------------|------|
| Card number | `457312******0119` | at most first 6 + last 4 |
| OTP / PIN / password / CVV | not logged | log state only: `otp=present`, `pin_valid=false` |
| Phone | `09******21` | keep a short prefix and last 2–4 digits |
| Email | `j***@example.com` | first character + domain |
| Government ID | `0790****1234` | first 4 + last 4 at most |
| Bank account | `****4321` | last 4 |
| Token | `tok_…9f2c` or a hash prefix | never the full value |

- **Mask at the source:** a masking utility called when building the message, or field annotations/serializers that redact on output.
- **Safety net at the sink:** a redacting layout/processor/filter in the logging pipeline that catches patterns such as 13–19 digit sequences, `"password"\s*[:=]`, `Bearer\s+\S+`, `eyJ[\w-]+\.` (JWTs). This is defense in depth, not a substitute for source masking.

## 3. Levels and content

| Level | Use for | Stack trace |
|-------|---------|-------------|
| ERROR | System failures (5xx), unrecoverable errors, data integrity problems | yes, full |
| WARN | Client errors (4xx), handled anomalies, degraded mode, retries exhausted | no |
| INFO | Business milestones (order created, payment completed, job finished with counts) | no |
| DEBUG | Technical detail for investigation | no; disabled in production by default |

- No `print`/`console.log`/`System.out`/`printStackTrace` in application code — use the project's logger.
- Every message has context: operation name, correlation id, relevant non-sensitive identifiers. `log.info("done")` is not acceptable.
  - Good: `[createOrder] completed orderId=ORD-881 items=3 amountMasked=*** durationMs=41`
- Do not log inside hot loops; aggregate counts instead.
- Log each error once, where it is handled — not at every layer it passes through.

## 4. Structured logs and correlation

- Emit structured logs (JSON or key-value) in services so a central system can index them.
- Every request/job/message gets a correlation id (`traceId`/`requestId`). Accept it from the incoming request (e.g. W3C `traceparent` or an `X-Request-Id` header) or generate one; put it in the logging context (MDC/context-local); propagate it on outbound calls; clear it at the end of the unit of work so it does not leak across pooled threads.
- Minimum fields: `timestamp` (UTC, ISO 8601), `level`, `service`, `environment`, `traceId`, `logger`, `message`.
- The same `traceId` appears in error responses (see `errors.md`) so users can report it.
- Frontend/mobile: send correlation ids on API calls; report client errors to the error tracker with release version, without personal data.

## 5. Metrics and traces

- Standardize on OpenTelemetry (OTLP) where possible rather than coupling to one vendor library.
- Minimum per service: request rate, error rate and latency (p50/p95/p99) per endpoint or operation; saturation of pools (DB connections, threads, queues); dependency health; a health/readiness endpoint.
- For jobs and pipelines: last success time, duration, records processed/failed, lag.
- New features add the metrics that would tell an on-call engineer the feature is working (see `sdlc-design` observability section).

## 6. Audit trail and retention

- Access to sensitive data and privileged/admin actions produces an audit record: who, what action, when, on which object id, from where — never the sensitive values themselves.
- Audit logs are append-only and shipped off the host promptly.
- Retention follows the project's or regulator's policy; clocks are synchronized (NTP) so cross-system timelines are reliable.

## Checklist

- [ ] No credentials, keys, card data or personal data in any log statement.
- [ ] Values that must appear are masked per section 2; a sink-level redaction net exists.
- [ ] Correct levels; stack traces only at ERROR; no print statements.
- [ ] Every log line has context and a correlation id; logs are structured.
- [ ] New behavior has metrics/health signals an on-call engineer can use.
- [ ] Sensitive/admin actions are audited without sensitive values.
