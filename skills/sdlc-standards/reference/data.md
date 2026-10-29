# Data and database

Applies to ORMs, query builders, raw SQL, stored procedures and NoSQL stores alike.

## 1. Injection-proof queries (no exceptions)

- Always use bind variables / parameterized queries. Never concatenate or interpolate input into a query string.
- Dynamic identifiers (sort column, direction, table) come from an allowlist mapping, never from raw input.
- Prefer the ORM/query builder when it can express the query; when raw SQL is needed, parameterize it and keep it in the data-access layer.

```
-- Wrong
"SELECT * FROM customer WHERE phone = '" + phone + "'"
-- Right
"SELECT id, name FROM customer WHERE phone = :phone"   -- bind :phone
```

## 2. Query performance

- Do not wrap indexed columns in functions in `WHERE` (`UPPER(col)`, `DATE(col)`, `CAST(col)`, `COALESCE(col, …)`) — it defeats the index. Transform the parameter instead, or add a functional/expression index deliberately.
- Query date/time columns with half-open ranges (`>= :from AND < :to`), not equality on a truncated value.
- Avoid N+1: fetch related data deliberately (joins, batch loading, prefetch), never query inside a loop.
- Select only the columns you need on wide tables.
- Batch bulk writes; do not issue one statement per row in a loop.
- Every list query is bounded (pagination or an explicit limit).
- Check the query plan for new queries on large tables; add indexes as part of the change (see `sdlc-db-migration` for creating them safely).

## 3. Types

- Money: exact decimal types (`DECIMAL/NUMERIC`, `BigDecimal`, `Decimal`, integer minor units). Never binary floating point. Store the currency (ISO 4217) next to the amount.
- Time: store instants in UTC with a timezone-aware type; use the language's modern date/time API; convert to local time only at the presentation edge. Business dates (a calendar day) are stored as dates, not midnight timestamps.
- Enums: map explicitly by name/code, never by ordinal position.
- Identifiers: use the database's sequence/identity or UUIDs consistently; do not invent ids in application code for tables that use sequences.

## 4. Transactions

- Transaction boundaries belong to the service layer — not the entry point, not the repository.
- Read-only operations use read-only transactions where supported and release connections quickly.
- **Never hold a transaction or connection open while calling a remote system** (HTTP, gRPC, cache, message broker, email). Commit/release first, then call out; use an outbox or a follow-up state for consistency.
- Do not mix two persistence mechanisms (e.g. ORM and raw driver on separate connections) inside one logical transaction.
- Make concurrency explicit: optimistic version columns, conditional updates (`UPDATE … WHERE version = :v`), or row locks — chosen deliberately.
- Idempotency for state-changing operations that may be retried: unique constraints on idempotency keys or natural keys.

## 5. Entities and mapping

- Business records carry audit fields (`created_at`, `created_by`, `updated_at`, `updated_by`) using the project's base entity/mixin if one exists.
- Prefer soft delete (`deleted_at`, `deleted_by`) for business data that may need audit or recovery; hard delete only for truly disposable data or legal erasure.
- Never expose persistence entities through APIs; map to DTOs (see `architecture.md`).
- Constraints belong in the database too (NOT NULL, UNIQUE, FK, CHECK) — application validation is not enough for integrity.

## 6. Time-growing tables — consider partitioning early

Tables that only grow with time (transactions, payment logs, audit trails, events, notifications, metrics):

- Decide on partitioning **at creation time** when the time column is the main query axis and growth is high. Retrofitting a large table is an expensive migration.
- Use range partitioning on the time column. Choose granularity from real volume and retention: monthly by default; daily for very high volume or daily retention; quarterly/yearly for slow growth.
- Data lifecycle becomes cheap: drop or detach old partitions instead of mass `DELETE` (which locks, bloats and floods logs).
- Queries must include the partition key as a range predicate so the planner can prune partitions.
- Syntax differs by engine (declarative range partitioning in PostgreSQL, interval partitioning in Oracle, range partitioning in MySQL where the partition key must be part of every unique key). Follow the engine's rules.
- Retrofitting an existing large table follows expand → migrate → contract (new partitioned table, batched backfill, switch reads/writes, drop old) with its own plan and DBA review.
- Record the decision (granularity, retention, rationale) in an ADR.

## 7. Schema migrations (summary — full procedure in `sdlc-db-migration`)

- Versioned migration files, reviewed like code; never edit a migration that has run in a shared environment.
- Forward-only in production; fix mistakes with a compensating migration. Every change has a written rollback/compensation plan before it runs.
- Expand → migrate → contract for anything in use: add (nullable/new) → backfill in batches → switch reads/writes → remove the old in a later release.
- Avoid long locks on large tables; use online/concurrent operations where supported.
- Frameworks that auto-generate schema from models still need explicit migration scripts for renames, type changes, data moves and constraint tightening.
- Agents never run DDL (`CREATE/ALTER/DROP/TRUNCATE/GRANT/REVOKE`) or bulk DML against shared or production databases. Local, disposable databases are fine.

## 8. Test and diagnostic databases

- Keep a clean, immutable baseline (fresh install or a scrubbed production copy). Never apply feature changes directly to it.
- Create one disposable database per feature/branch, cloned from the baseline and named after the branch scope (e.g. `test_<scope>`); drop it when the branch is merged. Name throwaway databases so they are obviously disposable.
- Production diagnostics are read-only (`SELECT` only). Data corrections go through the application layer or a reviewed migration/script, never ad-hoc `UPDATE`/`DELETE`. See `sdlc-incident`.

## Checklist

- [ ] All queries parameterized; dynamic identifiers allowlisted.
- [ ] No functions on indexed columns in WHERE; date ranges; no N+1; bounded lists.
- [ ] Exact decimals for money; UTC instants; enums by name.
- [ ] Transactions in the service layer; nothing remote inside a transaction.
- [ ] Entities not exposed; audit fields and DB constraints present; soft delete where appropriate.
- [ ] Time-growing tables evaluated for partitioning.
- [ ] Schema change follows `sdlc-db-migration`; no DDL run by the agent on shared environments.
