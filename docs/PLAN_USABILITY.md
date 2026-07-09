# PLAN — Usability overhaul after Mara's playtest (age 8, non-reader)

**Status: DONE.** All ten steps landed. Kept for its reasoning; `docs/SPEC.md`
wins wherever the two disagree.

Two things were **not** built as written below, because the tree said otherwise:

1. **Step 5 rested on a false premise.** It removed the summary's map link and
   picker button on the grounds that "map/level stay reachable via topbar+chip".
   They were not: `.overlay` is `position: fixed; inset: 0; z-index: 50`, so its
   backdrop covered both, and the change as specified would have trapped a child
   in an endless run of rounds with no way to the map. Verified with
   `elementFromPoint` before touching anything. The summary therefore sits at
   `z-index: 40` and the bar and chip at `45`, which makes the plan's own
   sentence true. Every other overlay stays modal at `50`.
2. **The hit-rect coordinates below are not the ones that shipped.** They were
   derived from reading the SVG, and several swallowed a neighbour's label
   (`pokalraum`'s would have taken the tail of "Number Village"). The shipped
   rects were measured with `getBBox()` in a real browser and then hit-tested
   over a grid of points, including the gap between the two Zahlendorf houses.
   `tests/map.test.js` now enforces the invariant rather than the numbers.

Smaller departures: `retryStep` rejects a digit the moment it can no longer
become the answer (the plan waited until the input reached the answer's length);
the shared trophy card was wired into both callers in step 3 rather than 5/8, so
that its shared-usage test could be green from the start; and `roomIntro`'s
reword needed a second pass — the first was circular German.

## How to work this plan (read first)

- Read `CLAUDE.md` and skim `docs/SPEC.md` §3, §8, §10 before touching code.
  The working rules there (a bug found is a test written; look at the page
  with `tools/shoot.mjs`; i18n keys always in BOTH `assets/i18n/de.js` and
  `en.js`; never hand-toggle an overlay's `.hidden`) all apply here.
- Line numbers below were verified against the tree at planning time but WILL
  drift as you work — treat them as anchors, re-locate with grep before each
  edit.
- Do the steps in order; each step must leave `node --test` green. Commit per
  step with a clear message (PRs here are not squashed — commits land on
  `main` as written).
- Steps 1–3 are independent enablers; steps 4–9 depend on them as noted.
- Nothing in this plan writes new persistent state. The cookie format is
  unchanged throughout (3500-byte budget untouched).

## Context

Martin watched his 8-year-old daughter Mara play without helping. She reads
almost nothing, taps what looks tappable, and got lost at nearly every seam:
didn't know map regions are clickable (tapped fog, missed the houses; taps
*between* the houses hit dead SVG), couldn't leave the Pokalraum, didn't
recognize the won trophy as a trophy (tapping it did nothing), couldn't find
the level picker, tried the chip *behind* the end-of-round modal, didn't
understand "20×" in the album, didn't grasp that Mittel/Schwer pay more,
doesn't know the ÷ sign (school writes ":"), and clicked "Verstanden" after an
error without registering she'd erred.

Guiding rule for every fix: **show, don't write** — nothing may depend on the
child reading a sentence.

Product decisions confirmed with Martin:
1. **Round summary = ONE button** (random congratulation, e.g. "Super!");
   pressing it starts the next round. Map/level stay reachable via topbar+chip.
2. **Stars are the single currency.** The weighted counter (`pr`, today shown
   as "Punkte") is *presented* as stars: a star on Leicht/Mittel/Schwer counts
   1/2/3 — the picker's "×2 ⭐" claim becomes literally true. Top bar, album
   thresholds ("⭐ 62"), summary gain ("+6 ⭐") all show the weighted number;
   "Punkte" leaves the UI. Cookie format unchanged.
3. **Wrong-answer feedback**: child's wrong answer red + struck through, the
   correct equation green below; to continue the child must ENTER the correct
   answer (keypad; on Leicht the 4 choices reappear, wrong ones shake). The
   "Verstanden" button is removed.
4. **Fogged (stub) regions no longer navigate**: tap stays on the map — fog
   wiggles, transient "Bald!" bubble. Stub pages remain for deep links.

## Pre-flight technical findings (verified at planning time)

- `tests/map.test.js:74-83` **prohibits** `<rect fill="transparent">` — step 4
  deliberately reverses that pinned regression. Rewrite test + comments in
  `map.js:44-46`, `schlaufuchs.css:313-315`, SPEC §3.1 together, in one
  commit. (SPEC already *demands* ≥64px tap targets — art-only hit testing
  violated it; the new invariant is "exactly one bounded `.hit` rect per
  region, inside its own `<a>`".)
- `fogRegion()` (`assets/js/map.js:47-87`) computes the fog bbox from region
  children — it must skip the new `.hit` rect or fog balloons over the label.
- Pokalraum facade columns (x=247/265/283/301 in `index.html:199-202`) leave
  11px gaps — remove the two middle columns to seat a 24px 🏆.
- `overlayFrom` focuses the FIRST focusable in the sheet
  (`assets/js/overlay.js:64`); with a trophy `<a>` before the primary button,
  Enter after a trophy round would navigate to the album. Needs an
  `initialFocus` option (step 1).
- `tests/i18n.test.js:87,100` allowlists dynamic key prefixes
  (`region_|game_|diff|starGoal`) — add `sumOk` to BOTH regexes, or the
  dead-key scanner fails on keys only referenced via computed names.
- Picker `onClose` guard (`games/einmaleins/einmaleins.js:28-30` reopens the
  summary when `roundOver`) stays reachable even after step 5: `endRound()`
  opens the summary on a 700ms `setTimeout` and the chip is tappable in that
  window. Keep the guard; it is not dead code. `startRound()` sets
  `roundOver = false` before `summary.close()`, so the single-button flow
  cannot resurrect a dead summary.
- `tools/play.js:113` clicks `#fb-next`; its `answer()` helper ends with an
  OK click that must stay a no-op in `correct-wait` phase (it currently is —
  keep it so).
- `tests/typography.test.js:39` pins `.summary .sum-link` in the display-face
  selector list — update when the secondary row dies (step 5). CLAUDE.md's
  shoot example uses `until #fb-next` — stale after step 7.
- Star unification ripples: `assets/js/parents.js:34` prints `sumStars`,
  `assets/js/map.js:97` uses `gameStars`/`starBadgeTier` — all switch to
  `pr`-based numbers, after which `gameStars`/`sumStars`/`ACHIEVABLE` are dead
  exports (delete them + rewrite `tests/rewards.test.js:115-166`).
- The random congratulation is picked per-round with `Math.random()`; the
  "Bald!" bubble is transient DOM. Neither touches storage.

## Implementation steps (each keeps `node --test` green)

### Step 0 — branch hygiene
`gh pr list --state merged --limit 3`; then
`git fetch origin && git checkout -b usability-overhaul origin/main`
(the checkout's branch `big-cleanup` may be a merged PR — CLAUDE.md rule:
never keep committing on a merged branch).

### Step 1 — overlay `initialFocus` (enabler for step 5)
- `assets/js/overlay.js`: `overlayFrom(el, { dismissible, onClose, onOpen,
  initialFocus })`; in `open()` try `sheet.querySelector(initialFocus)` first,
  fall back to the first `FOCUSABLE` match.
- `tests/overlay.test.js`: with `initialFocus`, the named node gets focus, not
  the first control (follow the existing fake-node test pattern in that file).

### Step 2 — division sign per language
- `games/einmaleins/logic.js`: `questionFor(id, difficulty, rng, divSign="÷")`;
  the div branch (`logic.js:37`) uses `${t*f} ${divSign} ${f} = ?`. The module
  stays pure and i18n-free — the sign is injected.
- `games/einmaleins/i18n.js`: add key `divSign` — de `":"`, en `"÷"`.
- `games/einmaleins/einmaleins.js` (`askNext`, ~line 110): pass
  `t("divSign")`. `showFeedback` (~line 261) stops reconstructing the
  equation with a hardcoded `÷` — it builds from `question.text` (step 7).
- `tools/play.js` `solveQuestion` (lines 24-34): accept `:` alongside `÷` in
  both the operator guard and the division branch.
- Tests: `tests/play.test.js` drives `questionFor(id, 2, rng, ":")` through
  the solver alongside `"÷"`; explicit `solveQuestion("10 : 2 = ?") === 5`.
  `tests/einmaleins.test.js`: injected sign appears in div questions; the
  default stays `÷` (keeps all existing tests untouched).

### Step 3 — shared trophy card
- New `assets/js/trophycard.js` (imports `iconHTML` from `./graphics.js`,
  relative import): export `trophyCardHTML(trophy, {size=34, lang, href})` →
  `<a class="tcard" href=…>` when `href` is given, else `<div class="tcard">`.
  Content: layered art block — 🏆 cup (`iconHTML("deco-trophy")`) with the
  trophy's theme emoji (its `icon`/`e` field) riding on top of the cup — plus
  `<span class="sname">${trophy[lang]}</span>`. This is Martin's "emoji lies
  in the cup" idea; the card must look identical in album and round summary.
- CSS: `.tcard` = the current album `.slot` look (aspect-ratio 1, panel bg,
  radius, shadow, `outline: 2px solid var(--depth-soft)`); refactor
  `schlaufuchs.css:842-877` so `.trophies .slot` and `.tcard` share the rules.
  `.t-art { position:relative }`, theme emoji absolutely positioned over the
  cup.
- `tools/version-assets.js` auto-discovers `assets/js/*.js` → import maps pick
  the new module up at the final version bump (step 10); `tests/cache.test.js`
  passes once bumped.
- New `tests/trophycard.test.js`: cup present, theme icon present, name in the
  requested language, `<a>` vs `<div>` switching; a shared-usage assertion
  (both `assets/js/album.js` AND `games/einmaleins/einmaleins.js` import
  `trophycard.js`) is added when steps 5/8 land.

### Step 4 — the map (hit targets, affordance, fog tap, Pokalraum facade)
One unit: `index.html` + `assets/js/map.js` + `tests/map.test.js` + CSS.
- **Hit shapes**: first child of each region `<a>`: `<rect class="hit"
  fill="transparent">` covering art+label+badge, ≥64×64. Starting coords
  (tune against screenshots): rechnungen 200,52,152×180 · vokabeln
  16,98,140×152 · tippen 218,222,130×152 · lesen 22,398,132×148 · einmaleins
  118,358,124×122 · pokalraum 214,398,128×150. Overlapping rects resolve by
  paint order (playable regions are painted last — existing invariant → any
  ambiguity favors einmaleins/pokalraum, the friendly outcome). Note: the
  "no art at the viewBox edge" test only parses `points=` and `<ellipse>`,
  so hit rects don't trip it.
- **`map.js`**: `fogRegion` bbox loop additionally skips
  `el.classList.contains("hit")`; rewrite the stale comment at lines 44-46.
  Locked-tap handler registered ONCE at module scope (NOT inside `render()`,
  which re-runs on settings changes): listen on `.worldmap`, find
  `e.target.closest("a.region.locked")`, `e.preventDefault()`, then
  `soonBubble(region)`: remove any existing bubble, append
  `<g class="soon-bubble">` (rounded rect + `t("soonBubble")` text,
  `pointer-events:none`) to the SVG root AFTER `#map-fox` so later-painted
  regions can't cover it, add a wiggle class to that region's `.fog`; remove
  both via a ~1300ms `setTimeout` (a timer, NOT `animationend` —
  reduced-motion never fires animation events). In `render()`, set
  `aria-disabled="true"` on locked regions (keep the existing lockedHint
  aria-label).
- **Label plates + idle bob**: in `render()`, for every non-locked region
  including pokalraum, `ensurePlate(region)`: insert/refresh a
  `<rect class="label-plate" rx="9">` immediately before `.region-label`,
  sized from `label.getBBox()` + ~7px/4px padding — re-measured on every
  render so a language change (which triggers `onChange → render`) resizes
  it. CSS: white fill, 2px `var(--orange-soft)` stroke, drop-shadow — the
  label must read as a button. Idle bob:
  `.worldmap .region:not(.locked) { animation: region-bob 3.2s ease-in-out
  infinite; transform-box: fill-box; }` (±1.5px translateY, staggered via
  nth-of-type delays; without `transform-box` SVG groups pivot on the
  viewport corner and fly across the page). Under reduced-motion the global
  kill switch disables the bob and the plate remains as the static
  affordance. Rewrite the stale CSS comment at `schlaufuchs.css:313-315`.
- **Pokalraum facade** (`index.html:195-209`): delete the two middle column
  rects (lines 200-201; keep x=247 and x=301) and the tiny roof 🏆 (line
  204); add `<text data-icon="deco-trophy" data-icon-size="24" x="278"
  y="484" font-size="24" text-anchor="middle">🏆</text>` on the facade.
- i18n: add `soonBubble` — de "Bald!", en "Soon!".
- `tests/map.test.js`: REPLACE the transparent-rect prohibition (74-83) with:
  every region has exactly one `.hit` rect ≥64×64 inside its `<a>`, spanning
  its own `region-label` anchor; no hit shape outside a region block. Add:
  `fogRegion` skips `.hit` (source check); locked-tap handler contains
  `preventDefault` + `t("soonBubble")`; plate creation gated on `!locked`.
  The existing fog / paint-order / viewBox-edge tests stay untouched and must
  stay green.

### Step 5 — round summary: one button + tappable trophy card
Depends on steps 1 and 3.
- `games/einmaleins/index.html:70-86`: delete `#sum-again` and the whole
  `.sum-secondary` row (map link + `#sum-pick`); add a single
  `<button class="primary" id="sum-ok"></button>` after `#sum-trophy`.
- `games/einmaleins/einmaleins.js`: summary overlay gets
  `initialFocus: "#sum-ok"`; wire `#sum-ok` → `startRound`. In `endRound()`:
  `sum-ok` text = `t(random of sumOk1..sumOk6)`; trophy block =
  `trophyCardHTML(s, {size, lang: getLang(), href: "../../album.html"})`
  rendered with class `tcard won` (keeps the `tests/typography.test.js` pin
  on `.trophy-earn .won` AND `tools/play.js`'s `readSummary()` selector
  `#sum-trophy .won` working); link aria-label
  `"${s[lang]} — ${t("region_pokalraum")}"`.
- i18n: ADD `sumOk1..sumOk6` (de: "Super!", "Weiter geht's!", "Toll
  gemacht!", "Klasse!", "Stark!", "Du schaffst das!" — natural, not literal,
  en counterparts); REMOVE `again`. `back` STAYS (used by `chrome.js`,
  `stub.js`, and step 8's map link).
- Tests: `tests/i18n.test.js` — add `sumOk` to both dynamic-prefix regexes
  (~lines 87 and 100). `tests/einmaleins.test.js` — pin `sumOk1..6` exist in
  both dicts (see the `starGoal` precedent in that file) + static test: the
  summary sheet has exactly one `<button>` and no
  `sum-pick`/`sum-again`/`sum-link`. `tests/typography.test.js` — drop
  `.summary .sum-link` from the pinned selector list (the CSS at ~733-752
  dies too).

### Step 6 — chip + picker clarity
- `.pickheading` CSS (~472-478): add 2px `var(--orange-soft)` border, keep
  shadow + radius, `:active { transform: scale(0.97) }`, and
  `.pickheading::after { content: " ▾" }` — a pseudo-element survives
  `updateChip()`'s `textContent` writes; never put the glyph in the i18n
  string.
- `renderPicker()` (`einmaleins.js:348-400`): the "Alle" tile (tbl === 0)
  gets a 🎲 prefix in its label span. Selected difficulty: strengthen
  `.seg button[aria-pressed="true"]` (CSS ~617) with an inset ring
  (`box-shadow: inset 0 0 0 3px …`) + slight scale — the aria-pressed
  mechanism already exists, this is CSS-only. Difficulty labels keep
  "×2 ⭐ / ×3 ⭐" — after step 9 that claim is literally true; `diffWorth`
  aria strings stay as-is.

### Step 7 — wrong-answer feedback: re-enter the answer
Depends on step 2 (divSign flows through `question.text`).
- `games/einmaleins/logic.js`: new pure `retryStep(input, key, answer)` →
  `{input, state: "typing"|"done"|"reject"}`: digits append (cap 3 chars);
  auto-`done` the instant `input === String(answer)`; `reject` (clears input)
  when length reaches the answer's length without matching; `⌫` deletes; OK =
  `done` on match / `reject` on non-empty mismatch / `typing` on empty.
  Exhaustive unit tests (all answers 1..100, wrong prefixes, backspace, junk
  keys).
- `games/einmaleins/einmaleins.js`:
  - `submit()` passes the wrong value into `showFeedback(wrong)`.
  - `showFeedback(wrong)` (~259-275) renders: struck-through wrong line
    `<span class="eq eq-wrong"><s>${question.text.replace("?", wrong)}</s></span>`,
    correct line `<span class="eq">${question.text.replace("?",
    `<b class="ans">${answer}</b>`)}</span>` (respects divSign for free), the
    dot grid, and for diff>0 a retry gap `<span class="gap"
    id="retry-gap">?</span>`. NO `#fb-next` button, no focus juggling (drop
    the old handling). CSS: `.eq-wrong` red on a soft red background; `.eq`
    stays green; delete the `#fb-next` CSS (~529-534).
  - Diff 0 (Leicht): cache the round's `choicesFor` result per question and
    re-render the SAME 4 choices in `#answers` in retry mode; the correct one
    calls `continueRound()`, a wrong tap gets a shake class (reuse
    `@keyframes stumble`) + soft `sfx.wrong()` and stays.
  - New module state `retry = ""`; `keyPress()`'s `wrong-wait` branch
    (~line 192) drives `retryStep`; paints `#retry-gap`; `done` →
    `continueRound()`; `reject` → shake + soft sound. `askNext()` resets
    `retry`.
  - `continueRound()` becomes the auto-continue: `phase = "correct-wait";
    sfx.correct(); setTimeout(askNext, NEXT_MS)` — the chime is
    `sfx.correct()`, no new audio code. Keep the function name; it stays the
    only exit from the aid.
  - Keyboard handler (~211-230): drop the `wrong-wait` Enter special-case;
    route digits/Backspace/Enter→OK through `keyPress` whenever `diff !== 0`
    (`keyPress` dispatches by phase). Preserve the structural pins in
    `tests/keyboard.test.js` test 1 (`e.key === "Enter"` present, `else
    return;` before the final `preventDefault()`).
  - REMOVE `gotIt` from BOTH dictionaries (the i18n test fails on unused
    keys).
- `tools/play.js`: the `aidUp()` branch (~111-114) → `await answer(want)`
  again instead of `$("fb-next").click()` (Leicht taps the correct choice;
  keypad types it — auto-continue fires on the matching digit and the
  trailing OK click lands in `correct-wait` where OK is a no-op — keep it
  so).
- Tests: rewrite the `tests/keyboard.test.js` aid test ("waits for a button"
  → "waits for the correct answer"): the wrong branch of `submit()` has no
  `setTimeout`, `fb-next` appears nowhere in source, `retryStep` is imported,
  `continueRound` is still the only exit. `tests/play.test.js`: assert the
  driver source no longer mentions `fb-next`. `tests/einmaleins.test.js`:
  `retryStep` suite + the child's wrong answer is rendered (source contains
  the struck-through wrong line).

### Step 8 — album: thresholds visible, sticky bar, exit button
Depends on step 3.
- `assets/js/album.js` `render()` (~24-57): earned slots →
  `trophyCardHTML(s, {size: 34, lang})` with class `slot tcard` so the grid
  CSS holds. Locked slots: DROP the `title` tooltip; visible footer instead —
  the next unlockable slot (`i === earned`): mini progress bar
  `<span class="sbar"><i style="width:${Math.min(100, 100 * (pr[game] ?? 0) /
  THRESHOLDS[game][i])}%"></i></span>`; later slots:
  `<span class="sfoot">⭐ ${THRESHOLDS[game][i]}</span>`. Extend the locked
  slot's aria-label with the threshold.
- `album.html`: big map-exit button before the footer:
  `<a class="primary maplink" href="./"><span class="nav-ico"
  aria-hidden="true">🗺️</span><span data-i18n="back">Zur Karte</span></a>`
  (icon in a sibling span — an icon must NEVER live inside a `[data-i18n]`
  element, `translateDOM` overwrites textContent).
- CSS: `.trophyroom .topbar { position: sticky; top: 0; z-index: 20;
  background: #fdf1de }` (opaque, matches the page gradient start; the topbar
  is a direct child of the scrolling body so sticky works); `.maplink`
  centered, max-width 560px, flex; `.sbar`/`.sfoot` (~6px bar,
  `var(--orange-soft)` track, `var(--depth)` fill).
- New `tests/album.test.js`: sticky rule present in CSS; `album.html` has the
  maplink with `data-i18n="back"`; `album.js` imports `trophycard.js`; no
  `title="` tooltip remains; `sbar`/`sfoot` rendered. Complete the
  shared-usage assertion from step 3 here.

### Step 9 — star currency unification
- `assets/js/rewards.js`: add pure `totalPoints(pr)` (sum over `GAMES`);
  `foxInfo().stars` = the weighted total (from `pr`); re-base `regionState`
  and `starBadgeTier` on `(pr, game)` vs `MAX_POINTS[game]` (thriving ≥ ⅓,
  mastered = 100% — same semantics, new denominator); DELETE `gameStars`,
  `sumStars`, `ACHIEVABLE`.
- `assets/js/map.js` (~97-104): badge count = `rewards.pr?.[game] ?? 0`;
  adapt to the new signatures; fix imports.
- `assets/js/parents.js` (~34): `totalPoints(...)` instead of
  `sumStars(state)` — the site shows ONE star number everywhere.
- `assets/js/journey.js`: `createJourney(container, {..., worth = 1})`; when
  `worth > 1` each sky-star `<g class="j-star">` carries a small
  `<text class="j-worth">×2/×3</text>` INSIDE the group, so the existing
  landed **transition** carries it into the basket (transition, never
  keyframe — SPEC §10.5's reduced-motion rule). `startRound()` passes
  `worth: starValue(diff)` (`starValue` is already imported).
- `endRound()` gain line: `+${points} ⭐` (the pinned `roundStat` regex in
  `tests/einmaleins.test.js` is untouched).
- i18n REWORD (key names unchanged, both languages): `trophyNextIn` → "Noch
  {n} ⭐ bis zum nächsten Pokal" / "{n} more ⭐ until the next trophy";
  `trophyNextIn1` likewise; `roomIntro` reworded without "Punkte" (stars
  unlock trophies; harder tasks make each star count more);
  `privacyCookieBody` drops "Punkte"/"points" from the stored-data list.
  Afterwards grep both dictionaries for `Punkt|point` — those four keys are
  today's only hits and none may remain.
- Tests: `tests/rewards.test.js` — delete the
  `gameStars`/`sumStars`/`ACHIEVABLE` suites (~115-166), add a `totalPoints`
  suite, rewrite `regionState`/`starBadgeTier` tests against `pr` numbers
  (einmaleins: thriving at 60, mastered at 180), static check that `foxInfo`
  uses `totalPoints`. `tests/journey.test.js`/`scene.test.js`: `worth: 2`
  renders ×2 tags inside `.j-star`; `worth: 1` renders none.

### Step 10 — docs, sweep, bump, verify
- `docs/SPEC.md`: §3.1 (hit rects real ≥64px — new invariant text; label
  plates + idle bob; fogged tap = preventDefault + wiggle + "Bald!" bubble +
  `aria-disabled`, stub pages remain for deep links; facade trophy), §3.2
  (sticky bar, bottom map button, unified trophy card, visible ⭐ thresholds
  + next-slot progress bar), §3.4 (summary = ONE primary button with a random
  congratulation; chip/topbar are the escape routes — rewrite the last
  bullet), §8.1 (wrong answer: child's answer struck through in red, correct
  in green, child re-enters the answer to continue, soft chime; "Verstanden"
  retired), §8.3/§8.4 (⭐ is the one visible currency; "Punkte" retired from
  UI vocabulary; internal names `pr`, `roundPoints`, `starValue`,
  `MAX_POINTS` stay), §10.1 items 3+4, §10.2 (division sign ":" DE / "÷" EN),
  §10.5 (worth tag rides the flying star).
- `CLAUDE.md`: fix the stale `--do 'until #fb-next'` shoot example (e.g.
  `until #feedback:not([hidden])`), add `trophycard.js` to the shared-modules
  list, and update the "there is no open plan" line.
- Sweep: `grep -rn "gotIt\|fb-next\|sum-pick\|sum-again\|gameStars\|sumStars\|ACHIEVABLE" assets games tests tools docs` —
  stale comments and dead keys are test failures in this repo.
- `node tools/version-assets.js <next>` (regenerates every import map, picks
  up `trophycard.js`), then `node --test`.

## Verification (look at it — CLAUDE.md rule)

`sh tools/serve.sh`, then `node tools/shoot.mjs` at 360×640 AND 390×844, and
**read the images** (`--help` for flags):
- Map: label plates, bob, facade 🏆 visible; tap between the two Zahlendorf
  houses via `--do 'eval document.elementFromPoint(...).click()'` (or assert
  `elementFromPoint` at a between-houses viewport coordinate resolves into
  `#region-einmaleins`) proving the hit rect works; tap a fogged region and
  prove the URL did NOT change and the bubble appeared (an `eval` step's
  return value lands in the report — use `location.href`); a
  `--reduced-motion` run (plates/bubble present without animation).
- Game: `--do 'eval @tools/play.js' --do 'eval play({ wrongAt: 1 })'` with
  `--clip .stage --probe '#feedback'` (four-edge overflow check — the aid
  gained a second equation line); summary screenshot with a cookie seeded
  near a trophy threshold (trophy card tappable, exactly one button); picker
  screenshot (filled selection, 🎲 on "Alle").
- Album `--full`: sticky bar while scrolled, ⭐ thresholds, progress bar on
  the next slot, bottom map button.
