# Session Handoff — 2026-07-10 02:06

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-10_0206-usability-overhaul-shipped.md` and continue the work described there.

## Goal
Execute `docs/PLAN.md` — the usability overhaul derived from a playtest with
Martin's 8-year-old daughter Mara, who reads almost nothing and got lost at
nearly every UI seam. The previous session planned it; this session built it.

## State
- Repo: schlaufuchs, worktree `wt/claude1`.
- **Branch `usability-overhaul` is MERGED** (PR #17, rebase-merged into `main`
  at 2026-07-10 00:03). Its commits are on `main` under different hashes; the
  local branch tree is identical to `origin/main` (`git diff HEAD origin/main`
  is empty). Working tree clean apart from this handoff file.
  **Do not keep committing on this branch** — CLAUDE.md explains why. Start
  with the branch-hygiene step in "Next steps".
- `node --test` → 196 pass, 0 fail (was 161 before this session).
- Asset version is **32**. The deploy workflow ran and succeeded; the changes
  are live on https://schlaufuchs.ankerl.com.

**Done** (all ten plan steps; each is one commit, verified in a real Chrome via
`tools/shoot.mjs`, not just by `node --test`):
1. `overlay.js` gained an `initialFocus` option.
2. The division sign follows the language (`":"` DE / `"÷"` EN), injected into
   the pure `questionFor(id, diff, rng, divSign)`.
3. New `assets/js/trophycard.js` — one trophy card, used by the album shelf and
   the round summary.
4. The map: one bounded `<rect class="hit">` per region, white label plates + an
   idle bob on enterable regions, a fogged tap that stays on the map (fog
   wiggles, "Bald!" bubble), and a Pokalraum facade with a readable trophy.
5. Round summary: one button with a random congratulation; the trophy links to
   the album.
6. The chip got a border and a caret; the chosen difficulty got a ring; "Alle"
   got a 🎲.
7. Wrong answers: her own answer struck through in red above the true equation
   in green, and she must enter the right answer to continue. `retryStep()` in
   `games/einmaleins/logic.js` is the pure core.
8. Album: sticky top bar, a big "Zur Karte" button at the bottom, visible ⭐
   thresholds on locked slots and a progress bar on the next one.
9. Stars are the one currency. `gameStars`/`sumStars`/`ACHIEVABLE` deleted;
   `totalPoints(pr)`, `gameStarsOf(pr, game)` added; `regionState`/
   `starBadgeTier` re-based on `pr` vs `MAX_POINTS`. Sky stars carry a ×2 / ×3
   tag into the basket. "Punkte" is gone from every string a child can read.
10. `docs/SPEC.md` + `CLAUDE.md` updated; `docs/PLAN.md` archived as
    `docs/PLAN_USABILITY.md` with a note on the two places the plan was wrong.

**In progress**: nothing.

**Not started**: the two defects in Q1 below, and a second playtest.

## Key context

### Two places the plan was wrong (already fixed; recorded at the top of `docs/PLAN_USABILITY.md`)
1. Plan step 5 claimed "map/level stay reachable via topbar+chip" after removing
   the summary's secondary buttons. **They were not.** `.overlay` is
   `position: fixed; inset: 0; z-index: 50` and its backdrop covered both;
   shipping it as written would have trapped a child in an endless run of rounds.
   Fix: `#sum-overlay { z-index: 40 }`, `.topbar` and `.pickheading`
   `{ position: relative; z-index: 45 }`; genuinely modal sheets stay at 50. The
   summary sheet also carries `aria-modal="false"` now, because it isn't one.
   `tests/einmaleins.test.js` pins the whole z-index ordering.
2. The plan's six hit-rect coordinate sets were derived from reading the SVG.
   The Pokalraum's would have swallowed the tail of the "Number Village" label
   (SVG paints in document order; the later region wins). The shipped rects were
   measured with `getBBox()` in a browser and hit-tested over a grid.
   `tests/map.test.js` now enforces the *invariant* — every region has exactly
   one `.hit` rect ≥64×64 spanning its own label anchor and no other region's —
   rather than the numbers.

### Non-obvious decisions
- `retryStep` rejects a digit **the moment it can no longer become the answer**
  (the plan said "when the input reaches the answer's length"). A child who
  types three more wrong digits does not know which one was the mistake.
- The trophy card was wired into both callers in step 3 rather than 5/8, so its
  shared-usage test could be green from the first commit.
- The "Bald!" bubble is removed by a `setTimeout`, never by `animationend`:
  under `prefers-reduced-motion` the site-wide `* { animation: none }` rule
  means no animation starts, so no event ever fires and the bubble would stay
  on the map forever. Same reason the ×2 tag is a child of the flying star's
  `<g>` (it rides the transform) instead of having a keyframe of its own.
- The map's locked-tap handler is registered **once at module scope**, not in
  `render()` — `render()` re-runs on every settings change.
