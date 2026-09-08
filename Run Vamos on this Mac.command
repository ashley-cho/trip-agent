#!/bin/bash
# Vamos — double-click this file to run the app on this machine.

cd "$(dirname "$0")" || exit 1
clear

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

hold() { echo; read -n 1 -s -r -p "Press any key to close this window."; echo; }

printf '\n  VAMOS \xe2\x80\x94 on this Mac only\n  ---------------------\n'
printf '  To put it on the internet, use "Publish Vamos to the web".\n\n'

if ! command -v node >/dev/null 2>&1; then
  echo "  Node isn't installed, or isn't on this shell's PATH."
  echo "  Install it from https://nodejs.org, then double-click this again."
  hold; exit 1
fi

# Don't take the key's word for it — spend one token proving it works, so a
# revoked or unfunded key shows up here instead of quietly degrading to regexes.
KEY=$(grep '^ANTHROPIC_API_KEY=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '\r\n')
if [ -z "$KEY" ]; then
  echo "  Model:  no key in .env.local — running on rules only"
else
  CODE=$(curl -s -o /tmp/trip-agent-key.json -w '%{http_code}' --max-time 20 \
    https://api.anthropic.com/v1/messages \
    -H "x-api-key: $KEY" -H 'anthropic-version: 2023-06-01' \
    -H 'content-type: application/json' \
    -d '{"model":"claude-sonnet-5","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}')
  if [ "$CODE" = "200" ]; then
    echo "  Model:  Claude — key verified, live"
  else
    echo "  Model:  key present but the API said $CODE. Running on rules."
    sed -n 's/.*"message":"\([^"]*\)".*/          \1/p' /tmp/trip-agent-key.json | head -1
  fi
  rm -f /tmp/trip-agent-key.json
fi

NEEDS_INSTALL=""
if [ ! -d node_modules ]; then
  NEEDS_INSTALL="first run"
elif [ package-lock.json -nt node_modules ] || [ package.json -nt node_modules ]; then
  NEEDS_INSTALL="dependencies changed"
fi

if [ -n "$NEEDS_INSTALL" ]; then
  echo "  Setup:  $NEEDS_INSTALL, installing. This takes a minute."
  echo
  npm install || { echo; echo "  Install failed. The reason is above."; hold; exit 1; }
  # npm doesn't always touch the directory itself, and if it doesn't, this
  # would decide an install is needed on every single launch.
  touch node_modules
  echo
fi

if curl -s -o /dev/null --max-time 1 http://localhost:3000; then
  echo "  Status: already running. Opening it now."
  open http://localhost:3000
  hold; exit 0
fi

echo "  Status: starting up at localhost:3000. Your browser opens by itself."
echo "          This copy runs on this Mac and nobody else can open it."
echo
echo "  Leave this window open while you use the app."
echo "  Close it, or press Ctrl-C, to stop."
echo

npm run dev &
DEV=$!
trap 'kill $DEV 2>/dev/null' EXIT INT TERM

opened=0
for i in $(seq 1 90); do
  if curl -s -o /dev/null --max-time 1 http://localhost:3000; then
    open http://localhost:3000
    opened=1
    break
  fi
  sleep 1
done

if [ "$opened" = "0" ]; then
  echo
  echo "  The server didn't come up within 90 seconds. The log above says why."
fi

wait $DEV
