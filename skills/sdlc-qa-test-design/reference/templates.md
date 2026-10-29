# Test design templates

Use the project's own format when it has one. Otherwise use these. IDs: `REQ-nn` (register), `BR/FR/AC/NFR-nn` (classified), `SC-nn` (scenario), `TC-<MOD>-nnn` (test case), `EC-<MOD>-nnn` (edge case), `UX-<MOD>-nnn` (UI/UX check), `AT-nnn` (automation candidate). IDs are never reused after deletion.

## 1. Suite overview

| Field | Value |
|-------|-------|
| Feature / release | |
| Version / date / author | |
| Source documents (with versions) | |
| Platform type | web / mobile / backend / mixed |
| Methodology | e.g. risk-based + BVA + decision table + state transition |
| Domain checklist applied | e.g. payments, CRM (see `sdlc-qa-domain-checklists`) |

## 2. Scenario list

Group rows under a module header row `▌ <MOD> — <module name>`.

| SC-ID | Module | Scenario | Requirement refs | Technique | Risk | Coverage status | Notes |
|-------|--------|----------|------------------|-----------|------|-----------------|-------|
| SC-01 | PAY | Pay with sufficient balance | BR-01, AC-02 | Use case + state transition | High | Covered | |
| SC-02 | PAY | Amount at / around min and max | BR-03 | BVA + EP | High | Covered | |

Coverage status: `Covered / Partially covered / Not covered`.

### Scenario approval record

| Field | Value |
|-------|-------|
| Review round / date / reviewer | |
| Decision | Pending / Approved / Approved with comments / Rejected |
| Comments to apply | numbered list, each linked to SC-IDs |
| Ready for detailed design | yes / no |

## 3. Test cases

Order inside each module: happy → unhappy → boundary/validation → business rule → alternate/exception → regression.

| TC-ID | SC-ID | Req ref | Title | Preconditions | Steps (action → verify) | Test data | Expected result | Technique | Priority | Type | Automation | Actual result | Status <platform 1> | Evidence <platform 1> | Status <platform 2> | Evidence <platform 2> | Defect ID | Notes |
|-------|-------|---------|-------|---------------|-------------------------|-----------|-----------------|-----------|----------|------|------------|---------------|---------------------|-----------------------|---------------------|-----------------------|-----------|-------|

- Priority: `Critical / High / Medium / Low`. Type: `Happy / Unhappy / Boundary / Regression / Edge`.
- Automation: empty until candidate selection, then `Candidate / Partial / Manual-only / Deferred`.
- Status: `Pass / Fail / Blocked / Not Run / N/A` — filled only after real execution.
- Platform columns: use what applies (iOS/Android, browser A/B, API version); delete the rest.

### Expected-result format

```
[SCREEN] Payment confirmation (after step 4)
  > Amount shows 1,000.00 with currency code          [AC-02]
  > Fee line shows 0.00 ("no fee" per BR-05)          [BR-05]
[STATE] After step 5
  > Exactly one payment record with status SUCCEEDED   [BR-07]
  > Source balance decreased by amount + fee           [BR-07]
  > Audit entry with user, action, amount, timestamp   [NFR-02]
[OPEN] OPEN-03: behavior when the user closes the receipt is not specified → record actual behavior
```

### Test data column format

```
✓ 10.00   — at minimum, accepted            [BR-03, spec §3.2]
✗ 9.99    — below minimum, must be rejected  [BR-03]
— 1,000.00 — mid-range value for happy path
```

## 4. Edge cases

Same columns as test cases plus `Category`. Start each group with a header row.

| Category | Typical cases | Default priority |
|----------|---------------|------------------|
| Idempotency | double submit, client retry, replayed request, re-run job | Critical where money/data |
| Concurrency | two actors/devices on one record or balance; last-write-wins vs conflict | Critical where money/data |
| Network resilience | loss/timeout after submit, reconnect, no ghost or orphaned operation | Critical / High |
| Session & auth | expiry mid-flow, re-authentication, revoked permission mid-session | High |
| Consistency / reconciliation | UI = API = stored state = downstream records | Critical where money |
| Audit & observability | required audit fields written; no sensitive data logged | High |
| Lifecycle (mobile) | background/foreground, kill/relaunch, rotation, low memory | High / Medium |

## 5. Test data specification

```markdown
# Test data specification — <feature>
## Boundary table
| Rule | Min−1 | Min | Max | Max+1 | Other (just inside, zero, negative, empty) |
## Happy-path data sets
| Set | Field | Value | Why valid (rule ref) |
## Error-trigger data
| Target failure | Data / setup | Expected |
## State combinations
| Combo | Actor state | Object state | Dependency state | Expected |
## Format validation
| Field | Valid examples | Invalid examples (rule violated) |
## Stub / mock strategy
| Dependency | Strategy in test env (stub, sandbox, seeded account, fixed one-time code) | Consequence if unavailable (manual-only) |
## Accounts and roles
| Role | Test identity (no real secrets in this file) | Required state | Reset method |
```

Rules: concrete values only; synthetic data; credentials referenced by name of the secret/variable, never written here; `TBD — confirm with <role>` for unknown formats.

## 6. Traceability matrix

| REQ-ID | Type | Classified as | Priority | Summary | SC-IDs | TC-IDs | Coverage status | Notes |
|--------|------|---------------|----------|---------|--------|--------|-----------------|-------|
| REQ-01 | FR | FR-01 | High | … | SC-01 | TC-PAY-001, TC-PAY-002 | Covered | |
| REQ-05 | NFR | NFR-01 | Medium | p95 < 2 s | — | — | Out of scope (performance test) | owner: perf |

Status values: `Not yet covered` (before design), `Covered`, `Partially covered`, `Not covered` (gap), `Out of scope`.

```
Total REQ: N   Out of scope (OOS + NFR routed elsewhere): q   Testable: N − q
Covered: a   Partial: b   Not covered: N − q − a − b
Coverage = (a + b) / (N − q)    Full coverage = a / (N − q)
```

Update the matrix in place; never regenerate IDs.

## 7. Suite summary

| Module / section | Total | Happy | Unhappy | Boundary | Edge | UI/UX | Critical | High | Medium | Low |
|------------------|-------|-------|---------|----------|------|-------|----------|------|--------|-----|
| **Total** | | | | | | | | | | |

## 8. CSV export

Header row = test case columns above. Multi-line cells: keep numbered lines inside one quoted cell (`"1. … ⏎ 2. …"`). UTF-8, comma separator, one file per section (cases, edge cases, UI/UX). Section header rows are omitted in CSV; use a `Module` column instead.
