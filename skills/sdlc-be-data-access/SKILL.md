---
name: sdlc-be-data-access
description: Design and review the persistence layer of a backend change — access-pattern inventory, query design, N+1 and ORM pitfalls, indexes checked with query plans, pagination strategies, transaction isolation and retry, optimistic/pessimistic locking and atomic updates, uniqueness and upserts, batch processing, connection-pool sizing and timeouts, caching with correct invalidation and authorization-aware keys, and read-replica consistency — with evidence (plans, statement counts) instead of assumptions. Use when writing or changing repository/DAO code, queries, ORM mappings, caches or bulk data operations, or when a data path is slow or loses updates.
stage: 4-build
role: be
icon: 💾
mode: acceptEdits
prefer: data-access-layer, persistence-patterns, backend-data-access
---

# Backend data access

Most backend outages and data bugs come from the persistence layer: a query without an index on a table that grew, an N+1 in a list endpoint, a lost update under concurrency, a cache that served one tenant's data to another, a pool exhausted by a transaction waiting on the network. This skill makes those decisions explicit and proves them. It complements `sdlc-standards` (`reference/data.md` holds the baseline rules); schema changes themselves go through `sdlc-db-migration`.

## When to use

- New or changed repository/DAO methods, ORM mappings, raw SQL, NoSQL access, stored-procedure calls.
- Bulk reads/writes, exports, imports, backfills executed by application code.
- Introducing or changing a cache, a read replica, locking or isolation settings.
- A data path is slow, deadlocks, or loses/duplicates updates (after `sdlc-debug` localized it there).

## When not to use

- DDL, new indexes, constraints, partitioning — design here, but write and plan them with `sdlc-db-migration`.
- System-wide performance work beyond the data layer — `sdlc-be-performance`.

## Guardrails

- Plans and experiments run on a local or disposable database with realistic volume, never with ad-hoc statements against shared or production databases. Read-only plan inspection on a shared environment only with human approval and only `EXPLAIN` without execution unless approved.
- No production data copied to local machines; use synthetic or scrubbed data.
- Cache keys and replica reads must never weaken authorization or tenant isolation.

## Step 1 — Inventory the access patterns

For every query the change adds or alters, record: caller (use case), frequency (per request, per job run), expected rows scanned and returned, table size now and in a year, latency budget, consistency need (must see own writes? may be stale for N seconds?), and whether it runs inside a transaction. This table drives every later decision and goes into the output.

## Step 2 — Query design rules

- Parameterized only; dynamic identifiers (sort column, direction) from an allowlist map.
- Select only needed columns; project into read models for lists instead of loading full aggregates.
- Sargable predicates: no functions or implicit casts on indexed columns (`UPPER(col)`, `DATE(col)`, comparing a string column to a numeric parameter); transform the parameter instead, or create an expression index deliberately.
- Time ranges are half-open (`>= :from AND < :to`); leading-wildcard `LIKE '%x'` cannot use a normal index — use full-text or trigram search where needed.
- `OR` across different columns and `NOT IN` with nullable columns often defeat indexes or produce wrong results; rewrite (`UNION ALL`, `NOT EXISTS`).
- Existence checks use `EXISTS` / `LIMIT 1`, not `COUNT(*)`. Aggregate in the database, not in application memory.
- Large `IN` lists are chunked (engines have parameter limits and plan-cache issues).
- Every list query is bounded by pagination or an explicit limit.

## Step 3 — ORM pitfalls (check each)

- [ ] **N+1**: relations accessed in a loop. Fix with join fetch, batch/`IN` loading or a dedicated projection query. Prove it with a statement-count assertion in an integration test.
- [ ] **Fetch join + pagination**: some ORMs paginate in memory when a collection is fetch-joined — page ids first, then fetch details for those ids.
- [ ] **Cartesian explosion**: fetching two collections of the same parent in one join multiplies rows; split queries.
- [ ] **Lazy loading outside the transaction** (or a request-scoped open session hiding it): map to DTOs inside the use case.
- [ ] **Bulk work through entities**: loading thousands of entities to change one field; use a set-based update and remember it bypasses entity callbacks and caches.
- [ ] **Session/unit-of-work growth** in batch jobs: flush and clear per chunk.
- [ ] **Implicit writes**: dirty checking flushing unintended changes; read-only transactions or detached reads for queries.
- [ ] Generated SQL inspected for every new query (enable SQL logging in tests, not in production).

## Step 4 — Indexes and query plans

1. Load a realistic volume (or use statistics from a production-like copy) — plans on ten rows tell you nothing.
2. Capture the plan with the engine's `EXPLAIN` (with actual execution statistics locally). Look for: full scans on large tables, row-estimate errors of orders of magnitude, sorts or hashes spilling to disk, nested loops over large inputs, filters applied after reading many rows.
3. Design composite indexes by access pattern: equality columns first, then the range column, then sort columns; include projected columns for covering indexes when it pays off; use partial/filtered indexes for skewed predicates (`WHERE deleted_at IS NULL`, `status = 'PENDING'`).
4. Weigh write cost: every index slows inserts/updates and uses memory. Remove or avoid redundant indexes (a prefix of an existing composite).
5. Hand the index to `sdlc-db-migration` (online/concurrent creation). Record before/after plans and timings in the output.

## Step 5 — Pagination strategies

