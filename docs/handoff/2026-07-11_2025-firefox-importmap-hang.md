# Session Handoff — 2026-07-11 20:25

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-11_2025-firefox-importmap-hang.md` and continue the work described there.

## Goal
Diagnose why every page of the site never finishes loading in Firefox
("Transferring data from localhost…" forever, tab spinner never stops, all
requests 200 in devtools), fix it, guard against regression, and produce a
reproducer + Bugzilla draft so Martin can report the Firefox side.

## State
- Repo: worktree `wt/claude1`, branch `importmap-static`, HEAD `e275e05`,
  working tree clean.
- **PR #55 is MERGED** (2026-07-11T18:08Z) — this branch is dead; any new work
  starts from `origin/main` (see CLAUDE.md's merged-branch rules).
- **Done, verified:**
  - Root cause found: commit `fe0d6f4` replaced each page's static
    `<script type="importmap">` with an inline script that builds and injects
    the map at load time. In Firefox 152 that makes (a) every nested module
    load twice (unversioned + `?v=N`) and (b) the document load group leak an
    image/favicon entry, so the `load` event never fires — on localhost AND on
    https://schlaufuchs.ankerl.com. Chrome unaffected. Found by driving
    headless Firefox via raw Marionette (probe script:
    `scratchpad/statuswatch.py`, session-local), `MOZ_LOG=LoadGroup:5`
    (requests "Adding" without "Removing"), and `git bisect run` with 4
    Firefox loads per commit.
  - Fix: `tools/version-assets.js` emits a literal static import map again;
    assets bumped to v68 across all ten pages. Verified: 344/344 tests, map
    page 4/4 and einmaleins 2/2 now reach `readyState=complete` in Firefox
    152.0.4, double fetches gone, Chrome screenshot unchanged.
  - Regression guard: `tests/cache.test.js` — exactly one static
    `<script type="importmap">` per page, before any module script, and the
    string `importmap` may appear ONLY as that script's type attribute. Both
    assertions proven able to fail via `tools/mutate.sh`.
  - Deliverables handed to Martin (session files, not in repo):
    `bugreport-firefox.md` (English Bugzilla draft, component Core::DOM:
    Networking) and `firefox-importmap-hang-repro.tar.gz` (self-contained:
    `index.html` hangs most loads, `full.html` ~always, `control-static.html`
    never — plus README).
- **In progress:** nothing.
- **Not started:** Martin filing the Bugzilla report; confirming the deployed
  v68 actually un-hangs the live site in Firefox (deploy runs on merge to
  main — check https://schlaufuchs.ankerl.com serves `?v=68` and loads to
  `readyState=complete`).

## Key context
- `tools/version-assets.js` — header explains WHY the map must stay static;
  the emitter writes the static block; its migration regex replaces whatever
  `<script…>` follows the `<!-- cache coherence -->` marker, so it converted
  the injected form automatically.
- `tests/cache.test.js` — the guard lives in the test
  "the import map is static and precedes any module the page loads".
- Memory file `firefox-injected-importmap-hang.md` (auto-memory dir) has the
  condensed story + probe method.
- Mechanism detail (for the Firefox bug, established by experiment): a
  parser-blocking stylesheet delays the inline injector while the speculative
  parser already fetched the module entry; the dependency graph then resolves
  with NO map (unversioned fetches) and is re-resolved once the map registers
  (`?v=N` fetches). One of the image-ish loads that start during that storm
  (SVG favicon, `/favicon.ico` fallback, or the topbar icon `<img>`s from
  `initTopBar`) stays registered in the load group forever although its HTTP
  channel completed. Webfonts and the late-inserted `<img>`s are necessary
  ingredients: removing either made the hang vanish.
- Dead ends — do not repeat:
  - It is NOT the python server (HTTP/1.0 vs 1.1 identical), NOT tailing
    (`network.http.tailing.enabled=false` still hangs), NOT throttling
    (already default-off), NOT the fox rAF walk (`ui.prefersReducedMotion=1`
    still hangs), NOT the favicon per se (page without any icon link still
    hangs via `/favicon.ico` 404), NOT the drawn-icons commit `920e7f7`
    (4/4 clean at that commit).
  - A from-scratch minimal repro (10 modules + injected map + slow CSS +
    fonts + late imgs) reproduces the DOUBLE FETCH reliably but not the hang;
    the reduced real page (`min2` = full head + gutted body) is the smallest
    thing that hangs, and is what the tarball ships.
  - Single test runs lie: the hang is a race (~75–100% on full pages, less on
    stripped ones). Use ≥3–4 runs per verdict; the earlier per-variant
    bisecting with n=1 produced contradictory results until this was clear.
- Commands: `sh tools/serve.sh`, `node --test`,
  `node tools/version-assets.js <n>`, `sh tools/mutate.sh <file> <perl> [tests]`.
  Firefox probing: start `firefox --headless --new-instance --marionette
  -remote-allow-system-access --profile $(mktemp -d)` then
  `python3 statuswatch.py <url> <seconds>` (script currently only in the
  session scratchpad — recreate from the memory file's description or the
  handoff below if needed; ~90 lines, speaks Marionette over TCP 2828).
- **Machine hygiene:** headless Firefox instances can linger if a probe run is
  interrupted (they hold Marionette port 2828 and break the next probe with a
  hanging `WebDriver:NewSession`). Check `ps aux | grep -e -marionette` and
  kill by PID. Never `pkill -f` a pattern that appears in your own command line.

## Next steps
1. Verify the deploy: `curl -s https://schlaufuchs.ankerl.com/ | grep -o 'v=68'`
   and (optionally) a Firefox probe against the live URL reaching
   `readyState=complete`.
