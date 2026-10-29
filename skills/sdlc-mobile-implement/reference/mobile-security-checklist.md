# Mobile security and code review checklist

Use during implementation self-review and in `sdlc-review` for mobile changes. Severity guide: **Critical** blocks merge (exploitable or data-leaking), **High** must be fixed before merge, **Medium** fix soon, **Low/Info** improvement. Report each finding as `severity · file:line · risk · fix`.

## Critical

- Hard-coded credentials, tokens, API keys, signing passwords or session ids in code, resources or build files
- Sensitive data (credentials, tokens, account/card numbers, personal identifiers, one-time codes) written to logs, crash reports, analytics, clipboard or plain storage
- JavaScript bridge in a WebView exposing sensitive data or privileged actions to arbitrary pages
- WebView file access / universal access from file URLs enabled without a documented reason; loading URLs from deep links or push payloads without origin validation
- Release build debuggable, or shrinking/obfuscation disabled for production
- Certificate validation disabled, trust-all managers, or pinning bypassed in release code paths
- SQL built by string concatenation with user input; file paths built from user input (path traversal)
- Authentication or authorization decisions made only on the client

## High

- Business logic or API calls in views/fragments/widgets instead of state holders/repositories
- Async callbacks touching a view without checking it is still attached; missing unsubscribe/dispose/detach → leaks and crashes
- Database/cursor/stream handles not closed; long-lived objects holding view/activity/context references
- Network, disk or database work on the main thread
- Session-expiry or auth-error codes handled per screen instead of the central handler
- Loading indicators started without guaranteed stop on every path (success, error, cancel)
- Navigation done manually around the project's router; new route not registered; deep link entry skipping auth/enrolment checks
- Local schema changed without version bump and migration
- New feature flag read without typed key and default value
- Functions far beyond the project's size limits (default: >50 lines) or nesting >4 levels in new code; files growing past ~800 lines
- New files in a language the project's policy no longer allows for new code

## Medium

- Exported components (activities, services, receivers, providers, URL schemes, universal/app links) without explicit intent; missing permission protection
- Tokens sent in URL query strings instead of headers
- Plain preferences/user defaults for data that should be in secure storage
- Weak cryptography (non-standard algorithms, ECB mode, keys < 2048-bit RSA / < 256-bit AES, non-secure random)
- Missing handling of back-to-app / callback / tel: / mailto: URLs in WebView navigation overrides
- WebView not stopped/cleaned when leaving the screen
- Equality comparisons on strings by reference; constants on the wrong side of null-unsafe equals
- Missing default branch in switches over server-provided enums/types
- TODO/FIXME without ticket

## Low / Info

- Navigation stack flags misused (clearing back stack unintentionally)
- Progress callbacks missing on non-critical calls
- Minor duplication that a shared helper would remove

## Platform hardening (as required by the project's policy)

- Root/jailbreak and emulator detection with defined behavior
- Screenshot/screen-recording blocking and app-switcher snapshot masking on sensitive screens
- Tamper/hook detection and runtime application self-protection kept enabled in release
- Clipboard cleared after copying sensitive values; secure text entry for codes and passwords
- Biometric prompts bound to keystore/keychain keys (cryptographic, not boolean) for high-value actions
- Token and cache wipe on logout, account switch and app uninstall/reinstall semantics understood

## Data and privacy

- Data minimization in analytics; consent before tracking where required; pseudonymous ids only
- Backups: sensitive files excluded from cloud/device backups
- Push notification payloads contain no sensitive data; previews masked

## Dependencies and build

- New SDKs reviewed for permissions, data collection, maintenance and known vulnerabilities
- Obfuscation rules keep what reflection/serialization needs and nothing more
- Signing configs and keystores never committed; CI injects them from the secret store
- Minimum OS version and target SDK/deployment target as required by stores and policy