| Strategy | Use when | Notes |
|----------|----------|-------|
| Offset/limit | Small, stable sets; admin screens needing page numbers | Cost grows with offset; rows shift when data changes |
| Keyset (seek) | Large or changing data, feeds, infinite scroll, APIs | `WHERE (created_at, id) < (:c, :id) ORDER BY created_at DESC, id DESC`; needs an index matching the order and a unique tie-breaker |
| Opaque cursor | Public APIs | Encoded keyset values plus filter fingerprint; validate on use |
| Streaming/export | Full extracts | Server-side cursor or chunked keyset, outside request time limits (`sdlc-be-async-jobs`) |

## Step 6 — Transactions and isolation

- Know the engine's default isolation level and what it allows (non-repeatable reads, phantoms, write skew). Choose the lowest level that is correct **combined with** explicit protection (conditional updates, locks, constraints) for the specific invariant.
- Serializable or repeatable-read transactions can fail with serialization errors by design: retry the whole transaction, bounded, with backoff.
- Deadlocks: acquire locks in a consistent order (sort ids before locking several rows), keep transactions short, retry the whole transaction.
- No remote calls, no user waits, no large computations inside a transaction; read-only transactions for reads.

## Step 7 — Locking and atomic updates

| Need | Technique | Watch out for |
|------|-----------|---------------|
| Decrement/increment with a limit | Atomic conditional update, check affected rows | Return a domain error when 0 rows changed |
| Concurrent edits by users | Optimistic version column / ETag | Conflict → 409; do not silently overwrite |
| Short exclusive section on known rows | `SELECT … FOR UPDATE` with lock timeout (or `NOWAIT`) | Lock order; never hold across remote calls |
| Work queue in a table | `FOR UPDATE SKIP LOCKED` claim + status + lease expiry | Reclaim expired leases; idempotent processing |
| Cross-process mutual exclusion | Database advisory lock or a lease with fencing token | Last resort; locks expire while work continues — fence writes |
| "Only one" rule | Unique (partial) constraint | Map the violation to a domain conflict |

Upserts use the engine's atomic construct (`INSERT … ON CONFLICT`, `MERGE`, conditional writes) rather than check-then-insert, which races.

## Step 8 — Batch operations

- Process in bounded chunks (by primary-key or keyset ranges), commit per chunk, store a checkpoint so the run is resumable and idempotent.
- Use the driver's batch/bulk APIs for inserts; set-based statements for updates; streaming reads with a fetch size instead of loading everything.
- Throttle between chunks on shared databases; log progress with counts; never one giant transaction or one statement over a whole large table.

## Step 9 — Connection pools

- Size from the database's connection limit divided across all instances and replicas of all services that share it — a pool per instance × instance count must stay below the server's limit with headroom. Bigger pools are not faster beyond the database's concurrency.
- Set acquire timeout (fail fast instead of piling up), connection/socket timeouts, statement/query timeouts, idle and max lifetime below network/firewall idle limits; enable leak detection in non-production.
- Pool exhaustion is usually a symptom (long transactions, remote calls inside transactions, leaks, slow queries) — fix the cause before raising the size.
- Expose pool metrics (active, idle, pending, acquire time) via `sdlc-be-observability`.

## Step 10 — Caching

Cache only when data is read far more than written, a defined staleness is acceptable, and the uncached path is measurably expensive.

- [ ] Pattern chosen: cache-aside (default), read-through, write-through; invalidate or update **after commit**, not before.
- [ ] Keys include every dimension that changes the result — tenant, user or permission scope, locale, version. Never cache per-user or per-tenant data under a shared key.
- [ ] TTL with jitter; stampede protection (single-flight/locking per key or early refresh) for hot keys.
- [ ] The cache is optional: on cache failure or timeout fall back to the source; short timeouts on cache calls.
- [ ] Bounded size and eviction policy; serialized format versioned so a deploy does not read incompatible entries.
- [ ] Negative results cached only briefly and deliberately; sensitive data cached only if allowed and encrypted where required.
- [ ] Hit ratio, latency and evictions measured.

## Step 11 — Read replicas and NoSQL

- Replicas lag. Route read-your-own-writes and check-then-act reads (including authorization decisions that must be current) to the primary; use replicas for reports, searches and tolerant reads; measure lag.
- NoSQL: model from access patterns; choose partition keys that spread load (no hot partition such as "today's date"); use conditional writes/version attributes for concurrency; state the read consistency level per query.

## Tests and evidence

Integration tests against the real engine (container/emulator) with migrations applied: query results and scoping, statement-count assertions for N+1, concurrency tests (parallel updates → no lost update, defined conflict), constraint-violation mapping, pagination boundaries, cache invalidation after update, batch resumability. Plans captured on realistic volume for new queries on large tables.

## Stop conditions

- Table sizes, growth or traffic are unknown for a query on a potentially large table — ask before choosing an approach.
- The correct consistency (may it be stale? may two users edit at once?) is a business decision not in the design — ask.
- The fix needs an index, constraint or schema change — route to `sdlc-db-migration`.

## Output template

```markdown
## Data access — <ticket>
### Access patterns
| Query (repository method) | Caller | Frequency | Rows scanned/returned | Table size | Consistency | Plan/index |
### Decisions
Isolation and retry: … · Locking/atomic updates: … · Pagination: … · Pool settings: … · Cache: <pattern, key, TTL, invalidation> · Replica use: …
### Evidence
| Query | Plan before | Plan after | Time before/after (volume) |
Statement-count assertions: … · Concurrency test: …
### Migration needs (for sdlc-db-migration)
### Not verified
```

## Hand-off

Index/constraint/schema needs → `sdlc-db-migration`; endpoint wiring → `sdlc-be-endpoint`; broader latency work → `sdlc-be-performance`; then `sdlc-review` → `sdlc-quality-gate` (step 8 performance evidence).
