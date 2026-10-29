---
name: sdlc-ba-srs
description: Author, review or update a software requirements specification (SRS) that developers can build from and testers can write test cases from without further questions — screen, API, integration or report variants; introduction and glossary, function list, business processes, screen specifications, business rules and reference values, affected APIs, data requirements, related systems, measurable non-functional requirements and an error-code catalogue — with tester and developer self-review, explicit approval before export, versioning and a change log. Use when a formal specification document is required for sign-off, contract or handover, or an existing SRS must be reviewed or revised.
stage: 3-design
role: ba
icon: 📘
mode: plan
prefer: srs, software-requirements-specification, srs-writer
---

# Software requirements specification (SRS)

The SRS is the formal, signed-off contract of behaviour. It consolidates — it does not invent: rules, APIs, data and NFRs appear only when an upstream artifact or a recorded decision supports them. Its test: a tester can write test cases and a developer can build from it without asking the analyst.

## When to use

- A formal specification is required (client sign-off, contract deliverable, outsourced build, regulated project, acceptance basis).
- An existing SRS must be reviewed for completeness or updated after an approved change.

## When not to use

- Requirements are not baselined → `sdlc-ba-requirements`.
- A lightweight team-internal spec is enough → `sdlc-ba-functional-spec` (+ `sdlc-ba-ui-spec`) may suffice; ask whether a formal SRS is really required.
- API contract design decisions → `sdlc-api-design` (the SRS references the agreed contract).

## BA conventions (shared by every sdlc-ba-* skill)

- **Label, don't upgrade:** facts, decisions, requirements, assumptions, constraints, hypotheses, risks, dependencies, out-of-scope items, conflicts and open questions stay distinct.
- **Stable IDs:** reuse upstream IDs (`BR-`, `UC-`, `BRL-`, `NFR-`, `SCR-`, `API-`, `ERR-`); the SRS adds function codes and error codes but never renumbers existing items.
- **Source of truth:** recorded decision → baselined requirements → functional spec → process flow → UI spec/prototype → SRS. The SRS is last: anything new it discovers goes back upstream as `Q-`/`CR-`.
- **Draft vs baseline:** DRAFT until approved; never overwrite an issued version; new version + change-log row.
- **Unattended runs:** no human available → no export; produce the Markdown draft, mark gaps `[NEEDS CONFIRMATION]` and `Q-`, list "Needs approval: … — <approver>"; cannot proceed → first line `BLOCKED: <reason>`.

## SRS variants

| Variant | Typical inputs | Focus |
|---|---|---|
| Screen | Functional spec, UI spec, prototype/design file, design tokens | Screens, UI behaviour, business rules |
| API | Agreed API contract, use cases, data model | Endpoints, request/response, errors, sequence |
| Integration | Partner specification, integration design (`sdlc-sa-integration`) | Data flow, field mapping, retry/fallback, validation, monitoring |
| Report | Report samples, business rules | Data sources, filters, formulas, layout, export, permissions |

## Procedure

1. **Gather inputs and pick the variant.** Read every input completely; a prototype is the primary source for screen appearance and behaviour, but never for business rules that contradict approved artifacts.
2. **Ask what is missing** (at most 3–4 questions): feature name and document code; version (new v1.0 or update of vN); readers (testers, developers, acceptance); available prototype/design file and contract.
3. **Draft** using the structure below and the detailed skeleton in `reference/srs-template.md`. Read the skeleton before writing.
4. **Self-review as a tester:** for each behaviour table — can I write a test case now? Are happy, negative, edge and boundary cases covered? Is every input → expected output explicit? Is every error code tied to a precise condition?
5. **Self-review as a developer:** can I build each screen from the component table and visual spec? Does each API have method, path, authentication, request and response schemas and errors? Is the data section enough to design a migration? Are rules unambiguous and non-contradictory?
6. **Fix and report:** apply fixes that follow from sources; list what changed; ask about anything that needs a decision instead of deciding it.
7. **Approval:** present a summary (sections, number of screens, rules, error codes, open questions, review fixes) and wait for an explicit confirmation before producing a final file. Feedback → revise → ask again.
8. **Issue:** only after confirmation, export in the format the project uses; save to the documented location from the project context; never overwrite an existing version — increment it and add a change-log row.

