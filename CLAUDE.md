# CLAUDE.md — Schlaufuchs

Orientation for an agent working on this repo. Read this first, then
`docs/SPEC.md` for the authoritative product spec. `docs/ARCHITECTURE.md`
maps the code — layers, dependency rules, testing kinds, extension recipes.

## What this is

A static website of educational browser games for children (ages 5–15),
framed as an illustrated world map. Live at https://schlaufuchs.ankerl.com.
Fully client-side: vanilla HTML/CSS/JS, **no build step, no dependencies, no
framework**. Progress is stored in a single cookie. Hosted on GitHub Pages.

## Commands

```sh
sh tools/serve.sh               # serve on :8000 — ALWAYS, never file:// (ES modules)
sh tools/kill-serve.sh          # stop it again
node --test                     # run unit tests (tests/*.test.js), needs Node 22+
node --check <file.js>          # syntax-check a module
node tools/version-assets.js N  # bump asset version — REQUIRED before deploying a change
node tools/shoot.mjs <url> …    # drive a real Chrome: screenshot + measure (--help)
sh tools/firefox-shot.sh <url> out.png [WxH]   # the same page in Gecko
sh tools/ff-probe.sh <url> …                   # Firefox: did the `load` event fire?
sh tools/smoke.sh [base-url]    # both engines × every page — the CI post-deploy check
sh tools/baseline.sh <ref> <path> [shoot opts] # the same page at another commit
sh tools/mutate.sh <file> <perl-expr> [tests]  # prove a test can fail
sh tools/install-hooks.sh       # pre-commit/pre-push guards (run once per clone)
```

`serve.sh` is idempotent (call it again and it reports the server it already
started) and refuses a port it does not own. It writes the PID to `.serve.pid`
in the checkout, so each worktree owns its own server, and `kill-serve.sh`
kills that PID only after `ps` confirms it is still a `python3 -m http.server`
on this port serving this checkout — a PID alone is not proof, because PIDs are
recycled.

**Never `pkill -f "http.server"` and never `pgrep -f "http.server" | xargs
kill`.** The pattern matches the command line of the very shell that runs it,
so the shell kills itself — this has eaten a `git commit` mid-run — and on a
shared machine it also kills someone else's server. Both forms were tried here;
both misfired. Use `kill-serve.sh`.

`tools/play.js` is the round driver for einmaleins — load it into a page with
`--do 'eval @tools/play.js'`, then `--do 'eval play({...})'`. It escapes the
level picker the game opens on (Escape starts the round on the fox's tile) and
plays until the summary is up. Options:

- `wrongAt: 3` or `[1,2,3]` — answer these questions wrongly first (drives the
  aid card, star loss, the ⭐⭐ tempo gate);
- `delayMs: 5000` — "think" that long before every answer, inside the game's
  tempo clock. This is how the slow tempo tiers (🐇/🚗, §10.6) are reached in a
  driven round and the knob for calibrating `TEMPO_TIERS`; the driver's
  deadline scales with it;
- `stopAt: 5` / `questions: n` — stop early, e.g. to screenshot mid-round.

It returns a trace of every question and of the scene after each one;
`readScene()` and `readSummary()` are also available as separate `eval` steps.
Seed state through the cookie (difficulty `d`, table `t`, `stars`, `tempo` —
see the recipe below), and read results back out of `document.cookie`. Two
traps: every post-answer wait must outlive the game's 250ms correct-wait
transition (`SETTLE = 350` in play.js — on Leicht a shorter wait re-reads the
same question and silently swallows `wrongAt`), and the trailing duplicate
reads of the final question in a trace are harmless phantoms. The parser is
unit-tested against every shape `questionFor()` can produce
(`tests/play.test.js`), because a driver that answers the wrong thing proves
nothing, quietly.

`tools/play-lesen.js` is the same thing for lesen: `playLesen({...})` with the
same options plus `stopInAid: true` (stop with the aid card still open, for
screenshots) and `waitHidden: true` (answer a word only after the blitz hid
it — the reduced-motion proof). Its `delayMs` sleep sits AFTER the reveal tap,
so it counts on lesen's tempo clock (§14.4) — the knob for reaching the slow
tempo tiers and calibrating lesen's `TEMPO_TIERS`, exactly like play.js for
einmaleins. Seed the cookie with difficulty `d` and pack
tile `p` (0–3 = themed packs, 4 = Alle); `readLesenScene()` reports the card
as `ready | faceUp | hidden | away` (`ready` = a word waits behind the
tap-to-reveal cover, §14.2 — `playLesen` taps it before answering). Its
resolver is unit-tested the same way (`tests/play-lesen.test.js`).

`tools/play-rechnungen.js` drives rechnungen: `playRechnung({...})` with the
same options as play.js (`wrongAt`, `delayMs`, `stopAt`/`questions`, plus
`stopInAid`). Keypad input on every difficulty, so it types digits and OK like
play.js. Seed the cookie with difficulty `d` and mode `m` (`"+" "-" "x" ":"
"mix"`). A new question is announced on `#question`'s `dataset.q` stamp (like
lesen), because a re-queued skill asks a fresh question that may read the same.
`resolveRechnung(text)` reads the printed equation — plain binary, a ± chain, or
a gap — and is unit-tested against every `questionFor` shape
(`tests/play-rechnungen.test.js`).