- `fogRegion()` must skip the `.hit` rect when computing its bbox, or the fog
  balloons over the label and the neighbouring region.

### Dead ends / traps already hit — do not repeat
- `tests/map.test.js` used to *forbid* `fill="transparent"` rects (an older map
  had unbounded hotspots tiling 42% of the island). That test was rewritten, not
  deleted; the bounded-rect invariant is what it was really protecting.
- `mapJs.indexOf("function render")` matches `renderBadge` first. Use
  `"function render()"`.
- `grep -n "point" assets/i18n/*.js` misses `roomIntro`'s capitalised "Points".
  Grep case-insensitively.
- `tests/i18n.test.js` fails on **unused** keys as well as missing ones, and
  waves dynamic prefixes through on a regex allowlist at two places (~lines 87
  and 100). `sumOk` had to be added to both.
- `tools/play.js` and `tests/play.test.js` break on both the division-sign
  change and the removal of `#fb-next`. Both were updated.

### Commands
```sh
sh tools/serve.sh              # never file://
sh tools/kill-serve.sh         # never pkill http.server (CLAUDE.md explains)
node --test                    # 196 tests
node tools/shoot.mjs --help    # screenshot + measure in a real Chrome
node tools/version-assets.js N # REQUIRED before any deploy
```
Useful cookie seed:
```sh
--cookie "schlaufuchs=$(node -e 'process.stdout.write(encodeURIComponent(JSON.stringify({einmaleins:{d:1,t:10},rewards:{pr:{einmaleins:64}}})))')"
```

## Next steps

1. **Branch hygiene first**, before touching anything:
   ```sh
   gh pr list --state merged --limit 3      # confirms #17 landed
   git fetch origin && git checkout -b <new-branch> origin/main
   ```
2. **Fix the label-plate font race** (Q1, measured this session). In
   `assets/js/map.js`, `ensurePlate()` measures `label.getBBox()` at module-eval
   time. Both webfonts declare `font-display: swap`, so a cold load paints the
   label in the fallback face — which is **8.1 px wider** for "Number Village" —
   and the plate is cut to that width and never re-measured. Add the same hook
   `games/einmaleins/einmaleins.js` already uses:
   ```js
   document.fonts?.ready.then(render);
   ```
   Test: assert `map.js` contains `document.fonts` (the pattern
   `tests/keyboard.test.js` uses for `fitQuestion`). To *see* it, throttle the
   font request or compare `plate.getAttribute("width")` against
   `label.getBBox().width + 14` on a cold load.
3. **Decide about the star jump before anyone notices it.** Nothing migrates,
   but the top bar now prints the weighted counter: a child who played only
   Mittel sees ⭐33 become ⭐66 overnight, Schwer triples. It only ever goes up.
   Either accept it or tell Martin; there is no code to write either way.
4. **Re-test with Mara** before polishing anything further. The map (step 4) and
   the summary (step 5) are the two changes she would touch first, and a single
   session with her can disprove half of the rest. This was the previous
   session's own recommendation and it still stands.
5. Then, in rough priority order: the `.region-label` typography discrepancy
   (Q1), and `docs/GRAPHICS_BRIEF.md` (102 SVG icons, still unexecuted —
   `AVAILABLE` in `graphics.js` is empty, so every icon is an emoji).

## Reflection

### 1. What in the delivered work am I least confident is correct?
Two things, both found while writing this handoff, both now measured rather than
suspected:

**(a) The label plates are sized against whichever font happened to be loaded.**
`ensurePlate()` in `map.js` reads `label.getBBox()` when the module runs. Both
`@font-face` declarations use `font-display: swap`, so a cold visitor paints
with the fallback face first. I measured the difference in Chrome: "Number
Village" is 110.2 px in the webfont and 118.4 px in `system-ui` — the plate would
be 8 px too wide, permanently, because `render()` never runs again unless a
setting changes. `einmaleins.js` already guards against exactly this with
`document.fonts?.ready.then(...)` for its question; `map.js` has no such hook
(`grep -c fonts assets/js/map.js` → 0). Cosmetic, not broken, and every
screenshot I took was of a warm cache, which is precisely why I did not see it.

**(b) `.region-label` does not render in the font its test claims.**
`getComputedStyle` on a map label returns `Atkinson Hyperlegible` (the body
face), because `.worldmap .region-label { font-family: inherit }` at
`schlaufuchs.css:279` is later and more specific than the display-face selector
list at the top of the file — which names `.region-label`. `tests/typography.
test.js` only asserts that the *rule* exists, so it cannot see this. It predates
this session; I noticed it only because (a) sent me to look at the computed
style. Whoever fixes it should decide which face the map is supposed to speak in
and make the test check the cascade, not the source text.

Lower down the list: the `soonBubble` width is a heuristic
(`Math.max(48, text.length * 10 + 18)`), fine for "Bald!"/"Soon!" and untested
against a longer translation; and einmaleins' hit rect (x 122–232) deliberately
stops short of its badge, relying on the badge's own glyphs being hit-testable.