### Updating an existing SRS

Read the current version; change only the agreed sections; update the change log and version everywhere it appears (title page, header, change log); verify by diff that nothing else changed.

## Structure (summary — full skeleton in `reference/srs-template.md`)

- **Front matter:** title page (project, document type by variant, feature, document code, version, date) · change log (date, location, reason, source, old version, description, new version) · approval page (prepared by, reviewed by, client approval) · table of contents.
- **1 Introduction:** purpose and readers · glossary (every domain term, technical term and abbreviation used) · references (documents, prototypes, contracts with dates) · overview (what, for whom, on which platforms).
- **2 Function list:** `| No | Code | Function | Notes |` — each function small enough for one or two screens.
- **3 Detailed functional requirements**, per function: purpose · business process by phase (who does what, system response, outcome; diagram reference) · screens (display condition, components, behaviours, visual specification) · business rules (`BRL-`/`BR-` with logic, data example, references) and reference value tables · affected APIs (method, endpoint, description, notes) · data requirements (tables/entities and key fields — proposed, not a database design) · related systems.
- **4 Non-functional requirements:** each measurable — performance, compatibility, security and audit, usability and accessibility, consistency/data effect, plus availability, capacity, privacy where applicable.
- **5 Error codes:** `<FEATURE>-E<NN>` · exact text the user sees · precise triggering condition.

Variant changes: **API** replaces screens with endpoint specification (method, path, authentication, rate limit), request (headers, parameters, body schema table), response (success schema, each error), sequence diagram. **Integration** adds field mapping (source ↔ target, transformation, mandatory/optional), retry and fallback, data validation, monitoring and alerts, reconciliation. **Report** specifies data sources, filters and defaults, formulas, grouping and sorting, layout, export formats, permissions, performance limits.

## Language rules

| Vague | Precise |
|---|---|
| "The user presses the button" | "The administrator selects [Create]" |
| "Show a notification" | "The system displays error MOD-E03: '<exact text>'" |
| "Save data" | "The system validates 5 conditions, saves the record, exits edit mode" |
| "Cannot delete" | "[Delete] is disabled (greyed, not clickable); hover shows '<text>'" |
| "Fast" | "List loads within 2 s at p95 for 10,000 records" |

## Review checklist

Structure
- [ ] Front matter complete; version identical on title page, change log and header.
- [ ] All five sections present; non-applicable parts state "N/A — reason".

Content
- [ ] Every screen has components, behaviours and a visual specification (layout, tokens, assets, visual states) referencing design-token names only.
- [ ] Every behaviour table covers happy, empty, error, edge and disabled states; every button and input has defined behaviour; dialogs state when they open and how they close.
- [ ] Every rule has logic, an example where complex, and references to screens and error codes.
- [ ] Every error code has exact text and a precise condition.
- [ ] NFRs are measurable.

Technical and cross-reference
- [ ] APIs have method, path and description; data section names entities and key fields; reference values listed.
- [ ] Screen ↔ rule ↔ error-code references are consistent; glossary covers every term used.
- [ ] Every statement traces to an upstream ID or decision; unknowns are `[NEEDS CONFIRMATION]`/`Q-`.

## Stop conditions

- Only a text description exists and key behaviour would have to be invented — draft with `[NEEDS CONFIRMATION]` markers and ask; never present invented behaviour as specified.
- The document is about to be exported or sent without explicit confirmation.

## Hand-off

The approved SRS goes to developers (`sdlc-feature-workflow`, `sdlc-design`), testers (test design from behaviour tables and error codes), the architect (`sdlc-sa-solution-design`), and the PM for acceptance criteria and sign-off (`sdlc-pm-quality`). Update the traceability matrix in `sdlc-ba-requirements`.
