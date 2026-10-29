# Coding standards

Language-neutral rules. The project's formatter, linter and style guide override layout details.

## 1. Structure and flow

- Use guard clauses and early returns instead of deep nesting. More than two levels of nesting is a signal to extract a function.
- Functions do one thing. Treat ~30 lines and ~4 parameters as review triggers, not hard limits; group related parameters into an object.
- Do not duplicate logic. Extract shared behavior; do not copy-paste blocks between files.
- Remove dead code, commented-out code, debug prints and unused imports in the code you touch.
- No `TODO`/`FIXME` without a ticket reference (`TODO(ABC-123): ...`).
- Do not use exceptions for normal control flow.

## 2. Naming

- Meaningful English names. Avoid ambiguous abbreviations (`rs`, `tmp`, `obj`, `data1`, `mgr2`) and transliterated non-English identifiers; user-facing text belongs in i18n resources, not identifiers.
- Booleans read as predicates: `isActive`, `hasAccess`, `canRetry`, `shouldNotify`.
- Collections are plural; constants follow the language convention (`UPPER_SNAKE_CASE` in most languages).
- Follow the language's casing conventions (`camelCase`/`PascalCase` in Java/TS/C#, `snake_case` in Python/Rust/SQL, etc.).
- Name things after the domain concept, not the storage table or the UI widget.

## 3. Null and absence safety

- Do not return null for collections; return an empty collection.
- Represent optional values explicitly (`Optional`, `Option`, `T | undefined` with strict null checks, nullable annotations).
- Compare against constants in a null-safe way (`"ACTIVE".equals(status)`, `status === Status.Active`).
- Fail fast with a clear domain error when a required value is missing (`findById(id).orElseThrow(...)`).

## 4. No magic values

- Numbers and strings with meaning become named constants or enums (`MAX_RETRY`, `Status.APPROVED`, `ErrorCode.ACCOUNT_LOCKED`).
- States and types are enums or the framework's selection/choice type — never ad-hoc string comparisons scattered through code.
- Environment-dependent values (URLs, timeouts, thresholds, feature flags, emails, ids of records) come from configuration.
- UI design values (colors, spacing, radii, font sizes) come from design tokens/variables, not literals copied by eye.

## 5. Resources and errors

- Close every resource deterministically (`try-with-resources`, `using`, `with`, `defer`, RAII).
- Never swallow exceptions; see `errors.md`.
- Avoid log-and-rethrow (it duplicates logs). Log once, where the error is handled.

## 6. Language idioms

- Use the modern idioms of the language version the project targets (records/data classes for DTOs, pattern matching, sealed types, async/await, comprehensions) when they make code clearer.
- Prefer immutability: `final`/`readonly`/`const`, immutable collections, no mutable statics.
- Streams/pipelines/comprehensions for clear transformations; do not nest them into something unreadable.

## 7. Comments

- Comments explain **why** (a constraint, a trade-off, a non-obvious invariant, a link to a ticket or spec), not **what** the next line does.
- Replace a "what" comment with a better name or an extracted function.
- Public APIs get doc comments describing contract, errors and side effects.

## 8. Code smells to flag in review

- Long functions, god classes, boolean flag parameters that switch between two behaviors (split into two functions).
- Catching the most generic exception type where a specific one is possible.
- Floating-point types for money; `==` on strings in languages where that compares references; floating-point equality.
- Hidden side effects in getters/properties; reliance on static initialization order.
- Query or remote call inside a loop (N+1).
- Overly broad privilege escalation (e.g. running as superuser / bypassing access rules) where a narrow scope suffices.
- Copy-pasted code that differs in one literal.

## 9. Formatting and static analysis

- Use the project's formatter and linter as configured; do not reformat files you did not otherwise change.
- If the project has no formatter, match the surrounding style exactly.
- Static analysis (linters, type checkers, bug finders) runs in CI and in `sdlc-quality-gate`. New code introduces no new warnings above the project's threshold.

## Checklist

- [ ] Early returns, small focused functions, shallow nesting, no dead code.
- [ ] Clear English names following language conventions.
- [ ] Null/absence handled explicitly; empty collections instead of null.
- [ ] No magic values; configuration and design tokens used.
- [ ] Resources closed deterministically; errors not swallowed or double-logged.
- [ ] No smells from section 8; formatter/linter/type checker clean.
