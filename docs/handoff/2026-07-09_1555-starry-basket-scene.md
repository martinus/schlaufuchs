# Session Handoff — 2026-07-09 15:55

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-09_1555-starry-basket-scene.md` and continue the work described there.

## Goal
Replace the in-round star display in the Einmaleins game with a single wordless
scene — a sky holding the stars still to be won, a meadow holding a basket with
the stars already owned, and the fox's path running through it — and remove the
streak counter. Along the way, fix the fact that the round promised stars on a
tile that could no longer pay any.

## State

- **Repo:** `/home/martinus/git/schlaufuchs/wt/claude1` (a git worktree of
  `martinus/schlaufuchs`). **Branch:** `starry-basket`, cut from `origin/main`
  at `b14fa2b`.
- **Zero commits.** Everything below is **uncommitted** in the working tree.
  The user asked for a handoff before I committed; I did not commit because the
  operating rules say to commit only when asked.
- `node --test` → **121 pass, 0 fail**.
- Asset version is **25** (`node tools/version-assets.js 25` already run).
- Nothing is deleted relative to `origin/main`
  (`git diff --diff-filter=D --name-only origin/main..HEAD` is empty).
- PR #13 (the previous session's work) is **merged**; `main` is at `b14fa2b`.

### Done (and how it was verified)

1. **The scene.** `assets/js/journey.js` now draws one SVG: a sky band with the
   three star slots, a meadow with a soft horizon, a large basket standing in
   it, and the existing fox path with its nodes, obstacles and goal bell. An
   earned star flies from its sky slot into the basket and stays there; a grey
   ghost marks the slot it left.
   *Verified in Chrome:* a played round logged the basket after every question —
   empty through question 5, ⭐ at 6, ⭐⭐ at 8, ⭐⭐⭐ at 10, never backwards.

2. **A mastered tile opens with a full basket and a grey sky.** This was a real
   bug, not a missing decoration. `basketState()` did not know the tile's stored
   star count, so a child who already held three stars on 7×/Mittel was still
   told „noch 2 richtig bis ⭐⭐⭐" and then paid **nothing**, because
   `endRound()` only pays on `improved = stars > old`. The new pure function is
   `ownedStars(progress, best) = max(best, starsFor(firstTrySolved, total))` in
   `games/einmaleins/logic.js`.
   *Verified:* with `stars: {1: "...3..."}` for table 7 the round opens with all
   three stars landed and `aria-label="3 von 3 Sternen gesammelt"`.

3. **The streak is gone.** `hot`, `#hotstreak`, `#goalline`, `#statusrow`,
   `.bstars` and the three i18n keys `hotStreak`, `basketGoal`, `basketHave` are
   removed from code, markup, CSS and both dictionaries. One string survives —
   `starsOwned` — and it is never painted; it is the scene's `aria-label`.

4. **The font complaint was real.** `.hotstreak` was in the display-face
   selector list and `.goalline` was not, so the goal line rendered in Atkinson
   (the body face) at 0.8rem beside Grandstander text. Both selectors are gone.

5. **`prefers-reduced-motion` is verified, not assumed.** The flight is a CSS
   `transform` + `transition`, never a keyframe animation, because the
   site-wide rule kills both `animation` and `transition` — a transition
   degrades to *the star is already in the basket*, an animation would leave it
   hanging in the sky forever. I added `--reduced-motion` to `tools/shoot.mjs`
   and measured it: with `reduce` the star is in the basket immediately
   (`transitionDuration: 0s`); without it, the star is **not** in the basket
   right after the sixth answer and arrives ~750 ms later.

6. **Two duplicate baskets.** The village theme's first obstacle was also a 🧺,
   which read as a second copy of the big one. It is now a 🌻 (`j-sunflower`).
   Found only by looking at a screenshot.

7. **The stars sat on the basket's rim, not in it.** An emoji `<text>` glyph
   hangs *above* its baseline, so the landing coordinates needed +11 units.
   Verified by comparing `getBoundingClientRect()` of each landed star against
   the basket's.

8. **`tools/shoot.mjs` passed on a page that never loaded.** I claimed "all
   pages error-free at v25" while the local server was **down**. Chrome renders
   its own error page for a dead host or a 404 and fires `load` on it, so the
   tool screenshotted that, found no page errors, and exited 0. It now throws on
   `Page.navigate`'s `errorText` and on a main-document status ≥ 400, and
   reports `status` in the JSON. *Verified:* dead port → exit 1, `/404.html` →
   exit 1, a real page → exit 0 with `"status": 200`. The page sweep was then
   re-run for real: all nine pages load and log no errors at 360×640 and
   390×844.

