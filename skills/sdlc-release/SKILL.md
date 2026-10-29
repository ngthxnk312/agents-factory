---
name: sdlc-release
description: Prepare verified work for shipping — conventional commit messages with ticket references, a merge request description, a changelog entry and release notes, a semantic version decision, and deployment and rollback notes — all derived from the actual diff and history. Use when the change has passed the quality gate and is ready to be committed, proposed for merge, or released; never pushes, merges or tags without explicit approval.
stage: 6-ship
role: devops
icon: 🚀
mode: acceptEdits
prefer: release-notes, changelog, commit-message, release
---

# Release preparation

You turn verified work into a reviewable, traceable, releasable package. Base everything on the real diff and git history — never describe changes that are not there.

## When to use

- The quality gate passed (`sdlc-quality-gate`) and the human wants commits, a merge request, or a release prepared.
- Writing release notes or a changelog for a version.

## Guardrails

- **Do not commit, push, open/merge a merge request, create tags or publish releases unless the human explicitly asked for that specific action.** Prepare the text and show it; execute only on approval.
- File edits are limited to release metadata: changelog, version files, release-notes docs. No production code changes here.
- Never include secrets, production hostnames or personal data in commits, MR text or release notes.
- Follow the project's attribution policy for commit trailers and public text.

## 1. Commit messages

Read `sdlc-standards` → `reference/git-workflow.md`. The project's documented format wins; otherwise use Conventional Commits:

```
<type>(<scope>): <imperative summary ≤ 72 chars>

<why the change was needed; notable trade-offs; wrap at 72>

Refs: <TICKET>
```

Procedure:

1. Inspect what will be committed: `git status`, `git diff --staged` (and unstaged), and for existing commits `git log <base>..HEAD`.
2. Group changes into logical commits (one purpose each; refactors separate from behavior; tests with the code they test). Propose the grouping if the working tree mixes concerns.
3. Choose the narrowest true **type** (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`) and a **scope** consistent with previous commits (`git log --format=%s | head -50` shows the project's habits).
4. Write an imperative, specific summary; no vague words ("update", "fix bug", "changes", "wip").
5. Add a body explaining why when it is not obvious.
6. Reference the ticket the way the project requires; never invent a key. If the project mandates a ticket field and there is none, use its explicit placeholder.
7. Mark breaking changes with `!` and a `BREAKING CHANGE:` footer.
8. Before any commit you are allowed to make: confirm no secret files are staged (`git status --porcelain`; `git check-ignore -v` for env/key files) and nothing unrelated is included.

## 2. Merge request description

Choose the level: **full** (default; required when reviewers outside the team, compliance or high-risk areas are involved) or **minimal** (goal + scope only, when the project explicitly allows it for internal, low-risk changes).

```markdown
## <type(scope): summary>   ·   Ticket: <link>   ·   Design/docs: <links>

### Goal
<what this changes and why>

### Scope
<modules/files touched; what is explicitly NOT in this MR>

<!-- full level only below -->
### How it was tested
- [ ] Unit: …
- [ ] Integration: …
- [ ] Authorization: user A cannot access user B's data
- [ ] Manual / smoke: …
Quality gate: <PASS/FAIL, link or summary>

### Screenshots / API examples
<UI before/after per state, or request/response samples; or N/A>

### Self-review
- [ ] Architecture (layering, dependencies)
- [ ] Functionality (acceptance criteria, edge cases)
- [ ] Security (validation, authorization, no sensitive data in logs/errors)
- [ ] Quality (tests, naming, no dead code, no unrelated changes)

### Deployment notes
Migrations (order, duration, lock risk) · config/env changes · feature flags · manual steps

### Risk & rollback
<what could go wrong; how to roll back or forward; data considerations>

### Reviewers
<peer; plus owner/second reviewer for high-risk or regulated changes>
```

## 3. Version and changelog

- **Semantic versioning**: MAJOR for breaking changes (removed/renamed public behavior, contract breaks), MINOR for backward-compatible features, PATCH for backward-compatible fixes. Pre-1.0 projects may treat MINOR as breaking — follow what the project does.
- The version recorded in the project's version file(s) must equal the release tag (`vX.Y.Z`). Tags are immutable once published — never move or force-push a released tag; release a new version instead.
- **Changelog** in "Keep a Changelog" style unless the project uses another format; the newest version on top; sections `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`; an `Unreleased` section collects entries between releases. Entries are written for users of the software, not as a commit dump. Derive them from the commits since the last tag (`git log <last-tag>..HEAD`).
- **Release notes**: user-facing language; highlights first; breaking changes with migration steps; known issues.

## 4. Releasing the right scope

- If production receives a subset of what is on the integration branch, release by scope: list the commits belonging to the approved scope (by commit scope/ticket), and promote exactly those (cherry-pick or a release branch built from them). Check for dependencies on commits outside the scope. Never blanket-merge an integration branch carrying unapproved work.
- Trunk-based projects: ensure unfinished features are behind flags that are off.

## 5. Rollback strategy

- Prefer **roll-forward**: a new patch version that reverts or fixes the faulty change. It always produces a new, distinguishable version.
- Hard rollback (redeploying a previous version) must account for data and schema: it is only safe if the schema is backward compatible (expand/contract) and no irreversible data change happened.
- Document both in the MR and in the deploy runbook (`sdlc-deploy`).

## Stop conditions

- The quality gate has not passed or was not run — do not prepare a release as if it had; say so.
- The diff contains unrelated or unexplained changes — ask before including them.
- A breaking change has no version bump or migration path — stop and raise it.

## Output

Return: proposed commit message(s) with the file grouping; MR description; version decision with reasoning; changelog entry (and the file edit if asked); deployment and rollback notes; and the exact git commands you would run — awaiting approval.
