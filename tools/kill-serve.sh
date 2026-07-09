#!/bin/sh
# Stop the server that `tools/serve.sh` started for THIS checkout, and nothing
# else. Never `pkill -f`: that pattern matches other people's python servers,
# and — because the pattern appears in the command line that runs pkill — the
# shell issuing it. Both have happened here.
#
#   sh tools/kill-serve.sh [port]
#
# A PID alone is not proof: PIDs are recycled. This kills a process only if its
# command line still says it is a python http.server on this port serving this
# checkout. Anything else, and it refuses and says why.

set -e

root=$(git rev-parse --show-toplevel)
port=${1:-${PORT:-8000}}
pidfile="$root/.serve.pid"

if [ ! -f "$pidfile" ]; then
  echo "no server was started here (no $pidfile)"
  exit 0
fi

pid=$(cat "$pidfile")
args=$(ps -p "$pid" -o args= 2>/dev/null || true)

if [ -z "$args" ]; then
  echo "pid $pid is gone; removing the stale $pidfile"
  rm -f "$pidfile"
  exit 0
fi

case "$args" in
  *http.server*" $port "*"--directory $root"*) ;;
  *)
    echo "pid $pid is not our server, so it stays alive:" >&2
    echo "  $args" >&2
    rm -f "$pidfile"
    exit 1
    ;;
esac

kill "$pid"

# Give it a moment to go, then make sure it did. A server left half-dead holds
# the port and the next `serve.sh` refuses to start.
i=0
while [ "$i" -lt 30 ] && kill -0 "$pid" 2>/dev/null; do
  i=$((i + 1))
  sleep 0.1
done
if kill -0 "$pid" 2>/dev/null; then
  kill -9 "$pid" 2>/dev/null || true
fi

rm -f "$pidfile"
echo "stopped the server on port $port (pid $pid)"