The hooks refuse a commit that fails `node --test` or that deletes tests
without saying so, and a push that would delete a file from `main`. Wave one
through with `SKIP_TEST_GUARD=1`.

There is no lint/format/build step. `node --test` is the only gate; the deploy
workflow runs it before publishing.

## Working rules (learned the hard way)

- **A bug found is a test written.** Before or right after fixing anything,
  add a test that fails on the old behaviour. Then re-break the code and watch
  it go red — a test that never fails is decoration. Use `sh tools/mutate.sh
  <file> <perl-expr> [test files]`: it copies the file, mutates it, runs
  `node --test`, and restores it from the copy on every exit path. **Never undo
  a mutation with `git checkout -- <file>`** — it reverts to HEAD, so it eats
  whatever you had not committed, and it *fails* on an untracked file and leaves
  the mutation sitting there. Both happened here, in one command. `mutate.sh`
  also exits 2 when the pattern matched nothing, which is the other silent way
  a mutation test lies to you. This repo has no types
  and no linter, so the test suite is the only thing standing between a change
  and a child staring at a blank page. Regression tests live next to their
  subject: `tests/map.test.js` (SVG structure), `tests/cache.test.js` (asset
  versioning), `tests/i18n.test.js` (string liveness), `tests/topbar.test.js`
  (the shared header). `tests/pages.js` is the shared page-discovery helper —
  a new root page joins every test the moment it exists.
- **Make it testable, then test it.** When the defect is inside DOM code, pull
  the arithmetic out as a pure function and unit-test that
  (`fittedFontSize()` in `games/einmaleins/logic.js` is the pattern).