### 2. What assumptions did I make that I never stated explicitly?
- **That `retryStep`'s prefix rule is pedagogically right.** It refuses `4` for
  an answer of `30` instantly. I assumed immediate correction beats letting a
  child finish a wrong number and then see it rejected. That is a claim about
  8-year-olds, not about code, and nobody has watched a child meet it. If it's
  wrong, the aid feels like it is slapping her hand mid-thought.
- **That the same four multiple-choice options must not reshuffle** between the
  answer and the retry. I cached `choicesFor()` per question on that basis. If
  the opposite is true (a child memorises the position of the wrong tap), the
  cache is now the thing to remove.
- **That an interactive top bar over a `role="dialog"` is acceptable.** I made
  the summary non-modal and set `aria-modal="false"`. It is honest, but it is
  also an unusual pattern; a screen-reader user now tabs out of a dialog into a
  live page. Nobody tested it with a screen reader, including me.
- **That Chrome's rendering is the site's rendering.** Every visual verification
  went through `tools/shoot.mjs`, which drives Chrome. `transform-box: fill-box`
  on an SVG `<a>` (the idle bob) is the one property here I would expect to
  differ on Safari/iOS. If it misbehaves there, regions fly off the island.

### 3. What is the biggest thing the user may not realize about the broader situation?
Four of the six map regions are now dead ends that shake and say "Bald!". The
map became honest, and in doing so it became emptier — a child who taps four
fogged regions and gets a bubble each time has learned that this island has one
village. Before this change she at least landed on a page. **Shipping one more
real game would change the first impression more than any further affordance
work**, and `MAX_POINTS` for those four games is a guess that is now the sole
denominator of their badges and region states, so shipping one requires
recomputing its maximum from its real tiles (SPEC §8.3 says so where it will be
read). Second-order: `docs/GRAPHICS_BRIEF.md` addresses "the houses don't look
tappable" at the root — proper button-like art is complementary to hit rects and
label plates, and it has been sitting unexecuted for several sessions.

### 4. If this work breaks in 3 months, what's the most likely reason?
Someone edits `index.html`'s map art — moves a house, renames a region, adds a
sixth game — and does not move that region's `.hit` rect with it. The rects are
hand-placed absolute coordinates in the markup, and their correctness depends on
a property no test can see: which region a *pixel* belongs to after SVG paint
order resolves overlaps. `tests/map.test.js` checks that each rect spans its own
label anchor and no other's, which catches the gross case, but a rect that
drifts off its art while still covering its label passes. The real check is the
`elementFromPoint` grid I ran by hand this session and did not commit. Runner-up:
a fifth ladder/threshold change re-basing `MAX_POINTS`, which since step 9 is the
denominator of `regionState`, `starBadgeTier` *and* (via `ladderFor`) every
trophy threshold — one number with three jobs.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
The previous handoff asked for exactly the thing I ended up writing by hand: a
map hit-test harness. I wrote `elementFromPoint`-over-a-grid as a throwaway eval
script three times (390×844, 360×640, and again for the fog-tap check). **It is
worth committing as `tools/hittest.js`** — a browser-side script in the style of
`tools/play.js`, returning `{point → region}` for a named set of probes, so
`node tools/shoot.mjs / --do 'eval @tools/hittest.js'` becomes the standing
answer to "did I break the map". That directly closes the gap in Q4. Second:
`tools/shoot.mjs` has no cold-cache mode, which is why the font race in Q1
survived every screenshot I took; a `--no-cache` or a font-throttle flag would
have surfaced it in the run that added the plates.

### 6. What could the user have done differently to make this session smoother?
Very little. The plan he approved was detailed and mostly right, and the one
instruction that mattered — "do not start implementation, I want to run it with
Opus" — was clear. The single thing that would have helped: the plan asserted
"map/level stay reachable via topbar+chip" as settled fact, and it took a
browser probe to discover that no one had checked. A plan is allowed to state a
premise; it would be better if it marked which premises were *verified* and which
were *assumed*, because the verified-looking ones are the expensive ones to
believe. (The plan did do this for its file:line anchors, and those held up.)

### 7. If I could add one unrequested, industry-leading feature, what would it be?
The same one the last session named, and this session strengthened the case for:
a **"watch me play" replay for parents**. Record per-question events of the last
N rounds — question, answer given, latency, retry count — into a ring buffer
(sessionStorage, or a capped cookie section if the 3500-byte budget allows), and
render it in the parents' view as a timeline. Martin spent an evening
shoulder-surfing to learn what the app could not tell him, and this session spent
its whole budget acting on those handwritten notes. The app saw every tap. Now
that `retryStep` exists, the retry count is *already* the single most diagnostic
number in the game — it says "she got it wrong and then could not find it
either", which no star count ever says — and it is currently thrown away.
