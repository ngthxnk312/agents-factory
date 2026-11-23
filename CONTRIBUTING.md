# Contributing to Agents Factory

[Tiếng Việt](CONTRIBUTING_vi.md)

Thanks for taking the time to contribute! Bug reports, ideas and pull requests are all welcome.

## Before you start

- Read [AGENTS.md](AGENTS.md) ([Vietnamese](AGENTS_vi.md)): architecture, safe testing, security rules and lessons learned. It applies to humans and AI agents alike.
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Security problems: **do not open a public issue** — see [SECURITY.md](SECURITY.md).

## Development setup

Agents Factory has no dependencies and no build step — you only need Node.js ≥ 20 and the CLI of each agent you want to try.

```bash
git clone https://github.com/ngthxnk312/agents-factory.git
cd agents-factory
git config core.hooksPath .githooks   # enables the commit-msg check
node server.js                        # http://127.0.0.1:7420
```

Test against a throwaway instance so you never touch your real chats or settings:

```bash
HUB_CONFIG=/tmp/hub-test/config.json HUB_DATA=/tmp/hub-test/data PORT=7499 node server.js
```

## Branches and pull requests

- `main` and `develop` are protected: every change lands through a pull request.
- Branch from `develop`: `feature/<short-name>` for features, `fix/<short-name>` for bug fixes.
- Open the pull request **into `develop`**. Releases go from `develop` into `main` and are tagged `vX.Y.Z`.
- Keep a pull request focused on one change and fill in the template.

## Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`.
- **No attribution trailers**: no `Co-Authored-By:` lines, "Generated with …" footers or other AI/tool attribution in commit messages, PR titles or PR descriptions. This is enforced by `.githooks/commit-msg` and by the `commit-hygiene` check on every pull request.

## Code style

- Match the surrounding code: small functions, early returns, no classes unless state really needs them.
- One-line English comments that explain *why*, above non-obvious code.
- Every UI label is an i18n key: add it to **both** `public/i18n/vi/` and `public/i18n/en/`.
- Never commit `data/`, `hub.log` or `hub.config.json`.

## Checklist before opening a pull request

- [ ] Tested on a throwaway instance (`HUB_DATA`/`PORT`), in light and dark theme, VI and EN.
- [ ] No errors in the browser console or server log.
- [ ] Docs updated (`README*.md`, `AGENTS*.md`) when behaviour or setup changes.