- **Look at the page.** `sh tools/serve.sh`, then use `tools/shoot.mjs` to
  screenshot it at 390×844 and 360×640, and *read the image*. Every visual bug this project has
  had — a floating mountain, a clipped gear button, art standing in the sea, a
  "cobbled" road that read as a river — was invisible in the diff and obvious
  in the screenshot. `node --test` passing is not evidence that the page looks
  right. `shoot.mjs` also measures: `--clip .stage --probe '#feedback'` reports
  overflow past **all four** edges, because a probe that checks only the bottom
  will call a clipped top a success. Whatever an `eval` step returns lands in
  the report — use it to prove the run actually reached the state it claims:

  ```sh
  node tools/shoot.mjs http://localhost:8000/games/einmaleins/ \
    --cookie "schlaufuchs=$(node -e 'process.stdout.write(encodeURIComponent(JSON.stringify({einmaleins:{d:1,t:10}})))')" \
    --size 360x640 --do 'eval @play.js' --do 'eval play({ wrongAt: 1, stopAt: 1 })' \
    --clip .stage --probe '#feedback' --out aid.png
  ```

  **A shot fails when the page is wider than the viewport it was asked for.**
  This site never scrolls sideways, and when it did the symptom appeared
  somewhere else entirely — a `position: fixed` overlay opened 46px off-centre
  because a grid track two DOM levels away had widened the layout viewport. The
  report names the outermost element whose own parent still fits. `--allow-hscroll`
  waves it through. Note the trap it exists for: under mobile emulation Chrome
  grows `innerWidth` to fit the overflow, so `scrollWidth > innerWidth` is *false*
  in exactly the broken case; the check is against `--size`.

  **Two more tools, for the two questions a Chrome screenshot cannot answer.**
  `sh tools/baseline.sh <ref> <path> [shoot opts]` renders the same page from
  another commit (worktree + its own server, both torn down on exit) and answers
  "did I break this, or was it always so?". `sh tools/firefox-shot.sh <url>
  out.png [WxH]` answers "does it look like this in the other engine?" — Gecko
  squeezed a flex-item button to 16px where Blink gave it 37, and the level
  picker shipped with its bottom border cutting through its own label. It only
  looks: no cookies, no script, no probes.

  **`firefox-shot.sh` only looks — and its `--screenshot` waits on `load`, so it
  hangs silently on the one Firefox bug that mattered** (an injected import map
  made Gecko never fire `load`; every page spun forever, live, for a day, and no
  test saw it because nothing functional waits on `load`). `sh tools/ff-probe.sh
  <url> …` is the assertion firefox-shot can't make: it drives Firefox over
  Marionette and *fails* when a page's `load` never fires (readyState never
  reaches `complete`). `sh tools/smoke.sh [base-url]` is both engines over every
  page at once — Chrome (shoot.mjs: loaded, no JS errors, no sideways scroll)
  plus Firefox (ff-probe: `load` fired). With no base it serves the checkout;
  give it `https://schlaufuchs.ankerl.com` to check the live site. It is the
  post-deploy CI job (`.github/workflows/deploy.yml`, `REPEAT=3` because the hang
  is a race), so the next cross-engine regression is a red run, not a child
  staring at a spinner.

  `--full` captures a whole scrolling page (privacy, parents). `--reduced-motion`
  emulates `prefers-reduced-motion: reduce` — this repo treats that setting as
  non-negotiable, so verify it rather than assume it: an animated element that
  never arrives is invisible in every other run.

  `--do back` walks Chrome's own navigation history, the way the hardware button
  and the Android edge swipe do. `--do 'eval history.back()'` only tests what the
  page thinks a back is, which is the one thing the round guard (§10.7) must not
  be trusted about.
- **Silent no-ops are the dangerous ones.** `pave("einmaleins")` looked up an
  id that did not exist and quietly did nothing. Prefer a test that asserts the
  wiring exists over trusting that a missing element is "handled".
- **Dead strings and stale comments accumulate.** When you remove a feature,
  remove its i18n keys and fix the comments that describe the old behaviour.
  The i18n tests now fail on both a missing and an unused key, and
  `tests/exports.test.js` fails on an export nothing references — delete the
  export, or write the test it was exported for.
- **A merged PR ends its branch — and you will not be told when it happens.**
  Martin merges out of band, between your turns, often right after you open the
  PR. So the branch you are standing on may already be dead, and a merged branch
  is a dead end: pushing more commits to it does **nothing** to `main`, and
  `gh pr edit` on a merged PR edits a closed page nobody reads. Both were done
  this session — a whole feature was committed onto `round-guard` *after* it
  merged, and had to be cherry-picked out onto a fresh branch to reach `main`.

  Therefore, **the check below is the first thing you do before ANY new unit of
  work, not only when you happen to know a merge occurred.** Do not trust your
  memory of the branch's state from an earlier turn:

  ```sh
  gh pr list --state merged --limit 5      # is the branch I'm on already merged?
  git branch --show-current                # ...this one
  ```

  If it merged (or you are on `main`), start clean and move only the commits
  that are genuinely new:

  ```sh
  git fetch origin && git checkout -b <new-branch> origin/main
  git cherry-pick <sha-of-each-new-commit>   # NOT the ones already on main
  ```

  **Do not reach for `git rebase origin/main` to "catch up" a merged branch.**
  Merges here rewrite history: a rebase- or squash-merge lands your commits on
  `main` with **new SHAs**, so your local branch's originals look like fresh,
  unmerged work. Rebasing (or opening a PR from that branch) then replays them
  as duplicates on top of what already merged — and drags along anything that
  landed on `main` in between, reverting it. That is how a neighbouring PR
  nearly lost `tests/svg-icon-validator.js` and `tests/graphics-assets.test.js`.
  Cherry-picking only the new commit sidesteps all of it.

  A corollary of the SHA rewrite: **"is my work on `main`?" cannot be answered
  by SHA.** `git branch -r --contains <sha>` will say no even when the content
  is there. Ask `gh pr view <n> --json state,mergedAt` and compare the *diff*.

  Either way, **before opening the PR**, read what it deletes — an unexpected
  name here means you are undoing someone's merge:

  ```sh
  git diff --diff-filter=D --name-only origin/main..HEAD
  ```

