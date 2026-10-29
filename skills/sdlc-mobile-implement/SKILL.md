---
name: sdlc-mobile-implement
description: Implement mobile app features (native or cross-platform) following the project's layered architecture — presentation, state holder, domain, data/adapter — with lifecycle-safe async work, a single navigation and deep-link entry, offline caching and sync, runtime permissions, secure storage, centralized session and error handling, build flavors per environment, feature flags with defaults, crash reporting and analytics without personal data, and unit, widget/UI and device tests. Use when adding or changing screens, flows, API integrations or platform capabilities in an Android, iOS or cross-platform app.
stage: 4-build
role: mobile
icon: 📱
mode: acceptEdits
prefer: mobile-implement, mobile-development, mobile-feature
---

# Mobile implementation

Apply `sdlc-implement` (test-first loop, minimal scope, honest verification) and `sdlc-standards`. This skill adds what mobile code must get right: lifecycles, devices, offline, platform security and the fact that **shipped binaries cannot be recalled** — old versions stay in users' hands. The project's architecture and conventions override the examples here; examples span cross-platform frameworks and native Android/iOS.

## When to use

- New screens/flows, API integrations, local storage, platform capabilities (camera, location, biometrics, push, files) in a mobile app.
- Refactoring a feature inside an existing mobile architecture.

## When not to use

- Building, signing and publishing a release — `sdlc-mobile-release`.
- Web frontends — `sdlc-fe-implement`.
- Unclear requirements or UI — `sdlc-intake`, `sdlc-prototype`.

## Before writing code

1. Read project rules and identify the architecture actually used (for example: clean architecture with presentation / domain / data packages; MVP with view–presenter–repository; MVVM with view–view model–repository; unidirectional state with reducers). Note the DI container and its initialization order, the navigation/router mechanism, the state-holder type, the networking client and interceptors, serialization and code generation, the theme/token system, the local database and its migration mechanism, and the language policy (e.g. "new classes in the newer language, existing files stay as they are").
2. Find the closest existing feature and mirror its file set, naming and error handling.
3. Collect the UI contract (prototype/design per screen × state, including offline and permission-denied states), API contract, analytics events, and target OS versions/devices.
4. Plan in dependency order: model → data source/API → repository → use case/domain logic → state holder → screen → navigation registration → DI registration → tests. Load steps into your todo tool.

## Architecture rules

- **Layers and direction**: presentation (screens/widgets/views) → state holder (view model, presenter, cubit/bloc, store) → domain (use cases, entities, repository interfaces) → data (repository implementations, remote/local data sources, DTO mapping). Dependencies point inward; domain has no platform or framework imports. DTOs never leak into UI; map to domain models.
- **Screens render state; they do not decide.** No API calls, database access or business rules in views/fragments/widgets. State holders expose immutable UI state (loading / content / empty / error / no-permission / offline) and one-off events (navigate, show message).
- **Lifecycle safety**: async work is scoped to the state holder's lifecycle (scoped coroutines/tasks/streams, cancelled on dispose); never touch a view after it is detached — guard callbacks or use lifecycle-aware observation; release listeners, controllers, subscriptions and database handles; never keep references to activities/views/contexts in long-lived objects (memory leaks).
- **Threading**: no network, disk or database work on the main/UI thread; heavy parsing or crypto off the main thread; UI updates only on the main thread.
- **Navigation**: through the project's single router/navigation registry; register new routes and deep links there; validate deep-link parameters and require authentication/enrolment checks on every entry path (home, search, notification, link) — not only the menu path. Handle back navigation and process death (restore state or restart the flow safely).
- **Networking**: one client with interceptors for auth headers, token refresh, correlation ids and logging (redacted); timeouts and bounded retries only for idempotent calls; **session expiry handled centrally** (one handler routes to re-authentication) — never per screen; map error codes to domain errors once in the data layer.
- **Generated code**: after changing annotations for serialization, DI, immutable models or HTTP clients, run the project's code generator; never edit generated files by hand.
- **Feature flags / remote config**: read through one accessor with a typed key constant and a **safe default** when the value is missing or offline.
- **Theme**: colors, typography, spacing from the theme/token system; support platform text scaling and dark mode if the app does.