2. Martin files the Bugzilla report using `bugreport-firefox.md` + the tarball
   (both delivered as session files). If Mozilla asks for a regression window,
   `mozregression` against `full.html` in the tarball would find it.
3. Nothing else open from this session.

## Reflection

### 1. What in the delivered work am I least confident is correct?
The claim that the LIVE site is fixed — I verified the fix only against the
local worktree. The deploy pipeline (test → copy → Pages cache) hadn't run
when the session ended, and the site's day-long asset cache means a browser
holding a cached v67 `index.html` keeps the injected map (and the hang) until
that page expires. Check step 1 of Next steps, ideally a day after merge too.
Second doubt: the guard in `cache.test.js` bans the string `importmap` outside
the one static script — if a future legitimate use appears (say a comment
mentioning it), the test fails "spuriously"; that strictness is deliberate but
someone may loosen it in the wrong direction (allowing scripts again) instead
of the right one (allowing comments).

### 2. What assumptions did I make that I never stated explicitly?
(a) That headless Firefox and Martin's headed flatpak Firefox share the bug's
behavior — all my probes were headless (native 152.0.4); Martin's original
report plus matching symptoms was the only headed evidence. If wrong, the fix
still stands (verified in the engine that showed the bug) but the Bugzilla
report's "reproduces headless" claim carries the weight. (b) That the double
fetch and the load-group leak are the same underlying Firefox defect — the
report presents them as linked; if they're independent, the static map still
avoids both, but Mozilla might split the report. (c) That no page
intentionally relies on `load` never firing — I grepped for `load` listeners
and found none, but third-party-ish code (none today) or future code could.

### 3. What is the biggest thing the user may not realize about the broader situation?
Every Firefox 152 visitor of the live site has been seeing an eternal tab
spinner since fe0d6f4 shipped (v52, ~yesterday) — on every page, every visit.
For a children's site where a parent judges trustworthiness in seconds, a
permanently "loading" page is a quiet credibility leak that no test caught
because nothing functional depends on `load`. The deeper point: the repo's
verification story is Chrome-first (`shoot.mjs` proves things; `firefox-shot.sh`
"only looks" — and worse, it waits on the `load` event, so during the broken
window it silently hung rather than failing loudly). A cheap cross-engine
"does `load` fire within N seconds" check would have caught this the day it
shipped; see Q5.

### 4. If this work breaks in 3 months, what's the most likely reason?
Someone re-centralizes the version bump for DX (the exact motivation that
produced fe0d6f4 — "a bump is one number, injected at load time") in a new
shape the guard doesn't recognize: e.g. a service worker rewriting URLs, or a
`<script src>` that document.writes a map. The cache.test.js guard catches the
literal injected-importmap pattern, not every dynamic-resolution scheme. The
header comment in version-assets.js is the real defense; if a future change
touches that file's emitter, the reviewer must reread it.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
A committed `tools/ff-probe.sh` (headless Firefox + Marionette readyState
probe, i.e. statuswatch.py productized): I rebuilt that capability mid-session
from raw TCP because firefox-shot.sh can't ask "did `load` fire?", and roughly
a third of the session's wall time went into probe scaffolding, flaky
Marionette sessions from lingering instances, and n=1 verdicts before I
standardized on hangtest.sh with n≥3. Worth building now — it's ~100 lines,
already designed, and it turns "Firefox seems stuck" from a debugging session
into a one-command check that could also run as a smoke test after deploys.

### 6. What could the user have done differently to make this session smoother?
Two facts from the original report would have cut an hour of favicon-chasing:
(1) that the hang also happens on the live site, not only against
`python3 -m http.server` — I discovered that late, and it immediately
eliminated the whole server-side hypothesis space; (2) roughly when the
symptom first appeared (even "since yesterday") — that would have pointed at
the recent-commit window and made the repo bisect the first move instead of
the fifth. Also, mentioning that Opus had already tried and what it ruled out
(rather than just "didn't find it") would have avoided re-walking the same
first steps.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
A post-deploy synthetic check that loads every page of the live site in BOTH
engines (headless Chrome via shoot.mjs, headless Firefox via the Q5 probe) and
asserts `load` fired, no console errors, and no horizontal scroll — run from
CI after Pages publishes. Static kid-focused sites almost never have
cross-engine monitoring; this one already owns 90% of the tooling
(shoot.mjs, serve.sh, the probe design), and it would have turned this
session's bug into a red CI run yesterday instead of a child watching a
spinner that never stops.
