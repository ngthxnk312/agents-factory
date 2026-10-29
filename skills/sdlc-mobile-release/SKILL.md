---
name: sdlc-mobile-release
description: Prepare and run a mobile app release safely — version name and build number rules, production flavor configuration checks, release build hardening (non-debuggable, shrinking/obfuscation, pinning, logging), signing through the secret store, symbol/mapping upload, internal and beta tracks, store listing and privacy declarations, review submission, staged rollout with crash and rating monitoring, halt and hot-fix strategy, minimum-version enforcement and backend compatibility with old app versions. Use when an Android, iOS or cross-platform app version must be built for testers or shipped to app stores; never signs with production keys, uploads or publishes without explicit approval.
stage: 6-ship
role: mobile
icon: 📦
mode: acceptEdits
prefer: mobile-release, app-store-release, store-release
---

# Mobile release

A mobile release cannot be rolled back: once a binary is on a device it stays there until the user updates. Releases are therefore **forward-only**, staged, monitored and designed so that the backend keeps serving every supported old version. Use `sdlc-release` for commit messages, changelog and versioning conventions; this skill adds the app-specific steps. `sdlc-deploy` covers backend services that the app depends on.

## Hard guardrails

- Never commit, print or paste signing keys, keystore passwords, provisioning profiles, store API credentials or service-account files. They live in the secret store/CI; locally only if the human provides them through the environment.
- **Upload to any store track, submission for review, rollout percentage changes, halts and publishing happen only after explicit human approval for that specific action.** Prepare everything; execute on approval.
- Never build a production-flavor binary that points at non-production services, or a test build that points at production, unless the project explicitly defines such a variant.
- Do not alter store listings, pricing, privacy declarations or age ratings without approval from their owner.

## When to use

- A tested build must go to internal testers, beta testers or the stores.
- Preparing release notes, store metadata and the rollout plan for a version.
- Hot-fix releases.

## When not to use

- Feature implementation — `sdlc-mobile-implement`. Release readiness decision — `sdlc-qa-test-report` (and `sdlc-pm-quality` at project level).

## Procedure

### 1. Readiness

- QA report recommends Go or Conditional go for **this exact build** (`sdlc-qa-test-report`); conditions listed and owned.
- `sdlc-quality-gate` passed on the release commit; release branch/tag strategy per `sdlc-release`.
- Backend changes the version depends on are already deployed and backward compatible (old app versions still work against the new backend).
- Feature flags for unfinished or risky features default to off in production config.

### 2. Versioning

- Version name follows the project's scheme (semantic `MAJOR.MINOR.PATCH` by default); build number/version code strictly increases for every upload, per platform; never reuse a build number.
- The same version name on iOS and Android corresponds to the same feature set unless the project states otherwise.
- Record version, build numbers and the commit SHA in the release notes.

### 3. Release build configuration check

| Check | Expectation |
|-------|-------------|
| Flavor/scheme | Production; correct application id / bundle id, app name, icons |
| Endpoints and config | Production values from flavor config; no debug menus, test hooks, mock servers or verbose logging |
| Debuggability | Not debuggable; developer options/screens excluded |
| Shrinking/obfuscation | Enabled; rules keep only what reflection/serialization needs; app smoke-tested **in release mode** (obfuscation bugs appear only there) |
| Security | Certificate pinning and app-protection enabled as in policy; no cleartext traffic allowed |
| Permissions and entitlements | Only those needed; each justified in store declarations |
| Target/min OS | Meet current store requirements and the project's support policy |
| Third-party SDKs | Production keys via config; data collection matches privacy declarations |
| Size | Compare with previous release; investigate unexpected growth |

### 4. Build and sign

