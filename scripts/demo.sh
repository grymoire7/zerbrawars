#!/bin/sh
# Offline demo: serve the production build and open it in the "Zebra Wars" browser profile.
set -eu
cd "$(dirname "$0")/.."

PORT=4173
URL="http://localhost:$PORT/"

if nc -z localhost "$PORT" 2>/dev/null; then
  echo "ERROR: port $PORT is already in use, probably a leftover demo server." >&2
  echo "Close the other Terminal window running the demo (Ctrl-C), or run:" >&2
  echo "  lsof -ti tcp:$PORT | xargs kill" >&2
  echo "then run this again." >&2
  exit 1
fi

# Rebuild when dist/ is missing or any source/config file is newer than it.
if [ ! -f dist/index.html ] || [ -n "$(find src index.html package.json vite.config.ts public -newer dist/index.html -type f 2>/dev/null | head -n 1)" ]; then
  echo "Building..."
  npm run build
fi

node_modules/.bin/vite preview --host --port "$PORT" --strictPort &
VITE=$!
caffeinate -dis -w "$VITE" &
CAFF=$!
trap 'kill "$VITE" "$CAFF" 2>/dev/null || true' EXIT
trap 'exit 130' INT TERM

# Wait for the server (up to 15s).
i=0
until curl -s -o /dev/null "$URL"; do
  i=$((i + 1))
  if [ "$i" -gt 30 ] || ! kill -0 "$VITE" 2>/dev/null; then
    echo "ERROR: the server did not start. Check the messages above." >&2
    exit 1
  fi
  sleep 0.5
done

# Find a browser profile named "Zebra Wars" (Brave first, then Chrome); reads only profile names.
find_profile() {
  node -e '
const [dir, name] = process.argv.slice(1);
const p = require("os").homedir() + "/Library/Application Support/" + dir + "/Local State";
try {
  const c = JSON.parse(require("fs").readFileSync(p, "utf8")).profile.info_cache;
  const k = Object.keys(c).find((d) => c[d].name === name);
  if (k) process.stdout.write(k);
} catch {}
' "$1" "Zebra Wars" 2>/dev/null || true
}

PROFILE=$(find_profile "BraveSoftware/Brave-Browser")
if [ -n "$PROFILE" ]; then
  echo "Opening in Brave profile \"Zebra Wars\" ($PROFILE)"
  open -na "Brave Browser" --args --profile-directory="$PROFILE" "$URL"
else
  PROFILE=$(find_profile "Google/Chrome")
  if [ -n "$PROFILE" ]; then
    echo "Opening in Chrome profile \"Zebra Wars\" ($PROFILE)"
    open -na "Google Chrome" --args --profile-directory="$PROFILE" "$URL"
  else
    echo "NOTE: no Brave or Chrome profile named \"Zebra Wars\" found; opening in the default browser."
    open "$URL"
  fi
fi

LAN=$(ipconfig getifaddr en0 2>/dev/null || true)
echo
echo "Zebra Wars is running at $URL"
[ -n "$LAN" ] && echo "On the same network: http://$LAN:$PORT/"
echo "Ctrl-C to stop."
wait "$VITE"
