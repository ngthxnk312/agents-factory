# Security and secrets

Default posture: **fail closed** — when in doubt, deny. Anchored to the OWASP Top 10 and OWASP API Security Top 10. For regulated domains (payments, health, government ID) the stricter regulation applies on top.

## 1. Object-level authorization — IDOR / BOLA (highest priority)

Insecure Direct Object Reference / Broken Object Level Authorization: user A changes an id in a request and reads or modifies user B's data. It is the most common serious API flaw.

**Rule:** for every operation on an object identified by an id, verify that the object belongs to the calling principal, or that the principal has explicit scoped rights to it. "Authenticated" is not enough.

```
# Wrong — any logged-in user can read any account
account = accounts.find_by_id(request.account_id)

# Right — ownership enforced in the query; unauthorized looks identical to missing
account = accounts.find_by_id_and_owner(request.account_id, current_user.id) \
                  or raise NotFound("ACCOUNT_NOT_FOUND")
```

- Prefer enforcing ownership **in the query** (`WHERE id = :id AND owner_id = :me`) over loading then checking.
- Enforce in the service/domain layer. Never trust ids or roles coming from the URL, body, headers or unverified token claims.
- Non-sequential ids (UUID/ULID) reduce enumeration but **never replace** the authorization check.
- Staff/admin operations check both the function permission and the data scope (tenant, branch, department, region).
- Return 404 rather than 403 for objects outside the caller's scope.
- Row-level security, record rules or policy engines are good defense in depth; still test them.
- Every feature touching user-owned data has a negative test: user A cannot read or modify user B's object.

## 2. Authentication and authorization

- Authenticate centrally (gateway, middleware, filter). Object-level authorization still happens in the service.
- Least privilege and deny by default. New endpoints/screens/menus are closed until a role is granted.
- Tokens and sessions are short-lived and revocable. Put only identifiers and roles in tokens — never personal data or secrets.
- Elevation of privilege inside code (superuser mode, bypassing access rules, `sudo`-style calls) is scoped as narrowly as possible and justified in a comment.
- Visibility inherited through hierarchies (menu trees, nested groups, folder ACLs) must be checked along the whole chain when debugging "user cannot see X".

## 3. Input validation and injection

- Validate all input at the boundary: type, length, format, range, enum membership. Maximum lengths match storage limits.
- **SQL/NoSQL injection:** parameterized queries/bind variables only. Never concatenate input into a query. Dynamic identifiers (sort column, table name) come from an allowlist.
- **Command injection:** never pass input through a shell; use argument arrays and allowlists.
- **XSS:** encode output for its context; rely on the UI framework's escaping; never inject raw HTML from input; set a Content-Security-Policy for web apps.
- **Path traversal / SSRF:** allowlist and canonicalize file paths and outbound URLs derived from input; block internal address ranges for user-supplied URLs.
- **Mass assignment:** bind requests into dedicated DTOs; never bind directly onto persistence entities (prevents setting `role`, `balance`, `ownerId` from outside).
- **Deserialization:** do not deserialize untrusted data into arbitrary types.
- **File uploads:** validate type by content, limit size, store outside the web root, scan if the domain requires it.

## 4. Secrets management

- Never hardcode secrets, keys, passwords, tokens, connection strings or webhook URLs in source, tracked config, tests, fixtures, docs, comments, commit messages or chat transcripts.
- Store them in environment variables, an untracked local env file (e.g. `.env.local`), or a secret manager/vault. Load at runtime.
- `.gitignore` must cover `.env`, `.env.*`, `*.local`, key files (`*.pem`, `*.key`, `*.p12`), and database dumps. Before committing, verify: `git check-ignore -v <secret-file>` matches a rule, and `git status --porcelain` shows no secret-looking files.
- Tool/integration tokens (CI, trackers, wikis, MCP servers) live in untracked configuration or env, never in a tracked config file and never embedded in a git remote URL.
- With multiple git remotes, keep credentials per remote (credential helper or per-remote env variables). Never reuse one remote's token for another.
- **A committed or pasted secret is compromised:** rotate/revoke it immediately. Removing it from the latest commit is not enough — history and caches keep it.
- Do not put production hostnames, IPs or credentials in documentation.
- Encrypt sensitive data in transit (TLS) and at rest where the domain requires it.

## 5. Safe error output

- No stack traces, SQL, table names, internal hostnames or versions to clients. Generic message + stable code + correlation id. See `errors.md`.

## 6. Dependencies and configuration

- Pin dependency versions with a lockfile. Scan for known vulnerabilities in CI (the ecosystem's audit tool or a scanner such as an SCA/container scanner). Upgrade or document accepted risk.
- Do not add a new dependency without checking maintenance status, license compatibility and whether the standard library already covers the need.
- Disable debug endpoints, admin consoles and verbose error pages in production.
- Web: HSTS, `X-Content-Type-Options: nosniff`, CSP, strict CORS (never `*` on authenticated APIs), secure/HttpOnly/SameSite cookies.
- Secure defaults: no default passwords, no demo accounts in production, features off until configured.

## 7. Integrity and signing (when the domain uses it)

- Verify request signatures centrally at the entry point, not per handler. Signing is configured explicitly and never disabled in production for sensitive APIs.
- Anchor to standards (JWS RFC 7515, JWA RFC 7518, JWK RFC 7517, canonical JSON RFC 8785) rather than inventing schemes. Document the exact algorithm, field order, encoding and null handling.
- Never copy an example algorithm or field order from a template as if it were the real one — read the actual implementation.

## 8. Personal and regulated data

- Collect the minimum; keep it only as long as needed; mask in logs and non-production copies.
- Non-production environments use scrubbed or synthetic data. Production data copied for debugging is handled under the same controls as production.
- Payment card data: never store sensitive authentication data (CVV, PIN, full track data) after authorization; mask card numbers (first 6 / last 4 at most).

## Checklist

- [ ] Every object access by id checks ownership/scope (negative test exists).
- [ ] Input validated at the boundary; queries parameterized; DTO binding, no mass assignment.
- [ ] No hardcoded secrets; secret files ignored; leaked secrets rotated.
- [ ] Errors leak nothing internal; fail closed.
- [ ] Dependencies scanned; debug surfaces closed; CORS/headers strict.
- [ ] Signatures verified centrally and documented from the real implementation.
- [ ] Personal/regulated data minimized, masked and scrubbed outside production.
