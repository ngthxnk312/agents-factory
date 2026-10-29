#!/usr/bin/env bash
# Open Agents Factory: start the server if not running (preferring the auto-start systemd service), then open the browser
cd "$(dirname "$(readlink -f "$0")")"
PORT="${PORT:-$(node -p "try{require('./hub.config.json').port||7420}catch{7420}" 2>/dev/null || echo 7420)}"
if ! curl -s "http://127.0.0.1:$PORT/api/overview" >/dev/null; then
  if systemctl --user cat agents-factory.service >/dev/null 2>&1; then
    systemctl --user start agents-factory.service
  else
    nohup node server.js >> hub.log 2>&1 &
  fi
  for i in $(seq 1 20); do curl -s "http://127.0.0.1:$PORT/api/overview" >/dev/null && break; sleep 0.3; done
fi
[ "$1" = "--no-open" ] || xdg-open "http://127.0.0.1:$PORT" >/dev/null 2>&1 &
echo "Agents Factory: http://127.0.0.1:$PORT  (log: $(pwd)/hub.log)"
