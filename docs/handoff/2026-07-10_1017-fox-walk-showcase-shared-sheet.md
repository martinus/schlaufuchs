# Session Handoff — 2026-07-10 10:17

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-10_1017-fox-walk-showcase-shared-sheet.md` and continue the work described there.

## Goal
Work through three rounds of feedback from Martin after he watched his daughter
play: make the map answer a tap (the fox walks there), make a won trophy worth
showing (a full-screen showcase), and unify the settings sheet across every page.
All of it landed as PR #19.

## State

- Repo: `/home/martinus/git/schlaufuchs/wt/claude1` (a worktree).
- **Branch `map-fox-journey` is stale — PR #19 is MERGED.** `origin/main` is at
  `7968dab`. The local branch commits (`b71ed7f`, `9a2a7d2`, `ead8fec`,
  `b3537d3`) are the same work under different hashes, so the merge rebased.
  **Before touching anything, cut a new branch from `origin/main`** (see
  "Commands" below). Committing further on `map-fox-journey` will silently
  revert whatever else lands on `main`.
- Working tree is clean apart from this handoff file.
- `node --test`: **224 pass, 0 fail.**
- Asset version is at **v36** (`node tools/version-assets.js 36` was the last bump).

### Done (and how it was verified)

Everything below was verified twice: `node --test`, and by driving a real Chrome
with `tools/shoot.mjs` and *reading the screenshot*. Several defects were
invisible to the test suite and obvious in the image — see "Dead ends".

1. **The fox walks to the region you tap** (`assets/js/mapwalk.js`, new; wired in
   `assets/js/map.js`). Tapping a region cancels the navigation, writes
   `rewards.at`, animates the fox along three damped hops, and only then sets
   `location.href`. Coming back to the map, the fox stands where she was.
   `prefers-reduced-motion` skips the walk but still writes `at`.
   Verified: fox at `translate(190.1, 431.8)` 300 ms after the tap with
   `location.pathname` still `/`; then arrival → `/album.html`.
2. **The Trophy Room's count moved onto its facade** (`#pokal-count` in
   `index.html`), above the painted cup. Its `region-badge` is gone.
3. **Zahlendorf → Einmaleins.** The village is named after its game. The game
   screen carries the village's 🏠 on the round's title chip.
4. **The Pokalraum announces itself with its symbol**, not a heading or an intro
   paragraph. The name survives as an `aria-label` on the `<h1>`.
5. **`showcase.js` (new): one trophy, held up.** Confetti, a cheering fox, blinking
   stars, the cup sized against the viewport in JS. Called by **both**
   `album.js` (shelf) and `games/einmaleins/einmaleins.js` (round summary). The
   summary's trophy used to be a *link to the Pokalraum*; it now opens the
   showcase over the summary (z-index 50 over 40) without leaving the round.
6. **The trophy card's symbol stands ON the cup** (`.t-art` is a flex column,
   symbol first, `margin-bottom: -0.26em`), at `THEME_RATIO = 0.66`.
7. **The sky counts in stars.** `starCluster(worth)` in `journey.js`: a slot holds
   1, 2 or 3 smaller stars instead of a `×2` tag. The whole cluster flies into
   the basket as one `<g>`.
8. **The wrong-answer aid is answered like the question**: digits, backspace,
   **OK**. `retryStep()` no longer auto-completes or pre-rejects.
   Verified in Chrome: typing "14" leaves the aid up, OK closes it.
9. **The German division colon is lifted** to `vertical-align: 0.08em`
   (`eqHTML()` in `einmaleins.js`; `.divsign` in CSS). `÷` is never touched.
10. **The picker's star pips wear a white outline** (four hard `drop-shadow`s —
    `-webkit-text-stroke` does nothing to a colour emoji) and the three bands are
    darker.
11. **One settings sheet everywhere.** `resetKind` is gone from `chrome.js` and
    every caller; `resetGame()` is gone from `storage.js`. Every gear opens the
    same six rows, reset included. Verified: identical row text on `/`,
    `/album.html` and `/games/einmaleins/`, and the two-step reset in the room
    empties the cookie.
12. **Album shelf**: `.album-progress` sentence removed; the next trophy's slot
    shows `+2 ⭐` under its progress bar. The `.maplink` button at the foot of
    the room is gone (the sticky bar carries the map button down).
