# Backend security checklist

Use with `sdlc-be-security` (and in `sdlc-review` for backend changes). Each item shows the **default severity** if it fails; adjust with evidence (exposure, data class, compensating controls). Report each finding as `severity · location · risk · fix`. Examples span stacks and are illustrative.

## 1. Secrets

- [Critical] Credential, API key, token, private key, signing secret or connection string with password in source, tracked config, tests, fixtures, container files, CI definitions, docs or comments.
- [Critical] Secret present in git history even if removed later (rotation required).
- [High] Secret files (`.env*`, `*.pem`, `*.key`, `*.p12`, local settings) not covered by ignore rules; verify with `git check-ignore -v <file>`.
- [High] Secrets passed on command lines, in URLs (including git remotes) or in container image layers.
- [Medium] Secret read from a literal default when the environment variable is missing (`password = env("DB_PASSWORD", "changeme")`) — must fail fast instead.
- Quick local patterns for a first pass (confirm every hit manually): `-----BEGIN .*PRIVATE KEY-----`, `(?i)(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]{6,}`, `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`, `AKIA[0-9A-Z]{16}`, connection strings with `user:pass@`.

## 2. Dependencies and supply chain

- [Critical/High] Known vulnerability with a reachable code path in an internet-facing component (rate by advisory severity and reachability).
- [High] No lockfile, or the build ignores it; dependencies resolved from untrusted registries.
- [Medium] New dependency without a clear need, unmaintained, or with an incompatible license; typosquatting-like names.
- [Medium] Base container image outdated or running as root without need.

## 3. Authentication

- [Critical] Route or operation reachable without authentication that is not on an explicit public allowlist.
- [Critical] Token accepted without signature verification, with `alg: none`, or with an algorithm not on an allowlist (algorithm confusion).
- [High] Issuer, audience or expiry not validated; excessive clock skew; tokens never expire or cannot be revoked.
- [High] Passwords hashed with fast hashes (MD5, SHA-*, unsalted) instead of Argon2id/bcrypt/scrypt with appropriate cost.
- [High] No rate limiting or lockout on login, OTP verification, password reset, or token refresh; user enumeration through different messages or timings.
- [High] Reset/verification/invite tokens predictable, reusable, long-lived or not bound to the user.
- [Medium] Sessions not invalidated on logout, password change or privilege change; session id not rotated on login.
- [Medium] Sensitive operations (change email, change payout account, disable MFA) without re-authentication.

## 4. Authorization

