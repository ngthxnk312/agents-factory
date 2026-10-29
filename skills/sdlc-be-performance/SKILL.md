---
name: sdlc-be-performance
description: Improve backend performance with evidence instead of guesses — agree a target (SLO or budget for latency percentiles, throughput, resource use), build a reproducible baseline, locate the hotspot with traces, profilers, slow-query data and pool/runtime metrics, apply the cheapest effective fix (do less work, better queries and indexes, batching, bounded parallelism, caching, moving work off the request path, tuning), verify before/after on the same workload, add a regression guard, and plan load tests (load, stress, soak, spike) safely. Use when an endpoint, job or query misses its budget, a performance regression is detected, capacity must be proven before launch, or infrastructure cost is driven by inefficiency.
stage: 5-verify
role: be
icon: ⚡
mode: acceptEdits
prefer: performance-optimization, backend-performance, performance-profiling
---

# Backend performance

Measure, locate, change one thing, measure again. Optimization without a target and a baseline produces complexity, not speed; and a faster system that serves stale or unauthorized data is a defect. Apply `sdlc-standards` and `sdlc-be-implement` for any code you change; measurable targets come from `sdlc-sa-nfr-review` when they exist.

## When to use

- A latency, throughput or resource budget is missed (user complaint, SLO burn, gate step 8 regression).
- Preparing a launch or expected traffic increase: prove capacity and find the first bottleneck.
- Cost reduction where compute or database load is the driver.

## When not to use

- No measured problem and no target — record the concern as a follow-up instead of optimizing speculatively.
- Production is degraded right now — `sdlc-incident` first (mitigate), then come back here for the durable fix.
- Defining what "fast enough" means for a new system — `sdlc-sa-nfr-review`.
- A purely query/index problem already localized — `sdlc-be-data-access` is enough.

## Guardrails

- No load, stress or soak test against shared, staging or production environments without explicit approval, a time window and the owners of every downstream system informed. Partners and outbound channels are stubbed during load tests — never load a third party.
- No profiler agents, debug flags or extra logging attached to production without approval; prefer always-on, low-overhead telemetry already in place.
- No production data copied to local machines for benchmarking; use synthetic data with realistic volume and distribution.
- Optimizations must not weaken correctness, authorization, tenant isolation, durability or observability (for example: caching per-user data under a shared key, skipping validation, dropping audit logs, turning off fsync). Risky changes ship behind a flag.

## Step 1 — Define the target

- Metric and percentile: p95/p99 latency per operation, throughput at a given error rate, CPU/memory per request, job duration, queue lag. Averages hide tails; always use percentiles for latency.
- Workload: request mix, payload sizes, data volume, concurrency or arrival rate, cache state (cold/warm).
- Environment: instance size, number of replicas, database size, configuration.
- Budget decomposition for multi-hop requests: allocate the end-to-end budget across hops (gateway, service, database, partner) so you know which part is over.
- If no target exists, propose one with rationale and get agreement before changing code.

## Step 2 — Baseline

- Reproducible: scripted workload, fixed data set, documented environment and versions, warm-up before measuring, enough samples or duration for stable percentiles, repeated runs to see variance.
- Capture at the same time: latency histogram, throughput, error rate, CPU, memory and garbage collection, thread/worker pool usage, database time and statement counts, connection-pool wait time, outbound call latency.
- Sources (use what the project has): distributed traces/APM, CPU sampling profiler, allocation profiler, wall-clock/off-CPU profiler for waiting, lock-contention profiles, database slow-query log and statement statistics, runtime metrics (event-loop lag, thread pool queue, goroutine/thread counts), OS metrics.

## Step 3 — Locate the hotspot

Start from traces of slow requests (not average ones) and attribute time: application CPU, database, outbound calls, waiting for a pool or lock, serialization, garbage collection, queueing before the handler. Use the USE method for each resource (utilization, saturation, errors).

| Symptom | Likely cause | Confirm with | Typical fix |
|---------|--------------|--------------|-------------|
| Latency grows with result size; many identical queries | N+1 queries | Statement count per request, trace spans | Join/batch fetch, projection query |
| One query dominates; full scans | Missing or unusable index; function on column | Query plan on realistic volume | Index via `sdlc-db-migration`, sargable rewrite |
| Time spent waiting for a connection | Pool exhaustion from long transactions or remote calls inside transactions | Pool wait metrics, transaction duration | Shorten transactions; move remote calls out |
| Sequential outbound calls | Chatty integration, request waterfalls | Trace showing serial spans | Batch API, bounded parallel calls, cache reference data |
| High CPU in serialization | Over-fetching, huge payloads | CPU profile | Smaller responses, pagination, projections, compression where it pays |
| High CPU in a function | Algorithmic complexity (nested loops, repeated parsing, regex) | CPU profile, flame graph | Better algorithm or data structure; precompute |
| Latency spikes, sawtooth memory | Allocation pressure, GC pauses | GC logs, allocation profile | Reduce allocations, stream instead of buffering, right-size heap |
| Throughput plateaus while CPU is low | Lock contention, blocked event loop, thread pool starvation, sync-over-async | Lock/off-CPU profile, event-loop lag | Remove shared locks, move blocking work off the loop, async all the way |
| Spikes when a cache entry expires | Cache stampede | Cache miss bursts aligned with latency | Single-flight, early refresh, TTL jitter |
| Logging dominates | Verbose logging or synchronous appenders in hot paths | Profile | Lower level, async appender, aggregate counts |

