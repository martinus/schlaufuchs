#!/bin/sh
# Render a page from another commit, so a screenshot can answer the one question
# a screenshot cannot answer alone: **did I break this, or was it always so?**
#
#   sh tools/baseline.sh <ref> <path> [shoot.mjs options...]
#
#   sh tools/baseline.sh origin/main album.html --size 360x640 --out was.png
#   sh tools/baseline.sh HEAD~3 games/einmaleins/ --size 360x640 --probe '#pickchip'
#
# `<ref>` is anything `git worktree add` accepts. `<path>` is relative to the
# site root, with no leading slash. Everything after it is handed to
# tools/shoot.mjs unchanged, so its exit code is this script's exit code — a
# baseline run that fails the horizontal-overflow guard tells you the bug is
# older than your branch.
#
# Twice now this has been hand-rolled at 2am (`git worktree add /tmp/mainwt`,
# a second `python3 -m http.server` on a port picked by guesswork, and no
# teardown). Both times it settled a question nothing else could: the Pokalraum's
# sideways scroll was mine, and the round summary's oversized trophy card was
# not. It is worth eleven lines of shell.
#
# The worktree and the server are torn down on every exit path, including Ctrl-C.
# The port is asked for from the kernel, not guessed, so this never collides with
# tools/serve.sh or with another checkout doing the same thing.

set -e

if [ $# -lt 2 ]; then
  sed -n '2,25p' "$0" | sed 's|^# \{0,1\}||'
  exit 1
fi

ref=$1
path=$2
shift 2

root=$(git rev-parse --show-toplevel)
# Fail before building anything if the ref is not a ref: `git worktree add` would
# otherwise create a *branch* of that name and leave it behind.
git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || {
  echo "baseline: '$ref' is not a commit" >&2
  exit 1
}

tree=$(mktemp -d -t schlaufuchs-baseline-XXXXXX)
pid=""

cleanup() {
  [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  # never `pkill -f http.server`: the pattern matches the shell running it
  [ -n "$pid" ] && wait "$pid" 2>/dev/null || true
  git worktree remove --force "$tree" 2>/dev/null || true
  rm -rf "$tree"
}
trap cleanup EXIT INT TERM

git worktree add --detach --quiet "$tree" "$ref"

# The kernel owns the port list; guessing one races every other checkout.
port=$(python3 -c 'import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()')

python3 -m http.server "$port" --bind 127.0.0.1 --directory "$tree" \
  </dev/null >/dev/null 2>&1 &
pid=$!

# Wait for an answer rather than sleeping: a shot against a server that is not up
# yet is a blank page, and a blank page looks like a very clean regression.
i=0
while [ "$i" -lt 50 ]; do
  curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$port/" && break
  kill -0 "$pid" 2>/dev/null || { echo "baseline: the server died" >&2; exit 1; }
  i=$((i + 1))
  sleep 0.1
done
[ "$i" -lt 50 ] || { echo "baseline: the server never came up" >&2; exit 1; }

echo "baseline: $ref (${tree##*/}) on http://127.0.0.1:$port" >&2
node "$root/tools/shoot.mjs" "http://127.0.0.1:$port/$path" "$@"
