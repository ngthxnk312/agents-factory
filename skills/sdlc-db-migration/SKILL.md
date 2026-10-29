---
name: sdlc-db-migration
description: Plan and write safe, reviewable database schema and data migrations — forward-only, expand/migrate/contract for zero downtime, batched backfills, lock-aware DDL, verification queries and a written rollback or compensation plan — without executing anything against shared environments. Use whenever a change adds, alters or removes tables, columns, indexes or constraints, moves or backfills data, or partitions a table.
stage: 3-design
role: dev
icon: 🗄
mode: acceptEdits
prefer: db-migration, database-migration, database-migrations
---

# Database migration (safe schema and data change)

Tool-agnostic: works with migration frameworks (Flyway, Liquibase, Alembic, Django/Rails/Prisma/EF migrations, Knex, golang-migrate), ORM-generated schema, or hand-written versioned SQL. What matters are the principles. See also `sdlc-standards` → `reference/data.md`.

## When to use

- Any DDL: create/alter/drop table, column, index, constraint, view, partition.
- Data migrations and backfills, column renames and type changes, splitting or merging tables.
- Introducing partitioning on a time-growing table.

## Hard guardrails

- **You write migrations; humans run them on shared environments.** Never execute DDL (`CREATE/ALTER/DROP/TRUNCATE/GRANT/REVOKE`) or bulk DML against staging, production or any shared database. Running against a local, disposable database you created is allowed and expected.
- Never edit a migration that has already run in a shared environment; add a new one.
- Never put credentials or production hostnames in migration files or the plan.
- Large backfills on production are run by a human under supervision, after the plan is approved.

## Principles

1. **Forward-only in production.** Mistakes are fixed with a compensating migration, not by "undoing" in place. Down-migrations are useful locally but are not a production rollback plan.
2. **A written rollback/compensation plan exists before anything runs.**
3. **Versioned and reviewed like code**, in the repository, in the project's migration directory and naming scheme.
4. **Schema change is decoupled from code deploy** so each can roll out independently; old and new application versions must both work with the schema during a rolling deploy.
5. **Idempotent where possible** (`IF NOT EXISTS`, guarded data updates) so re-runs do not corrupt data.

## Expand → migrate → contract

Never rename, retype or drop something in use in a single step.

1. **Expand** (release N): add without breaking — new nullable column, new table, new index (built online/concurrently where supported). Old code keeps working.
2. **Migrate** (release N / N+1): deploy code that writes both old and new (dual write) or reads new with fallback; backfill existing rows in batches; switch reads to the new structure; verify.
3. **Contract** (release N+2 or later): once nothing reads or writes the old structure (verified by code search and, ideally, metrics/logs), drop it.

Common recipes:

| Change | Safe sequence |
|--------|---------------|
| Add NOT NULL column | add nullable (or with a constant default if the engine does it without rewrite) → backfill in batches → add NOT NULL / validate constraint |
| Rename column | add new → dual write → backfill → switch reads → stop writing old → drop old later |
| Change column type | add new column with new type → dual write → backfill with conversion → switch → drop old |
| Add index on large table | create concurrently/online; never inside a long transaction on a hot table |
| Add foreign key / check | add as not-validated (if supported) → fix violating data → validate |
| Drop column/table | remove all code usage first and deploy → wait one release → drop |
| Partition existing large table | new partitioned table → dual write or change-capture → batched backfill → switch → retire old (own plan, DBA review) |

## Avoiding locks and incidents

- Know which operations rewrite the table or take exclusive locks on your engine and version; check before writing them.
- Set lock/statement timeouts for DDL so it fails fast instead of queueing behind traffic.
- Run heavy DDL outside peak hours; state the expected duration based on table size.
- Backfill in bounded batches (e.g. by primary-key ranges) with a pause between batches and a progress log; make the backfill resumable.
- Never `UPDATE`/`DELETE` an entire large table in one statement.
- For ORM frameworks that auto-sync schema from models, simple additive fields may be generated automatically, but renames, type changes, data moves and constraint tightening still need an explicit migration script.

## Procedure

1. **Inventory.** Read the current schema (migrations, models, or schema dump) and every code path that reads or writes the affected tables (search the whole repository, including jobs, reports and other services if known). Note table sizes if available.
2. **Classify** each change: additive, expand-phase, data migration, contract-phase, or destructive.
3. **Design the sequence** across releases using expand → migrate → contract. Decide whether a feature flag is needed.
4. **Write the migration files** following the project's tool and naming. Keep schema and data migrations in separate files/steps.
5. **Write verification queries**: row counts, null counts, constraint checks, sample comparisons between old and new columns.
6. **Write the rollback/compensation plan** for each step and state what is irreversible (dropped data, lossy conversion). For destructive steps, specify a backup or snapshot requirement.
7. **Test locally** on a disposable database cloned from a clean baseline (per-branch database named after the scope); run the migration, run it again to check idempotency, run the app and tests against it, and test the compensation path.
8. **Partitioning decision** for new time-growing tables (granularity, retention) — record it in an ADR.
9. **Produce the runbook section** for `sdlc-deploy`: order relative to code deploy, expected duration, lock risk, verification, monitoring, rollback.

## Pre-run checklist (for the human who runs it)

- [ ] Migration is versioned, reviewed and idempotent or guarded.
- [ ] Rollback/compensation plan written; irreversible steps called out; backup taken if destructive.
- [ ] Expand/contract respected; old and new code both work during rollout.
- [ ] No long exclusive locks on large/hot tables; lock timeout set; online index creation used.
- [ ] Backfill batched, throttled, resumable, with progress logging.
- [ ] Tested on a lower environment with realistic data volume.
- [ ] Verification queries ready; monitoring watched during the run.

## Stop conditions

- The change requires dropping or irreversibly transforming data — get explicit owner approval.
- Table size, traffic or engine version is unknown for a potentially locking operation — ask before choosing an approach.
- Other services or reports may use the table and you cannot verify — ask.

## Output template

```markdown
## Migration plan — <change> (<ticket>)
Engine/version: … · Tool: … · Tables affected (approx. rows): …

| Step | Release | Type | File | Lock/rewrite risk | Est. duration | Rollback / compensation |
|------|---------|------|------|-------------------|---------------|-------------------------|
| 1 | N | expand | `migrations/V42__add_x.sql` | none (nullable add) | <1s | drop column (no data yet) |

### Code changes coordinated with each step
### Backfill
Batch size · ordering key · throttle · resumability · progress logging
### Verification queries
### Irreversible steps and backups
### Local test evidence
<commands run on the disposable database and results>
### Runbook notes for sdlc-deploy
```
