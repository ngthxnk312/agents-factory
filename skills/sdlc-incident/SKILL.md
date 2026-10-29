---
name: sdlc-incident
description: Handle a production problem safely — triage severity, gather read-only evidence, propose mitigation for human approval, diagnose the root cause, plan safe data corrections, and write a blameless postmortem with follow-up actions. Use when users or data in production are affected, when diagnosing production-only behavior or data, or when asked to fix production data.
stage: 7-operate
role: devops
icon: 🚨
mode: plan
prefer: incident-response, incident, prod-diagnostics
---

# Incident handling and production diagnostics

In production, the first job is to stop the harm, the second is to understand it, the third is to make sure it does not happen again. Every action that changes production is a human decision.

## Hard guardrails

- **Read-only by default.** Logs, metrics, traces, dashboards, and `SELECT` queries only. No `UPDATE`, `DELETE`, DDL, restarts, config changes, flag toggles or deployments without explicit approval of that exact action.
- **Never experiment on production.** Reproduce in a lower environment with scrubbed production-like data.
- **Data corrections go through the application layer or a reviewed script**, never ad-hoc SQL typed into a production console. Scripts are idempotent, scoped by explicit ids, dry-run first, logged, and executed by a human.
- **Check for drift before changing anything on a host**: uncommitted changes or hand-applied hotfixes (`git status`/`git diff` in deployed checkouts, running version vs expected). Bring hotfixes into version control first.
- Credentials come from the environment/secret store; never paste them into chat, tickets or documents. Mask personal data in every artifact you produce.
- Keep exploit details of security incidents out of public channels.

## When to use

- Production errors, outages, degraded performance, wrong data, security alerts, failing scheduled jobs.
- "User X cannot see/do Y in production."
- A request to fix production data.

## Phase 1 — Triage (minutes)

1. **What is the impact?** Who and how many are affected, which functions, since when, is data being corrupted or exposed, is money involved.
2. **Assign severity** (use the project's scale if it has one):

   | Sev | Definition | Response |
   |-----|------------|----------|
   | SEV1 | Outage of a critical function, data loss/exposure, money at risk | Mitigate immediately; owner and stakeholders informed now |
   | SEV2 | Major degradation or a critical function failing for a subset | Mitigate within the hour |
   | SEV3 | Minor function broken, workaround exists | Fix in normal flow |
   | SEV4 | Cosmetic / no user impact | Backlog |

3. **What changed recently?** Deployments, config/flag changes, migrations, dependency or infrastructure changes, traffic changes, external provider incidents.
4. Start an **incident timeline** (UTC timestamps) and keep it updated.

## Phase 2 — Mitigate (proposal → approval → action)

Choose the fastest safe option and propose it with its risk:

- disable the feature flag;
- roll back or roll forward the last deployment (`sdlc-deploy`), only if the schema allows;
- scale or restart a component;
- pause a misbehaving job or consumer;
- block an abusive client;
- put a function into maintenance/read-only mode.

Mitigation is not the fix. Record what was done, when, and by whom.

## Phase 3 — Diagnose (read-only)

- Correlate: error logs by correlation id, traces, metrics around the start time, deployment markers.
- Query data read-only, with explicit limits and narrow predicates; never run heavy queries on a struggling primary — use a replica if available.
- Typical production-only causes: configuration or secret differences, data shapes not present in test data, time zones (jobs running in UTC vs local business cut-offs), caches (application, CDN, front-end asset bundles), permission inheritance (a menu/page/resource visible only if every ancestor or group in the chain grants it — check the whole chain, including implied/inherited groups), resource exhaustion (connection pools held during remote calls), external provider changes, schema drift between environments, version skew between services.
- Reproduce in a lower environment, then apply `sdlc-debug` phases 2–4 for the root cause and fix.

## Phase 4 — Data correction (if needed)

1. Define the exact affected set with a read-only query; record counts and ids (not personal values).
2. Write a correction script that uses the application's domain layer (ORM/service/admin command) or a reviewed migration — idempotent, scoped by ids, with a dry-run mode that prints what would change.
3. Back up the affected rows (or snapshot) before applying.
4. Test it in staging on a copy.
5. Hand it to a human to execute in production; verify afterwards with read-only queries.

## Phase 5 — Resolve and learn

- Confirm recovery with metrics and user-facing checks; close the timeline.
- Write a **blameless postmortem** within the project's agreed time. Focus on systems and conditions, not individuals.
- Root cause analysis: ask "why" until you reach a cause that a change in process, code or design can remove (often 3–5 levels). Distinguish trigger, root cause and contributing factors.
- Every action item has an owner, a ticket and a due date; prefer actions that prevent the class of problem (tests, guards, alerts, constraints) over "be more careful".
- Feed the lesson into the System Context `anti-patterns.md` (`sdlc-system-context`) and runbooks (`sdlc-docs`).

## Stop conditions

- Any production-changing action without explicit approval — stop and ask.
- You lack access or evidence to diagnose — say exactly what you need (log query, dashboard, read-only DB access) rather than guessing.
- Evidence suggests a security breach — escalate to the human immediately; preserve evidence; do not tip off or alter systems.

## Output templates

Status update (during the incident):

```markdown
**[SEV<n>] <title>** — <UTC time>
Impact: <who/what> · Status: investigating | mitigated | resolved
Current hypothesis: … · Next action (awaiting approval?): … · Next update: <time>
```

Postmortem:

```markdown
# Postmortem — <title> (<date>)
Severity · Duration (detect → mitigate → resolve) · Authors · Status

## Summary
## Impact            <users, functions, data, money; numbers>
## Timeline (UTC)
## Root cause        <trigger, root cause, contributing factors; evidence>
## Detection         <how we found out; how we should have>
## Mitigation and resolution
## What went well / what went poorly / where we got lucky
## Action items
| Action | Type (prevent/detect/mitigate) | Owner | Ticket | Due |
## Lessons for anti-patterns catalog
```