## Conventions (do not violate)

- **All files, code, comments, and docs are English.** The user (Martin)
  communicates in German — **reply to him in German** — but that never carries
  into the repo.
- **UI strings are bilingual.** Every user-facing string goes into BOTH
  `assets/i18n/de.js` and `assets/i18n/en.js`. `tests/i18n.test.js` enforces
  key parity — a key in only one language fails CI.
- Keep the style: small vanilla ES modules, relative imports, no new deps.

## Architecture

Pages (each an entry point):
- `index.html` — the world map (inline SVG, viewBox `0 0 360 560`), driven by
  `assets/js/map.js`. Six regions: 5 games + the Trophy Room (→ album).
- `album.html` — trophy album, driven by `assets/js/album.js`.
- `games/<name>/index.html` + `<name>.js` — one folder per game. Three are
  fully implemented: `einmaleins`, `lesen` (Blitzwörter + Quatsch-Sätze, §14 —
  content in `games/lesen/content.js`, which is **append-only**: item order is
  the box string's index) and `rechnungen` (mental arithmetic ＋ − × ÷ Mix,
  §12 — skill buckets in `games/rechnungen/logic.js`, also **append-only**: a
  bucket's index is its box-string slot). `tippen`, `vokabeln` are stubs and
  share one module: their page is a `<body data-game>` and `assets/js/stub.js`
  is the rest.

**Every page contributes an empty `<header class="topbar" id="topbar">` and
nothing else.** The bar is built by `initTopBar()` (`chrome.js`), in one of two
shapes — the child's (map button, fox chip, gear) or the reader's (map button,
title). Never write bar markup into a page; `tests/topbar.test.js` fails on it.

Shared modules in `assets/js/`:
- `i18n.js` — `initI18n`, `t(key, params)`, `setLang`; `translateDOM` sets
  `textContent` on `[data-i18n]` and `aria-label` on `[data-i18n-label]`.
- `storage.js` — the single cookie `schlaufuchs`. Pure encode/decode +
  `patchSection` + typed section readers (`getSettings`/`getRewards` take an
  optional already-loaded state, so a page parses the cookie once). **Hard
  3500-byte budget** (`BUDGET`); writes over budget are refused. Do not add
  persistent state casually.
- `rewards.js` — stars, trophies, region/badge state. Pure functions are
  exported and unit-tested: `trophyCount(game, pr)`, `totalTrophies`,
  `totalPoints(pr)`, `starBadgeTier(pr, game)`, `nextTrophyInfo(game, pr)`.
  **The trophy ladder is per game**: `THRESHOLDS[game]`, scaled by
  `ladderFor(MAX_POINTS[game])` from the einmaleins curve. `foxInfo()` reads the
  cookie and returns the two numbers the top bar shows: `{stars, trophies}`.
  **⭐ is the site's only currency.** `rewards.pr` is the weighted star counter
  (Leicht 1, Mittel 2, Schwer 3); internally the code says `points`, the UI
  never does. `MAX_POINTS` is its denominator everywhere and is a **guess** for
  the two unbuilt games (`tippen`, `vokabeln`) — recompute when one ships
  (einmaleins, lesen and rechnungen are computed from their real tiles).
- `journey.js` — the round's scene; `sceneGeometry(nodes, theme)` is the pure
  arithmetic (tested), `createJourney` is the DOM around it.
- `mapwalk.js` / `motion.js` / `levelfox.js` — the fox's walk: pure gait
  arithmetic; the one rAF driver (`runWalk`) plus `prefersReducedMotion()`;
  the fox element in the level picker. The island and the picker share the
  driver and the gait, and both open a place only once the fox has arrived.
- `graphics.js` — the icon registry (see below). `applyIcons` only matters where
  a page has static `[data-icon]` markup, which today is `index.html` alone.
- `trophycard.js` — `trophyCardHTML(trophy, {size, lang, href, cls, label})`,
  the ONE way a trophy is drawn. The album shelf and the round summary both
  call it, so a child recognises what she won when she meets it again.
- `chrome.js` — the one top bar: `topBarHTML` (pure, tested), `initTopBar`,
  `renderFoxChip` (fox, stars, trophies — nothing else, §3.3) and
  `initSettingsOverlay` (sound/language/reset).
- `overlay.js` — the overlay contract, used by all three overlays: focus in on
  open and back to the opener on close, Escape/backdrop close unless
  `dismissible: false`, and `anyOverlayOpen()` — which is how a game knows the
  keyboard is not its own. Never toggle an overlay's `.hidden` by hand.
- `adaptive.js` (Leitner-light practice engine), `audio.js` (synth WebAudio
  sfx, respects mute), `fox.js` (code-generated mascot SVG; the pose is its
  only variable), `confetti.js`.

## Key invariants & gotchas

- **Bump the asset version on every deploy** (`node tools/version-assets.js N`).
  GitHub Pages serves everything with `Cache-Control: max-age=86400` and each
  file expires on its own clock, so a browser can pair a cached old
  `index.html` with a freshly fetched `map.js`. They disagree about element
  ids, the JS throws, and the page renders without its chips and buttons —
  invisible in incognito, which has an empty cache. Every URL a page loads
  therefore carries the page's version, propagated to nested imports by an
  import map in each HTML file. Read the header of `tools/version-assets.js`.

- **Graphics registry** (`graphics.js`): all icon-like art is a named entry
  with an emoji fallback. A name renders as an SVG file
  (`assets/img/icons/<name>.svg`, viewBox `0 0 64 64`) **only if listed in the
  `AVAILABLE` set** — which is currently empty, so everything shows emoji. To
  swap in real graphics: drop files in `assets/img/icons/` and add names to
  `AVAILABLE`. URLs resolve via `import.meta.url` — **never emit absolute
  `/assets/...` paths** (subpath deploys must work). Not in the registry: the
  fox (`fox.js`) and the hand-drawn map scenery polygons in `index.html`.
  Icons added to `AVAILABLE` are gated by `tests/graphics-assets.test.js`
  (validator in `tests/svg-icon-validator.js`): the file must exist and satisfy
  the machine-checkable items of `docs/GRAPHICS_BRIEF.md` (viewBox 64,
  transparent, no scripts/raster/external refs/fonts), and no stray files may
  sit in `assets/img/icons/`.
- **Icons and i18n don't mix.** `translateDOM` overwrites `textContent`, so an
  icon must never live inside a `[data-i18n]` element — use a sibling/inner
  span (see `.fallback-nav` in `index.html`).
- **Trophies require `e`/`de`/`en`** on every entry (`tests/rewards.test.js`);
  the added `icon` field is additive only.
- **Deploy copies only** `index.html album.html CNAME assets games` (see
  `.github/workflows/deploy.yml`). Root/`docs/` markdown is NOT deployed. Any
  new runtime asset must live under `assets/`.
- **SPEC.md is authoritative** and code comments cite its sections (e.g.
  `§3.1`). If you change behavior, update `docs/SPEC.md`.
- The site is intentionally **light-theme only** and **fits `100dvh` without
  scrolling**; mobile-first from a 360px baseline.

## Where things live

- `docs/SPEC.md` — full product specification (authoritative).
- `docs/NEW_GAME.md` — **the checklist for shipping a game**: every cross-file
  fact the PLAYABLE flip pins (test pins, i18n gameDicts, importmaps, parents'
  view, drivers). Work through it before building `rechnungen`/`tippen`/
  `vokabeln` — each item on it failed once while `lesen` shipped.
- `docs/PLAN_*.md` — past plans, all fully implemented and archived. Kept for
  their reasoning (the colour/type tokens live in the UI design one); SPEC wins
  wherever they disagree. There is no open plan.
- `docs/GRAPHICS_BRIEF.md` — brief to hand an LLM to generate the ~102
  replacement SVG icons. Paths in it are repo-root-relative. **Unexecuted:**
  `AVAILABLE` in `graphics.js` is empty, so every icon still renders as emoji.
- `docs/handoff/` — session handoff notes; newest describes current state.
- `docs/claude_prompts.md` — prompt history/notes.

When ending a session, write a handoff into `docs/handoff/` (the `/handoff`
skill does this; point it at `docs/handoff`).
