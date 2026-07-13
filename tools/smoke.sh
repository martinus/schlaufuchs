#!/bin/sh
# Cross-engine smoke test: load every page of the site in BOTH engines and fail
# on the things a `node --test` run cannot see.
#
#   sh tools/smoke.sh                 # against a local server (started for you)
#   sh tools/smoke.sh https://schlaufuchs.ankerl.com   # against the live site
#
# Why it exists: this site's verification was Blink-first, and its worst shipped
# bug lived in the gap. An injected import map (fe0d6f4) made Firefox 152 never
# fire the `load` event — every page, every visit, an eternal tab spinner — on
# localhost AND live, for a full day, and no test caught it because nothing
# functional waits on `load`. A parent judges a children's site in seconds; a
# page that is forever "loading" is a quiet credibility leak.
#
# The two halves cover the two failure classes this project has actually shipped:
#   Chrome, via tools/shoot.mjs  — the page loaded (not a 404 / dead host), logged
#                                  no uncaught error or console.error (a stale
#                                  index.html paired with a fresh module throws
#                                  and renders chrome-less), and does not scroll
#                                  sideways at the 360px baseline.
#   Firefox, via tools/ff-probe.sh — the `load` event actually fires (readyState
#                                  reaches "complete") within a deadline.
#
# Pages are discovered, not listed: every root *.html and every games/*/ — so a
# new page is covered the moment it exists, matching tests/pages.js.
#
# Env:
#   REPEAT   Firefox probes per page (default 1; CI raises it because the hang
#            is a race and one pass can miss a probabilistic regression).
#   SIZE     Chrome viewport (default 360x640, the site's tightest baseline).
#
# Exit status is the number of failures (0 = all pages load clean in both engines).

set -e

root=$(git rev-parse --show-toplevel)
size=${SIZE:-360x640}
repeat=${REPEAT:-1}

base=${1:-}
started_server=""
if [ -z "$base" ]; then
  # No base given: serve this checkout and probe localhost. serve.sh is
  # idempotent and owns its PID, so we only stop a server we started.
  before=$(cat "$root/.serve.pid" 2>/dev/null || true)
  sh "$root/tools/serve.sh" >/dev/null
  after=$(cat "$root/.serve.pid" 2>/dev/null || true)
  [ "$before" != "$after" ] && started_server=1
  base="http://localhost:8000"
fi
base=${base%/}   # no trailing slash; we add our own

cleanup() {
  [ -n "$started_server" ] && sh "$root/tools/kill-serve.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Discover pages the same way tests/pages.js does, and turn each into the URL a
# visitor actually opens (a directory index is visited as the directory).
urls=""
for f in "$root"/*.html; do
  name=${f##*/}
  if [ "$name" = "index.html" ]; then
    urls="$urls $base/"
  else
    urls="$urls $base/$name"
  fi
done
for d in "$root"/games/*/; do
  urls="$urls $base/games/$(basename "$d")/"
done

echo "smoke: $base — $(printf '%s\n' $urls | grep -c .) pages, Chrome ($size) + Firefox (x$repeat)"
echo

fails=0

echo "── Chrome (shoot.mjs) ──"
for u in $urls; do
  if out=$(node "$root/tools/shoot.mjs" "$u" --size "$size" 2>&1); then
    echo "ok   $u"
  # One retry: a cold runner's first Chrome launch can fail to come up at all,
  # which says nothing about the page. A page that fails TWICE — once on a
  # warmed-up Chrome — is a real failure and still fails the run.
  elif out=$(node "$root/tools/shoot.mjs" "$u" --size "$size" 2>&1); then
    echo "ok   $u (after one retry — first Chrome launch flaked)"
  else
    echo "FAIL $u"
    echo "$out" | sed 's/^/       /'
    fails=$((fails + 1))
  fi
done

echo
echo "── Firefox (ff-probe.sh) ──"
# One Firefox launch for all pages — the launch is the slow part, the probe is
# cheap. ff-probe's exit status is its own failure count.
if FF_REPEAT="$repeat" sh "$root/tools/ff-probe.sh" $urls; then
  :
else
  fails=$((fails + $?))
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "smoke: all pages load clean in both engines ✓"
else
  echo "smoke: $fails failure(s) — see above"
fi
exit "$fails"
