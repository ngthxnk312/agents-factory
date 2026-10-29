---
name: sdlc-be-async-jobs
description: Implement background work that survives duplicates, crashes and partial failure — choose the mechanism (in-process task, database-backed queue, message broker, event stream, scheduler), publish reliably with the transactional outbox, consume idempotently with acknowledgement after commit, classify errors into retry with backoff and jitter versus dead-letter, handle ordering, poison messages, timeouts, graceful shutdown and single-run scheduling across instances, and make every job observable. Use when adding or changing scheduled jobs, queue or topic consumers and producers, domain events, long-running asynchronous operations or retry logic in a backend service.
stage: 4-build
role: be
icon: 📬
mode: acceptEdits
prefer: background-jobs, async-messaging, message-queue-patterns
---

# Background jobs, queues and events

Assume every message can arrive twice, late, out of order or never acknowledged; every job can run on two instances at once, be killed halfway or run again after a restart; every downstream call can time out with an unknown outcome. Design so that each of those leaves data correct. Apply `sdlc-be-implement` (layering, transactions, authorization) and `sdlc-standards` (architecture reference, jobs section). Integration with external systems is designed in `sdlc-sa-integration`; event and message contracts are designed in `sdlc-api-design`.

## When to use

- New or changed scheduled job, queue/topic consumer, event publisher, delayed or retried task.
- Moving work off the request path (exports, notifications, heavy computation) with an accepted/status pattern.
- Fixing duplicate processing, lost messages, stuck queues or overlapping job runs.

## When not to use

- Choosing the integration pattern with a partner — `sdlc-sa-integration`.
- Broker or scheduler infrastructure provisioning — the platform's own process (`sdlc-deploy` for rollout).

## Guardrails

- Never publish to, consume from, purge or replay a shared or production queue/topic, or trigger a production job, without explicit approval.
- Tests and local runs never send real emails, chat messages, webhooks or partner calls; non-production schedulers run with outbound delivery disabled or redirected.
- Messages carry identifiers and minimal data — no secrets, tokens or unnecessary personal data in payloads or headers.

## Step 1 — Choose the mechanism

| Mechanism | Use when | Do not use when |
|-----------|----------|-----------------|
| In-process async task / thread pool | Non-critical, losable work (cache warm-up, best-effort metrics) | Losing the work on crash or deploy is unacceptable |
| Database-backed job table (claim with `SKIP LOCKED`, lease, status) | Work must be created atomically with business data; moderate volume; no broker available | Very high throughput or many independent consumers |
| Message queue (work distribution) | Competing consumers, load leveling, per-message retry and dead-letter | Consumers need replay of history or strict global order |
| Event log / stream (partitioned topic) | Several independent consumers, replay, per-key ordering, high volume | You need per-message delay/visibility semantics only |
| Scheduler (cron-like) | Time-based triggers: cut-offs, reconciliation, cleanup | Reacting to individual business events — use messages |

Record the choice and why. Prefer what the service already uses over adding new infrastructure.

## Step 2 — Delivery semantics

- Brokers give at-most-once or at-least-once. "Exactly once" in practice means **at-least-once delivery + idempotent processing**. Design for that, whatever the product claims.
- Define for each message type: who produces it, its key, ordering requirement, expected volume and peak, maximum acceptable delay, retention, and what happens if it is lost.

## Step 3 — Producing reliably (transactional outbox)

The dual-write problem: committing the database and then publishing can lose the message (crash in between); publishing and then committing can emit an event for data that was rolled back.

1. In the same transaction as the business change, insert an outbox row: message id (UUID), type, schema version, aggregate key, payload, headers (correlation id, causation id), created time.
2. A relay (poller or change-data-capture) publishes unsent rows after commit, marks them sent, retries on failure. The relay is itself at-least-once — consumers must deduplicate.
3. Preserve per-aggregate order where required (publish in sequence per key; key the topic by aggregate id).
4. Clean up or archive sent rows on a schedule; alert when the oldest unsent row ages beyond the threshold.

Only fire-and-forget publishing (no outbox) is acceptable for messages whose loss is explicitly tolerated.

Envelope fields: `id`, `type`, `version`, `occurredAt` (UTC), `key`, `correlationId`, `causationId`, `producer`, `payload`. Evolve schemas additively; breaking changes get a new type or version and a period where both are produced or consumed.

## Step 4 — Consuming idempotently

- Make the effect idempotent by one of: a processed-message record with a unique constraint on (consumer name, message id) written **in the same transaction** as the effect; a natural idempotent operation (upsert to a computed state, conditional state transition `WHERE status = :expected`); or a version check that ignores stale events (`WHERE version < :eventVersion`).
- **Acknowledge after commit**, never before. A crash between commit and ack causes a redelivery, which idempotency absorbs.
- Visibility timeout / ack deadline exceeds the worst-case processing time; extend it (heartbeat) for long work, or split the work.
- Bound concurrency and prefetch so a burst cannot exhaust the database pool or a partner's rate limit.
- Ordering: if order matters per entity, partition by entity key and process each key sequentially; otherwise handle out-of-order arrival explicitly (versions, timestamps from the producer, state checks). Never assume order across keys.
- Validate the message like any external input (schema, version, tenant, referenced ids). Identity or permissions claimed in a message are trusted only if the producer is trusted and the message is authenticated.

