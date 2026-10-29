# Client requirements document review — templates

Used by `sdlc-ba-requirements` Path B. Three deliverables; keep the client's original text, the analyst's observation and the analyst's proposal in separate columns.

## 1. Review report

```markdown
# Review — <client document name> v<x> (received YYYY-MM-DD from <sender>) · DRAFT

## Summary
- Overall readiness: Ready | Ready after clarification | Not ready — <one line why>
- Findings: Critical <n> · High <n> · Medium <n> · Low <n>
- Top risks to scope, schedule or compliance: …

## Coverage checklist
| Area | Present? | Quality | Notes |
|---|---|---|---|
| Scope in/out | Yes / Partial / No | … | … |
| Actors and stakeholders | | | |
| As-is / to-be | | | |
| Functional requirements | | | |
| Business rules | | | |
| Non-functional requirements (with metrics) | | | |
| Integrations and data | | | |
| Compliance / security / privacy | | | |
| Constraints and assumptions | | | |
| Ownership and approval | | | |

## Findings
| # | Severity | Location (section/page) | Original text (quoted or "absent") | Finding type | Observation (analyst) | Proposed question / proposal | Owner to answer |
|---|---|---|---|---|---|---|---|
| 1 | Critical | §3.2 | "User can update phone number" | Missing rule | No verification step or expiry defined for the confirmation code | How is the change verified, and how long is a code valid? Who approves this security rule? | Client security owner |
```

Finding types: missing section · ambiguous/untestable · NFR without metric · contradiction · missing owner · missing dependency · unverified compliance · unrealistic constraint · terminology inconsistency.

Severity rules:

| Severity | Use when |
|---|---|
| Critical | Blocks go/no-go: scope undefined, compliance or legal exposure, contractual conflict |
| High | Changes scope, NFR, integration, data ownership or business outcome |
| Medium | Must be clarified before functional specification, but does not change scope |
| Low | Wording, consistency, formatting |

## 2. Requirement mapping

```markdown
| Map ID | Client ref (section/page) | Client text (short quote) | Our item type | Proposed ID | Status (mapped / needs clarification / out of scope) | Notes |
|---|---|---|---|---|---|---|
| MAP-01 | §2.1 p.4 | "…" | Business requirement | BR-03 | mapped | |
```

## 3. Clarification list

```markdown
| ID | Question | Related finding / map ID | Severity | Addressed to | Needed by | Answer | Answered by / date |
|---|---|---|---|---|---|---|---|
```

After answers arrive, run Path A (synthesis) to create the URD draft; record each answer with its source in the decision log.
