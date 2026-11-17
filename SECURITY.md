# Security policy

[Tiếng Việt](SECURITY_vi.md)

Agents Factory starts AI coding agents that can read and change files on your machine, so security reports are taken seriously.

## Supported versions

Only the latest release receives fixes.

| Version | Supported |
| ------- | --------- |
| latest `v0.0.x` | ✅ |
| older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report it privately through GitHub: **Security → Advisories → [Report a vulnerability](https://github.com/ngthxnk312/agents-factory/security/advisories/new)**.

Please include:

- what an attacker can do, and under which conditions;
- steps to reproduce (version / commit, OS, browser, agent CLI);
- any proof of concept or logs that help confirm it.

You can expect an acknowledgement within **3 working days** and a first assessment within **7 days**. Once a fix is released you will be credited in the advisory, unless you prefer to stay anonymous.

## Scope

Agents Factory is designed to run **locally for a single user**:

- the server listens on `127.0.0.1` and rejects requests from foreign origins;
- file access is limited to projects known to the Hub, and image endpoints serve image files only.

Examples of what we want to hear about:

- a web page or another local user being able to reach the Hub's API or start an agent;
- reading or writing files outside the allowed projects, path traversal, or serving non-image files through image endpoints;
- injection into the commands the Hub runs (agent CLIs, `git`, terminal launchers);
- tokens or secrets leaking into logs, the UI or the repository.

Out of scope: problems that need the attacker to already control your user account, and exposing the Hub on a public interface against the documented setup.
