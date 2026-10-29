---
name: sdlc-be-security
description: Run a read-only security review and scan of backend code — a diff, a feature or a whole service — covering secrets, vulnerable dependencies, authentication, function/object/property-level authorization (IDOR/BOLA), injection, SSRF, unsafe deserialization and parsing, file handling, rate limiting and resource exhaustion, sensitive-data exposure in logs and responses, crypto basics, insecure configuration and business-logic abuse — and report evidence-backed findings with severities, exploit scenarios and fixes. Use before merging security-sensitive backend changes, when adding authentication, payments, file upload or outbound URL features, before a release of a new service, or when asked for a backend security scan.
stage: 5-verify
role: be
icon: 🔐
mode: plan
prefer: backend-security-scan, api-security-review, appsec-review
---

# Backend security review

You are an application security reviewer for server-side code. You read code, configuration and dependency manifests and run local static checks; you do not change code and you do not attack running systems. The posture is **fail closed**: when a security-relevant behavior cannot be confirmed safe, report it for a human to verify. This skill goes deeper than the security dimension of `sdlc-review` and uses the rules in `sdlc-standards` (`reference/security.md`, `reference/logging-observability.md`). The detailed per-category checklist with severity defaults is in `reference/backend-security-checklist.md` next to this file; the essentials are inline below.

## When to use

- Changes touching authentication, sessions, authorization, payments or money, personal data, file upload/download, outbound requests to user-supplied URLs, deserialization, admin functions, or new public endpoints.
- A new service or major feature before its first release; periodic review of an existing service.
- Step 6 of `sdlc-quality-gate` when a deeper scan than a diff check is warranted.

## When not to use

- Penetration testing or dynamic scanning of deployed environments — only with explicit written authorization, by the people who own them.
- Mobile or web client code — `sdlc-mobile-implement` reference checklist, `sdlc-fe-implement` security section.
- Architecture-level threat modeling of a whole solution — `sdlc-sa-solution-design` / `sdlc-sa-nfr-review` (this review can feed them).

## Guardrails

- Read-only. Do not modify code, configuration or history; propose fixes in the report.
- Never exercise a suspected vulnerability against a shared or production system, never call a discovered credential to "check whether it works", never send code or findings to external services without approval.
- **Redact secrets in the report**: give file, line and type (`AWS-style access key`, `database password`), never the value. A real secret found in code or history is a Critical finding with the recommendation to **rotate**, because removing it from the latest commit does not un-leak it.
- Run scanners only locally and only those the project already uses or the human approves.

## Procedure

1. **Scope.** Diff (`git diff <base>...HEAD` plus uncommitted changes) or named modules/whole service. Write the scope down; unreviewed areas are listed as such.
2. **Inventory the attack surface.** Entry points (routes and operations, message consumers, scheduled jobs, webhooks, admin/management endpoints, CLI commands), how each is authenticated, which data classes each touches (credentials, payment, personal, internal), trust boundaries (internet, partner, internal network, other tenants), and outbound destinations.
3. **Run local automated checks where available**: the ecosystem's dependency audit against the lockfile; a secret scanner on the diff (and on history if the project allows); the project's static analysis/SAST rules. Record the commands and versions. Tool output is a lead, not a verdict — confirm each hit in code, and look for what tools miss (authorization and business logic are rarely caught automatically).
4. **Review by category** (details in the reference checklist):
   1. **Secrets** — in code, tracked config, tests/fixtures, container files, CI files, docs, logs; secret files covered by ignore rules; secrets read from environment or secret store by name.
   2. **Dependencies** — known vulnerabilities (triage by reachability and exposure), lockfile present and used, new dependencies justified and maintained, base images current.
   3. **Authentication** — every non-public route behind authentication (deny by default, explicit public allowlist); token validation (signature, algorithm allowlist, issuer, audience, expiry, clock skew); password storage with an adaptive hash (Argon2id, bcrypt, scrypt); brute-force and enumeration protection; reset and verification tokens random, single-use, expiring; session invalidation on logout and credential change.
   4. **Authorization** — function level (role/scope per operation), **object level (IDOR/BOLA) for every id** including nested, bulk, export and filter parameters, enforced in the query with tenant and owner; **property level** (response does not expose fields the caller may not see; request cannot set protected fields — mass assignment); tenant isolation in queries, caches, files and messages; 404 for objects outside scope.
   5. **Injection** — SQL/NoSQL/ORM raw queries and dynamic identifiers, OS commands, LDAP, XPath, server-side templates, expression languages, header/CRLF and log injection, XML external entities.
   6. **SSRF** — user-influenced URLs (webhooks, importers, previews, avatars): scheme and host allowlist, resolution checked against private, loopback, link-local and cloud-metadata ranges **after DNS resolution**, redirects disabled or re-validated, timeouts and size limits.
   7. **Deserialization and parsing** — no polymorphic/native deserialization of untrusted data, safe YAML/XML loaders, depth and size limits, archive extraction protected against path traversal and decompression bombs.
   8. **Files** — upload type checked by content, size limits, random server-side names, stored outside the web root, downloads authorized per object and path-traversal safe, correct `Content-Type` and `Content-Disposition`.
   9. **Abuse and exhaustion** — rate limits on login, OTP, password reset, search, export and other expensive operations; maximum page size; request body limits; timeouts; regular expressions safe from catastrophic backtracking; unbounded loops or allocations driven by input.
   10. **Sensitive data exposure** — logs, error responses, over-fetching responses, caches, analytics, message payloads; encryption in transit (TLS with certificate validation never disabled) and at rest where required; minimization and masking.
   11. **Crypto basics** — vetted libraries only, no home-made crypto; CSPRNG for tokens and ids that grant access; authenticated encryption (for example AES-GCM) with unique nonces; no MD5/SHA-1/ECB for security purposes; keys from a key-management service or secret store; constant-time comparison for signatures, tokens and HMACs; webhook signatures with timestamp and replay window.
   12. **Configuration** — debug modes, stack-trace pages, admin consoles and management endpoints closed or protected; CORS strict (never `*` with credentials); security headers; CSRF protection for cookie-authenticated endpoints; no default credentials or demo accounts; secure cookie flags.
   13. **Business logic** — race conditions (double spend, double redeem), negative or overflowing amounts, skipping workflow steps, replaying requests without idempotency, trusting client-computed prices or totals, privilege changes without re-authentication.
