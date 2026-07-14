# Architecture — Schlaufuchs

How the code is shaped, and why. `docs/SPEC.md` is the authoritative *product*
spec; this document is the map of the *code* — read it before adding a module,
a page or a game. If the two disagree, SPEC wins and this file has a bug.

## The one-paragraph version

A static site: vanilla ES modules, no build step, no dependencies. Every page
is an HTML shell that loads one entry module; all state lives under one localStorage key;
everything a child can earn is derived from that store on every load. Code is
split along one line: **arithmetic is pure and unit-tested, DOM code is thin
and screenshot-tested.** `node --test` is the only gate.

## The three layers

```
pure logic        no DOM, no storage, no i18n lookups — unit-tested directly
  ├─ adaptive.js, mapwalk.js, parentstats.js, trophycard.js (string out)
  ├─ rewards.js (pure functions + two storage-backed writers at the bottom)
  ├─ roundrules.js (star criteria, tempo ladder, retry, fitter — every game)
  └─ games/einmaleins/logic.js

engines / chrome  DOM + shared behaviour, built on the pure layer
  ├─ storage.js, i18n.js, graphics.js, fox.js, audio.js, confetti.js
  ├─ overlay.js, chrome.js, showcase.js, journey.js, levelpicker.js
  ├─ roundsummary.js (the finish sheet: star groups, tempo, trophies — every game)
  └─ motion.js, levelfox.js, leaveguard.js

pages             one entry module per HTML page; wiring only
  ├─ map.js, album.js, parents.js, stub.js, about.js, privacy.js
  └─ games/einmaleins/einmaleins.js (+ picker.js, the game's second overlay)
```

Dependency rules, all enforced by habit and review rather than tooling:

- Pages import engines and logic; nothing imports a page.
- Engines may import other engines and pure logic, never a page.
- A page may import another game's `logic.js` when the logic is the point
  (`parents.js` reads the times tables through `games/einmaleins/logic.js`
  rather than growing a second `pairOf`). Only `logic.js` crosses that border —
  it is the one game file the import maps ship to every page.
- No module ever emits an absolute `/assets/...` URL; everything resolves via
  `import.meta.url` (subpath deploys) and rides the import map (versioning,
  below).

## Pages

Every page contributes: an HTML shell with the versioned import map, an empty
`<header class="topbar" id="topbar">`, and one `<script type="module">`. The
entry module calls `initI18n()` and `initTopBar()` and renders the rest.
`tests/pages.js` discovers pages by listing `*.html`, so a new root page joins
every page-level test the moment the file exists — but only root pages and
`games/*/index.html` are discovered; a page nested anywhere else is invisible
to the suite.

The top bar has exactly two shapes (child's: map · fox chip · gear; reader's:
map · title) and is always built by `chrome.js`, never written as markup
(`tests/topbar.test.js` fails on markup). The gear opens the one settings
overlay every page shares.

The four unbuilt games are one module: their pages carry `<body data-game>`
and `stub.js` renders the rest, throwing loudly on a name it does not know.

## State

One localStorage key, `schlaufuchs`, self-capped at 3500 bytes (`storage.js` refuses
writes over budget — do not add persistent state casually; §9 has the schema).
Sections: `settings`, `rewards`, and one per game. A page parses the store
once and hands the parsed state to the section readers.

Everything shown is derived: trophies come from per-game lifetime star
counters (`rewards.pr`) run through per-game threshold ladders, region states
and badges from the same counters, the parents' grid from the Leitner box
string plus the recall string. During play nothing is written until
`endRound()` — which is why `leaveguard.js` exists — and `endRound()` is the
only writer of game state. `recordRound()` (rewards) is the only writer of
`rewards`.

## Motion

Three modules, one line each in the story: `mapwalk.js` is the pure arithmetic
of the fox's gait (anchors, hop curve, duration); `motion.js` is the runtime —
the single rAF driver `runWalk` plus `prefersReducedMotion()`; `levelfox.js`
is the fox as a DOM element inside the picker. The island (`map.js`) and the
picker (`levelpicker.js`) share the driver, so there is one gait and one loop.
`prefers-reduced-motion` is non-negotiable (§15): CSS kills all transitions
globally, and every scripted animation asks `prefersReducedMotion()` first,
always leaving the end state in place (the fox arrives, stars land, regions
open).

## Overlays

