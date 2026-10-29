---
name: sdlc-fe-implement
description: Implement web frontend changes the way a senior frontend engineer would — component architecture that matches the codebase, clear state ownership (server cache vs client vs URL vs form state), typed API integration with every loading/empty/error/permission state, design tokens instead of literals, accessibility (WCAG 2.2 AA) and i18n built in, performance budgets, frontend security, and component, integration and end-to-end tests — finishing with a verification report including screenshots per state. Use when building or changing screens, components, forms or client-side logic in a web application.
stage: 4-build
role: fe
icon: 🖥
mode: acceptEdits
prefer: frontend-implement, frontend-development, web-frontend
---

# Frontend implementation (web)

Apply `sdlc-implement` (test-first loop, no scope creep, no secrets, honest verification) and `sdlc-standards`. This skill adds what is specific to browser UIs. The project's framework, conventions and lint rules override everything here; examples are illustrative across stacks (component frameworks, server-rendered templates, admin frameworks).

## When to use

- New screens, components, forms, client-side state or API integration in a web app.
- Implementing an approved prototype (`sdlc-prototype`) or design.

## When not to use

- No approved UI contract for a significant UI change — `sdlc-prototype` first.
- The API contract is not agreed — `sdlc-api-design` first.
- Native or cross-platform mobile apps — `sdlc-mobile-implement`.

## Before writing code

1. Read project rules and the closest existing feature: folder layout, component patterns, state library, data-fetching layer, form library, styling approach (tokens/CSS variables/utility classes/component library), routing, i18n, test setup. Mirror them; do not introduce a second library for something the project already does.
2. Collect the UI contract: approved prototype/design per **screen × state × role** (default, loading, empty, error, no permission, long content), acceptance criteria, API contract and error codes, analytics events if specified.
3. Plan components: list new/changed components, where state lives, which API calls, which routes; load the steps into your todo tool.

## Architecture rules

- **Component layers**: presentational components (props in, events out, no data fetching) → container/feature components (wire data and state) → route/page (layout, guards, data prefetch). Reuse the design-system components; create a new shared component only when a second use exists or the design system lacks it — then follow its API conventions.
- **State ownership** — put each piece of state in exactly one home:

  | Kind | Home | Notes |
  |------|------|-------|
  | Server data | The project's data-fetching/cache layer | Cache keys, invalidation after mutations, no copying into global stores |
  | URL state | Route/query params | Filters, pagination, selected tab — shareable and back-button friendly |
  | Form state | Form library / local state | Validation schema shared with the API contract where possible |
  | UI state | Local component state | Open/closed, hover, step index |
  | Global client state | Store only if truly cross-cutting | Session, preferences, feature flags |

- **Derived, not duplicated**: compute derived values; never keep two copies of the same truth.
- **API integration**: one typed client/adapter per backend resource; map transport errors to domain errors; standard handling for 401 (re-authenticate), 403 (no-permission state), 404 (not-found state), 409 (conflict message), 422/400 (field errors mapped to inputs), 429/5xx/timeout (retry affordance). Cancel or ignore stale requests on navigation/parameter change; no request waterfalls when calls are independent; debounce search inputs.
- **Mutations**: disable the trigger while pending (no double submit), send an idempotency key when the API supports it, optimistic updates only with rollback on failure, invalidate or update affected queries.
- **Design tokens**: colors, spacing, typography, radii, shadows, breakpoints and z-index come from tokens/theme — no literal hex values or magic pixel numbers; layout responsive from the smallest supported width.
- **Every state rendered**: loading (skeleton, no layout shift), empty (with next action), error (message + retry), no permission, partial data, very long text, many items (virtualize long lists).
- **No hard-coded configuration**: API base URLs, feature flags, keys come from the environment/config mechanism; never secrets in client bundles (anything shipped to the browser is public).

## Accessibility (built in, not retrofitted)

Semantic HTML first (button, link, label, headings, landmarks, lists, tables); custom widgets follow established keyboard patterns; every input labelled and errors associated and announced; focus managed on route change and in dialogs (move in, trap, restore); visible focus; contrast and target sizes per tokens; images with alt text or marked decorative; no information by color alone; respects reduced motion. Target WCAG 2.2 AA. Checklist: `sdlc-qa-ui-ux` reference.

## Internationalization

All user-visible strings through the i18n mechanism with keys; plurals and interpolation via the library (no string concatenation); dates, numbers and currencies formatted with locale APIs; layout tolerates longer text and right-to-left if supported; no locale-dependent parsing of user input without explicit format.

## Performance budgets

Use the project's budgets; otherwise target on a mid-range mobile device and fast 4G: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile, and no route bundle growth above ~10% without justification. Techniques: code-split by route and heavy component, lazy-load below-the-fold media, responsive images with dimensions, memoize only measured hot spots, avoid re-render cascades from context/store changes, virtualize long lists, prefetch likely next routes, avoid blocking third-party scripts.

## Security (frontend)

Never inject unsanitized HTML (framework escape hatches only with a sanitizer and a reason); validate and encode URLs before navigation (no `javascript:` URLs, open-redirect checks); tokens preferably in secure, http-only cookies managed by the backend — if tokens must live in the client, keep them in memory, not in persistent storage; CSRF protection per backend pattern; no sensitive data in URLs, logs, analytics or error reporters; respect the Content Security Policy (no inline scripts if CSP forbids them); third-party scripts only with approval; dependency additions checked for maintenance and vulnerabilities.

## Tests

- **Unit**: pure logic (formatters, reducers, validation schemas, mappers).
- **Component**: render with props/states, user interactions via accessible queries (role/label), assert visible outcomes; cover loading/empty/error/no-permission.
- **Integration**: feature with mocked network at the HTTP boundary (request/response fixtures from the API contract), including error codes and slow responses.
- **End-to-end**: few critical journeys with stable selectors (`sdlc-qa-automation` patterns), against a test environment.
- **Accessibility**: automated a11y assertions in component/E2E tests for new screens.
- **Visual** (if the project uses it): snapshot per state and breakpoint, reviewed not auto-accepted.

## Verification before reporting

Build, type check, lint, unit/component tests, then run the app and walk the changed screens: every state × breakpoint (smallest, a tablet width, desktop) × role; keyboard-only pass; check the browser console for errors/warnings and the network panel for duplicate or failing calls. Capture screenshots per state for the report and for the fidelity check in `sdlc-prototype`. Measure performance on the changed route if budgets apply. List anything not verified.

## Stop conditions

- The design lacks a state you must render (error, empty, no permission) — ask; do not invent UX.
- The API returns data or errors not in the contract — raise it (`sdlc-api-design`), do not paper over it in the UI.
- A new dependency, global store, or design-system change is needed — propose it first.

## Output template

```markdown
## Frontend implementation — <ticket>
### Changes
| File | Change | Why |
### Components and state
| Component | Type (presentational/container/page) | State owned | Data sources |
### States implemented
| Screen | Default | Loading | Empty | Error | No permission | Long content | Breakpoints checked |
### Tests
| Level | File | Behaviors |
### Verification
| Step | Command / method | Result |
Accessibility: keyboard ✔ · labels ✔ · contrast ✔ · automated a11y 0 violations
Performance: <metric before/after or N/A> · Bundle delta: <kB>
Screenshots: <paths> · Not verified: <items>
### Follow-ups
Nothing was committed or pushed.
```

## Hand-off

`sdlc-prototype` fidelity check → `sdlc-review` → `sdlc-quality-gate`; QA verification with `sdlc-qa-ui-ux` and `sdlc-qa-test-design` suites.