## Step 4 — Fix, cheapest effective first

Work down this ladder and stop when the target is met:

1. **Do less work**: remove redundant calls and queries, select fewer columns, paginate, avoid recomputation, return less data.
2. **Do database work better**: indexes, query rewrites, set-based operations, batch writes (`sdlc-be-data-access`).
3. **Overlap independent I/O**: bounded parallelism for independent calls with an overall timeout; never unbounded fan-out.
4. **Cache**: only with a defined staleness, correct invalidation after commit and authorization-aware keys (`sdlc-be-data-access` caching checklist).
5. **Move work off the request path**: asynchronous processing with `202` and status, or precomputation by jobs (`sdlc-be-async-jobs`).
6. **Tune**: pool sizes, runtime/GC settings, worker counts, keep-alive and connection reuse — after the code-level causes are fixed.
7. **Scale out or up**: when the per-request cost is already reasonable; state the cost.

One change per measurement cycle, so each improvement is attributable. Keep a note of what did not help.

Runtime notes (examples, not requirements): JVM — warm up JIT before measuring, read GC logs, watch thread pool and virtual-thread pinning on locks; Node.js — measure event-loop lag, keep CPU-heavy work off the main loop (worker threads), avoid synchronous I/O; Python — the GIL limits CPU parallelism in threads (use processes or native code for CPU-bound work), size worker processes for I/O; Go — profile with the built-in profiler, watch goroutine leaks and allocation in hot paths; .NET — avoid sync-over-async causing thread pool starvation, watch allocations and large-object heap.

## Step 5 — Verify and guard

- Re-run the identical baseline workload; compare percentiles, throughput, error rate and resource use. Report variance; a change smaller than run-to-run noise is not a result.
- Check for regressions elsewhere: memory, database load, downstream call volume, cache memory, correctness tests, authorization tests.
- Add a guard so it cannot silently regress: statement-count assertion, query-plan check, micro-benchmark with threshold for a hot function, load-test threshold in the pipeline, or an SLO alert (`sdlc-be-observability`).

## Load testing plan

| Type | Purpose | Shape |
|------|---------|-------|
| Load | Meet the target at expected peak | Ramp to peak arrival rate, hold |
| Stress | Find the breaking point and failure mode | Increase until errors/latency exceed limits; observe recovery |
| Soak | Find leaks and slow degradation | Expected load for hours |
| Spike | Behavior under sudden bursts | Step from baseline to several times peak |

Plan contents: workload model from production metrics (operation mix, payloads, think time) using an **open arrival-rate model** for public traffic so the tool does not hide queueing (coordinated omission); realistic synthetic data volume; environment parity and its differences stated; outbound partners stubbed; monitoring dashboards open during the run; pass/fail criteria tied to the target; abort criteria (error rate, downstream alarms); owners informed; results archived with configuration.

## Stop conditions

- The target is not agreed, or the workload model is unknown — ask before investing.
- The fix needs a schema change, new infrastructure (cache cluster, broker), a contract change (pagination on an existing endpoint) or relaxed consistency — needs design approval.
- Measurements are too noisy to separate the effect — improve the setup before claiming a result.

## Output template

```markdown
## Performance — <operation / job> (<ticket>)
Target: <metric, percentile, value, workload, environment>
### Baseline
| Metric | Value | Runs / variance |
Environment and data: …
### Hotspot
Evidence: <trace/profile/plan excerpts and where the time goes>
### Changes
| Change | Ladder step | Risk | Flag |
### Result
| Metric | Before | After | Delta |
Regression checks: memory · DB load · error rate · correctness tests · authorization tests
Guard added: <test/alert/benchmark>
### Load test (if run)
Type · model · duration · pass/fail · bottleneck observed
### Not verified / follow-ups
Nothing was committed or pushed; no shared environment was load-tested without approval.
```

## Hand-off

`sdlc-review` → `sdlc-quality-gate` (step 8 with this evidence) → `sdlc-deploy` (watch the same metrics after release) → `sdlc-be-observability` for SLO alerts; capacity findings to `sdlc-sa-nfr-review` and `sdlc-pm-risk-issue`.