- [Critical] **IDOR/BOLA**: object fetched or modified by id without ownership/tenant scope in the query — including ids in nested bodies, bulk arrays, export/report parameters, file keys, and filters such as `?userId=`.
- [Critical] Tenant isolation missing in a query, cache key, file path, search index or message routing.
- [Critical] Principal, role or tenant taken from the request body, query string or an unverified header/claim.
- [High] Function-level check missing on a new operation (deny by default not applied); admin endpoints reachable by ordinary roles.
- [High] **Mass assignment**: request bound onto an entity, or DTO exposes protected fields (`role`, `ownerId`, `status`, `price`, `isVerified`).
- [High] **Property-level exposure**: response includes fields the caller may not see (internal flags, other users' data, hashes, tokens).
- [Medium] 403 vs 404 discloses existence of other users' objects; sequential ids on sensitive resources without other controls.
- [Medium] Privilege elevation in code (system user, bypassing access rules) broader than needed or unaudited.

## 5. Injection

- [Critical] SQL/NoSQL built by concatenation or interpolation of input; raw ORM query fragments with input; dynamic identifiers (sort column, table) not allowlisted.
- [Critical] OS command built from input or executed through a shell; use argument arrays and allowlists.
- [Critical] Server-side template or expression-language evaluation of input (SSTI).
- [High] XML parser with external entities or DTDs enabled (XXE).
- [High] LDAP/XPath queries built from input without escaping.
- [Medium] Header or log injection: CR/LF from input written into headers or log lines; untrusted input in redirect targets (open redirect).

## 6. Server-side request forgery

- [Critical] Server fetches a user-supplied URL (webhook target, import-from-URL, image/preview fetcher, PDF renderer) without scheme and host allowlisting.
- [High] Allowlist checked on the hostname but not on the resolved IP; private (RFC 1918), loopback, link-local and metadata addresses (for example `169.254.169.254`) reachable; IPv6 and DNS-rebinding not considered.
- [Medium] Redirects followed without re-validation; no timeout or response size limit.

## 7. Deserialization and parsing

- [Critical] Native/polymorphic deserialization of untrusted data (object streams, pickle-like formats, type hints taken from the payload).
- [High] Unsafe YAML loaders; JSON libraries configured to instantiate arbitrary types.
- [High] Archive extraction without path normalization (zip slip) or without size/ratio limits (decompression bomb).
- [Medium] No maximum depth, size or item count for parsed payloads.

## 8. Files

- [High] Upload type trusted from the extension or client `Content-Type`; executable content stored in a served directory.
- [High] Download endpoint builds a path from input (path traversal) or serves files without per-object authorization.
- [Medium] No size limit; original file names used on disk; missing `Content-Disposition: attachment` for user content; no malware scanning where the domain requires it.

## 9. Abuse and resource exhaustion

- [High] Expensive or abusable operations (search, export, report, send OTP/email/SMS) without per-principal or per-IP rate limits — cost and spam abuse.
- [Medium] Page size, batch size, body size or upload size unbounded; no timeouts on outbound calls; regular expressions vulnerable to catastrophic backtracking on input.
- [Medium] Work amplification: one request triggers unbounded fan-out (notifications to all users, recursive expansion).

## 10. Sensitive data exposure

- [Critical] Credentials, tokens, card data (full number, CVV, PIN), government ids or passwords in logs, error responses, analytics, message payloads or caches.
- [High] Stack traces, SQL, table names, hostnames or framework versions in client-facing errors.
- [High] TLS certificate validation disabled or hostname verification turned off in any outbound client.
- [Medium] Sensitive columns not encrypted at rest where policy or regulation requires; personal data copied to non-production without scrubbing; `Cache-Control` missing on sensitive responses.

## 11. Cryptography

- [Critical] Home-made encryption or signing schemes; hard-coded keys or IVs.
- [High] Non-cryptographic random (`Math.random`, default PRNGs) for tokens, ids that grant access, OTPs or nonces.
- [High] MD5/SHA-1 for signatures or integrity; ECB mode; unauthenticated encryption where tampering matters; nonce reuse with GCM.
- [High] Signatures, HMACs or tokens compared with ordinary string equality (timing attack) — use constant-time comparison.
- [Medium] Webhook/request signatures without timestamp and replay window; keys not rotatable.

## 12. Configuration and platform

- [High] Debug mode, interactive consoles, verbose error pages or management/metrics endpoints exposed publicly or without authentication.
- [High] CORS reflecting arbitrary origins with credentials, or `*` on authenticated APIs.
- [High] Cookie-authenticated state-changing endpoints without CSRF protection (token or SameSite strategy).
- [Medium] Missing `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, appropriate `Content-Security-Policy` for any HTML served; cookies without `Secure`, `HttpOnly`, `SameSite`.
- [Medium] Default credentials, demo accounts or sample data enabled; features on by default before configuration.

## 13. Business logic

- [Critical] Money or quota operations vulnerable to races (double spend, double redeem, overdraft) — no atomic conditional update, lock or constraint.
- [High] Client-supplied price, total, discount or fee trusted; negative quantities or amounts accepted; integer overflow in amounts.
- [High] Workflow steps skippable by calling a later operation directly; state transitions not guarded.
- [Medium] Replays possible on state-changing operations without idempotency keys or nonces.

## 14. Logging, audit and monitoring

- [High] No audit record for privileged actions, authentication events, permission changes and access to sensitive data.
- [Medium] Security-relevant failures (authorization denials, signature failures, rate-limit hits) not logged or not alertable; audit logs mutable by the application.
