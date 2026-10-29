---
name: sdlc-be-observability
description: Make a backend service or feature operable before it ships — an event catalog of structured logs with correlation, RED metrics per operation and USE metrics per resource with low-cardinality labels, business metrics, distributed tracing across HTTP, messages and jobs, liveness/readiness/startup health checks that do not cause restart storms, SLIs and SLOs with error budgets, symptom-based actionable alerts (burn-rate), a service dashboard, and a runbook — delivered as code or reviewable definitions and verified locally. Use when creating a new service, adding a feature an on-call engineer must be able to watch, adding a job or consumer, or after an incident revealed missing signals.
stage: 6-ship
role: be
icon: 📡
mode: acceptEdits
prefer: service-observability, observability-instrumentation, backend-observability
---

# Backend observability and operational readiness

The question for every new behavior: when it breaks at 3 a.m., can the on-call engineer **detect** it (alert), **locate** it (dashboard, trace), **understand** it (logs with context) and **act** (runbook) — without reading the code? `sdlc-standards` (`reference/logging-observability.md`) holds the baseline rules for log levels, masking and audit; this skill designs and implements the signals. Use the project's telemetry stack and conventions; OpenTelemetry semantic conventions are the default where the project has none.

## When to use

- New service, new externally visible feature, new job/consumer, new integration.
- Before the first production release of a change that alters critical paths (`sdlc-deploy` pre-flight).
- After an incident or postmortem showing a detection or diagnosis gap.

## When not to use

- Defining availability or latency targets for a new system from scratch — `sdlc-sa-nfr-review` (this skill implements them).
- Investigating a live problem — `sdlc-incident`.

## Guardrails

- Do not create, modify or silence alerts, dashboards, log pipelines or on-call routes in shared monitoring systems without approval; deliver them as code/configuration in the repository or as reviewable definitions.
- No personal data, secrets or tokens in logs, metric labels, span attributes or baggage.
- Watch cost and cardinality: unbounded label values (user ids, raw paths, emails, request ids) can take down a metrics backend.

## Step 1 — Questions to signals

Write the on-call questions for this feature and map each to a signal:

| Question | Signal |
|----------|--------|
| Is it working for users right now? | SLI from RED metrics; synthetic check for critical journeys |
| Since when, and did a deploy or flag change cause it? | Time series with deploy/flag markers |
| For whom is it failing (tenant, region, client version, operation)? | Low-cardinality labels; logs/traces for the long tail |
| Where is time or error introduced? | Traces with spans per dependency |
| Is a dependency or resource saturated? | USE metrics for pools, queues, threads, memory |
| Is background work keeping up? | Lag, oldest-message age, last-success timestamp |
| What exactly happened to this request/order? | Logs and traces joined by correlation id; audit records |

## Step 2 — Logs

