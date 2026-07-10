#!/bin/sh
# Screenshot a page in Firefox. A second engine, because a bug that only Chrome
# can see is a bug this project ships.
#
#   sh tools/firefox-shot.sh <url> <out.png> [WxH]
#
#   sh tools/firefox-shot.sh http://localhost:8000/games/einmaleins/ ff.png 360x760
#
# tools/shoot.mjs drives Chrome and is the tool for *proving* things: it clicks,
# evaluates, probes geometry, fails on a page error or a sideways scroll. This
# one only looks. Firefox has no DevTools-protocol client here and its
# `--screenshot` flag takes no cookies and runs no script, so there is nothing to
# assert against — you get a picture, and you read it.
#
# That is enough for the class of bug it exists for. The level-picker button was
# reported from Firefox on an Android phone: a `<button>` styled `display: block`
# with `min-height: 0` renders shorter in Gecko than in Blink, and a `▾` glyph in
# a `::after` falls back to whatever font the device has. Both were invisible in
# every Chrome screenshot this project had taken.
#
# The profile is a throwaway in $TMPDIR, so this never touches the Firefox you
# are browsing with, and `--new-instance` keeps it from attaching to it.

set -e

if [ $# -lt 2 ]; then
  sed -n '2,21p' "$0" | sed 's|^# \{0,1\}||'
  exit 1
fi

url=$1
out=$2
size=${3:-360x760}

case "$size" in
  *x*) w=${size%x*}; h=${size#*x} ;;
  *) echo "firefox-shot: size wants WxH, got $size" >&2; exit 1 ;;
esac

bin=${FIREFOX:-firefox}
command -v "$bin" >/dev/null || {
  echo "firefox-shot: no '$bin' on PATH. Set \$FIREFOX." >&2
  exit 1
}

profile=$(mktemp -d -t firefox-shot-XXXXXX)
trap 'rm -rf "$profile"' EXIT INT TERM

# Firefox writes nothing to stdout and exits 0 even when it wrote no file, so the
# file's existence is the only proof the shot happened.
rm -f "$out"
"$bin" --headless --new-instance --profile "$profile" \
  --window-size="$w,$h" --screenshot "$out" "$url" >/dev/null 2>&1 || true

[ -s "$out" ] || {
  echo "firefox-shot: no image at $out — is the server up? is the url right?" >&2
  exit 1
}
echo "$out ($size, firefox)"
