#!/usr/bin/env bash
# Run Agents Factory under systemd --user (starts automatically on login).
# systemd doesn't read ~/.bashrc, so rebuild PATH / tooling here so Claude and MCP behave like in a terminal.
cd "$(dirname "$(readlink -f "$0")")"
[ -f "$HOME/.profile" ] && . "$HOME/.profile" >/dev/null 2>&1
export SDKMAN_DIR="$HOME/.sdkman" NVM_DIR="$HOME/.nvm" PYENV_ROOT="$HOME/.pyenv"
for d in "$SDKMAN_DIR"/candidates/*/current/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done
for d in "$NVM_DIR"/versions/node/*/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done
[ -d "$SDKMAN_DIR/candidates/java/current" ] && export JAVA_HOME="$SDKMAN_DIR/candidates/java/current"
PATH="$HOME/.local/bin:$PYENV_ROOT/shims:$PYENV_ROOT/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH:/snap/bin"
export PATH
exec /usr/bin/env node server.js