13. **Parents' view drops the 🔥 chip**; `ui-flame` left the graphics registry
    and `docs/GRAPHICS_BRIEF.md`.

### In progress
Nothing. PR #19 is merged and the tree is clean.

### Not started
See "Next steps" — two known loose ends the user was told about and has not
answered: the dead streak state, and the emoji baseline drift.

## Key context

### Files that matter
- `assets/js/mapwalk.js` — **new.** Pure: `ANCHORS`, `walkPoint(from,to,p)`,
  `walkMs(from,to)`. Kept out of `map.js` so `node --test` can check it without a
  browser (`tests/mapwalk.test.js`).
- `assets/js/showcase.js` — **new.** `openShowcase(trophy)` + `showcaseSizes(w,h)`.
  Built lazily on first open, so a round that wins nothing adds no overlay.
- `assets/js/chrome.js` — `initSettingsOverlay()` now takes no `resetKind`.
- `assets/js/journey.js` — `starCluster(worth)` is exported and tested.
- `games/einmaleins/logic.js` — `retryStep()`, rewritten. Its old contract is
  documented in the function's comment; don't "restore" the clever version.
- `assets/css/schlaufuchs.css` — the trophy card (`.t-art` / `.t-theme`), the
  showcase (`.sc-*`), `.divsign`, `.tilegrid .tstars i`.

### Decisions and their reasons (non-obvious ones)
- **`resetGame()` was deleted, not just unused.** A child is never told which game
  she is "in", so "reset this game" promised a scope she cannot see. One sheet,
  one reset. Enforced by `tests/topbar.test.js`, which strips `//` comments
  before searching (the comments deliberately name what was removed).
- **The summary's trophy must not navigate.** Linking to the album "celebrated"
  by dropping the child among empty slots. `tests/album.test.js` asserts neither
  caller builds its own `createOverlay`.
- **`.trophies` uses `repeat(4, minmax(0, 1fr))`, not `1fr`.** See dead ends.
- **`.summary .trophy-earn .won` widths are in `rem`, not `em`.** `.tcard` sets
  `font-size: 1.9rem`, so the old `5.5em` silently meant 167px.
- **The walk's hop is damped by a half-sine envelope.** Without it the fox is
  ~2.5 units airborne on the frame the page navigates and snaps to the ground.

### Dead ends already tried — do not repeat these
- **`location.href = region.href` on an SVG `<a>`.** `href` is an
  `SVGAnimatedString`, not a string; every region on the map navigated to
  `/[object%20SVGAnimatedString]`. `node --test` saw nothing. Use
  `region.getAttribute("href")`. Guarded by a test in `tests/map.test.js`.
- **Emitting the cup before the symbol in `trophycard.js`.** In a flex column
  that puts the cup *on top of* the prize. Only the screenshot said so.
- **A `mapwalk` test that only checks `walkPoint(A,B,0)` and `walkPoint(A,B,1)`.**
  It passes with an undamped hop, because `sin(3π)` rounds to zero at double
  precision. The real test checks the altitude at p = 0.03 and p = 0.97.
- **Sizing the showcase card from `window.innerWidth` alone.** It ignored the
  sheet's 16px padding and the overlay's 12px margin; the card hung over the
  sheet. `SHEET_X`/`SHEET_Y` in `showcase.js`.
- **Blaming the showcase for opening 46px off-centre.** The cause was elsewhere:
  the earned slot had become a `<button>`, a grid item's bare `1fr` track is
  floored at its `min-content`, and a button's `min-content` is its longest
  unbreakable word. **"Rechenschieber" pushed the four columns to 406px inside a
  360px phone**; the Pokalraum scrolled sideways and the `position: fixed`
  overlay inherited the widened layout viewport. I confirmed against
  `origin/main` (via `git worktree add /tmp/mainwt origin/main`) that it was my
  own regression before fixing it.
- **`hyphens: auto`** is in the CSS and does nothing in headless Chrome (no
  hyphenation dictionary). It is harmless and may work in real browsers; the
  break is carried by `overflow-wrap: break-word` + `align-self: stretch`.

