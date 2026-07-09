#!/bin/sh
# Serve this checkout on http://localhost:8000, idempotently.
#
#   sh tools/serve.sh [port]     # start it (or report the one already running)
#   sh tools/kill-serve.sh       # stop exactly the one this started
#
# The pages are ES modules, so `file://` cannot load them: every visual check
# goes through a real server. Starting one by hand is easy; stopping it is
# where this project has drawn blood — `pkill -f "http.server 8000"` matches
# the very shell command that contains the pattern and kills it, taking a
# `git commit` with it. So the PID is written down here and killed by number.
#
# The PID file lives in the checkout, which is what makes this safe across the
# worktrees this repo is developed in: each one owns its own server, and
# kill-serve.sh refuses to touch a process it cannot prove is that server.

set -e

root=$(git rev-parse --show-toplevel)
port=${1:-${PORT:-8000}}
pidfile="$root/.serve.pid"

# True only if `pid` is alive AND is a python http.server on `port` serving
# `root`. PIDs are recycled; the command line is the proof.
is_our_server() {
  args=$(ps -p "$1" -o args= 2>/dev/null) || return 1
  case "$args" in
    *http.server*" $port "*"--directory $root"*) return 0 ;;
    *) return 1 ;;
  esac
}

if [ -f "$pidfile" ]; then
  old=$(cat "$pidfile")
  if is_our_server "$old"; then
    echo "already serving $root on http://localhost:$port (pid $old)"
    exit 0
  fi
  # a stale file: the server died, or its PID now belongs to something else
  rm -f "$pidfile"
fi

# Someone else's server on this port is not ours to kill, and not ours to
# serve from either — it would answer with a different repo's files.
if curl -s -o /dev/null --max-time 1 "http://localhost:$port/" 2>/dev/null; then
  echo "port $port is already taken by something this script did not start" >&2
  echo "stop it yourself, or pass another port: sh tools/serve.sh 8001" >&2
  exit 1
fi

# `--directory` keeps the cwd out of it and gives kill-serve.sh the string it
# needs to recognise this process later.
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" \
  </dev/null >/dev/null 2>&1 &
pid=$!
echo "$pid" > "$pidfile"

# Wait for it to answer rather than guessing at a sleep: a screenshot taken
# against a server that is not up yet is a blank page and a confusing bug.
i=0
while [ "$i" -lt 50 ]; do
  if curl -s -o /dev/null --max-time 1 "http://localhost:$port/"; then
    echo "serving $root on http://localhost:$port (pid $pid)"
    exit 0
  fi
  kill -0 "$pid" 2>/dev/null || break
  i=$((i + 1))
  sleep 0.1
done

rm -f "$pidfile"
kill "$pid" 2>/dev/null || true
echo "the server did not come up on port $port" >&2
exit 1
