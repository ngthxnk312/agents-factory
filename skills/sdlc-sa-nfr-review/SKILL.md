---
name: sdlc-sa-nfr-review
description: Turn vague quality expectations into measurable non-functional requirements and check an architecture against them — quality-attribute scenarios with thresholds and measurement methods, a prioritised utility tree, top drivers and their trade-offs, fitness functions for continuous verification, and a structured architecture review (risks, sensitivity and trade-off points, non-risks) ending in a fit / fit-with-conditions / not-fit verdict. Use when requirements say "fast", "secure", "scalable" or "highly available" without numbers, before approving a solution design, or when reviewing an existing architecture for fitness.
stage: 3-design
role: sa
icon: 🎯
mode: plan
prefer: nfr-analysis, architecture-review, sa-nfr-analysis
---

# Non-functional requirements and architecture review

Non-functional requirements decide the architecture far more than features do — and they are the ones nobody writes down properly. Your job: make each one measurable, rank them, expose the trade-offs, and judge whether a design will actually meet them. A requirement without a number and a way to measure it is a wish.

## When to use

- **Mode A — NFR analysis:** requirements or a brief contain quality words without numbers; a solution design needs its drivers; a contract needs service levels.
- **Mode B — Architecture review:** a solution or technical design must be approved, or an existing system is suspected not to meet its quality goals.

## When not to use

- Designing the solution itself → `sdlc-sa-solution-design` (it calls this skill for drivers and review).
- Code-level review → `sdlc-review`; running performance tests → `sdlc-test` / the project's tooling.

## Quality attributes to cover

| Attribute | Typical measures |
|---|---|
| Performance | latency p50/p95/p99 per operation, throughput, resource use per request |
| Scalability / capacity | peak concurrent users, requests or messages per second, data growth per year, headroom % |
| Availability | SLO % per user journey, error budget, maintenance windows |
| Reliability and resilience | RPO, RTO, graceful degradation, failure isolation, recovery time from dependency outage |
| Security | authentication strength, authorisation granularity, vulnerability SLAs, secrets rotation, audit coverage |
| Privacy and compliance | data classification, residency, retention and deletion, consent, regulatory controls |
| Observability | time to detect, time to diagnose, trace coverage, alert precision |
| Maintainability / testability | change lead time, test coverage on critical paths, module coupling rules |
| Deployability / portability | deploy frequency, deploy duration, rollback time, environment parity |
| Interoperability | supported protocols and versions, backward compatibility window |
| Usability / accessibility | task completion time, accessibility conformance level, supported devices |
| Cost efficiency | run cost per month or per transaction, cost growth vs load |

## Mode A — NFR analysis

1. **Collect sources:** requirements, contracts and SLAs, regulations, current production metrics, business volumes (users, transactions, peak periods, growth), incident history.
2. **Write quality-attribute scenarios** — the unit of a testable NFR:
   `Source → Stimulus → Environment → Artifact → Response → Response measure`.
   Example: "500 concurrent customers (source) submit transfers (stimulus) during month-end peak (environment) against the transfer service (artifact); requests are processed (response) with p95 ≤ 800 ms and error rate < 0.1% (measure)."
3. **Quantify every vague word** with a metric, threshold, measurement method, environment and owner. Derive numbers from business data (peak = daily volume × peak-hour share ÷ 3600 × safety factor) and show the calculation. If the business cannot give a number, propose one with its rationale and mark it `[ASSUMPTION]` for approval.
4. **Detect conflicts** (for example strong consistency vs availability across regions, encryption overhead vs latency, cost vs redundancy) and state the trade-off that someone must decide.
5. **Prioritise with a utility tree:** each scenario rated business importance (H/M/L) and technical difficulty (H/M/L); the H/H scenarios are the architecture drivers — usually about five.
6. **Define fitness functions** — how each driver is verified repeatedly: load test in the pipeline with a threshold, SLO dashboards and burn-rate alerts, dependency and vulnerability scans, architecture rules as tests (allowed layer dependencies), restore drills for backups, chaos/fault-injection tests, cost alerts. State trigger (per commit, nightly, per release, continuous).

## Mode B — Architecture review

1. **Inputs:** the design (solution or technical), the NFR scenarios (run Mode A first if missing), the current system evidence.
2. **For each top scenario,** identify the architectural approaches the design uses to meet it, then record:
   - **Risks** — decisions that may prevent meeting the scenario;
   - **Sensitivity points** — parameters the response depends on strongly (pool sizes, cache TTL, partition key);
   - **Trade-off points** — decisions that help one attribute and hurt another;
   - **Non-risks** — decisions confirmed adequate (record them; they matter for future changes).
3. **Checklist sweep** (apply what is relevant):
   - single points of failure; capacity headroom; scaling model and its limits;
   - timeouts on every remote call, retry policy with backoff and limits, circuit breakers, bulkheads, back-pressure;
   - idempotency of writes and message handling; unknown-outcome handling; ordering; duplicate delivery;
   - cache consistency and invalidation; data growth, indexing, partitioning, archival;
   - object-level authorisation, input validation, secrets, sensitive data in logs, audit trail, rate limiting and abuse;
   - correlation ids end to end, actionable alerts, runbooks;
   - deploy and rollback path, schema compatibility during rolling deploys, feature flags;
   - backup, restore tested, RPO/RTO achievable; dependency on single vendors;
   - run cost at expected and peak load.
4. **Classify findings:** Blocker (a top scenario will not be met, or a security/data-loss exposure) · Major (likely miss or significant operational risk) · Minor (improvement). Each with evidence and a recommendation.
5. **Verdict:** **Fit** · **Fit with conditions** (conditions with owners and due dates, approved by the decision maker) · **Not fit** (blockers listed). The verdict is a recommendation; the approver decides.

## Guardrails

- Never invent production metrics; cite sources or label numbers as assumptions.
- Never weaken a security, privacy or compliance requirement to make a design pass; escalate it as a trade-off decision.
- Load or chaos tests against shared environments only with explicit approval.

## Stop conditions

- No volumes or business data to derive thresholds and nobody to confirm assumptions — deliver scenarios with proposed numbers marked for approval, not as facts.
- Conflicting NFRs whose resolution is a business decision.

## Output templates

```markdown
## NFR catalogue — <system / initiative> · DRAFT
| ID | Attribute | Scenario (source → stimulus → environment → artifact → response) | Measure / threshold | Method | Importance | Difficulty | Owner | Source / assumption |
Drivers (H/H): NFR-…
Conflicts: <NFR-a vs NFR-b — decision needed from …>
| Fitness function | Verifies | Mechanism | Trigger | Threshold |
```

```markdown
## Architecture review — <design name vN> · YYYY-MM-DD
Scope · inputs · reviewers
| Scenario | Approaches | Risks | Sensitivity points | Trade-offs | Non-risks |
| # | Severity | Finding | Evidence | Recommendation | Owner |
Verdict (recommendation): FIT | FIT WITH CONDITIONS | NOT FIT
Conditions / blockers: …
```

## Hand-off

Drivers and fitness functions feed `sdlc-sa-solution-design` sections 8 and 13; measurable NFRs go back to `sdlc-ba-requirements` (and the SRS NFR section, `sdlc-ba-srs`); review findings become risks in `sdlc-pm-risk-issue` and tasks via `sdlc-breakdown`; fitness functions become tests and gates (`sdlc-test`, `sdlc-quality-gate`).
