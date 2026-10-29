# Functional specification template

Used by `sdlc-ba-functional-spec`. Replace `<MOD>` with a short module code (for example `APPR`). Keep every heading; write `None` or `TBD — source silent` / `GAP — needs confirmation (Q-nn)` instead of deleting. Labels `[DECISION]`, `[ASSUMPTION]`, `[OPEN QUESTION]` from the sources are kept verbatim.

```markdown
# Functional specification — <feature name> · v<N> · DRAFT | IN REVIEW | APPROVED

| Field | Value |
|---|---|
| Feature / epic | … |
| Target release | … |
| Document owner | … |
| Designer · Developers · Testers | … |
| Sources | <URD vN §…, feature brief vN, decisions DL-…> |
| Principle | Only content supported by the sources; unknowns marked TBD/GAP |

## 1. Description
<2–4 sentences: business goal and scope>

## 2. Sub-features
| ID | Sub-feature | Short description | Requirement IDs |
|---|---|---|---|
| FT-<MOD>-01 | … | … | BR-… |

## 3. Actors and systems
| ID | Actor / system | Role in this feature | Permissions summary |
|---|---|---|---|
| ACT-<MOD>-01 | … | … | … |
| SYS-<MOD>-01 | … | … | … |

## 4. Scope
| ID | Scope item (per platform: web, mobile, back office, API) |
|---|---|
| SC-<MOD>-01 | … |
| OOS-<MOD>-01 | Out of scope: … |

## 5. Main processing flow
| ID | Flow | Step | Actor / system | Action and system response |
|---|---|---|---|---|
| FL-<MOD>-01-01 | <flow name> | 1 | … | … |

## 6. Configuration
| ID | Setting | Default | Allowed values | Who can change | Audited |
|---|---|---|---|---|---|
| CFG-<MOD>-01 | … | … | … | … | … |

## 7. Constraints and impacts
### 7.1 Constraints
| ID | Constraint |
### 7.2 Impact on systems
| ID | System | Impact |
### 7.3 Impact on users
| ID | User group | Impact |

## 8. Business rules
| ID | Rule (condition → outcome) | Example with data | Applies to (UC/step/screen) | Source |
|---|---|---|---|---|
| BRL-<MOD>-01 | … | … | … | … |

## 9. Validations
| Field / input | Rule | When validated | Message ID |
|---|---|---|---|

## 10. State model
| From state | Event / action | Actor | Guard | To state | Side effects |
|---|---|---|---|---|---|
Forbidden transitions: …

## 11. Messages
| ID | Exact text | Trigger condition | Shown where |
|---|---|---|---|
| ERR-<MOD>-01 | "…" | … | … |

## 12. Permissions
| Action | Role A | Role B | Role C | Ownership rule |
|---|---|---|---|---|
| View request | Own only | All in unit | — | Owner or same unit |

## 13. User stories
### US-<MOD>-01 — <title>
| As a | I want | So that | Priority |
|---|---|---|---|
#### Acceptance criteria
- **AC-<MOD>-01-01 — <name>:** Given … When … Then … (related: UC-<MOD>-01)
- **AC-<MOD>-01-02 — <negative>:** Given … When … Then …

## 14. Use cases
### UC-<MOD>-01 — <title>
| Attribute | Value |
|---|---|
| Related stories / criteria | US-<MOD>-01 / AC-<MOD>-01-01 |
| Actor | … |
| Trigger | … |
| Preconditions | … |
| Priority | MUST / SHOULD / COULD / TBD |
| Notes | … |
**Main flow**
1. …
**Alternative flows**
- A1 (at step n): …
**Error flows**
- E1 (at step n): … → message ERR-<MOD>-0x; flow returns to step m | ends
**Postconditions**
- …

## Appendix A — Traceability
| Requirement | User story | Acceptance criteria | Use case | Rules / flows / config |
|---|---|---|---|---|

## Appendix B — Open questions · assumptions · decisions
| ID | Item | Owner | Impact | Status |

## Appendix C — Change log
| Version | Date | Change | Reason / CR | Author | Approved by |
```
