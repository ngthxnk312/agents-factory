---
name: sdlc-ba-ui-spec
description: Specify screens so they can be built and tested without guessing — screen inventory, display conditions, component and field tables (type, format, required, default, validation, message), behaviour tables covering happy, empty, loading, error, disabled, permission and edge states, exact copy, accessibility and responsive notes, and a visual specification that only references design tokens; or extract a sourced design-token sheet from an existing approved prototype without redesigning it. Use when a feature with UI needs screen specifications, or when an existing mockup or prototype must be turned into a token reference for the SRS or the build team.
stage: 3-design
role: ba
icon: 🖼
mode: plan
prefer: ui-spec, screen-specification, design-tokens-extraction
---

# UI specification (screens and design tokens)

Two modes — pick one before anything else; if unsure, ask "new screen specification, or extract the specification from an existing prototype?":

| Mode | When | Output |
|---|---|---|
| **A. Screen specification** | Screens are defined by the functional spec; a wireframe or design file may exist | Screen inventory + one specification per screen |
| **B. Token extraction** | An approved prototype or mockup (HTML/CSS or design file) already exists and must be documented, not redesigned | A design-token sheet where every value has a source |

A clickable prototype for stakeholder validation is built with `sdlc-prototype`; this skill writes the specification that the prototype, the SRS and the build team rely on.

## When not to use

- Behaviour is not yet specified → `sdlc-ba-functional-spec` first.
- Visual design exploration or brand work — a designer's task; this skill documents, it does not invent visual design.

## BA conventions (shared by every sdlc-ba-* skill)

- **Label, don't upgrade:** facts, decisions, requirements, assumptions, constraints, hypotheses, risks, dependencies, out-of-scope items, conflicts and open questions stay distinct.
- **Stable IDs:** `SCR-` screen, `ERR-`/`MSG-` message, and the source's `UC-`, `BRL-`, `FL-`, `API-`, `Q-`. Never reuse an ID.
- **Source of truth:** recorded decision → baselined requirements → functional spec → process flow → UI spec/prototype → SRS. A prototype never outranks an approved business artifact; a conflict becomes `Q-`/`CR-` upstream.
- **Draft vs baseline:** DRAFT until approved; revisions are new versions.
- **Unattended runs:** no human available → record `Q-` with owner and impact, mark `[ASSUMPTION]`, keep DRAFT, list "Needs approval: … — <approver>"; cannot proceed → first line `BLOCKED: <reason>`.

## Mode A — Screen specification

1. **Inputs:** functional spec (flows, rules, validations, messages, permissions), process flow (front-end lane and user actions), wireframes or design files, the project's design system/tokens, existing screens for consistency.
2. **Screen inventory:** `SCR-` ID, name, purpose, entry points, roles that can access it, use cases/steps it serves. Confirm the list before detailing.
3. **For each screen**, write:
   - **Display condition** — when and for whom the screen appears; what is shown on first load.
   - **Components table** — every visible element:
     `| No | Component | Display description | Type / format | Constraints / notes |`
     Display description is exactly what the user sees: literal labels and texts, conditional display ("if more than 5 items, show the first 5 and '…and N more'"), formatting (dates, amounts, masking).
   - **Field table** for inputs:
     `| Field | Type | Required | Default | Format / mask | Min–max | Validation rule (BRL/ref) | When validated | Message ID | Data source | Editable by role |`
   - **Behaviour table** — every interaction:
     `| No | User action | System response | Expected result |`
     System response is precise enough to code: what is validated in which order, what is saved, what changes on screen, which message appears ("System validates in order (1) name present, (2) amount ≤ limit; on failure shows ERR-REQ-03 below the field and keeps entered data").
   - **Must-cover states** in the behaviour table: happy path · empty (no data yet) · loading (slow or async) · error (validation, conflict, system failure, timeout) · disabled (when and why, tooltip text) · no permission / read-only · edge (boundaries, very long text, many items, concurrent change, cancel/back, double submit, session expiry).
   - **Visual specification** — layout (regions, order of blocks, fixed vs scrolling areas), tokens referenced by name, assets referenced by file name and size, visual states (empty, loading, error, selected). Reference token names in backticks (`--color-surface`, `.card`); never describe colours in words or copy raw values when a token exists; write `not in prototype` for anything the source lacks.
   - **Accessibility** — labels for every input, focus order, keyboard operation, error announcement, alternative text for meaningful images, contrast handled by the design system (flag any custom colour).
   - **Responsive and localisation** — breakpoints that change layout; texts as i18n keys if the project localises; long-text behaviour.