- Structured (JSON or key-value) with the minimum fields: UTC timestamp, level, service, environment, version, trace/correlation id, span id, logger, message, plus event-specific fields.
- An **event catalog** for the feature: event name (`order.payment_failed`), level, fields (non-sensitive ids, counts, durations, error code), when it is emitted. Log state changes and failures, not every step.
- Correlation: accept W3C `traceparent` (or the project's header) on inbound requests, generate if absent, put it in the logging context, propagate on outbound HTTP/gRPC and in message headers, restore it in consumers and jobs, clear it at the end of each unit of work.
- Errors logged once where handled, at ERROR with stack trace; client errors at WARN without; no request/response body dumps; masking per the baseline.
- High-volume debug logs: sampled or disabled by default, switchable per logger without redeploy if the platform allows.

## Step 3 — Metrics

- **RED per operation** (route template, RPC method, consumer, job): request rate, errors (by status class and stable error code), duration as a histogram. Bucket boundaries include the SLO thresholds so compliance can be computed.
- **USE per resource**: database and HTTP client pools (active, idle, pending, acquire time), worker/thread pools and queues, broker consumer lag, memory, CPU, garbage collection or event-loop lag, file descriptors.
- **Business metrics** that prove the feature works: orders created, payments failed by reason, emails queued vs delivered, imports processed/rejected.
- **Jobs**: last successful run timestamp, duration, items processed/failed, backlog.
- Naming: follow the project or OpenTelemetry conventions; units explicit (`_seconds`, `_bytes`); counters only increase; gauges for current values.
- Labels: bounded sets only (operation, status class, error code, tenant tier, region). Never user ids, emails, raw URLs, request ids or free-text error messages.

## Step 4 — Traces

- Spans for inbound requests, outbound calls, database queries (statement shape, not values), cache calls, message publish and consume, and significant internal steps.
- Messages carry trace context in headers; consumer spans link to the producer span; scheduled runs start a new trace.
- Attributes: operation, route template, status, error code, retry count, tenant tier — no personal data or payloads.
- Sampling: head sampling at a configurable rate plus always keeping errors and slow traces where the stack supports tail sampling. State the sampling so readers know traces are partial.

## Step 5 — Health checks and lifecycle

| Probe | Answers | Must check | Must not |
|-------|---------|-----------|----------|
| Liveness | Is the process stuck beyond recovery? | Process responsive, internal deadlock watchdog | Check databases or other services (a dependency outage would restart every instance) |
| Readiness | Can this instance take traffic now? | Initialization done, critical dependencies reachable (with short timeouts and cached results), not shutting down | Do expensive work per probe |
| Startup | Has a slow start finished? | Migrations/caches warm-up complete | Share thresholds with liveness |

- Health endpoints reveal no versions, hostnames or dependency details to the public; detailed health is internal and authenticated.
- Graceful shutdown: on termination signal, fail readiness, stop accepting new work, finish in-flight requests and messages within the grace period, flush telemetry, exit.

## Step 6 — SLIs, SLOs and alerts

- SLI = good events / valid events (for example, requests to `POST /orders` answered successfully within 800 ms / all non-4xx requests). SLO = target over a window (99.5% over 30 days). Error budget = 1 − SLO. Take targets from `sdlc-sa-nfr-review` or propose them for approval.
- **Page on symptoms**, not causes: multi-window burn-rate alerts on the SLO (a fast window for sudden breakage, a slow window for steady leaks). Cause-level signals (CPU high, one pod restarted) go to dashboards or tickets, not pages.
- Every alert has: clear name, severity, owner, the condition and duration, what the user impact is, and a **runbook link**. If nobody would act on it, do not create it.
- Additional alerts typical for backends: dependency error rate, pool saturation sustained, consumer lag or oldest-message age, dead-letter queue non-empty, job missed its schedule, certificate expiry, disk/partition growth.
- Validate alert rules with the tooling's linter or unit tests where available; trigger them once in a non-production environment if possible.

## Step 7 — Dashboard

One service overview: SLO status and error budget; RED per key operation; saturation of pools and queues; dependency latency and errors; background job health; deploy and flag-change annotations. Add a feature panel for business metrics. Link from alerts and runbook.

## Step 8 — Runbook

For each alert and each known failure mode: symptoms; dashboards and log/trace queries to run; likely causes in order of probability; **safe mitigations** (disable flag, scale, pause consumer, drain queue, fail over) with who may perform them; what not to do (for example, never replay the dead-letter queue before the consumer is fixed); escalation path; links to `sdlc-incident` for severity handling. Publish via `sdlc-docs`.

## Step 9 — Audit

Privileged actions, authentication events, permission changes and access to sensitive data produce audit records (who, what, when, which object, from where — no sensitive values), append-only and shipped off the host.

## Verification

Run the service locally with the telemetry exporter pointed at a local collector or console: generate traffic including errors; confirm logs carry trace ids and masked fields; scrape or inspect the metrics endpoint for the new series and check label values are bounded; open a trace that crosses HTTP → database → message → consumer; stop a dependency and confirm readiness fails while liveness stays healthy; send a termination signal and confirm graceful shutdown; lint alert and dashboard definitions. List what could only be verified in a shared environment.

## Stop conditions

- No SLO or target exists for a critical path and you would have to invent one — propose and ask.
- The telemetry backend, label budget or alert routing is unknown — ask the platform owner.
- A needed signal would require logging personal data — redesign the signal (counts, hashes approved by policy, ids) or ask.

## Output template

```markdown
## Observability — <service / feature> (<ticket>)
### Signal map
| On-call question | Signal | Name / query |
### Log event catalog
| Event | Level | Fields | Emitted when |
### Metrics
| Name | Type | Unit | Labels (bounded values) | Purpose |
### Traces
Spans added · propagation (HTTP, messages, jobs) · sampling
### Health
Liveness · readiness · startup · graceful shutdown behavior
### SLOs and alerts
| SLI | SLO / window | Alert (burn-rate windows) | Severity | Owner | Runbook |
### Dashboard and runbook
Files/definitions: … · Runbook entries: …
### Verification
| Check | Result |
Not verified: …
Nothing was pushed to shared monitoring systems.
```

## Hand-off

`sdlc-review` → `sdlc-quality-gate` → `sdlc-deploy` (pre-flight confirms dashboards and alerts exist; post-deploy watches them) → `sdlc-docs` (runbook) → `sdlc-incident` uses the runbook; gaps found in postmortems come back here.
