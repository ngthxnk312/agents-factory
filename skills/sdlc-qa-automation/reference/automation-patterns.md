# Automation patterns and flaky-test reduction

Framework-neutral guidance with short examples. Follow the existing automation project's conventions first.

## 1. Project structure (UI + API, any language)

```
automation/
├── config/                 # runner config; env-driven base URLs, app build, devices
├── .env.example            # variable names only — committed; real .env ignored
├── src/
│   ├── pages/ or screens/  # one object per screen/component: locators, actions, state queries
│   ├── components/         # shared widgets (header, dialog, date picker)
│   ├── fixtures/           # auth state per role, API client, seeded data, device session
│   ├── data/               # builders/factories; boundary and negative datasets
│   └── utils/              # waits, safe input, scrolling, popup handling, reporting hooks
├── tests/
│   ├── <module>/           # one spec/class per objective group
│   └── smoke/
└── reports/                # ignored; traces, screenshots, videos, machine-readable results
```

Separation of responsibilities:

| Page/screen object | Test (spec/class) | Data provider |
|--------------------|-------------------|---------------|
| Locators, actions, state queries, `isDisplayed()` | Test methods, assertions, step logging, flow orchestration | Inputs, expected values, negative datasets |
| Never: assertions, test annotations, test-specific branching | Never: raw locators, driver/element lookups | Never: UI actions, assertions |

Naming: page/screen objects `<Name>Page` / `<Name>Screen`; locators `SCREEN_ELEMENT_TYPE` (`LOGIN_SUBMIT_BTN`, `TRANSFER_AMOUNT_INPUT`) or descriptive fields; tests named by expected behavior (`rejectsAmountAboveDailyLimit`). Actions return the next page object (fluent navigation).

## 2. Locators

| Rank | Web | Mobile |
|------|-----|--------|
| 1 | Accessibility role + accessible name; label | Accessibility id / content description |
| 2 | Dedicated test id attribute | Stable native resource id |
| 3 | Placeholder / stable text (non-localized) | Platform UI query by text (non-localized) |
| 4 | Relative CSS | Platform predicate / class chain |
| 5 | Relative XPath with attributes — comment `NEEDS_VERIFY` | Relative XPath with attributes — comment `NEEDS_VERIFY` |

Forbidden: absolute XPath, index-only paths, generated/hashed class names, dynamic ids, hard-coded pixel coordinates. If no stable locator exists, request a test id from developers and mark the candidate Deferred.

## 3. Waits

- Wait for a **condition**: visible, enabled, hidden/detached, URL, specific network response, text/value, element count, app state.
- Prefer the runner's built-in auto-wait and web-first assertions; centralize custom waits in one utility.
- Distinguish **present in tree** vs **visible**: hidden elements (pre-rendered fragments, closed dialogs) are present but not visible — wait on visibility for "dialog is shown".
- Avoid "network idle" waits on pages with polling or sockets.
- Timeouts come from config, consistent across tests, sized for CI, not tuned per test to pass.
- Fixed sleeps only with a comment naming the uncontrollable reason (e.g. third-party animation without state) and a ticket.

## 4. Authentication and state

- Log in once per role (setup step or fixture), save the authenticated state, reuse it; do not log in through the UI in every test.
- Separate stored states per role (admin, maker, approver, read-only).
- Long flows: split into independent tests rather than fighting session expiry; when unavoidable, handle re-authentication explicitly.
- Mobile: decide per suite whether each test starts from a clean install, cleared app data, or a preserved session; document it; grant/deny permissions deliberately per test.

## 5. Test data

- Seed via API/fixtures, not through the UI; unique identifiers per run (prefix + timestamp/uuid) to allow parallelism.
- Clean up in teardown; tolerate already-deleted data.
- Tests sharing a mutable resource (one account balance) run serially or get their own resource.
- One-time codes: test accounts with fixed codes, a test-only retrieval endpoint, or a stubbed provider — agreed with the environment owner. Captcha: disabled by a test-environment flag. Never real devices, real phone numbers or real inboxes owned by people.

## 6. Assertions

- One expected-result line → one assertion; assert exact values (text, amount, status, URL, response field), state (enabled/disabled, selected), and persisted state where the case says so (API read-back).
- Use the runner's assertion library; no mixing libraries.
- Soft assertions only with a project-wide convention.
- Never catch and ignore runner errors to "stabilize" a test.

## 7. Configuration and reporting

- Base URL / API URL / app package / device capabilities from environment variables; `.env.example` lists names.
- Retries: 0 locally; small number in CI **only** to detect flakiness — report flaky separately.
- On failure capture trace (or step log), screenshot, video where cheap, console and network logs; machine-readable report (JSON/JUnit) for triage and dashboards.
- Run tests by explicit path or anchored tag to avoid over-matching.

## 8. Mobile specifics

Keyboard covering inputs (hide or scroll), off-screen elements (scroll into view first), animations (wait for settled state or disable animations in test builds), permission dialogs, background/foreground, rotation if supported, OS/device differences, app launch via the driver rather than shell shortcuts when the session is active, device id resolved once at session start (fail fast).

## 9. Flaky-test reduction checklist

Symptoms: same data, different outcome; passes locally fails in CI; depends on order; fails at wait/click/assert/navigation; fails because of popups, animation, keyboard or loading.

- [ ] Locators stable and owned by page objects
- [ ] Every action/assert waits on the right condition; no fixed sleeps
- [ ] Each test independent: own setup, own data, own cleanup; no order dependence
- [ ] App/session/account/data state reset as designed
- [ ] Assertions strong and checked at the right time (after state settles)
- [ ] Popups, banners, cookie notices, permission dialogs, keyboard, loading handled
- [ ] Shared resources serialized or isolated for parallel runs
- [ ] Environment dependencies (network, seed data, build, device) documented and checked in readiness
- [ ] Timeouts consistent and config-driven
- [ ] Failures captured with trace/screenshot

Classification: **Partial** — runs but with known flaky risk or temporary locators. **Blocked** — no stable locator, uncontrollable state, unstable environment, or no reliable way to assert the expected result.

## 10. Script review checklist

- [ ] Structure: page/screen objects, tests, data separated per section 1
- [ ] Traceability: every test tagged with TC/AT IDs; every candidate implemented or recorded as pending with reason
- [ ] Assertion map complete against expected results
- [ ] No secrets, real URLs of production, real personal data
- [ ] No hard-coded environment values; config-driven
- [ ] Flaky checklist passed
- [ ] Runs green twice in a row locally/CI on an unchanged build (repeatability)