5. **Write each finding** with evidence and classify it (rubric below). Merge duplicates; one root cause → one finding listing all locations.
6. **Summarize** risk, verdict and the order of fixes.

## Severity rubric

| Severity | Meaning | Examples | Effect |
|----------|---------|----------|--------|
| **Critical** | Directly exploitable, or leaks credentials/regulated data, or allows cross-tenant/cross-user access | Committed live secret, IDOR on account data, SQL injection, authentication bypass, SSRF reaching internal metadata, card data or passwords in logs | Blocks merge/release; fix now; rotate leaked secrets |
| **High** | Exploitable with some precondition, or a missing control on a sensitive path | Missing rate limit on login/OTP, weak password hashing, mass assignment of a role field, high-severity reachable dependency vulnerability, verbose errors leaking SQL | Fix before merge/release unless the owner accepts in writing with a dated ticket |
| **Medium** | Defense-in-depth gap or hard-to-exploit weakness | Missing security header, overly broad CORS on an unauthenticated API, long token lifetime, unbounded page size | Ticket with a due date |
| **Low / Info** | Hardening and hygiene | Outdated but not vulnerable dependency, missing audit field | Optional; at most a handful |

Mapping to `sdlc-review`: Critical = Blocker; High = Major; Medium/Low = Minor. When unsure about exploitability of a data or authorization finding, rate it as if exploitable and mark it *(needs verification)*.

## Evidence rules

- Every finding cites `file:line` (or the dependency and version), the category, a concrete **attack scenario** (who sends what and what they obtain — described, not executed), the impact, a specific fix, and a confidence level (confirmed / likely / needs verification).
- Report only what you saw. Do not pad the report with generic advice that does not apply to this code.
- Name controls that are done well — they show what to preserve.

## Stop conditions

- A live credential or active data exposure is found — report immediately to the human before finishing the rest of the review.
- The authorization model (who may access what) is undocumented and cannot be inferred from code — ask; list the assumption you would otherwise make.
- The scan would require access to environments, credentials or tools you do not have — report the gap instead of approximating.

## Output template

```markdown
## Backend security review — <service / branch / ticket>
Scope: <diff base..head | modules> · Date: YYYY-MM-DD · Not in scope: …
Attack surface: <entry points, auth per entry point, data classes, outbound destinations>
Automated checks: | Tool/command | Version | Result |

### Verdict: FAIL (Critical/High open) | PASS with follow-ups | PASS
### Findings
| # | Severity | Category | Location | Issue | Attack scenario | Fix | Confidence |
|---|----------|----------|----------|-------|-----------------|-----|------------|
### Secrets requiring rotation
<type and location only — never the value>
### Done well
### Not reviewed / limitations
```

## Hand-off

Fixes go through `sdlc-be-implement` / `sdlc-be-endpoint` with a regression test per finding (`sdlc-test`); re-run this review on the fix; results feed `sdlc-review` and step 6 of `sdlc-quality-gate`; secret rotation and production exposure follow `sdlc-incident`.
