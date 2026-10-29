# Digital banking checklist (retail and business)

Use with `payments-fintech.md` for any money movement and with `cross-cutting.md` always. Product-specific values (exact limits, attempt counts, authentication methods) come from the project, never from this file.

## A. Retail mobile and web banking

### Feature groups — split, do not test "banking" as one thing

Onboarding and identity verification; login, device binding and trusted devices; authentication methods management; balances and transaction history; statements and documents; transfers (own, internal, external, instant, by account/card/phone alias/QR); beneficiaries; bill payment and top-ups; cards (activate, lock/unlock, limits, PIN, virtual cards); savings/deposits (open, top-up, early withdrawal, maturity); loans (apply, repay, schedule); notifications and balance alerts; profile and settings; limit management; support/chat.

### State dimensions

Customer verification level and segment/tier (limits and features differ per tier); account states (active, locked by failed logins, suspended, dormant, closed, restricted); **authentication-method lock is independent of login lock** — test them separately; device trusted/new/replaced; service enrolment (feature not activated, activation required).

### Checklist

- Onboarding: document capture and liveness (manual or partial automation), duplicate customer detection, resume interrupted onboarding, age/eligibility rules, consent capture with versioning
- [C] Device binding: new device requires verification; old device deregistered as specified; limit on number of devices; SIM change or phone number change handling
- [C] Authentication method lifecycle: enrol, change (requires old method), lock after configured failures, re-activation; device clock skew effect on time-based codes
- Balances/history: pagination, filters by date/type/amount, pending vs posted, running balance, export/statement equality with history
- [C] Beneficiaries: add requires authentication if specified; name lookup; edit/delete; cannot use a beneficiary of another customer
- Cards: lock/unlock immediate effect on authorization; limit change bounds; masked display; reveal requires authentication
- Savings/deposits: interest calculation at boundaries, maturity instructions, early withdrawal penalties, holiday maturity shift
- Notifications: balance-change alert after every successful posting, once; delayed alert vs app state; preview masking
- App lifecycle: background/foreground during a transaction, auto-logout timer, app-switcher masking, forced update / minimum supported version
- Entry points: every path to a feature (home tiles, search, menus, deep links, notifications) reaches the same validated flow

## B. Business / corporate banking (web and mobile)

### Roles and approval

- [C] **Maker-checker-approver**: maker creates, checker verifies, approver(s) authorize; a user cannot approve their own transaction unless explicitly allowed; approval levels by amount; sequential vs parallel approvals; minimum number of approvers
- [C] **Permission matrix**: per user × account × function × amount band; test each cell class (allowed, denied, allowed up to band); changes take effect on pending items as specified
- Delegation and substitutes; user deactivation with pending items
- Rejection with reason, return to maker, edit and resubmit creates an auditable new version
- Expiry of unapproved items; cut-off for value date

### Bulk operations

- Bulk upload files: template validation, header/encoding/delimiter errors, max rows (max, max+1), duplicate rows, partial-invalid files (reject all vs accept valid rows — per requirement), totals and checksums, idempotent re-upload of the same file
- Bulk approval of many items; partial failures reported per item

### Mobile approvals and notifications

- Notification-driven tasks open the right item with current status (already approved by someone else, expired)
- Role-based visibility on small screens; amount and counterparty always visible before approval
- Session and security handling equal to web; step-up authentication for approval

### Audit and browser behavior

- [C] Audit trail for every create/edit/approve/reject/cancel with user, time, before/after
- Multi-tab and back-button behavior on approval pages (no double approval)
- Export permissions and watermarking if specified

## Common defects

Approval bypass through direct API call; self-approval allowed; permission change not applied to queued items; bulk file accepted twice; history and statement disagree; login lock and method lock confused; feature reachable from a deep link without enrolment check.

## Automation notes

Candidates: permission matrix and approval rules via API, bulk file validation sets, history/statement consistency with seeded data. Partial/manual: identity document capture and liveness, device binding with real SIM/phone, push approvals on real devices.