## Step 5 — Retries, dead letters and poison messages

| Error class | Examples | Handling |
|-------------|----------|----------|
| Transient | timeout, 503, deadlock, broker unavailable | Retry with exponential backoff + jitter, bounded attempts (for example 5–8 over minutes); use delayed retry queues/topics so one message does not block a partition |
| Permanent | schema invalid, referenced entity does not exist and never will, business rule rejects | No retry; dead-letter immediately with the reason |
| Unknown outcome | timeout after a state-changing partner call | Do not retry blindly; record `PENDING`, query status or reconcile (`sdlc-sa-integration`) |
| Bug | unexpected exception | Limited retries, then dead-letter; alert |

- Dead-letter entries keep the original message, headers, error class, last error message (no sensitive data), attempt count and timestamps.
- Every dead-letter queue has an owner, an alert on non-zero depth or growth, and a written replay procedure. Replay is safe only because consumers are idempotent; replay into production needs approval.
- Poison messages (crash the consumer, exceed size limits, fail deserialization) are detected by attempt count and diverted — a consumer loop must never stall on one message.

## Step 6 — Timeouts, long-running work and shutdown

- Every handler and job has a processing deadline; every outbound call inside it has its own timeout within that deadline; cancellation is honored.
- Long operations triggered by an API: return `202 Accepted` with a status resource; store progress (state, counts, last checkpoint, error summary); make the work resumable from the checkpoint; support cancellation if the contract requires it.
- Graceful shutdown: stop fetching new messages, finish in-flight work within the grace period or release it back (nack, lease expiry), flush the outbox relay, then exit. Deploys must not lose or double-apply work.

## Step 7 — Scheduled jobs

- [ ] **Single execution across instances**: a scheduler of record, a database row claim/lease, or a lock with lease and fencing — not "it runs on every pod and hopefully only one does work".
- [ ] **No overlap**: a run does not start while the previous one is still running (or overlapping is proven safe).
- [ ] **Misfire policy** decided: skip, run once to catch up, or process every missed window.
- [ ] **Windows, not "now"**: process by business date or watermark (`last processed id/time`), so reruns and catch-ups are idempotent.
- [ ] **Time zones explicit**: schedulers often run in UTC; cut-offs in local business time are converted explicitly; tests around midnight and DST changes.
- [ ] **Chunked and resumable** for large volumes; scoped per tenant/company; run as a least-privilege system principal.
- [ ] Schedule is configuration, not a literal; if the job is defined in code **and** a registration/schedule file, both are changed together.
- [ ] Manual trigger for operations (re-run a window) exists or is documented, protected by authorization and audit.

## Step 8 — Context propagation and observability

- Carry the correlation id (W3C trace context or the project's header) from producer to consumer and into logs and outbound calls; start a new trace with a link for scheduled runs.
- Metrics per consumer/job: processed, succeeded, failed by error class, retried, dead-lettered, processing duration percentiles, queue depth, **age of oldest message / consumer lag**, last successful run timestamp, outbox backlog.
- Logs: job start and end with window, counts and duration; one ERROR per failed message with message id and type (no payload dump).
- Alerts: no successful run within the expected interval, lag or oldest-message age above threshold, DLQ non-empty or growing, failure rate above threshold. Define them with `sdlc-be-observability` and add the runbook entries.

## Tests

- Handler logic unit-tested without the broker.
- Integration test with the real broker/scheduler in a container, or a test double that honors redelivery and ack semantics.
- Duplicate delivery → one effect. Out-of-order delivery → final state correct. Crash after commit before ack → redelivery absorbed.
- Transient failure → retried with backoff; permanent failure → dead-lettered with reason; poison message → consumer continues with the next.
- Outbox: business rollback produces no message; commit produces exactly one outbox row.
- Scheduler logic with an injected clock: window calculation, DST, misfire, overlap prevention.
- Outbound effects stubbed; assertions that no real delivery was attempted.

## Stop conditions

- Loss, duplication or delay tolerance for a message type is not specified and the effect is money, notifications to customers or legal records — ask.
- A new broker, topic, queue, or a change to retention/partitioning of a shared one is needed — needs owner approval.
- The unknown-outcome behavior for a partner call is undefined — back to `sdlc-sa-integration`.

## Output template

```markdown
## Async processing — <ticket>
### Message types / jobs
| Name | Mechanism | Producer → consumer | Key / ordering | Volume (peak) | Max delay | Loss tolerance |
### Reliability decisions
Outbox: … · Idempotency: <mechanism, unique key> · Ack: after commit · Retry: <attempts, backoff, jitter> · DLQ: <name, owner, replay procedure> · Timeouts: … · Shutdown: …
### Scheduling (if any)
Schedule (config key, time zone) · single-run mechanism · misfire policy · window/watermark · chunk size
### Observability
Metrics · alerts · runbook entries
### Tests
| Scenario | File | Result |
### Not verified
Nothing was committed or pushed; no shared queue or job was touched.
```

## Hand-off

`sdlc-be-observability` (alerts, runbook) → `sdlc-review` → `sdlc-quality-gate` → `sdlc-deploy` (enable flags/schedules per environment, drain or migrate in-flight messages if the format changes) → `sdlc-docs`.