9. **`tests/graphics.test.js` was a copy, not a check.** It hard-coded 15
   journey icon names, so it broke on the rename instead of validating it. It
   now derives the names from `THEMES` (newly exported from `journey.js`) and
   fails both when a theme names a missing icon and when an icon lingers in the
   registry that no theme uses.

10. **The scene yields the stage to the feedback aid** (`.stage:has(#feedback:not([hidden])) .journey-wrap { display: none; }`).
    That is a net win: the ten-row aid card now has **54 px** of headroom at
    360×640, where it had 15 px.

Every new guard was re-broken and seen red:
- star flight as a keyframe `animation` → `tests/scene.test.js` #1 red
- scene stays visible during the aid → `tests/scene.test.js` #2 red
- `stars: best` removed from `createJourney` → `tests/scene.test.js` #4 red
- `setStars(stars)` without `{animate:false}` → `tests/scene.test.js` #4 red
- a theme names a missing icon → `tests/graphics.test.js` red
- an orphan `j-*` icon in the registry → `tests/graphics.test.js` red
- `ownedStars` ignoring `best` → three `tests/einmaleins.test.js` tests red
- `ownedStars` driven by the reachable maximum → `tests/einmaleins.test.js` red

### In progress
Nothing is half-written. The work is complete and green; it is simply
**uncommitted**.

### Not started
- Committing, pushing, and opening the PR.
- Real mobile Safari. Never tested, in this session or the three before it.

## Key context

### Files that matter
- `assets/js/journey.js` — the whole scene. Geometry constants at the top
  (`H`, `HORIZON`, `PATH_X0`, `BASKET`, `landing()`). `setStars(n, {animate})`
  is idempotent and assumes the caller passes a monotone `n`.
- `games/einmaleins/logic.js` — `ownedStars()`, `STAR_SLOTS`. Pure, tested here.
- `games/einmaleins/einmaleins.js` — `best` is read once in `startRound()` from
  `starDigit(saved.stars[diff], table)` and handed to `createJourney`;
  `renderStatus()` calls `journey.setStars(ownedStars(session.progress(), best))`.
- `assets/css/schlaufuchs.css` — `.j-sky`, `.j-grass`, `.j-ghost`, `.j-star`,
  `.j-star.landed`, `.j-star.j-instant`, and the aid rule on `.journey-wrap`.
- `tests/scene.test.js` (new), `tests/einmaleins.test.js`,
  `tests/graphics.test.js`, `tests/keyboard.test.js`, `tests/shoot.test.js`.
- `tools/shoot.mjs` — grew `--full`, `--reduced-motion`, and the
  navigation/status failure check.
- `docs/SPEC.md` §10.5 rewritten to describe the scene.

### Non-obvious decisions
- **The basket holds what you *own*, not what this round earned.** That is why
  it starts full on a mastered tile and why `max()` makes it monotone: both
  `best` (constant during a round) and `starsFor(firstTrySolved)` (monotone) are
  monotone, so a star can never leave the basket. This was the fix for the bug
  in item 2, and it also removes any need for text.
- **Stars this round can no longer reach stay gold.** After three misses two
  stars are unreachable *today*, but still winnable another day. Dimming them
  would be the loss framing the previous session deliberately removed.
- **The star's flight must be a `transition`, not an `animation`.** See item 5.
  This is the single most fragile property of the scene: it is invisible in
  every run that does not emulate reduced motion.
- **`clipPath id="j-clip"` is a fixed id, not a random one.** There is one scene
  per page and `container.innerHTML` replaces it wholesale each round.
- **I rejected the obvious fusion**: putting the three stars as gates on the
  fox's path at nodes 6/8/10. The fox advances on every *correct answer*, but
  stars count only *first-try* correct answers. After one mistake the fox stands
  on node 6 with five first-try hits and the star there would not open — the
  picture would lie to the child. Sky and path must stay separate axes.

### Dead ends / traps — do not repeat
- **Editing `tests/einmaleins.test.js` by string-slicing indices.** I cut on
  `s.index('test("star digit string')`, which matched an *earlier* occurrence
  than I expected, and the file ended up with the whole tail duplicated. My
  "fix" then truncated at the same wrong index and silently deleted the
  `fittedFontSize` tests. I restored with `git checkout -- tests/einmaleins.test.js`
  and redid it. Count the tests (`grep -c "^test("`) before and after any bulk
  edit of a test file.
