# AGENTS.md

Guide for anyone (human or AI agent) working on this codebase. Read it before changing code.

## What this is

**Agents Factory** is a local web dashboard (http://127.0.0.1:7420) for sending work to AI coding agents across every project on one machine, and watching them run. The agents are Claude Code, Antigravity (`agy`), Codex and Gemini CLI, plus any custom CLI.

It is a personal project for now, and may be open-sourced later. Keep it:
- **Zero-dependency.** Node 20+ built-ins only, no `npm install`, no build step, no framework.
- **Local-only.** It binds to 127.0.0.1 and must never become reachable from the network.
- **Portable.** Everything specific to one machine lives in `hub.config.json`.

**All UI text comes from i18n dictionaries** (`public/i18n/<lang>/<namespace>.json`, key → value) — never hard-code labels in code or markup. **Code comments, docs, skills and example files are English** — never add Vietnamese notes in code. The Vietnamese companions `README_vi.md` and `AGENTS_vi.md` mirror the English docs for review; keep them in sync when you change the English ones. Do not put personal names, local usernames or machine paths in tracked files; when an author/signature is needed use `ngthxnk312`.

## Run, restart, test

```bash
./start.sh                            # start the server if it isn't running (prefers the systemd service), open the browser
systemctl --user restart agents-factory   # reload after changing server.js / agents.js
tail -f hub.log                       # server log
./install.sh                          # on a new machine: hub.config.json + systemd user service + app launcher
```

- **Changes in `public/` need no restart.** The server serves static files from disk, so Ctrl+F5 in the browser picks them up.
- **Restarting the server kills every running chat**, including the one you may be talking through, because the agents run as child processes of the server. Before you restart:
  1. Check `curl -s localhost:7420/api/tasks` and confirm nothing is `running` or `queued`.
  2. Or schedule the restart for when the Hub is idle.

  The Hub is often used to develop itself, so this happens a lot.

### Testing

There is no test suite. Test against a sandbox instance so the live Hub and its data stay untouched:

```bash
D=$(mktemp -d); cp data/hub.json $D/
PORT=7499 HUB_DATA=$D node server.js     # separate data dir, real ~/.claude read-only
```

- **API:** exercise it with `curl`.
- **UI:** drive headless Chromium over CDP (Node's global `WebSocket`, no Playwright library needed). Take a screenshot and look at it. Check for `Runtime.exceptionThrown`.
- **Syntax:** `node --check` every JS file you touched.

## Layout

```
server.js           HTTP server + everything backend (single file, sections marked with "// ---------- … ----------")
agents.js           Adapters for non-Claude agents (agy, codex, gemini, custom) — args builder + JSON-line parser
hub.config.json     Per-machine config (gitignored). Template: hub.config.example.json
hub-service.sh      Entry point for systemd: restores PATH (pyenv, sdkman, linuxbrew…) then `node server.js`
install.sh          Creates config, systemd unit (agents-factory.service), .desktop launcher; --uninstall
start.sh            Start-if-needed + open browser
public/
  index.html        Shell: topbar, sidebar, tabs, compose dialog. Script order matters (see below)
  style.css         All styles. Theme tokens on :root, dark via [data-theme] + prefers-color-scheme
  i18n.js           t(key, params), i18n.tx(), data-i18n / data-i18n-attr, vi/en switch (loads dictionaries synchronously)
  i18n/<lang>/*.json Flat key → value dictionaries, one file per namespace (common, index, app, dashboard, files, slash, nav, bgview, ui, resize, server)
  icons.js          Inline SVG sprite + MutationObserver that turns UI emoji into <svg> (MAP / SKIP lists)
  ui.js             Custom popups: dialog/confirm/prompt, toast, custom <select>, popMenu, tooltips (replaces title=)
  files.js          Right-hand File panel: tree, editor, save with conflict detection
  slash.js          "/" command autocomplete in the chat box; Hub-local commands (/stop /rename /model …)
  dashboard.js      Home dashboard (default tab): running work, needs-attention, KPIs, 14-day chart, recent chats
  app.js            Main UI: state, render functions, chat, sessions, token dashboard, routing, SSE handling
  bgview.js         Background agents (claude --bg) list + read-only live viewer
  nav.js            Ctrl/middle-click → new tab, right-click context menus with info
  resize.js         Drag-to-resize columns (sizes saved in layout.sizes)
  img/logo.svg      Pixel-art factory logo / favicon / app icon
  img/vi.svg, en.svg Pixel-art flag icons for the language dropdown
skills/             Factory SDLC skills (sdlc-*/SKILL.md) — FALLBACK ONLY, see "SDLC skills" below; index in skills/README.md
data/               Runtime state (gitignored): hub.json, tasks.json, logs/<task>.jsonl, uploads/, sessions-cache.json,
                    ratelimit.json, accounts.json, commands.json
```

Script load order: `icons.js → i18n.js → ui.js → files.js → slash.js → nav.js → app.js → handoff.js → dashboard.js → bgview.js → resize.js`. These are classic scripts sharing one global scope. Top-level `const`/`function` from `app.js` (`state`, `api`, `esc`, `$`, `$$`, `toast`, `layout`, …) are used by the other files **at call time**, so never call them at load time from a file that loads before `app.js`.

## Backend (`server.js`)

- **Config:** `hub.config.json` gives the defaults, and environment variables override it (`PORT`, `HUB_DATA`, `CLAUDE_BIN`, `CLAUDE_CONFIG_DIR`, `MAX_PARALLEL`, `IDLE_MINUTES`).
- **Claude chats:** each Hub chat ("task") runs one long-lived process, `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages`, started in the project's directory. The CLI therefore loads that project's MCP servers, plugins, `AGENTS.md` / `CLAUDE.md` and settings itself.
  - User messages go in on stdin as JSON lines. `handleLine()` turns stdout into events.
  - The process closes after `IDLE_MINUTES` of idle and is reopened with `--resume`.
  - Changing the model, permission mode or plugins restarts the process with `--resume`.
- **Other agents:** each message spawns one process, via `deliverOneShot()` and the adapter in `agents.js`. The conversation is continued by session ID.
- **Events:** saved to `data/logs/<taskId>.jsonl` and broadcast over SSE at `/api/stream`.
  - SSE message types: `task`, `event`, `delta`, `usage`, `ratelimit`, `removed`, `sessions-updated`, `account`.
  - Event kinds that `evNode()` renders: `user`, `text`, `thinking`, `init`, `tool`, `tool_result`, `result`, `stderr`, `system`.
- **Session history & cost:** read incrementally from `~/.claude/projects/*/*.jsonl`, `~/.gemini/antigravity-cli/brain/*`, `~/.codex/sessions/*`, and `~/.gemini/tmp/*/chats/*` (byte offsets and mtimes are cached in `sessions-cache.json`; bump `SCAN_V` to force a full rescan).
  - Token usage is deduplicated by message/step ID.
  - Subagent usage comes from `<id>/subagents/*.jsonl`.
  - Session USD cost uses CLI-reported `runs` when present or estimates cost from token usage via `PRICE_PER_M` / `estimateCost()`.
- **Accounts:** usage is attributed to the account logged in at that moment. `accounts.json` keeps the timeline (polled from `~/.claude.json`, `~/.gemini/oauth_creds.json`, `~/.codex/auth.json`). Usage from before tracking began is "unknown".
- **SDLC skills:** `resolveSkills(project)` merges, highest priority first: project skills (`<project>/.agents/skills`, `.agent/skills`, `.claude/skills`, `.codex/skills`, `.gemini/skills`), user skills (`~/.agents/skills`, `~/.gemini/antigravity-cli/builtin/skills`, `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/config/skills`, nested folders allowed), native/plugin skills named in a factory skill's `prefer:` field (installed plugins' `skills/` + the CLI's reported slash commands, persisted in `commands.json`), then the factory's own `skills/sdlc-*`. For Claude, a non-factory resolution is invoked natively as `/<skill> …`; a factory skill goes into `--append-system-prompt` (task skill) or wraps the message (one-off `/sdlc-x`). Other agents get the resolved `SKILL.md` body inlined on the first turn.
- **Agent handoff:** `POST /api/tasks/:id/handoff {agent, clear, model, permissionMode, note}` → `switchAgent()` switches the agent of the SAME task: stops the claude process (`afterProcExit`), moves the old session to `pastSessions`, resets `sessionId`/cost counters and logs a `system` event carrying `agentSwitch {from, to, clear}`. Unless `clear` (forced when the agent is unchanged = /clear), it sends a brief from `handoffBrief()` (original request, todos, files changed/read from tool events, recent dialogue within a size budget, labelled per agent, only after the last clear); with `clear`, `note` is sent as a plain first message. Old tasks may still carry `handoffFrom`/`handoffTo` links from the previous new-chat behaviour; the user event shows a short `displayText` instead of the whole brief. UI lives in `public/handoff.js` (namespace `handoff.*`).
- **Background agents:** listed via `claude agents --json` (cached). Removing one runs `claude stop` + `claude rm`. The CLI daemon only runs on demand, so start it with `claude daemon run` when `rm` reports it unreachable.

### Hard-won facts. Do not regress these

- `result.total_cost_usd` from the CLI is **cumulative for the session**: resuming a session restores the earlier cost. Never sum it per turn. Store the difference between turns (`costBase`/`costLast`).
- The CLI emits `system/init` on **every turn**. It is deduplicated with `lastInitKey`.
- `--resume` fails with "running in the background (<id>)" when a `claude --bg` agent holds the session. The Hub detects this (`BG_RE`) and offers three options: fork, stop-and-move, or attach.
- The `agy` CLI needs the prompt attached to the flag: `-p=<text>`, not `-p <text>`. In headless mode `agy` auto-denies commands unless it runs with `--mode accept-edits` or `--dangerously-skip-permissions`.
- Rate-limit percentages belong to the **account** and include other machines. Token counts belong to **this machine**. The UI must never present one as the other.

## Security rules

- Keep the localhost bind and the Host/Origin checks at the top of the request handler (they block DNS rebinding).
- **File API** (`/api/fs/*`): paths go through `fsResolve()`, which `realpath`s them and requires the result to stay inside a project root known to the Hub. Symlinks that escape the root are rejected. Never add a code path that skips it.
- **Previewing project files:** `/api/fs/raw` serves **images only**, with `Content-Security-Policy: sandbox`. Never serve project HTML from the Hub origin, because the page would get the Hub's API with full agent control.
- **Secrets:** they are masked before MCP config reaches the browser (`maskServer` / `maskStr`). Keep that masking in place for anything new that returns config.
- **Claude Code's own files are read-only** (`~/.claude/projects/*.jsonl`, `~/.claude.json`): never write to them. Session renames live in `hub.json` (`names`), and deleting a session moves it to the system trash (`gio trash`).
- **Child processes:** spawn them with argument arrays, never shell strings built from user input. `openTerminal` builds a shell command only from validated IDs.

## Frontend conventions

- **HTML templating:** template strings plus `innerHTML`. **Every interpolated value goes through `esc()`.**
  - Exceptions are helpers that already return HTML: `md()`, `toolLabel()`, `modeChip()`, `agentBadge()`, `fxIconHtml()`. Never wrap these in `esc()`.
- **Never use native browser UI.** No `alert`, `confirm`, `prompt`, `Notification`, native `<select>` menus or `title` tooltips: use `ui.*`. `ui.js` upgrades `<select>` and `title` automatically.
- **Icons:** write emoji in templates and let `icons.js` swap them for SVG. To add one, put a sprite entry in `P` and an emoji mapping in `MAP`. User/agent content must stay untouched, so add its container to `SKIP` or give it `data-noicon`.
- **Clicks:** one delegated `document` click handler matches on `data-*` attributes; register new attributes in `CLICK_SEL`.
- **Persistence:** per-viewer state goes in `localStorage` keys prefixed `hub-` (`hub-layout`, `hub-ws`, `hub-theme`, `hub-seen`, …). Shared state goes to the server.
- **i18n:** every label is a key. JS: `t('ns.area.name', { param })` (placeholders `{param}`; keep word order in the value, not in code). HTML: `data-i18n="key"` for text, `data-i18n-attr="placeholder:key;title:key"` for attributes. Each file owns its namespace (`app.*` in app.js, `dashboard.*` in dashboard.js, …; shared words in `common.*`); add the key to **both** `vi` and `en` files. Dates use `i18n.locale`. Tooltips and context menus go through `t()` too. Server text: HTTP errors are translated with the `X-Lang` request header (`{ error, errorKey }`); text the server stores (events, task `lastText`/`note`) carries `textKey` + `params` beside a Vietnamese fallback and is rendered with `i18n.tx()`. Never translate user/agent content. Adding a language = add `public/i18n/<lang>/` and its entry in `LANGS` in i18n.js. Switching language happens in place (no reload, cross-faded with a View Transition): i18n.js swaps the dictionary, re-applies `data-i18n`, then fires `langchange`. **Any label translated once at load time (module-level constants such as `STATUS`, `PERM_MODES`, `HUB_CMDS`) must be refreshed in a `langchange` listener** — see `relabelConstants()` in app.js and the listeners in files.js, slash.js, bgview.js, resize.js; prefer calling `t()` at render time instead.
- **Routing:** the hash, `#tab=…&project=…`, `#chat=<taskId>`, `#session=<sessionId>`. Keep links usable in a new tab.
- **Timeline:** `.timeline` is a flex column, so children need `flex-shrink: 0` or collapsed `<details>` shrink into thin lines. It auto-scrolls only while the user is at the bottom (`state.follow`).
- **Gotcha when patching code with scripts:** in `String.prototype.replace` the replacement string treats `$$` as `$`, so a replacement containing `$$(` silently becomes `$(`. Use a function replacement, or check afterwards.

## Adding things

- **A new agent CLI:** add an adapter to `ADAPTERS` in `agents.js`:
  - `args(t, text, ctx)` returns the argument array for one turn.
  - `parse(obj, h)` maps each JSON line onto `h.session / delta / text / thinking / tool / toolResult / result / stderr`.
  - also set `resumeCmd(t)`, `models` and `modes`.

  Modes reuse Claude's names (`''`, `acceptEdits`, `plan`, `auto`, `bypassPermissions`); map them to the nearest flags the CLI has. Test it end to end on the sandbox instance with a real prompt.
- **A new API endpoint:** add a `p === '/api/…'` branch inside the request handler. Read bodies with `await body(req)`, reply with `send(res, code, obj)`, and put user-facing error messages in Vietnamese (UI copy); comments in English.
- **A new SDLC skill:** add `skills/sdlc-<name>/SKILL.md` with the line-based frontmatter (`name`, `description`, `stage`, `icon`, `mode`, `prefer`). Keep it generic (any stack), list well-known equivalent skills in `prefer:` so local ones win, and add it to `skills/README.md` (+ the Vietnamese mirror if present).
- **Skill roles:** every SDLC skill has a `role:` (`lead`, `pm`, `ba`, `sa`, `dev`, `fe`, `mobile`, `qa`, `devops`); the compose dialog groups skills by role (`SKILL_ROLES` in app.js).
- **A new task field:** set it with `updateTask(t, patch)`, which saves and broadcasts. `publicTask()` controls what reaches the browser.
- **A new panel or dialog:** use `modalShell(html, cls)` or `ui.dialog`. Add CSS at the end of `style.css` under a `/* ---------- section ---------- */` header, and use theme tokens, not hard-coded colors.

## Git workflow

- `main` and `develop` are **protected** on GitHub: no direct pushes, no force-pushes, no deletion; everything lands through pull requests.
- Feature work:
  1. Branch `feature/<short-name>` from `develop`; use `fix/<name>` for bug fixes.
  2. Use Conventional Commits (`feat: …`, `fix: …`, `docs: …`).
  3. Open a PR into `develop`.
- Releases: open a PR from `develop` into `main`, then tag the version (`vX.Y.Z`).
- Commit author: `ngthxnk312`. Never commit `data/`, `hub.log` or `hub.config.json`.
- **No attribution trailers:** never add `Co-Authored-By:` lines, "Generated with …" footers or any other AI/tool attribution to commit messages, PR titles or PR descriptions. Enforced locally by `.githooks/commit-msg` (run `git config core.hooksPath .githooks` once per clone) and on every PR by the `commit-hygiene` GitHub Action, which is a required check on `main` and `develop`.

## Style

- Small functions; no classes unless state really needs them; early returns.
- Comment the *why* in one line, in English, above non-obvious code.
- Keep `server.js` as one file, organised by section headers, until a section clearly deserves its own module (as `agents.js` did).
- Update README.md (+ README_vi.md) when you add a feature, and this file (+ AGENTS_vi.md) when you learn something that should not be relearned.
