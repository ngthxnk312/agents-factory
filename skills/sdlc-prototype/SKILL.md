---
name: sdlc-prototype
description: Build a fast, self-contained clickable or static prototype at an explicitly declared fidelity level — covering every state, flow and role with realistic data and the project's real design tokens — so stakeholders can validate it before production code is written; and later verify that the built UI matches it. Use for new screens, flows or significant UI changes when no approved design or prototype exists, or to check implementation fidelity against one.
stage: 3-design
role: fe
icon: 🎨
mode: acceptEdits
prefer: prototype, prototype-builder, ui-prototype
---

# Prototype (validate before building)

A prototype is a cheap question to stakeholders: "is this what you need?" It becomes the **UI contract** once approved. Building it takes hours; building the wrong feature takes weeks.

## When to use

- A new screen, flow or significant UI change without an approved design (mockup, design file or prototype).
- Several UI options need to be compared quickly.
- After implementation, to verify the real UI matches the approved prototype (fidelity check).

## When not to use

- An approved design already exists — implement from it, and use only the fidelity check below.
- Backend-only changes. (For API consumers, write an API spec with `sdlc-api-design` instead.)

## Fidelity levels — declare one before starting

| Level | What it is | Use when |
|-------|------------|----------|
| F0 — sketch | Boxes and labels, static, greyscale | Exploring layout options; very early |
| F1 — wireframe flow | Clickable low-fidelity screens, real copy and data, no styling polish | Validating flow, content and states |
| F2 — styled prototype | Clickable, uses the project's real design tokens and component patterns, all states | Stakeholder sign-off before build (default) |
| F3 — production-parity | Built with the real UI framework and components, often throwaway branch | Validating complex interaction or performance |

State the level, the reason, and what the prototype deliberately does **not** represent (e.g. "no real authentication, data is fixed").

## Procedure

1. **Gather inputs**: intake acceptance criteria, roles and permissions, the data the screens show (fields, types, required, realistic values), flows from `sdlc-ideate`/`sdlc-design`, and the target UI platform (web framework, mobile, desktop, admin framework).
2. **Read the real design system.** Extract colors, typography, spacing, radii, shadows and component conventions from the project's actual source (theme files, CSS/SCSS variables, token files, component library). Never invent brand colors or logos; if no brand source exists, use a neutral palette and label it as such. Use a text label instead of a fabricated logo.
3. **Match the target platform's patterns.** Use the screen types and components the real framework will provide (list/table, form, detail, kanban, search/filter panel, dialog/modal, bottom sheet, etc.) and the project's existing UX conventions (where actions live, how dialogs and confirmations behave). A prototype that the framework cannot reproduce is misleading.
4. **Enumerate screens × states × roles** before drawing. Every screen covers:
   - default (with realistic data);
   - loading;
   - empty;
   - error (validation errors and system errors);
   - no permission / read-only;
   - plus feature-specific states (draft, submitted, approved, locked, partial data, very long text, many items).
5. **Build the flow.** All steps clickable: navigation, dialogs, confirmations, success and failure outcomes, back/cancel paths.
6. **Use realistic data** in the user's language — no lorem ipsum — and no real personal data (synthetic names, masked identifiers).
7. **Show permissions**: a role switcher or annotated variants showing what each role sees and can do.
8. **Embed acceptance criteria** in the prototype (a notes panel or a legend) so reviewers check against them.
9. **Package**: for F0–F2, a single self-contained HTML file (inline CSS/JS, no external network calls), responsive, openable from disk. Save it under the project's docs/feature folder or a scratch directory as the project prefers. Share via whatever link mechanism the human uses; do not publish externally without approval.
10. **Export the build contract** alongside it: the design tokens used (as variables), a component map (prototype block → intended real component), and the screen × state × role checklist.
11. **Request stakeholder approval.** Production code starts only after approval. Record the approved version and any change requests; if the prototype is wrong, update the prototype and acceptance criteria — not just the code later.

## Fidelity check (after implementation)

1. Run the real UI with representative data. Use browser or device automation to capture **each state at each breakpoint** (mobile, tablet, desktop as relevant).
2. Place each capture next to the corresponding prototype state and compare: layout, colors, spacing, typography, copy, empty/error/no-permission states, and the click-through flow.
3. Check the code reuses the exported tokens and components rather than retyped literal values.
4. Every deviation is a **fidelity bug**: fix the code, or — if the prototype was wrong — update the prototype and acceptance criteria with stakeholder agreement. Never "close enough" silently.
5. Report the checklist with pass/fail per screen × state × breakpoint.

Common causes of drift to avoid: values re-typed by eye instead of tokens; only the happy path built; no side-by-side comparison; fixing "until it works" instead of "until it matches".

## Stop conditions

- Roles/permissions or the data shown are unknown — ask before building screens around guesses.
- No design source exists and the human cares about brand fidelity — ask for one or agree on a neutral palette.

## Output template

```markdown
## Prototype — <feature>
Fidelity: F2 — <reason> · Not represented: <…>
File: <path> · Approved: no | yes (by <who>, <date>, version <n>)

### Screens × states × roles
| Screen | Default | Loading | Empty | Error | No permission | Other | Roles |
|--------|---------|---------|-------|-------|---------------|-------|-------|

### Acceptance criteria shown
### Design tokens used (source: <file paths>)
### Component map (prototype block → real component)
### Open questions / change requests
```