### Commands
```sh
git fetch origin && git checkout -b <new-branch> origin/main   # FIRST, always
node --test                    # the only gate; 224 tests
sh tools/serve.sh              # :8000 — never file://
sh tools/kill-serve.sh         # never `pkill -f http.server`
node tools/version-assets.js N # REQUIRED before any deploy; currently at 36
node tools/shoot.mjs <url> --size 360x640 --out shot.png   # then READ the image
```

Driving the game to a round summary:
```sh
node tools/shoot.mjs http://localhost:8000/games/einmaleins/ \
  --cookie "schlaufuchs=$(node -e 'process.stdout.write(encodeURIComponent(JSON.stringify({v:1,settings:{lang:"de"},einmaleins:{d:2,t:4},rewards:{pr:{einmaleins:0}}})))')" \
  --size 360x640 --do 'eval @tools/play.js' --do 'eval play({})' \
  --do 'until #sum-overlay:not([hidden])' --do 'wait 900' --out summary.png
```

## Next steps

1. **`git fetch origin && git checkout -b <new-branch> origin/main`.** The current
   branch is merged and stale.
2. **Decide the fate of the daily streak.** `rewards.streak` and
   `streakMilestone` are still written to the cookie by `recordRound()`
   (`assets/js/rewards.js:322-334`) and `updateStreak()` is still unit-tested,
   but **nothing reads them any more** — the parents' 🔥 chip was the last
   consumer and it is gone. This is dead state inside a hard 3500-byte cookie
   budget. Either rip it out (touches `rewards.js`, `tests/rewards.test.js`,
   SPEC §8.5, and the "daily streak" phrase in `privacyCookieBody` in both
   dictionaries) or restore a reader. The user was told and has not answered.
3. **The trophy symbol's baseline drifts per emoji.** 🔔 sits deeper in the cup
   than 🏠, because emoji glyphs carry different internal padding and
   `.t-theme { margin-bottom: -0.26em }` is one number for all sixty. It is
   visible in the round summary. Real SVG icons (`AVAILABLE` in `graphics.js`,
   still empty; brief in `docs/GRAPHICS_BRIEF.md`) would make it go away — that
   is the intended fix, not a per-trophy nudge table.
4. **Fill a stub game.** `rechnungen`, `tippen`, `vokabeln`, `lesen` are all
   `assets/js/stub.js` behind fog. When one ships, `MAX_POINTS[game]` in
   `rewards.js` must be **recomputed from its real tiles** — the four current
   numbers are guesses and they are the denominator of every badge tier and
   region state on the map.

## Reflection

### 1. What in the delivered work am I least confident is correct?
The **fox walk's interaction with `render()`**. `render()` re-runs on every
settings change and ends with `placeFox(ANCHORS[foxAt])`. If a language switch
lands mid-walk, the fox snaps back to its start anchor while the rAF loop keeps
running, and the loop wins the next frame — so it recovers, but for one frame the
fox teleports. I never exercised it: opening the gear during a walk requires the
walk to still be running, and the walk is 420–1100 ms. To check, open the map,
tap a far region, and within ~500 ms tap the gear and switch language. The clean
fix is for `render()` to skip `placeFox` while `walking` is true.

Second: **`showcaseSizes()` is computed once, at open.** Rotate the phone with the
showcase up and the card keeps the portrait size. I decided the overlay was
transient enough not to warrant a resize listener; I did not test it.

### 2. What assumptions did I make that I never stated explicitly?
- **That "das Flammensymbol gibt es nicht mehr" meant "remove it", not "it renders
  as tofu on my Mac".** If it was the latter, I deleted a feature the user wanted
  and left `rewards.streak` orphaned. Cheap to check: ask.
- **That making the reset global on the game page is acceptable collateral.** The
  user asked for "the same dialog everywhere"; I resolved the ambiguity toward
  the whole-site reset. A parent who wanted to wipe only Einmaleins can no longer
  do it. If that was wrong, the fix is to restore `resetGame()` and give *every*
  page both rows — still one sheet.
- **That the trophy showcase should be dismissible.** The round summary
  deliberately is not (`dismissible: false`), and I gave the showcase the default.
  A child who taps her trophy and then taps the backdrop lands back in the
  summary, which is what I intended, but nobody specified it.