- Build with the project's release command per platform (store bundle/archive formats) from a clean checkout of the tagged commit — preferably in CI so the build is reproducible.
- Signing happens in CI or a controlled machine with keys from the secret store; use the store's app-signing service where the project enrolled. Verify the signature/certificate fingerprint of the output.
- Upload crash-symbolication files and obfuscation mapping files for **this** build to the crash reporter (otherwise production crashes are unreadable).
- Archive artifacts (binary, mappings, symbols, build log, SBOM if produced) with the version.

### 5. Pre-store verification

Install the signed release binary (not the debug build) on real devices for each platform: fresh install, **upgrade from the currently live version with real local data** (database migrations, stored session, cached settings), login, critical journeys, push notifications, deep links/universal links, in-app purchases if any (sandbox), offline start. Run the release smoke suite from `sdlc-qa-automation` against production-like configuration if available.

### 6. Store metadata and compliance

What's-new text per locale (user language, no internal ticket numbers), screenshots if UI changed, privacy/data-safety declarations updated for any new data collection or SDK, permission rationales, export-compliance and content-rating answers unchanged or re-reviewed, review notes and a **test account for store reviewers** (dedicated, non-personal, limited) when login is required.

### 7. Tracks and staged rollout (after approval)

1. Internal testing track → quick smoke by the team.
2. Beta/external testers (optional) → collect crashes and feedback for a defined period.
3. Production with staged rollout, e.g. 1% → 5% → 20% → 50% → 100%, advancing only when gates hold for the agreed observation window (typically 24–48 h per step):
   - crash-free users/sessions ≥ the project's threshold and not worse than the previous version;
   - no new top crash or ANR/hang cluster; app-not-responding rate within store limits;
   - key business metrics and backend error rates normal for the new version's traffic;
   - ratings/reviews and support tickets show no new pattern.
4. On iOS, use phased release where appropriate; remember that users can still update manually during a phase.

### 8. Halt and hot-fix (forward-only)

- **Halt** the rollout (with approval) on a gate breach. Halting stops new installs but does not remove the version from devices.
- Mitigate server-side first: disable the feature flag, adjust remote config, or keep the backend compatible.
- Hot-fix: branch from the release tag, minimal fix with a regression test, new build number (and patch version), expedited review if justified, then staged rollout again.
- If the defect is severe (security, money, data loss), use minimum-supported-version enforcement (in-app forced/flexible update prompt driven by remote config) to move users off the bad version — never break the app for users who cannot update yet without a message explaining what to do.

### 9. After release

Tag/record the released version, update the changelog and release notes (`sdlc-release`), update the supported-versions matrix and the backend compatibility notes, schedule removal of feature flags no longer needed, and note lessons in the release runbook (`sdlc-docs`).

## Stop conditions

- QA verdict missing or No-go for this build; release build fails the configuration check; signature does not match the expected certificate.
- Store requirements changed (new target OS level, privacy declaration fields) and need owner decisions.
- Any action that publishes, uploads or changes rollout — wait for explicit approval.

## Output template

```markdown
## Mobile release — <app> <version> (Android <code>, iOS <build>) · commit <sha>
### Readiness
QA verdict: <Go | Conditional> (<report link>) · Gate: PASS · Backend compatibility: confirmed (<notes>)
### Release configuration check
| Check | Android | iOS | Notes |
### Artifacts
| Platform | Artifact | Signed (fingerprint) | Mappings/symbols uploaded | Size Δ |
### Pre-store verification
| Device / OS | Fresh install | Upgrade from <live version> | Critical journeys | Result |
### Store metadata
What's new (locales) · privacy declarations changed? · reviewer account prepared? · screenshots
### Rollout plan
| Step | Audience | Gates to advance | Observation window | Owner |
### Halt / hot-fix plan
Server-side mitigations available · forced-update threshold · on-call owner
### Awaiting approval
- [ ] Upload to <track> - [ ] Submit for review - [ ] Start rollout at <n%>
```

## Hand-off

Monitoring and incidents after launch → `sdlc-incident`; documentation and runbook → `sdlc-docs`; next version planning picks up deferred flags and known issues.
