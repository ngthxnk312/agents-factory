# SRS skeleton

Used by `sdlc-ba-srs`. Replace `<FEAT>` with the feature abbreviation (for example `PERM`). Keep every heading; non-applicable sections say `N/A — <reason>`. Markers: `[NEEDS CONFIRMATION]` for anything assumed, `[INSERT IMAGE: <caption>]` where a screenshot or diagram belongs.

```markdown
<!-- Title page -->
<Organisation> · <Project name>
<DOCUMENT TYPE: SCREEN SPECIFICATION | API SPECIFICATION | INTEGRATION SPECIFICATION | REPORT SPECIFICATION>
<FEATURE NAME>
Document code: <PROJECT>_SRS_<FEAT> · Version: v<X.Y> · <Month YYYY>

<!-- Change log -->
| Date | Location (sections) | Reason (Created / Added / Changed) | Source | Old version | Description | New version |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | All | Created | <team> | | Initial version | 1.0 |

<!-- Approval -->
Prepared by: ______ Date: ______ · Reviewed by: ______ Date: ______ · Client approval: ______ Date: ______

<!-- Table of contents (headings 1–4) -->

# 1. Introduction
## 1.1 Purpose
- Specifies <feature> on <product>.
- Readers: testers (test design), developers (implementation), acceptance reviewers.
- May be revised in later versions; see change log.
## 1.2 Glossary
| Term | Definition | Notes / abbreviation |
## 1.3 References
| Document | Date / version | Source | Notes |
## 1.4 Overview
<2–3 sentences: what, for whom, which platforms>

# 2. Function list
| No | Code | Function | Notes |
|---|---|---|---|
| 1 | <FEAT>-01 | … | … |

# 3. Detailed functional requirements
## 3.1 <Function>
### 3.1.1 Purpose
- Allows <actor> to …
- Supports …
- Supporting tools …
- Users and platforms …
### 3.1.2 Business processes
#### 3.1.2.1 P1 — <process name>
PHASE 1 — <name>: who does what · system response · outcome
PHASE 2 — …
[INSERT IMAGE: swimlane diagram P1] (source: process flow v<N>)
### 3.1.3 Screens
#### 3.1.3.1 SCR-01: <screen name>
Display condition: …
**Components**
| No | Component | Display description | Type / format | Constraints / notes |
**Behaviour**
| No | User action | System response | Expected result |
(cover happy path, empty, error, edge/boundary, disabled; reference other screens as "Ref: SCR-07")
**Visual specification** (source: design tokens v<N>)
- Layout: …
- Tokens: `…` (role)
- Assets: `…` (size)
- Visual states: empty — …; loading — …; error — …; selected — … (or `not in prototype`)
### 3.1.4 Business rules
#### BR-01: <short name>
[INSERT IMAGE: illustration]
- Logic …
- Example with data …
- Ref: SCR-…, <FEAT>-E…
#### Reference values
| No | ID | Name / value | Notes |
### 3.1.5 Affected APIs
| No | Method | Endpoint | Description | Notes |
### 3.1.6 Data requirements (proposed)
| No | Table / entity | Description and key fields |
### 3.1.7 Related systems
| No | System | Relationship |

# 4. Non-functional requirements
| No | Requirement | Description (measurable) |
|---|---|---|
| 1 | Performance | Page loads < 2 s at p95; interactions respond < 200 ms |
| 2 | Compatibility | Supported browsers/OS versions; minimum resolution |
| 3 | Security and audit | Only <roles> may access; every change written to the audit log with actor, time, before/after |
| 4 | Usability and accessibility | Follows the product design system; inline validation; target accessibility level |
| 5 | Consistency | Changes apply to new <objects> immediately; existing <objects> are unaffected |
(adjust values to the sources; add availability, capacity, privacy as applicable)

# 5. Error codes
| Code | Message shown (exact text) | Condition |
|---|---|---|
| <FEAT>-E01 | "…" | A row has no name when [Save] is selected |
```

API variant — replace 3.1.3 with:

```markdown
### 3.1.3 Endpoint specification
| Item | Value |
|---|---|
| Method / path | POST /v1/… |
| Authentication / authorisation | … (object-level rule) |
| Rate limit / idempotency | … |
**Request** — headers, path/query parameters, body schema:
| Field | Type | Required | Format / range | Description |
**Response** — success schema; each error: HTTP status, error code, condition
**Sequence** — diagram reference
```

Integration variant — add: field mapping (source field ↔ target field, transformation, mandatory/optional, default), retry and fallback (attempts, interval, behaviour on final failure), data validation, monitoring and alerts, reconciliation.

Report variant — add: data sources, filters and defaults, formulas, grouping/sorting, layout, export formats, permissions, volume and performance limits.
