# Git workflow, commits and merge requests

The project's documented workflow wins. Use this when the project has none or is silent on a point.

## 1. Branching

- Detect the model the repository uses (trunk-based, GitHub flow, git-flow with `develop`/`release/*`) from branch names, CI config and docs. Follow it.
- Branch names: `feature/<scope>`, `fix/<scope>`, `hotfix/<issue>`, `chore/<scope>` — optionally with the ticket key (`feature/ABC-123-export-csv`).
- Branches are short-lived and single-purpose. Sync with the base branch often to avoid large conflicts.
- Before starting: `git fetch`; if a branch for this scope already exists, continue on it; otherwise branch from the integration branch the project uses. If the code you must fix is not on that branch yet, stop and ask.
- Work in one working directory and switch branches sequentially (commit or stash before switching). Create extra worktrees or clones only when several branches truly must run at once, and remove them when done. Clean up the footprint: disposable databases, containers and processes you started.

## 2. Commit messages

Default format: **Conventional Commits** with a ticket reference.

```
<type>(<scope>): <imperative summary, ≤ 72 chars, no trailing period>

<body: why the change was needed and what trade-offs were made; wrap at 72>

Refs: ABC-123
BREAKING CHANGE: <what breaks and how to migrate>   (only if applicable)
```

- **type** — one of `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`. Use the narrowest true type.
- **scope** — the module, domain or feature (`orders`, `auth`, `billing-ui`), not the service or repository name. Keep scopes consistent over time so commits can be filtered (and, if the project releases by scope, selected) by scope.
- **summary** — imperative mood ("add daily transfer limit", not "added"/"adds"), specific, no vague verbs like "update", "fix bug", "changes", "coding".
- **body** — explain *why*, not a restatement of the diff.
- **ticket** — reference the tracking ticket when one exists (footer `Refs: ABC-123`, or the project's required position such as `[ABC-123]` in the subject). If the project requires a ticket field but the work has none, use the project's explicit placeholder (e.g. `[N/A]`) rather than omitting it. Never invent a ticket key.
- **breaking changes** — `!` after the type/scope (`feat(api)!: …`) and a `BREAKING CHANGE:` footer.
- One logical change per commit; the build should pass at each commit.
- **Attribution trailers:** follow the project's policy. Some projects forbid AI or co-author trailers; others require them. Do not add or remove trailers against that policy.
- Never put secrets, production hostnames or personal data in commit messages.

If the project uses a different documented format (for example `<scope> [<TICKET>] <type>: <summary>`), follow it exactly; the same rules about types, imperative summaries, tickets and bodies still apply.

## 3. Human in the loop

- **Never** commit, push, merge, rebase shared branches, force-push, tag, or delete branches unless the human explicitly asked for that action. State the intent and wait for confirmation.
- Agent-authored commits are reviewed exactly like human commits before they reach a shared branch.
- Writes to external systems (merge requests, trackers, wikis, chat, deployments) require confirmation from the responsible human.
- Deploying to a shared environment always goes through the normal integration path (merge request into the integration branch, then the pipeline). Never copy files by hand onto a server from an unmerged branch.

## 4. Merge requests

- Small and focused: one purpose, one scope. Treat ~400 changed lines (excluding generated files and lockfiles) as the point to consider splitting.
- Pure refactors go in their own MR, separate from behavior changes.
- Protected main branches require passing CI and at least one approving review; regulated or high-risk changes need two reviewers including an owner.
- The description states goal, scope (and what is out of scope), how it was tested, risk and rollback. See `sdlc-release` for the template.

## 5. Releasing by scope

When an integration branch mixes many features but production must receive only approved ones, release by scope: promote exactly the commits of the approved scope (cherry-pick by scope, or a release branch built from them), not a blanket merge of the integration branch. Consistent commit scopes make this possible. Trunk-based projects achieve the same with feature flags.

## 6. CI pipeline order

Recommended stage order: `build → unit/integration tests → static analysis & quality gate → security scan (dependencies, secrets, containers) → package → deploy`. Main branches run every stage; feature branches may run a subset but merge requests run the full gate.

## Checklist

- [ ] Branch follows the project model and is single-purpose.
- [ ] Commit messages: valid type, consistent scope, imperative summary, ticket reference, why in the body.
- [ ] No secrets or personal data in history; attribution policy respected.
- [ ] No commit/push/merge/tag/deploy without explicit approval.
- [ ] MR is small, single-purpose, with test plan and rollback.
