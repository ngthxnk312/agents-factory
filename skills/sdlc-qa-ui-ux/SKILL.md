---
name: sdlc-qa-ui-ux
description: Test the user interface and experience of web and mobile screens — visual fidelity to the design system or approved prototype, responsive layouts across breakpoints and devices, all UI states (loading, empty, error, no permission, long content), interaction and feedback, error-message quality, flow clarity, accessibility (WCAG 2.2 AA keyboard, screen reader, contrast, target size, motion), localization, and sensitive-data presentation — and record findings as UI/UX test cases or defects with evidence. Use when a UI change is ready for testing, when a UI/UX test section is requested after test design, or when accessibility must be verified.
stage: 5-verify
role: qa
icon: 👁
mode: acceptEdits
prefer: ui-ux-testing, accessibility-testing, a11y-audit
---

# UI/UX and accessibility testing

A screen that looks right but confuses users, traps keyboard users or hides errors is defective. Test the static picture **and** the states, the interactions and the assistive-technology experience.

## When to use

- A UI change is deployed to a test environment or runnable locally.
- After `sdlc-qa-test-design`, when the human opts into a UI/UX section (ask; it is not automatic).
- Accessibility verification before release, or after an accessibility complaint.

## When not to use

- Checking pixel fidelity of a fresh implementation against its prototype as part of building — the fidelity check in `sdlc-prototype` (this skill can execute it but does not replace the developer's own check).
- Functional business-rule testing — `sdlc-qa-test-design`.

## Inputs

Approved design source (design file, prototype, design tokens/component library), acceptance criteria, supported platform matrix from the test plan (browsers, OS versions, devices, breakpoints, locales, themes), accessibility target (default **WCAG 2.2 level AA** unless the project states otherwise).

## Procedure

1. **Build the matrix.** Screens × states × breakpoints/devices × themes/locales × roles. States per screen: default with realistic data, loading, empty, partial data, error (validation, system, offline), no permission/read-only, very long text/many items, success/confirmation. Keep it proportional: critical flows get the full matrix; minor screens get default + error + smallest/largest breakpoint.
2. **Visual and design-system conformance.** Layout, alignment, spacing, typography, color, icons, images (no stretching), component usage per design system; values come from tokens (inspect computed styles where possible). Compare side by side with the approved design/prototype per state; every deviation is a finding unless the design is wrong — then raise it to the designer, do not "accept" silently.
3. **Responsive / device behavior.** Smallest and largest supported widths, common breakpoints, zoom 200% and text-size 400% reflow (no horizontal scroll for text content at 320 CSS px), portrait/landscape if supported, soft keyboard not covering focused inputs, safe areas/notches, scroll containers, sticky elements not hiding content.
4. **Interaction and feedback.** Immediate visual response on press/click; disabled state while processing (prevents double submit); loading → processing → success/failure clearly distinguished; progress for long operations; undo or confirmation for destructive actions; gestures have accessible alternatives; animations smooth and respect reduced-motion settings.
5. **Error UX.** Errors state what went wrong and how to fix it, appear next to the field and in a summary for long forms, are announced to assistive technology, preserve user input, never expose stack traces/internal codes alone/sensitive data.
6. **Flow clarity.** Can a first-time user tell where they are, what to do next and how to go back? Step count reasonable; important information (amount, recipient, fees, consequences) shown before commitment; empty states explain and offer an action.
7. **Accessibility (WCAG 2.2 AA)** — run automated checks first (an accessibility engine in the browser, platform accessibility scanners), then manual checks, because automation finds only part of the issues. Full checklist: `reference/ui-ux-a11y-checklist.md`. Never skip: keyboard-only completion of the flow, visible focus, logical focus order and no traps, screen-reader names/roles/states for controls, form labels and error association, contrast (4.5:1 text, 3:1 large text and UI components), target size (≥24×24 CSS px web minimum; ≥44×44 pt iOS / 48×48 dp Android recommended), no information by color alone, captions/alternatives for media, page titles and headings structure.
8. **Localization and content.** Longest supported language does not truncate; right-to-left if supported; date/number/currency formats per locale; no hard-coded strings; pluralization.
9. **Sensitive data presentation** (finance, health, identity): masking of account/card/identity numbers, sensitive screens protected from screenshots/app-switcher previews on mobile where required, auto-logout warning behavior, nothing sensitive in titles, URLs or notifications.
10. **Capture evidence.** Use browser/device automation to screenshot each state × breakpoint; name files `<screen>_<state>_<breakpoint>_<locale>.png`; attach to findings. Synthetic data only.
11. **Record results.** Executable checks go into the UI/UX section of the suite (`UX-<MOD>-nnn`, categories: Layout, Interaction/UX flow, Accessibility, Localization, Security presentation, Performance perception); failures become defects via `sdlc-qa-defect` with severity by user impact (an accessibility barrier that blocks task completion is at least High).

## Stop and ask

- No design source or accessibility target defined and the human expects conformance — agree on the reference first.
- Required devices, OS versions or assistive technologies are unavailable — report what was not covered.

## Guardrails

- Do not "fix" UI code inside this skill; report. Fixes go through `sdlc-implement` or `sdlc-fe-implement` / `sdlc-mobile-implement`.
- Automated accessibility scores are not a pass; manual checks are required for a pass verdict.
- Do not use real personal data on screens being captured.

## Output template

```markdown
## UI/UX & accessibility test — <feature> (<build>, <date>)
Reference: <design/prototype version> · Target: WCAG 2.2 AA · Matrix: <breakpoints/devices/browsers/locales/themes>

### Coverage
| Screen | States tested | Breakpoints/devices | Locales/themes | Roles | Evidence folder |

### UI/UX test cases
| UX-ID | Category | Screen | Check | Expected | Actual | Status | Evidence | Defect |

### Accessibility summary
Automated: <tool type, violations by impact> · Manual: keyboard ✔/✘ · screen reader (<AT + platform>) ✔/✘ · contrast ✔/✘ · target size ✔/✘ · reflow/zoom ✔/✘
| Criterion | Result | Finding |

### Findings (prioritized)
| # | Severity | Screen/state | Finding | WCAG / design reference | Recommendation |

### Not covered (and why)
```

## Hand-off

- Defects → `sdlc-qa-defect`; summary → `sdlc-qa-test-report`.
- Stable visual/a11y checks worth repeating → candidates for `sdlc-qa-automation` (visual snapshots, automated accessibility scans in CI).
