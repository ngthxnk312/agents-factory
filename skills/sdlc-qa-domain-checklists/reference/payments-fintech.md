# Payments and fintech checklist

Scope: money movement (internal/external transfers, instant payments, wallets, top-ups, bill payments, QR payments, card operations), fees, foreign exchange, savings/deposits, loans/repayments, merchant acquiring. Use with `cross-cutting.md`; for bank apps also `digital-banking.md`.

**Golden rules** — money safety first; never lose money (complete rollback or completion, never in between); never duplicate money (idempotency); always consistent (UI = API = ledger = downstream = settlement); always test boundaries.

## 1. State dimensions (split cases by these, never "valid user")

| Dimension | Values to consider |
|-----------|--------------------|
| Customer | identity verification pending / verified; active / locked / suspended / dormant / closed; risk-flagged |
| Source of funds | sufficient / exactly sufficient / insufficient / zero / negative-capable (overdraft) balance; frozen; restricted for debits |
| Destination | valid / non-existent / closed / wrong institution / wrong format / own account / blocked counterparty |
| Limits | per-transaction, daily, monthly, per-channel, per-tier: under / at / over; **cumulative** totals across earlier transactions the same day; limit tier change mid-day |
| Authentication | each supported method separately (SMS/email code, authenticator/soft token, push approval, signing device, biometrics); not enrolled; locked method |
| Device | trusted / new / changed; rooted/jailbroken; clock skew |
| Dependency | core ledger, switch/scheme, card processor, biller, fraud engine, notification — available / timeout / error / duplicate callback |
| Time | business day vs holiday/weekend, cut-off times, end-of-day processing window, month end, value date |

## 2. Transaction lifecycle — cover every stage

1. **Initiation** — entry points (home, search, shortcuts, deep links, QR scan); source/destination/biller selection; amount input formatting (thousand separators, decimals, currency precision, paste, max digits).
2. **Confirmation** — summary shows source, destination name (from lookup), amount, fee, total, FX rate and its validity, reference/memo; editing and going back preserves correct data; name lookup mismatch handling.
3. **Authentication / step-up** — each method tested separately; correct / wrong / expired / reused / resend invalidates previous code / attempt limit and its consequence (cancel, cool-down, method lock); step-up thresholds (amount per transaction **or** cumulative daily total crossing the threshold triggers stronger authentication); method change requires authentication with the old method; session expiry between confirmation and authentication.
4. **Processing** — status transitions pending → succeeded / failed / reversed; [C] timeout handling shows a determinable status, never "success" without confirmation; [C] downstream rejection after debit triggers reversal; long-pending items reconciled.
5. **Post-transaction** — [C] balance after = balance before − (amount + fee) on source; destination credited with amount only; [C] ledger entries balanced; history entry with correct timestamp, reference, status; receipt; balance-change notification sent once; reopening the app/reloading shows the same final state.

## 3. Critical risk areas

- [C] **Idempotency**: double tap, client retry with same request id, replayed request, re-scanned static QR, repeated callback → exactly one effect
- [C] **Concurrency**: two transactions from the same source at once (balance 1,000; two × 700) → at most one succeeds; never negative balance; limits consumed atomically
- [C] **Network resilience**: loss after submit, app killed after submit, retry → no ghost, no double
- [C] **Reconciliation**: app vs ledger vs scheme/switch vs settlement files; mismatches detected and reported by the reconciliation job
- [C] **Fees and rounding**: fee tiers and boundaries, fee waivers, currency minor units, rounding mode, FX spread, displayed vs charged amount equal
- [C] **Limits**: each tier/group the customer can belong to, tier changes, cumulative totals, reset at period boundary (time zone!)
- [C] **Authorization**: cannot debit an account the user does not own or is not mandated for; cannot view another customer's receipts by id
- [C] **Fraud/AML hooks** (if in scope): rule-triggering transactions are held/flagged/logged as specified; no bypass by splitting amounts below thresholds if the rule covers aggregation
- Cut-off and value dating: submissions just before/after cut-off, on holidays; scheduled and recurring payments execute once at the right date, skip/shift rules
- Cancellation/reversal/refund windows and partial refunds
- Statements and exports match history

## 4. Integration failure modes

Core ledger, payment switch/scheme, card processor, biller, FX rate provider, fraud engine, notification gateway: timeout, specific error codes, duplicate response, late callback after timeout, partial success, maintenance windows.

## 5. Security and privacy

- [C] One-time-code bypass attempts (skipping the step via API, reusing an old code, brute force within rate limits)
- [C] Masked account/card numbers on screens, notifications, logs; no full card numbers stored or logged
- [C] Amount/recipient tampering between confirmation and execution (server re-validates)
- Screenshot protection and app-switcher masking on sensitive screens (mobile), root/jailbreak detection behavior, certificate pinning behavior on intercepting proxies (test builds), session hijacking protections

## 6. Common defects in this domain

Duplicate transfer on retry; wrong balance after failed transaction; status stuck in pending; fee or interest miscalculated at tier boundary; cumulative limit not enforced across channels; one-time code still valid after resend; session not expired after logout; race condition producing negative balance; notification sent twice or not at all; time-zone error at daily limit reset.

## 7. Signs of a weak suite

Checks only "success screen"; no balance/ledger verification; no per-method authentication cases; only per-transaction limits, no cumulative limits; no double-submit, concurrency, timeout-after-debit or reconciliation cases; one limit tier only.

## 8. Automation notes

Candidates: validations, limit and fee boundary sets (API level), idempotency via API replays, status transitions with stubbed downstream responses, history/receipt correctness with seeded accounts. Partial: flows up to a real second-factor step (use test-environment fixed codes or stubs). Manual-only: real biometrics, real devices for push approval, physical card/terminal flows, visual receipts judgement. Never automate against real accounts or real payment rails.
