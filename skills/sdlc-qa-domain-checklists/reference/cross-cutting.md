# Cross-cutting risk checklist (all domains)

**[C]** = critical consequence (security, data integrity, money, legal) → test negative, boundary and failure paths and verify stored state.

## 1. Identity and authentication

- [C] Login with valid/invalid credentials; generic error that does not reveal which part was wrong or whether the account exists
- [C] Lockout / throttling after the configured number of failures; counter reset rules; unlock path
- [C] Multi-factor / one-time code: correct, wrong, expired, reused, resent (old code invalidated), attempt limit, rate limit on resend
- [C] Password/credential change and reset: old sessions revoked as specified; reset tokens single-use and expiring
- Remember-me / biometric / device login: enable, disable, fallback, re-enrolment after credential change
- Account states: pending verification, active, locked, suspended, dormant, closed — each login/action behavior

## 2. Sessions

- [C] Idle and absolute timeout at the configured values (just before / at / after)
- [C] Logout invalidates the session server-side; back button and cached pages do not reveal data
- [C] Session expiry in the middle of a form or multi-step flow: no stale or partial submission, clear re-authentication path
- Concurrent sessions / multiple devices: allowed, limited or single-session as specified; notification of new login
- Token refresh failure handling

## 3. Authorization

- [C] Unauthenticated access rejected on every endpoint/screen, including deep links
- [C] Role without permission rejected (UI hidden **and** server-side enforced)
- [C] Object-level: user A cannot read/modify/delete user B's object by changing an id (expect not found/forbidden)
- [C] Tenant isolation in multi-tenant systems; exports and search respect permissions
- Permission changes take effect for active sessions as specified

## 4. Input handling

- Required, length (min/max, max+1), format, type, range, allowed characters, unicode/emoji, leading/trailing spaces, empty vs whitespace
- [C] Injection on every input reaching a query, command, template or HTML (SQL/NoSQL, script injection, path traversal, header injection) — web and API
- Copy-paste, autofill, very large input, numeric precision and rounding, negative and zero values
- Dates: time zones, daylight-saving changes, month/year end, leap day, past/future limits

## 5. Concurrency and idempotency

- [C] Double click / double submit / client retry produces one effect
- [C] Two actors edit the same record: conflict detection or defined last-write behavior; no lost update
- [C] Re-running a job or re-delivering a message produces no duplicate effect
- Optimistic locking messages are understandable

## 6. Offline, network and sync (mobile and rich web clients)

- No network at start; loss mid-operation; slow network; network switch (Wi-Fi ↔ cellular); captive portal
- [C] Operation submitted then connection lost: final state determinable, no ghost or duplicate operation on retry
- Offline edits queued, synced, conflicts resolved per rule; user informed of pending sync
- Cached data freshness indicated; cache cleared on logout

## 7. Integrations

For each dependency: success, business error codes, timeout, malformed response, duplicate callback, out-of-order callback, partial success, dependency unavailable for a long time.
- [C] Failure after a local commit: compensation/rollback or retry leads to a consistent final state
- Retries bounded with backoff; circuit-breaker behavior visible to users as specified
- Contract changes: unknown fields tolerated, removed fields handled

## 8. Batch jobs and scheduled processing

- Trigger at schedule, manual trigger, overlapping runs prevented
- [C] Idempotent re-run after partial failure; checkpoint/restart
- Time zone of schedule; end-of-day/month cut-off; holidays if relevant
- Empty input, huge input, malformed records (skip and report vs abort)
- Output files/reports correctness and delivery; monitoring/alerting on failure

## 9. Notifications (email, SMS, push, in-app)

- Sent once per event, to the right recipient, with correct content and locale
- [C] No sensitive data in notification previews; unsubscribe/preferences respected
- Delivery failure handling; notifications disabled at OS level
- Test environments never send to real people — verify the sink/stub

## 10. Files and media

- Allowed types/sizes (max, max+1), empty file, corrupted file, wrong extension vs content, very long names, unicode names
- [C] Malware scanning or rejection as specified; files not executable/served with dangerous types
- Download authorization (object-level); expiring links
- Camera/gallery permissions on mobile; large images compressed as specified

## 11. Search, filter, sort, pagination

- Empty query, no results, special characters, partial/case/diacritic-insensitive matching as specified
- Combined filters (pairwise), reset filters, filter persistence
- Stable sort with ties; pagination boundaries (first/last page, page size change, items added between pages)
- [C] Results respect permissions

## 12. Data migration and backward compatibility

- Existing records render and behave under the new version; defaults for new fields
- Old clients against new server (mobile apps cannot be force-updated instantly)
- [C] No data loss; counts and checksums match before/after; rollback path tested

## 13. Audit, logging and privacy

- [C] Audit records for security- and business-relevant actions: who, what, when (UTC), from where, before/after values as specified
- [C] No credentials, tokens, full card numbers or sensitive personal data in logs, URLs, analytics or crash reports
- Data subject rights if in scope: export, deletion/anonymization, consent changes

## Signs of a weak suite (any domain)

- Only "success message shown" checks; no stored-state verification
- One generic "valid user" instead of state combinations
- No authorization negatives; no dependency failure cases; no boundaries around thresholds
- No session/timeout or double-submit cases on forms that change data

## Automation notes

Good: validation rules, role/permission matrices via API, idempotency via API replays, boundary sets. Partial/manual: real multi-factor delivery, real devices for push, OS-level permission dialogs across many OS versions, human judgement of messages.