### 3. What is the biggest thing the user may not realize about the broader situation?
**Four of the five regions are fog, and the trophy ladders behind them are
fiction.** `MAX_POINTS` for `rechnungen`, `tippen`, `vokabeln` and `lesen` are
explicitly guesses in the source, and they are the denominator of `starBadgeTier`
and `regionState` for those regions. The Pokalraum shelf already draws twelve
priced slots per fogged game — a child can read "⭐ 112" under a silhouette for a
game that does not exist and cannot be played. Every polish round on the
einmaleins loop makes the map's promise louder while four fifths of it stay
undeliverable. The highest-leverage move is not more polish; it is shipping one
more game, which is also the only way to learn whether the per-game ladder
generator (`ladderFor`) produces a sane curve for a game that is not einmaleins.

### 4. If this work breaks in 3 months, what's the most likely reason?
**A neighbouring change re-introduces a bare `1fr` or a new `<button>`-shaped grid
item, and the album silently starts scrolling sideways again.** The failure is
non-local in a nasty way: the symptom shows up in the *showcase*, which is a
`position: fixed` overlay inheriting a layout viewport that some grid track
widened. `tests/album.test.js` pins `minmax(0, 1fr)` and `align-self: stretch` as
strings, which will catch a rewrite of those exact rules and will not catch a new
grid elsewhere. The durable guard would be a browser assertion that
`document.documentElement.scrollWidth === innerWidth` on every page at 360px —
see Q5.

Runner-up: the emoji fallbacks. Every measurement in `trophycard.js`,
`showcase.js` and `.t-theme` is tuned to Noto Color Emoji's metrics. A font
update, or the day `AVAILABLE` gains its first SVG, shifts all of them at once.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
Two, concretely:

- **A `--no-hscroll` assertion in `tools/shoot.mjs`** that fails the run when
  `document.documentElement.scrollWidth > innerWidth`. This session I lost a full
  debugging cycle chasing an off-centre overlay whose cause was a 406px-wide
  shelf two DOM levels away. The tool already loads the page and evaluates JS; the
  check is three lines and the site's own spec says it never scrolls
  horizontally. **Worth building now** — it would have caught the regression at
  the moment I introduced it, not two commits later.
- **A `tools/shoot.mjs --baseline <ref>` mode** that renders the same URL from a
  `git worktree` of another ref and reports pixel/geometry deltas. I hand-rolled
  this twice (`git worktree add /tmp/mainwt origin/main`, second `python3 -m
  http.server` on 8123) to answer "did I break this, or was it always so?" —
  which is the single question a screenshot cannot answer alone. Worth building
  when the next visual regression appears; not before.

Not worth building: anything that tries to assert on the rendered image. The
project's discipline is *an agent reads the screenshot*, and that caught the
cup-on-house inversion in one look.

### 6. What could the user have done differently to make this session smoother?
The three screenshots he sent were worth more than the prose around them, and the
two that arrived *with* a picture (the colon, the small cup) took one iteration
each. The requests that arrived as prose alone took two or three: "das Symbol
soll wirklich noch höher" landed the cup on top of the house first, and "der
Dialog soll überall gleich sein" left me guessing whether "gleich" meant *global
reset everywhere* or *both rows everywhere* — I picked one and said so, but a
half-sentence would have settled it.

The one thing that genuinely cost work: **the mid-turn message** ("der Klick auf
einen Pokal soll ihn groß anzeigen") arrived after I had already inlined the
showcase into `album.js` and written its tests. Extracting `showcase.js` meant
rewriting both. That request belonged with the first showcase request two turns
earlier — it is the same feature. Batching the "and also, in the other place"
half of an idea with its first half would have saved a module extraction and a
test rewrite.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
**A per-question latency signal, used only to choose the next question — never
shown, never scored.** `adaptive.js` is a Leitner box keyed on right/wrong, so
`7 × 8` answered correctly after eleven seconds of finger-counting is
indistinguishable from `2 × 2` answered in half a second. Recall latency is the
best cheap proxy for fluency there is, and the box already stores per-fact state;
the change is to demote a fact whose answer was slow but right, so it comes back
sooner. The parents' heat map (`parentstats.js`) would gain a third colour —
"knows it, but counts" — which is exactly the thing a parent can act on and which
no report card tells them. Crucially it fits this project's one hard rule: the
clock is a teaching signal, never a score. `starsFor()` takes no time argument and
a test enforces that; this feature must never make it take one.
