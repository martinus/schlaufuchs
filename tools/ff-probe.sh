#!/bin/sh
# Ask Firefox the one question a screenshot cannot: did the page finish loading?
#
#   sh tools/ff-probe.sh <url> [<url> ...]
#
#   sh tools/ff-probe.sh http://localhost:8000/ http://localhost:8000/games/lesen/
#
# `firefox-shot.sh` only *looks*, and worse, its `--screenshot` flag waits on the
# `load` event — so during the window where fe0d6f4's injected import map made
# Firefox 152 never fire `load` (readyState stuck at "interactive" forever, the
# tab spinner never stopping), the shot tool hung silently instead of failing
# loudly, and every Firefox visitor of the live site watched a spinner that never
# stopped. No test caught it because nothing functional waits on `load`.
#
# This drives Firefox over Marionette with pageLoadStrategy "none" — so we regain
# control the instant navigation starts — then polls `document.readyState` until
# it reaches "complete" or a deadline passes. A page that never completes is the
# bug; an `about:neterror` document is an unreachable host. Either fails the run.
# (An HTTP 404 that still sends a body loads as a normal document here — Gecko's
# content JS cannot see the status code; that case is the Chrome side's job, where
# shoot.mjs fails on a main-document status >= 400.)
#
# It is the Firefox half of `tools/smoke.sh`: Blink (via shoot.mjs) proves no JS
# errors and no sideways scroll, Gecko (here) proves the load event actually
# fires. Between them they cover the failure classes this site has actually shipped.
#
# Env:
#   FIREFOX      firefox binary (default: firefox)
#   FF_TIMEOUT   seconds a page may take to reach "complete" (default: 20)
#   FF_REPEAT    probe each url this many times (default: 1). The hang is a race
#                — ~75-100% on heavy pages, less on light ones — so a single pass
#                can miss it; CI raises this to catch a probabilistic regression.
#   FF_PORT      Marionette port (default: 2829, NOT the 2828 default, so this
#                never attaches to a Firefox you happen to be browsing with)
#
# The profile is a throwaway in $TMPDIR and the instance is killed on every exit
# path, so this never touches your own Firefox or leaves a process holding the port.

set -e

if [ $# -lt 1 ]; then
  sed -n '2,30p' "$0" | sed 's|^# \{0,1\}||'
  exit 1
fi

bin=${FIREFOX:-firefox}
timeout=${FF_TIMEOUT:-20}
repeat=${FF_REPEAT:-1}
port=${FF_PORT:-2829}

command -v "$bin" >/dev/null || {
  echo "ff-probe: no '$bin' on PATH. Set \$FIREFOX." >&2
  exit 1
}
command -v python3 >/dev/null || {
  echo "ff-probe: needs python3 for the Marionette client." >&2
  exit 1
}

profile=$(mktemp -d -t ff-probe-XXXXXX)
ffpid=""
cleanup() {
  [ -n "$ffpid" ] && kill "$ffpid" 2>/dev/null || true
  rm -rf "$profile"
}
trap cleanup EXIT INT TERM

# Pin the Marionette port in the profile rather than trusting the default, and
# quiet the parts of a cold Firefox that would otherwise fetch the network
# (the update ping, the new-tab tiles) and muddy "still loading".
cat > "$profile/user.js" <<EOF
user_pref("marionette.port", $port);
user_pref("app.update.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.newtabpage.enabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
EOF

"$bin" --headless --new-instance --marionette --profile "$profile" \
  about:blank >/dev/null 2>&1 &
ffpid=$!

FF_PORT="$port" FF_TIMEOUT="$timeout" FF_REPEAT="$repeat" \
  python3 - "$@" <<'PY'
import json, os, socket, sys, time

PORT = int(os.environ["FF_PORT"])
TIMEOUT = float(os.environ["FF_TIMEOUT"])
REPEAT = int(os.environ["FF_REPEAT"])
URLS = sys.argv[1:]


class Marionette:
    """A minimal Marionette client: length-prefixed JSON over TCP (protocol 3)."""

    def __init__(self, port, connect_timeout=60):
        deadline = time.time() + connect_timeout
        while True:
            try:
                self.sock = socket.create_connection(("127.0.0.1", port), timeout=5)
                break
            except OSError:
                if time.time() > deadline:
                    raise
                time.sleep(0.3)
        self.sock.settimeout(60)
        self.buf = b""
        self.msgid = 0
        hello = self._read()
        assert hello.get("marionetteProtocol") == 3, hello

    def _read(self):
        while b":" not in self.buf:
            self.buf += self.sock.recv(65536)
        n, rest = self.buf.split(b":", 1)
        n = int(n)
        while len(rest) < n:
            rest += self.sock.recv(65536)
        self.buf = rest[n:]
        return json.loads(rest[:n])

    def cmd(self, name, params):
        self.msgid += 1
        payload = json.dumps([0, self.msgid, name, params]).encode()
        self.sock.sendall(str(len(payload)).encode() + b":" + payload)
        while True:
            msg = self._read()
            if isinstance(msg, list) and msg[0] == 1 and msg[1] == self.msgid:
                if msg[2]:
                    raise RuntimeError(msg[2])
                return msg[3]

    def js(self, script):
        return self.cmd("WebDriver:ExecuteScript", {"script": script, "args": []})["value"]


# pageLoadStrategy "none" hands control back the instant navigation begins, so
# WE decide when the page is done — the whole point is not to wait on `load`
# ourselves the way firefox-shot.sh did.
m = Marionette(PORT)
m.cmd("WebDriver:NewSession", {"pageLoadStrategy": "none"})
m.cmd("Marionette:SetContext", {"value": "content"})

PROBE = """
return JSON.stringify({
  ready: document.readyState,
  uri: document.documentURI,
});
"""

failures = 0
for url in URLS:
    for attempt in range(REPEAT):
        m.js("window.stop(); window.location.href = %s;" % json.dumps(url))
        t0 = time.monotonic()
        state = {"ready": "?", "uri": ""}
        while time.monotonic() - t0 < TIMEOUT:
            time.sleep(0.25)
            state = json.loads(m.js(PROBE))
            # An unreachable host lands on about:neterror, which DOES reach
            # "complete" — so check the document, not just the ready state.
            if state["uri"].startswith("about:neterror"):
                break
            if state["ready"] == "complete" and state["uri"] != "about:blank":
                break
        took = time.monotonic() - t0
        tag = ("#%d " % (attempt + 1)) if REPEAT > 1 else ""
        if state["uri"].startswith("about:neterror"):
            print("FAIL %s%s — did not load (about:neterror; host unreachable)" % (tag, url), flush=True)
            failures += 1
        elif state["ready"] == "complete":
            print("ok   %s%s — complete in %.1fs" % (tag, url, took), flush=True)
        else:
            print("FAIL %s%s — stuck at readyState=%s after %.0fs (load never fired)"
                  % (tag, url, state["ready"], TIMEOUT), flush=True)
            failures += 1

try:
    m.cmd("Marionette:Quit", {})
except Exception:
    pass

sys.exit(1 if failures else 0)
PY
