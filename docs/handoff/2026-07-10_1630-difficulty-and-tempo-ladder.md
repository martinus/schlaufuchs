# Session Handoff — 2026-07-10 16:30

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-10_1630-difficulty-and-tempo-ladder.md` and continue the work described there.

## Goal
Two things, both for einmaleins, both prompted by Martin watching his daughter
play: (1) make the difficulty honest — Schwer served 1×1 and 8×10, fixed-table
divisions answered themselves, and every round asked every fact of a row
regardless of mastery; (2) add a motivation for *memorizing* facts (she counts
her way to every answer, rationally, because accuracy is all that pays) — the
**tempo ladder**, a purely additive per-tile speed collectible.

## State
- Branch `einmaleins-difficulty` off `origin/main` (9ebabdb), worktree
  `wt/claude1`. **Clean tree, 6 commits, NOT pushed, no PR.** `node --test`:
  254 pass, 0 fail. Asset version bumped to **v41** (main was at 39).
- **Done and verified** (all driven end-to-end in real Chrome via
  `tools/play.js` + `tools/shoot.mjs`, screenshots read):
  - `3a89074` play driver fixes (pre-existing bugs): Escape past the level
    picker the game now opens on; post-answer waits outlive the 250 ms
    correct-wait phase (Leicht re-read every question and swallowed `wrongAt`).
  - `f3ed2c0` difficulty redesign: `HARD_TABLES` (Schwer = factors/tables 2–9
    only, tiles 1er/10er removed → `MAX_POINTS.einmaleins` 180→162, trophy
    ladder grandfathered at `ladderFor(180)`); fixed rows on Mittel/Schwer hold
    both orientations (pool 19/15 > round, so Leitner weights finally bite);
    `pairHardness`/`hardnessBoost` (new `boost` opt in `adaptive.js`) makes
    7×8 ~3.4× as frequent as 2×2; `questionFor(..., table)` — on a fixed row
    the gap/division never solves for the row itself; `ROUND_SIZE=[10,10,12]`;
    `starGoalNeed` + parametrized `starGoal*` strings (`{n} von {total}`);
    `coerceTable` checks `tablesFor(diff)`.
  - `699e8a1` tempo ladder (§10.6): per-question first-try times → round
    median → `tempoTier` (🐇/🚗/🚀, bounds in `TEMPO_TIERS`, keypad later than
    tap) → `awardTempo` (gated at ⭐⭐, merges by max, monotone). Stored as
    `tempo` digit strings beside `stars` in the cookie. Corner badge on picker
    tiles (tier 0 draws NOTHING — no snail), quiet summary line
    („🚀 Rakete · Neuer Tempo-Rekord!"), ⚡ flash on a single rocket-speed
    answer (transition, reduced-motion safe). Purely collectible — no stars,
    no trophies. Verified: fast round pays 🚀 + cookie digit; 1-star round with
    a rocket-fast driver pays nothing and leaves the stored badge alone;
    reduced-motion round completes; no clipping at 360×640 / 390×844.
  - `c21e867` SPEC catch-up: §8.1 (⚡ moment), §8.3 (badge ≠ currency), §10.1
    (summary line, tile promise), plus stale `starsFor` comment.
- **In progress:** nothing mid-flight.
- **Not started:** push + PR (user has not asked); tempo threshold calibration
  with a real child (see Next steps).

## Key context
- `games/einmaleins/logic.js` — ALL new pure logic lives here, unit-tested in
  `tests/einmaleins.test.js`: pools, hardness, question forms, `ROUND_SIZE`,
  `median`, `tempoTier`, `awardTempo`, `TEMPO_TIERS`, `starGoalNeed`.
- `games/einmaleins/einmaleins.js` — wiring: `qShownAt`/`answerTimes`/
  `missedIds` (reset in `startRound`), award in `endRound` **before** the
  `setTimeout` (the pinned no-clock test regex bans `Date.now|ms|median|…` in
  the painted block), badge in `renderPicker`, `blitzFlash()` (defined ABOVE
  `submit()` on purpose — `tests/keyboard.test.js` slices submit→showFeedback
  and forbids `setTimeout` in the wrong-answer branch).
- Tempo i18n lives in `games/einmaleins/i18n.js` (`tempo1..3`, `tempoBest`,
  `tileTempo`), NOT in `assets/i18n/*` — game-local strings, both languages in
  one file. A test asserts none of them contains a number or a time unit.
- Icons `tempo-hare/-car/-rocket` are registry entries (`graphics.js`), emoji
  fallbacks 🐇🚗🚀, swappable for SVGs later like everything else.
- Cookie: `einmaleins.tempo = {0,1,2: 11-digit string}` — same layout and
  helpers as `stars` (`starDigit`/`withStarDigit` are generic digit-string
  functions). A test pins a maxed section < 400 bytes (< BUDGET/8).
- **Decisions with reasons** (agreed with Martin via question rounds):
  only positive tiers (no snail — empty until 🐇); gate at ⭐⭐ so
  fast-and-wrong never pays; median not mean (a slow think about a new fact
  has no veto); purely collectible so the ⭐-economy and `MAX_POINTS` stay
  untouched. Not built (explicitly deferred): Blitzrunden mode, ghost race,
  tempo in the parents' view.
- **Dead ends / traps:**
  - `git checkout <file>` to undo a deliberate test-breaking sed also wiped
    the *uncommitted* feature code in that file once (recovered by re-editing).
    Use targeted sed-reverts or `git stash` while code is uncommitted.
  - `19:1` on Leicht in the driver: any post-answer sleep < 250 ms re-reads
    the same question ("phantom reads") — fixed via `SETTLE = 350` in
    `tools/play.js`; don't lower it. Trailing phantom reads of the *last*
    question still appear in traces (harmless: clicks land in correct-wait).
  - The `#question` probe reports ~4–10 px `clippedBelow` — pre-existing on
    main (glyph descent artifact), verified via `tools/baseline.sh`. Not ours.
  - Commutant pairs on a fixed row can render the same division twice in one
    round ((4,2) and (2,4) both print `8 : 4 = ?` in the 4er-Reihe) — known,
    accepted (~1 in 3 rounds); the mul/gap forms differ.
- Commands: `sh tools/serve.sh` (never file://), `node --test`,
  `node tools/version-assets.js N` before deploy (now 41), driver recipe:
  ```sh
  node tools/shoot.mjs http://localhost:8000/games/einmaleins/ \
    --cookie "schlaufuchs=$(node -e 'process.stdout.write(encodeURIComponent(JSON.stringify({v:1,settings:{lang:"de"},einmaleins:{d:2,t:4}})))')" \
    --size 360x640 --do 'eval @tools/play.js' --do 'eval play({})' \
    --do 'until #sum-overlay:not([hidden])' --do 'wait 900' --out sum.png
  ```
  (play() now escapes the picker itself; `wrongAt`, `stopAt` as before.)

## Next steps
1. `gh pr create` off `einmaleins-difficulty` when Martin says push — before
   that, re-run `git diff --diff-filter=D --name-only origin/main..HEAD`
   (was empty) in case main moved.
2. **Calibrate `TEMPO_TIERS` with the real child.** The bounds
   (Leicht 3/5/8 s, keypad 4.5/7/11 s median) are educated guesses. Watch a
   counting round vs a recall round; adjust the constants in
   `games/einmaleins/logic.js` — only the boundary tests in
   `tests/einmaleins.test.js` reference them symbolically, so a retune is a
   one-line change.
3. Optional follow-ups already scoped in `docs/SPEC.md` §10.6 discussion:
   tempo in the parents' view (per-round medians exist transiently but are
   not persisted), Blitzrunden mode, ghost race.

## Reflection

### 1. What in the delivered work am I least confident is correct?
The `TEMPO_TIERS` thresholds. Everything around them is verified; the numbers
themselves are guesses about how fast a 7-year-old taps a choice or types two
digits. If they're too tight the ladder never pulls; too loose and counting
earns a hare. Check: play one honest counting round and one recall round on a
phone and read the awarded tier (visible in the cookie's `tempo` digits).
Second doubt: `qShownAt` keeps ticking if the child walks away mid-question —
the median blunts one outlier per round, but a distracted round on a 10-item
Leicht row has 10 chances to collect several. If that shows up in practice,
cap per-question times (e.g. 30 s) before pushing into `answerTimes`.

### 2. What assumptions did I make that I never stated explicitly?
(a) That the daughter will *notice* the badge without being told — the ladder
has no introduction anywhere in the UI. If wrong, the feature motivates
nothing until a parent explains it. (b) That both orientations in a fixed row
(7×4 inside the 4er-Reihe) match what her school calls "die 4er-Reihe"; if her
teacher treats rows as strictly `4×n`, Mittel/Schwer rows will look "wrong" to
her. (c) That existing children's cookies have no `tempo` key colliding with
anything — `getGame` just spreads unknown keys through, verified only by
reading `storage.js`, not with a real legacy cookie.

### 3. What is the biggest thing the user may not realize about the broader situation?
The tempo ladder measures time-to-submit, and on **Leicht it can be gamed**:
four choices, gate is ⭐⭐ (two misses allowed in ten), so a fast guesser has a
real shot at a hare or car on easy rows. On keypads guessing is expensive, so
Schwer tempo is trustworthy — but the child plays Leicht first. If gaming
shows up, the fix is a stricter gate on Leicht only (⭐⭐⭐), one line in
`awardTempo`'s caller. Also: the four stub games will one day want the same
ladder, and today it lives entirely inside einmaleins — fine now, but worth
extracting the pure parts before game #2 copies them.

### 4. If this work breaks in 3 months, what's the most likely reason?
A change to the summary's paint block or the round flow that reintroduces a
time word — the pinned test bans a specific regex (`Date.now|ms|median|…`),
not the concept, so a variable named `speedMs` inside the `setTimeout` slice
fails the test (good) but a refactor that computes the tier *inside* it under
a banned name will be "fixed" by renaming rather than by moving the code.
Second candidate: `tools/play.js`'s `SETTLE=350` silently depends on
`NEXT_MS=250` in `einmaleins.js`; if someone slows the transition past 350 ms
the driver's phantom reads return and CI-adjacent verification runs get flaky.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
A `tools/play.js` option to pace answers (`play({ delayMs: 5000 })`). I could
not end-to-end-verify the *slow* path (hare tier, or no tier) in the browser —
only fast (🚀) and gated (wrong answers) — because the driver answers at one
speed and a 12×5 s round exceeds its 60 s deadline. It's a ~5-line addition
plus a deadline derived from `questions × delay`; worth doing before anyone
retunes `TEMPO_TIERS`, since that's exactly the loop calibration needs.

### 6. What could the user have done differently to make this session smoother?
Very little — the observed-behavior framing ("sie zählt, weil sie keine Sterne
verlieren will") was exactly the right input, and the four design questions
got immediate, decisive answers. The one improvement: saying "update the SPEC"
was a separate follow-up turn; stating up front that SPEC-completeness (every
section that *mentions* a surface, not just the new section) is part of "done"
would have folded that into the feature commit.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
Per-fact recall telemetry in the parents' view: the cookie already stores a
Leitner box per pair, and this session added per-question timing — combine
them into a tiny 10×10 heat grid ("which facts does she *know*, which does she
*compute*?") using median time class per pair (one extra digit string, ~100
bytes, budget holds). No commercial times-tables app shows parents
recall-vs-counting per fact; it would also make `TEMPO_TIERS` calibration
self-evident from real data instead of guesswork.