- **`shoot.mjs` exiting 0 on a dead server** (item 8). I published a false
  "all pages error-free" claim from it. If a sweep passes suspiciously easily,
  check that something is actually listening.
- **Reading `gapToKeypad: 0px` as "the stage is full".** It is a flex child; a
  zero gap to the keypad is its resting state, not an overflow. The signals that
  actually mean trouble are `document.documentElement.scrollHeight > innerHeight`
  and a `.kp-ok` whose `bottom` exceeds `innerHeight`. Neither fires anywhere
  down to 320×568.
- **A re-break that does not break.** My first attempt to prove the "no clock in
  the summary" test declared an unused `const seconds` outside the block the
  test inspects. It stayed green, correctly. Simulate the *real* defect, not a
  cosmetic one.
- **`prefers-reduced-motion` cannot be checked by reading CSS alone.** Use
  `node tools/shoot.mjs --reduced-motion` and assert the element *arrived*.
- **The auto-mode Bash classifier went down for ~10 minutes** mid-session
  ("claude-opus-4-8 is temporarily unavailable"). File edits still worked. If it
  happens again, keep editing with Read/Edit/Write and re-run the suite later.

### Commands
```sh
python3 -m http.server 8000        # serve; never file:// (ES modules)
node --test                        # 121 tests, the only CI gate (Node 22+)
node tools/version-assets.js 26    # REQUIRED before the next deploy (25 is set)
node tools/shoot.mjs <url> --help  # screenshot + measure; --reduced-motion, --full
```
Driver scripts used this session live in the session scratchpad
(`scene.js`, `scene8.js`, `rm.js`, `aid.js`, `perfect.js`, `hit.js`) and are
**not** in the repo. They are small; rewrite rather than hunt for them.

## Next steps

1. `git add -A && git commit` the work. Suggested split, each green on its own:
   (a) `ownedStars` + the logic tests, (b) the scene in `journey.js` + CSS +
   markup + the streak removal, (c) `shoot.mjs`'s navigation/status guard +
   `--reduced-motion` + `--full` + its tests, (d) the `graphics.test.js`
   rewrite, (e) SPEC/CLAUDE.md. Verify with:
   ```sh
   for c in $(git rev-list --reverse origin/main..HEAD); do
     git checkout -q "$c" && node --test 2>&1 | grep -E "^# (pass|fail)"
   done
   ```
2. `git diff --diff-filter=D --name-only origin/main..HEAD` must be empty, then
   push and open the PR.
3. Ask the user to look at the scene on a real phone. The composition was only
   judged on headless Chrome at 360×640 and 390×844.
4. Consider whether the other four games' themes (`mountain`, `forest`,
   `meadow`) still make sense now that `journey.js` draws a sky and a basket for
   every theme. Only `village` has ever been rendered.

## Reflection

### 1. What in the delivered work am I least confident is correct?
*(Corrected after writing: my first answer here claimed the stage was "exactly
full, no slack left" at 360×640, reading `gapToKeypad: 0px` as an overflow. It
is not — `.stage` is a flex child and a zero gap to the keypad is its resting
state. A sweep afterwards showed the game screen never scrolls and the OK key
never leaves the viewport at 320×568, 360×568/600/640/700/740/800, 375×667,
390×844 or 412×915, and the tallest state — the ten-row aid card on the 10×
table — clears both edges of `.stage` at every one of them, with 29 px of
headroom even at 320×568. The layout is far more robust than I said.)*

What I am actually least sure of is the scene's **composition on a real device**:
`landing(i)` places stars by *baseline*,
and I tuned the offset (+11) against the emoji font Chrome happens to use here.
A different emoji font — or the real SVG icons, once `AVAILABLE` is populated —
will move them. That is the argument for finally executing
`docs/GRAPHICS_BRIEF.md`.

### 2. What assumptions did I make that I never stated explicitly?
- **That `best` cannot change during a round.** I read it once in
  `startRound()`. It is true today because only `endRound()` writes stars, but
  nothing enforces it, and `ownedStars`'s monotonicity — the property everything
  rests on — silently depends on it. If a future feature awards a star mid-round,
  the basket could jump or, worse, `setStars` could be called with a smaller `n`
  and silently no-op (it returns early on `next === owned`), leaving the scene
  wrong rather than crashing.
