# Agents Factory

A local control room for AI coding agents. Send work to Claude Code, Antigravity, Codex, Gemini CLI or any CLI agent across every project on your machine, then watch them run, review the results and keep going — from one browser tab.

- **Zero dependencies.** Node.js ≥ 20 and the CLI of each agent you want to use (`claude`, `agy`, `codex`, `gemini`, …). No `npm install`, no build step.
- **Local only.** The server listens on `127.0.0.1` and rejects foreign origins, because it can run agents with access to your files.
- **SDLC-aware.** Ships with a set of fallback SDLC skills (ideate → plan → design → build → verify → ship → operate) that defer to your own project and machine skills.

> Vietnamese version: [README_vi.md](README_vi.md)

```bash
./install.sh          # first run on a machine: config + autostart service + app launcher
./start.sh            # start (if needed) and open http://127.0.0.1:7420
node server.js        # or run in the foreground
```

## Features

**Projects and workspaces**
- Projects are discovered from `~/.claude.json`. Open any other folder with **＋** (folder browser), reorder with drag & drop, star, hide/restore.
- Group projects into workspaces and switch between them; every view is filtered by the active workspace.

**Chat with agents**
- Each Claude chat is one long-lived `claude` process (stream-json) started in the project folder, so it loads that project's MCP servers, plugins, CLAUDE.md, skills and settings exactly like a terminal session. Text streams in live; you can send follow-ups while the agent works.
- Other agents (Antigravity, Codex, Gemini, custom) run one process per message and resume the conversation by session ID.
- **Switch agent** (⇄ in the chat header): continue a chat with another agent — e.g. Claude → Antigravity. It happens in the same chat — no new chat is created. CLI sessions are not portable, so the target agent starts a fresh session and, if you keep the context, gets a brief (original request, task list, files changed, recent conversation). "Clear context" starts it clean; picking the current agent with "Clear context" is a /clear that keeps the chat.
- Permission modes match the Claude Code terminal (`default`, `⏵⏵ accept edits`, `⏸ plan`, `⏵⏵ auto`, `bypass`) — **Shift+Tab** cycles them in the chat box.
- `/` in the chat box lists CLI commands, skills, plugins and Hub commands (`/stop /rename /model /terminal /files /new /help`).
- Attach files by drag & drop, paste or 📎. Links and file paths in answers are clickable (file paths open in the File panel at the right line).
- A progress bar shows the current step, elapsed time, step count and the agent's todo list; subagent steps are grouped under their parent.

**Sessions**
- Every Claude Code session on the machine (terminal or Hub) can be reopened, forked, renamed, grouped by project or deleted (moved to the system trash).
- Sessions held by a background agent (`claude --bg`) can be forked, moved into the Hub (`claude stop` + resume) or attached in a terminal.
- **Background agents** panel: list `claude --bg` agents, watch any of them live (read-only), attach, or remove them.

**Files**
- File panel (Ctrl+B): project tree, view and edit files (Ctrl+S, conflict detection when the agent edits the same file), image/markdown preview, new file. Access is confined to known project folders.

**Usage**
- Token usage per day, model, project and session for the whole machine; long-term history from Claude Code's own stats; per-account view (usage is attributed to the account logged in at that time); 5-hour / weekly limits with reset times.
- Costs are estimates at public API list prices, not invoices.

**Home dashboard**
- What is running right now (current step, elapsed time, todo progress), what needs attention, today's output, machine-wide cost, usage limits, a 14-day token chart, most active projects and recent chats.

**UI**
- English / Vietnamese switch (top bar). Light / dark / system theme, resizable and collapsible columns, links for every view (`#tab=…`, `#chat=…`, `#session=…`) so anything opens in a new tab, rich right-click menus.

## SDLC skills

The `skills/` folder holds the factory's SDLC skills (`sdlc-ideate`, `sdlc-breakdown`, `sdlc-design`, `sdlc-implement`, `sdlc-review`, `sdlc-test`, `sdlc-release`, …) in the standard `SKILL.md` format. Pick one when assigning work, or type `/sdlc-review <request>` in a chat.

Skills are grouped by role — **lead, PM, BA, SA, Dev, BE, FE, Mobile, QA, DevOps** — and cover the whole lifecycle from intake and discovery to incident handling.

They are **fallbacks only**. For each skill the Hub uses, in order:
1. the project's own skill — `<project>/.claude/skills/`
2. your machine's skill — `~/.claude/skills/`
3. an equivalent native or plugin skill listed in the skill's `prefer:` field (e.g. `code-review`)
4. the factory's own `SKILL.md`

See [skills/README.md](skills/README.md) for the full list and how to add one.

## Agents

| Agent | How it runs | Status |
|---|---|---|
| Claude Code (`claude`) | long-lived stream-json process, `--resume` | full support |
| Antigravity (`agy`) | `agy --output-format stream-json -p=…`, `--conversation` | tested |
| Codex (`codex`) | `codex exec --json`, `codex exec resume` | per CLI docs, untested |
| Gemini CLI (`gemini`) | `gemini --output-format stream-json`, `--resume` | per CLI docs, untested |
| Custom | any CLI declared in `hub.config.json` (`{prompt}`, `{session}` placeholders) | plain-text output |

## Configuration

Per-machine settings live in `hub.config.json` (created from `hub.config.example.json` by `install.sh`): display name and avatar, port, data folder, Claude config folder, terminal command, extra skill folders, agent binaries and models. Environment variables override it:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 7420 | web port |
| `HUB_DATA` | `./data` | runtime data folder |
| `MAX_PARALLEL` | 4 | chats running at once; the rest are queued |
| `IDLE_MINUTES` | 15 | close an idle Claude process after this long |
| `CLAUDE_BIN` | `claude` | Claude Code CLI |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Claude Code config folder |

## Autostart (Linux, systemd user service)

`install.sh` installs `~/.config/systemd/user/agents-factory.service` (runs `hub-service.sh`, which restores your shell PATH so agents and MCP servers behave as in a terminal) and an **Agents Factory** app launcher.

```bash
systemctl --user restart agents-factory   # after changing server.js
systemctl --user stop agents-factory      # stop / disable to remove autostart
tail -f hub.log                           # logs
./install.sh --uninstall                  # remove service and launcher (keeps data)
```

## Development

Read [AGENTS.md](AGENTS.md) ([Vietnamese](AGENTS_vi.md)) before changing code: architecture, safe testing, security rules and lessons learned.

## Author

ngthxnk312
