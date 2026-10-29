---
name: sdlc-deploy
description: Plan, execute (only on explicit approval) and verify a deployment through the project's environments — pre-flight checks, ordered steps including migrations, non-production safety, post-deploy smoke and monitoring, and a ready rollback or roll-forward path — and write or follow the runbook. Use when a merged or approved change must reach a test, staging or production environment, or when preparing a deployment runbook.
stage: 6-ship
role: devops
icon: 🛫
mode: acceptEdits
prefer: deploy, deploy-and-verify, deployment
---

# Deploy and verify

Deployment is where reversible work becomes irreversible. The agent prepares, checks and verifies; a human authorizes every step that changes a shared environment.

## Hard guardrails

- **Never deploy, restart services, run migrations, change infrastructure, or toggle feature flags in a shared environment without explicit approval for that specific action in this session.** State the exact command and target first, then wait.
- Shared environments receive code only through the normal path (merge request into the tracked branch, then the pipeline or runbook). Never copy files by hand from an unmerged branch onto a server.
- Never print or paste secrets; load them from the environment or the secret manager.
- If production shows drift (uncommitted changes, hand-applied hotfixes), stop and report; bring the hotfix into version control before deploying over it.

## When to use

- Promoting a change to test/staging/production.
- Writing or updating the runbook for a feature.
- Verifying a deployment someone else performed.

## When not to use

- The quality gate has not passed — go back to `sdlc-quality-gate`.
- Production is currently degraded — follow `sdlc-incident`.

## 1. Local gate (before any shared environment)

- Quality gate passed for the change.
- Migrations applied cleanly to a **disposable database cloned from a clean baseline** (one per branch, named after the scope; never apply feature changes to the baseline itself). Drop it after merge.
- The application starts with no errors (scan start-up logs for errors, stack traces, parse failures) and the changed paths pass a smoke test. For UI: browser automation through the main flow, checked against the acceptance criteria and, if applicable, the prototype (`sdlc-prototype` fidelity check).
- No real outbound side effects during local tests.

## 2. Pre-flight (per environment)

- [ ] Correct artifact/commit/tag identified; it is what was reviewed and gated.
- [ ] Target environment healthy now (dashboards, error rate, recent incidents); no conflicting deployment in progress.
- [ ] Migration plan reviewed (`sdlc-db-migration`): order relative to code, expected duration, lock risk; backup/snapshot taken if any step is destructive.
- [ ] Configuration and secrets present for the new version (names checked, values not printed).
- [ ] Feature flags in the intended state.
- [ ] Rollback or roll-forward path written and feasible given the schema state.
- [ ] People notified per the project's practice; deployment window respected for production.
- [ ] Production: drift check (no local modifications on hosts, running version as expected).

## 3. Environment pipeline

Follow the project's promotion path (typically `feature → integration/test → staging/UAT → production`). Each environment is verified before promoting to the next. If production receives only a subset of what staging has, promote exactly the approved scope (`sdlc-release` → releasing the right scope).

**Non-production safety:** staging and test environments built from production data must stay scrubbed — scheduled jobs that send email/chat/webhooks, payment calls and other outbound integrations disabled or redirected. Some frameworks re-enable jobs or settings on upgrade; re-apply the safety configuration immediately after every deployment to these environments and verify it.

## 4. Execution (after approval)

Typical order — adapt to the runbook:

1. Apply expand-phase migrations (human-run or pipeline-run as the project dictates).
2. Deploy the new version (pipeline job, rolling/blue-green/canary as configured).
3. Run any post-deploy tasks the framework needs (module upgrade, cache/asset purge, search reindex). If front-end assets do not change after a deploy, suspect asset bundles or CDN caches before suspecting code.
4. Re-apply non-production safety settings (non-production only).
5. Enable feature flags gradually if used.

Report each step's command and result as you go; stop on the first unexpected output.

## 5. Post-deploy verification

- Version endpoint/build info shows the expected version.
- Health/readiness checks green; start-up logs free of errors.
- Smoke tests of the changed paths and one or two critical unchanged journeys (log in, open the main screen, perform the core transaction with test data where allowed).
- Error rate, latency and saturation compared with the pre-deploy baseline for a defined observation window (e.g. 15–30 minutes for production).
- Background jobs run (or are correctly disabled in non-production).
- Data verification queries from the migration plan (read-only).

## 6. Rollback / roll-forward decision

Trigger criteria (decide before deploying): smoke failure, error rate or latency beyond the threshold, data verification failure, critical user report.

- **Roll forward** (preferred when the fix is small and quick): a new version reverting or fixing the change.
- **Roll back** (redeploy the previous version) only if the schema is still compatible with it and no irreversible data change happened.
- Disable the feature flag if the change is flagged — often the fastest mitigation.
- Any rollback of production is itself an approved action; record it and open an incident if users were affected (`sdlc-incident`).

## Runbook template (kept in the repository with the feature, scripts versioned alongside it)

```markdown
# Deploy runbook — <feature / service>
Last verified: YYYY-MM-DD · Owner: <role>

## Components
<diagram or list: services, datastores, jobs, external systems touched>
## Pre-flight checklist
## Steps per environment
| Env | Step | Command / pipeline job | Expected result |
## Migrations
<order, duration, lock risk, verification queries>
## Non-production safety settings
## Post-deploy verification
## Rollback / roll-forward
## Known issues and fixes
```

## Output

```markdown
## Deployment — <version> → <environment>
Approved by: <who/when, as stated by the human> · Artifact: <tag/sha>
| Step | Command | Result | Time |
|------|---------|--------|------|
Verification: <health, smoke, metrics vs baseline, data checks>
Decision: SUCCESS | ROLLED BACK | ROLLED FORWARD | NEEDS ATTENTION
Follow-ups: <tickets, runbook updates>
```
