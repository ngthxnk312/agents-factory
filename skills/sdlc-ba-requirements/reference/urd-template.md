# URD template (user requirements document)

Used by `sdlc-ba-requirements`. Keep every heading; write `None` or `N/A — <reason>` instead of deleting a section. Every item cites its source.

```markdown
# User Requirements — <project / feature> · v<N> · DRAFT — not approved | BASELINE (approved by <name>, YYYY-MM-DD)

| Field | Value |
|---|---|
| Owner (BA) | … |
| Business owner | … |
| Approver(s) | … |
| Sources | <meetings with dates, documents with versions> |
| Previous version | v<N-1> (link) |

## 1. Background and objectives
| ID | Objective (measurable) | KPI / target | Source |
|---|---|---|---|
| BO-01 | … | … | … |

## 2. Scope
| In scope | Out of scope | Deferred (later phase) |
|---|---|---|

## 3. Stakeholders and actors
| Actor / role | Description | Goals | Permissions (high level) |
|---|---|---|---|

## 4. As-is and to-be summary
<short narrative; reference process diagrams>

## 5. Business requirements
| ID | Requirement | Priority (MoSCoW) | Rationale / objective | Source | Owner | Status |
|---|---|---|---|---|---|---|
| BR-01 | The system shall … | Must | BO-01 | Meeting YYYY-MM-DD, decided by <role> | … | Confirmed |

## 6. User stories / use cases (summary)
| ID | Title | Actor | Related BR | Priority | Acceptance criteria (summary) |
|---|---|---|---|---|---|

## 7. Business rules
| ID | Rule (condition → outcome) | Example | Source |
|---|---|---|---|

## 8. Non-functional requirements
| ID | Category | Requirement | Metric / threshold | How measured | Source |
|---|---|---|---|---|---|

## 9. Integrations and data
| ID | System | Direction | Purpose | Data exchanged | Owner |
|---|---|---|---|---|---|

## 10. Constraints
| ID | Constraint | Type (time/budget/technology/regulatory/organisational) | Source |

## 11. Assumptions
| ID | Assumption | Owner to confirm | Confirm by | Impact if false |

## 12. Dependencies and risks
| ID | Item | Type | Owner | Impact |

## 13. Open questions
| ID | Question | Severity | Type | Owner | Impact if wrong | Status |

## 14. Decision log
| ID | Decision | Decided by | Source | Date |

## 15. Glossary
| Term | Definition | Synonyms / abbreviation |

## 16. Change log
| Version | Date | Change (IDs added/changed/removed) | Reason | Source | Author | Approved by |
```

Conventions:

- Version numbers increase on every issued change; draft iterations inside one review round may keep the number.
- A baselined version is never edited; a `CR-` produces the next version.
- File naming follows the project's convention; default `URD_<feature>_v<N>`.