## Offline, caching and data

- Decide per feature: online-only (clear offline state + retry), cache-then-network (show cached with freshness indicator), or offline-first (local source of truth + sync queue with conflict rules).
- Local database schema changes require a version bump **and** a migration, tested from the oldest supported schema; never wipe user data silently.
- Writes that must not duplicate (payments, submissions) carry an idempotency key and are not auto-retried blindly after an ambiguous failure — re-query status first.
- Cache and user data cleared on logout and on account switch.

## Platform capabilities and permissions

Request runtime permissions in context (just before use, with rationale), handle denied and permanently denied (link to settings), and degrade gracefully. Declare only needed permissions and capabilities. Background work uses the platform's scheduled/background APIs within OS limits. Third-party SDKs: initialize lazily or deferred so startup is not blocked, wrap initialization so an SDK failure cannot crash the app, and check compatibility with obfuscation/app-protection tooling.

## Security essentials

Secrets and tokens only in platform secure storage (keystore/keychain-backed); nothing sensitive in plain preferences, files, logs, crash reports, analytics, screenshots or URLs; HTTPS only, certificate pinning if the project uses it (never disabled in release); WebViews locked down (no file access or universal file URL access without reason, JavaScript bridges expose no sensitive data, origin validation for loaded URLs); exported components declared deliberately; release builds non-debuggable with shrinking/obfuscation on. Full checklist: `reference/mobile-security-checklist.md`. Regulated apps (finance, health) may add root/jailbreak detection, screenshot blocking and app-switcher masking — follow the project's policy.

## Environments and build flavors

Use the project's flavors/schemes (e.g. dev, staging, production) with distinct application ids/bundle ids, app names/icons and configuration; environment values come from flavor config, never from code branches on string literals. Never point a debug or test build at production services unless the project explicitly provides such a flavor.

## Observability

Crash reporting and analytics through the project's wrapper; events as specified, no personal data or identifiers beyond the approved pseudonymous id; log levels stripped or redacted in release builds; breadcrumbs for critical flows.

## Tests

- **Unit**: use cases, mappers, validators, state holders (state sequence for success, error, empty, session expired, offline), with fakes/mocks at repository boundaries; deterministic clocks and dispatchers/schedulers.
- **Widget/UI component tests**: render each state; interaction via accessibility labels.
- **Integration/instrumented**: database migrations, navigation and deep links, permission flows on emulators/simulators.
- **End-to-end on devices**: critical journeys via `sdlc-qa-automation` patterns.
- Manual checks list: rotation (if supported), background/foreground, process death, airplane mode, low-end device, largest text size, screen reader (TalkBack/VoiceOver).

## Verification before reporting

Code generation → analyze/lint/format → unit and widget tests → build the dev/staging flavor → run on at least one emulator/simulator per target platform (and a real device when hardware features are involved) → walk the changed flow through every state including offline, permission denied and session expiry → check logs for errors and for sensitive data. Report anything not verified (e.g. iOS not built because no macOS host).

## Stop conditions

- A change needs a new permission, SDK, backend contract, schema migration or minimum-OS change not in the plan — ask.
- Release signing material, store credentials or production configuration are needed — never in this skill; see `sdlc-mobile-release`.
- Behavior for offline, permission denial or session expiry is unspecified — ask; do not invent UX.

## Output template

```markdown
## Mobile implementation — <ticket> (<platforms>)
### Changes by layer
| Layer | File | Change | Why |
### States implemented
| Screen | Loading | Content | Empty | Error | Offline | Permission denied | Session expired |
### Registrations
Routes/deep links · DI · flags (key + default) · permissions · migrations (from → to)
### Tests
| Level | File | Behaviors |
### Verification
| Step | Command / device | Result |
Manual checks: rotation · background/foreground · process death · offline · large text · screen reader
Not verified: <items and reason>
Nothing was committed or pushed.
```

## Hand-off

`sdlc-review` (with `reference/mobile-security-checklist.md`) → `sdlc-quality-gate` → QA (`sdlc-qa-test-design`, `sdlc-qa-ui-ux`, `sdlc-qa-automation`) → `sdlc-mobile-release`.