`overlay.js` is the contract: focus in on open and back to the opener on
close, Escape and backdrop close only when `dismissible`, and
`anyOverlayOpen()` is the one truth the keyboard handler asks. Overlays either
adopt existing markup (`overlayFrom`: picker, summary) or build it
(`createOverlay`: settings, showcase, leave guard). Never toggle an overlay's
`.hidden` by hand.

## Graphics

All icon-like art goes through the registry (`graphics.js`): a name maps to an
emoji, and renders as an SVG file from `assets/img/icons/` only if the name is
in `AVAILABLE`. The fox is code (`fox.js`, pose is its only variable); the map
scenery is hand-drawn SVG in `index.html`. Trophy cards have exactly one
renderer (`trophycard.js`) so a child recognises her trophy wherever it
appears. Icons never live inside `[data-i18n]` elements — `translateDOM`
rewrites `textContent`.

## Cache coherence

GitHub Pages caches each file on its own clock, so every URL a page loads
carries the page's version (`?v=N`), propagated to nested imports by an import
map in each HTML file. `node tools/version-assets.js N` regenerates all of it
and **must run before every deploy**; `tests/cache.test.js` fails when a
reachable module is missing from a page's map. A side effect worth knowing:
the import map gives every module exactly one URL per page, which is what
keeps module-level state (`overlay.js`'s open set) a singleton.

## Testing

`node --test`, Node 22+, no other gate. The suite mixes four kinds of tests:

- **Pure unit tests** for every module in the pure layer. When a bug is in DOM
  code, first pull the arithmetic out (`fittedFontSize`, `sceneGeometry`,
  `showcaseSizes`, `retryStep` are the pattern), then test that.
- **Source guards**: regexes over the shipped source for wiring that no unit
  test can see (is the navigation inside the walk's callback?). Brittle by
  design — they name the file and the pattern, and updating them is part of
  moving the code they guard.
- **Liveness gates**, which keep dead things from accumulating:
  `i18n.test.js` (a key missing in one language, or used nowhere, fails),
  `exports.test.js` (an export referenced nowhere outside its module fails),
  `graphics-assets.test.js` (icons in `AVAILABLE` must exist and validate; no
  stray files), `cache.test.js` (unversioned reachable modules fail),
  `topbar.test.js` (bar markup in a page fails).
- **Economy tests** (`rewards.test.js`): the trophy ladders stay reachable,
  grinding stays worthless, no child can lose an earned trophy.

Prove a new test can fail: `sh tools/mutate.sh <file> <perl-expr> [tests]`.
For eyes: `tools/shoot.mjs` (screenshot + overflow probes + a scriptable
`--do` driver), `tools/play.js` (plays einmaleins rounds), `baseline.sh`
(same page at another commit), `firefox-shot.sh` (the other engine).

## How to extend

**A new game** is a folder: `index.html` (shell + `#topbar`), `<name>.js`
(wiring), `logic.js` (the pure pool/question/star arithmetic — this is where
the tests bite), `i18n.js` (both languages in one file). Wire `initTopBar`,
`createLeaveGuard` if rounds live in memory, `recordRound` at round end.
Then: move the name from stubs to `PLAYABLE` (rewards.js), **recompute its
`MAX_POINTS` from its real tiles** (the current number is a guess), delete its
stub page, run `version-assets.js`. The einmaleins folder is the worked
example; `picker.js` shows how a game adapts the shared level picker
(`assets/js/levelpicker.js`).

**A new language**: write `assets/i18n/<code>.js`, import it in `i18n.js`,
add a row to `LANGUAGES`, register its flag in `graphics.js`. Key parity is
enforced per language pair by `i18n.test.js`.

**A real icon**: drop `assets/img/icons/<name>.svg` (viewBox 64, transparent,
no scripts/raster/fonts — the validator enforces the brief) and add the name
to `AVAILABLE`.

**New persistent state**: read §9 first, then `storage.js`'s budget note.
Digit strings (`box`, `stars`, `tempo`, `rc`) are the pattern for anything
per-item.

## Invariants that shape everything

- No build step, no dependencies, no framework — a file is what ships.
- All UI strings exist in `de` **and** `en`; repo language is English; the
  star (⭐) is the site's only currency and `pr` its only counter.
- Light theme only; fits `100dvh` with no scrolling (the picker's level list
  is the deliberate exception, scrolling inside its sheet); mobile-first from
  360px.
- Reduced motion is honoured everywhere, with end states intact.
- Nothing leaves the device: no network after load, no analytics, one
  localStorage key (a legacy cookie is adopted once and deleted, §9.1).