- **That every theme wants a sky and a basket.** `journey.js` is game-agnostic
  and four themes exist; I drew the scene into all of them. Only `village` has
  ever rendered. If `tippen` scores by words-per-minute rather than by stars,
  the basket is meaningless there and I have baked a star metaphor into a shared
  module.
- **That the user's „Bau den Fuchs weg in die Grafik ein" meant „Fuchsweg".**
  I asked and they confirmed, so this one is discharged — but it was a guess
  before I asked, and the opposite reading (remove the fox) would have produced
  a completely different module.
- **That `aria-hidden="true"` on the SVG plus `role="img"` + `aria-label` on the
  wrapper is correct.** I never tested with a screen reader.

### 3. What is the biggest thing the user may not realize about the broader situation?
Four of the five games still do not exist, and this is now the **fourth
consecutive session** spent on Einmaleins. The map draws six regions, four sit
under fog I added last session, and the fog is honest precisely because the gap
is real. Meanwhile `graphics.js`'s `AVAILABLE` set is still **empty**, so every
one of the ~102 icons in `docs/GRAPHICS_BRIEF.md` renders as an emoji — the
basket, the stars, the fox's obstacles, the trophies. The scene I just built is
made of system emoji, which means it looks different on every phone and is the
one thing in the design that the type and colour tokens do not govern. The
cheapest high-leverage move is not another Einmaleins refinement; it is either
(a) `rechnungen`, which can reuse the keypad, the journey, the rewards and the
chrome and differs only in `questionFor()`, or (b) executing the graphics brief,
which would visually finish the entire site at once.

### 4. If this work breaks in 3 months, what's the most likely reason?
Someone adds a keyframe animation to `.j-star` — a twinkle, a bounce on landing,
a wobble — and it will look correct in every screenshot. Under
`prefers-reduced-motion` the site-wide `* { animation: none !important }` rule
will then cancel it, and the star will never leave the sky for exactly the
children who need calm. `tests/scene.test.js` guards the *current* rule by
asserting the flight block contains no `animation:`, but it inspects the CSS
between `.journey .j-star {` and `.journey .j-star.j-instant`, so an animation
added in a new rule elsewhere slips past. The durable fix is a browser check in
CI, which this repo cannot have; the cheap fix is to widen the regex to any rule
whose selector contains `.j-star`.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
Two, both concrete. First, **`--reduced-motion` and the navigation/status check
in `shoot.mjs` should have existed already** — I built both this session, and
the second one only after publishing a false claim from the tool. Second, and
worth building now: a **committed `tools/play.mjs`** holding the round-driver
scripts I have now rewritten in four separate sessions (answer correctly, answer
wrong on question N, reach the summary, read the scene). They live in the
scratchpad and are thrown away every time; they are the reason each verification
costs twenty minutes. A `--do 'play 10 --wrong-at 1'` verb in `shoot.mjs`, or a
sibling script importing nothing, would pay for itself on the next session.
A third, smaller: a `pre-commit` hook running `grep -c "^test(" tests/*.js` and
refusing a commit that *reduces* the count without the message saying so — that
would have caught me silently deleting the `fittedFontSize` tests.

### 6. What could the user have done differently to make this session smoother?
One thing, and it is minor: **„Bau den Fuchs weg in die Grafik ein"** is
genuinely ambiguous in German — „den Fuchs weg" (remove the fox) and „den
Fuchsweg" (the fox's path) are opposite instructions, and the whole module
structure hangs on which one is meant. Asking cost one round trip; guessing
would have cost a rebuild. Otherwise the framing was unusually good: the three
complaints in the first message were each specific enough to check against the
code, two of them turned out to be real defects rather than preferences, and
„Oder hast du eine bessere Idee?" is exactly the invitation that let me reject
the path-gates design on evidence instead of building it and discovering the
mismatch afterwards.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
**A weekly "what changed" line on the parents' page**, computed from a single
extra cookie field: last week's Leitner box string. Today `parents.html` shows a
snapshot — which facts are solid right now. A parent cannot see *movement*, and
movement is the only thing that tells them whether the practice is working.
Diffing two box strings costs 100 bytes of cookie and yields sentences no
commercial kids' app produces: „7×8 sat in box 0 last Sunday and is in box 3
today", „6×7 has been slipping for two weeks — sit down with it". The data
already exists in `boxesFromString()`; nothing needs a server, and it turns the
heat grid from a photograph into a story.