4. **Messages list** — `ERR-`/`MSG-` ID, exact text, trigger, location on screen.
5. **Self-review as a tester and a developer:** can every behaviour be tested from the table alone? Can the screen be built without asking? Fix or raise `Q-`.
6. Present as DRAFT; revise as new versions.

### Writing rules

| Vague | Precise |
|---|---|
| "User clicks the button" | "Approver selects [Approve]" |
| "Show a message" | "System shows ERR-REQ-03 'Amount exceeds your daily limit of 50,000' under the Amount field" |
| "Save the data" | "System validates 3 conditions, saves the request with status Submitted, closes the dialog and refreshes the list" |
| "Cannot delete" | "[Delete] is disabled when status ≠ Draft; hover shows 'Only drafts can be deleted'" |

## Mode B — Token extraction from an existing prototype

The prototype is the **only** source of truth for this document. You copy what it decided; you do not redesign.

1. Read in order: viewport meta and language; font declarations; root custom properties in declaration order; each class/selector (colour, type, spacing, radius, border, shadow, transitions, `:hover`/`:active`/`:focus` and state classes); repeated literal values without a variable; media queries and safe-area insets; frame size; markup regions; images, inline SVG, background images, icon fonts; elements hidden by default and pre-applied state classes.
2. Rules:
   - Keep names and values verbatim (case of hex codes, units).
   - Every row has a **source** location (`:root --gold`, `.card border`, `@media (max-width: 600px)`, `<img src="assets/logo.png">`). No source → the row is not written.
   - Missing → write exactly `not in prototype` in value and source; no "reasonable default".
   - Inherited values are noted as inherited from the named selector; browser defaults are `not in prototype`.
   - No redesign (no new scales, no semantic renaming, no fixing the designer's "mistakes"), no conversion to platform code.
   - Ask only about what is genuinely absent (error state, missing asset file).
3. Output sections in this order: 1 Colours · 2 Typography · 3 Spacing, radius, border, shadow · 4 Viewport, container, safe area, layout · 5 Assets · 6 Motion · 7 Visual states (at least empty, loading, error, selected) · 8 Assumptions and questions.

```markdown
# Design tokens — <project/feature>
Source prototype: `<file>` (<version/date>) · Reference frame: <width × height> (`<frame selector>`)
## 1. Colours
| Token | Value | Used in | Source |
## 2. Typography
| Token | Font | Size | Weight | Line height | Source |
## 3. Spacing · Radius · Border · Shadow
| Token | Kind | Value | Used in | Source |
## 4. Viewport · Container · Safe area · Layout
| Item | Value | Source |
## 5. Assets
| Asset | Type | Size | Used in | Source |
## 6. Motion
| Token | Property | Duration | Easing | Source |
## 7. Visual states
| State | Component | Appearance | Source |
## 8. Assumptions and questions
```

## Stop conditions

- A screen needs behaviour the functional spec does not define — raise `Q-` upstream.
- The prototype conflicts with an approved business rule — report the conflict; the business artifact wins until a decision changes it.

## Output template (Mode A)

```markdown
# UI specification — <feature> · v<N> · DRAFT
Sources: <functional spec vN, flow vN, design file/prototype vN, design tokens vN>
## Screen inventory
| SCR | Name | Purpose | Entry points | Roles | UC / steps |
## SCR-<nn>: <name>
Display condition: …
### Components
### Fields
### Behaviour
### Visual specification
Layout: … · Tokens: … · Assets: … · States: empty … / loading … / error … / selected …
### Accessibility · Responsive · Localisation
## Messages
| ID | Text | Trigger | Location |
## Open questions
```

## Hand-off

Screen specifications and tokens → `sdlc-ba-srs` (screen sections reference them), `sdlc-prototype` (build or verify the clickable prototype), front-end implementation via `sdlc-feature-workflow`; testers derive UI test cases from the behaviour tables.
