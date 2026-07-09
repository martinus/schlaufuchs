# CLAUDE.md — Schlaufuchs

Orientation for an agent working on this repo. Read this first, then
`docs/SPEC.md` for the authoritative product spec.

## What this is

A static website of educational browser games for children (ages 5–15),
framed as an illustrated world map. Live at https://schlaufuchs.ankerl.com.
Fully client-side: vanilla HTML/CSS/JS, **no build step, no dependencies, no
framework**. Progress is stored in a single cookie. Hosted on GitHub Pages.

## Commands

```sh
python3 -m http.server 8000   # serve locally — ALWAYS use this, never file:// (ES modules)
node --test                   # run unit tests (tests/*.test.js), needs Node 22+
node --check <file.js>        # syntax-check a module
node tools/version-assets.js N  # bump asset version — REQUIRED before deploying a change
node tools/shoot.mjs <url> …    # drive a real Chrome: screenshot + measure (--help)
```

There is no lint/format/build step. `node --test` is the only gate; the deploy
workflow runs it before publishing.

## Working rules (learned the hard way)

- **A bug found is a test written.** Before or right after fixing anything,
  add a test that fails on the old behaviour. Then re-break the code and watch
  it go red — a test that never fails is decoration. This repo has no types
  and no linter, so the test suite is the only thing standing between a change
  and a child staring at a blank page. Regression tests live next to their
  subject: `tests/map.test.js` (SVG structure), `tests/cache.test.js` (asset
  versioning), `tests/i18n.test.js` (string liveness).
- **Make it testable, then test it.** When the defect is inside DOM code, pull
  the arithmetic out as a pure function and unit-test that
  (`fittedFontSize()` in `games/einmaleins/logic.js` is the pattern).
- **Look at the page.** Serve it, then use `tools/shoot.mjs` to screenshot it at
  390×844 and 360×640, and *read the image*. Every visual bug this project has
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
    --size 360x640 --do 'eval @play.js' --do 'until #fb-next' \
    --clip .stage --probe '#feedback' --out aid.png
  ```
- **Silent no-ops are the dangerous ones.** `pave("einmaleins")` looked up an
  id that did not exist and quietly did nothing. Prefer a test that asserts the
  wiring exists over trusting that a missing element is "handled".
- **Dead strings and stale comments accumulate.** When you remove a feature,
  remove its i18n keys and fix the comments that describe the old behaviour.
  The i18n tests now fail on both a missing and an unused key.
- **A merged PR ends its branch.** PRs here are **squash-merged**, so the
  branch's own commits never appear on `main` and the branch instantly looks
  like it is 18 commits ahead of a `main` that already contains its work. Keep
  committing there and the next PR silently reverts whatever landed on `main`
  in the meantime — this nearly deleted `tests/svg-icon-validator.js` and
  `tests/graphics-assets.test.js` from a neighbouring PR. So, before the first
  change after a merge:

  ```sh
  gh pr list --state merged --limit 3   # did my branch's PR land?
  git fetch origin && git checkout -b <new-branch> origin/main
  ```

  Already committed onto the stale branch? `git rebase origin/main` (it skips
  the squashed commits). Either way, **before opening the PR**, read what it
  deletes — an unexpected name here means you are undoing someone's merge:

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
- `games/<name>/index.html` + `<name>.js` — one folder per game. Only
  `einmaleins` is fully implemented; `rechnungen`, `tippen`, `vokabeln`,
  `lesen` are stubs.

Shared modules in `assets/js/`:
- `i18n.js` — `initI18n`, `t(key, params)`, `setLang`; `translateDOM` sets
  `textContent` on `[data-i18n]` and `aria-label` on `[data-i18n-label]`.
- `storage.js` — the single cookie `schlaufuchs`. Pure encode/decode + typed
  getters/setters. **Hard 3500-byte budget** (`BUDGET`); writes over budget are
  refused. Do not add persistent state casually.
- `rewards.js` — stars, fox level, trophies, streak, region/badge state. Pure
  functions are exported and unit-tested. `foxLevel = min(20, 1+floor(total/10))`;
  trophy `THRESHOLDS`; `starBadgeTier`, `nextTrophyInfo`.
- `journey.js` — per-round path strip; fox advances on each correct answer;
  friendly obstacles at nodes 3/6/9 with bounce/wiggle/pop animations.
- `graphics.js` — the icon registry (see below).
- `chrome.js` — shared top-bar chrome: `renderLevelChip` + `initSettingsOverlay`
  (sound/language/reset), used by the map, games, and stubs.
- `adaptive.js` (Leitner-light practice engine), `audio.js` (synth WebAudio
  sfx, respects mute), `fox.js` (code-generated mascot SVG with level
  cosmetics), `confetti.js`.

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
