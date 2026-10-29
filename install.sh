#!/usr/bin/env bash
# Install Agents Factory on this machine: create hub.config.json (if missing), a service that starts on login, and an app menu icon.
# Usage: ./install.sh            install + start now
#        ./install.sh --uninstall remove the service and icon (keeps data)
set -e
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
UNIT="$HOME/.config/systemd/user/agents-factory.service"
APP="$HOME/.local/share/applications/agents-factory.desktop"
ICON="$HOME/.local/share/icons/agents-factory.svg"

if [ "$1" = "--uninstall" ]; then
  systemctl --user disable --now agents-factory.service 2>/dev/null || true
  rm -f "$UNIT" "$APP" "$ICON"; systemctl --user daemon-reload
  echo "Removed the service and icon. Data in $DIR/data has been kept."; exit 0
fi

command -v node >/dev/null || { echo "Node.js 20+ is required (node --version)"; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "Node is too old, 20+ is required"; exit 1; }
[ -f "$DIR/hub.config.json" ] || { cp "$DIR/hub.config.example.json" "$DIR/hub.config.json"; echo "Created hub.config.json — adjust the name, port, agents… for this machine."; }
chmod +x "$DIR/hub-service.sh" "$DIR/start.sh"
PORT=$(node -p "try{require('$DIR/hub.config.json').port||7420}catch{7420}")

for b in claude agy codex gemini; do printf '  %-7s %s\n' "$b" "$(command -v $b || echo '— not installed')"; done

mkdir -p "$(dirname "$UNIT")" "$(dirname "$APP")" "$(dirname "$ICON")"
cat > "$UNIT" <<UNITEOF
[Unit]
Description=Agents Factory — assign work to AI agents (http://127.0.0.1:$PORT)
After=graphical-session.target network-online.target
StartLimitIntervalSec=120
StartLimitBurst=10

[Service]
Type=simple
ExecStart=$DIR/hub-service.sh
WorkingDirectory=$DIR
Restart=always
RestartSec=3
StandardOutput=append:$DIR/hub.log
StandardError=append:$DIR/hub.log

[Install]
WantedBy=graphical-session.target
UNITEOF

cp "$DIR/public/img/logo.svg" "$ICON"
cat > "$APP" <<APPEOF
[Desktop Entry]
Type=Application
Name=Agents Factory
Comment=Assign work to Claude / Antigravity / Codex / Gemini across all projects
Exec=$DIR/start.sh
Icon=$ICON
Terminal=false
Categories=Development;
APPEOF
update-desktop-database "$(dirname "$APP")" >/dev/null 2>&1 || true

systemctl --user daemon-reload
systemctl --user enable agents-factory.service >/dev/null
if curl -s "http://127.0.0.1:$PORT/api/overview" >/dev/null; then
  echo "The Hub is already running on port $PORT — the service will take over from the next login (or: systemctl --user restart agents-factory)."
else
  systemctl --user start agents-factory.service && echo "Agents Factory started: http://127.0.0.1:$PORT"
fi
