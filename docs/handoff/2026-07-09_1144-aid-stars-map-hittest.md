# Session Handoff — 2026-07-09 11:44

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-09_1144-aid-stars-map-hittest.md` and continue the work described there.

## Goal
Fix three playtest defects in Schlaufuchs: the map's cursor stayed a hand over
empty land, the wrong-answer explanation vanished on a 2-second timer, and the
star criteria punished slow children by counting seconds.

## State

- **Repo:** `/home/martinus/git/schlaufuchs/wt/improve-map` (a git worktree of
  `martinus/schlaufuchs`). **Branch:** `improve-map-2`. **Last commit:**
  `bab83ff CLAUDE.md: a merged PR ends its branch`.
- **Working tree is clean** apart from this handoff file (untracked).
- **PR #11 is OPEN:** https://github.com/martinus/schlaufuchs/pull/11 (base
  `main`). Nothing in it is live until it merges and the deploy workflow runs.
- **Asset version is 20** (`node tools/version-assets.js 20` already run; every
  page's import map and stylesheet URL carries `?v=20`).
- `node --test` → **85 pass, 0 fail** (69 from this branch + 16 from the SVG
  asset validator that PR #9 added to `main`).

### Done (and how it was verified)

1. **Map hit-testing.** Every region wrapped its art in an invisible
   `<rect fill="transparent">` touch target. Once the map filled the viewport
   these rects tiled it, so the cursor became a hand over open grass and sea and
   never reverted. The rects are removed; regions are hit-tested by their own
   art.
   *Verified by measurement, not by eye:* a CDP script walked the rendered map
   on a 4 px grid calling `document.elementFromPoint` and counting hits inside
   `a.region`. **Before: 42 % of the map was a link. After: 23 %.** The smallest
   region (Zahlendorf) still covers ≈ 8800 px² ≈ 90×90 px.
   Guarded by `tests/map.test.js` → "regions are hit-tested by their art".

2. **The wrong-answer aid waits for a button.** `setTimeout(askNext, 2000)` is
   gone. `showFeedback()` renders a `#fb-next` "Verstanden" / "Got it" button;
   only `continueRound()` leaves the aid. Enter activates it on **all three**
   difficulties (the keydown handler now checks `phase === "wrong-wait"` before
   its `diff === 0` early return, so Leicht — which otherwise ignores the
   keyboard — also responds).
   *Verified* with a real Chrome over CDP: the aid is still on screen 3000 ms
   after a wrong answer, at 360×640 / 390×844 / 402×874, on Leicht and Mittel.
   Guarded by `tests/keyboard.test.js` → "the feedback aid waits for a button,
   not for a clock", which was **proven to go red** when the timer is restored.

3. **Stars are accuracy only.** `starsFor(firstTryOk, total)` takes no `seconds`
   argument. Ladder: **6/10 → ⭐, 8/10 → ⭐⭐, 10/10 → ⭐⭐⭐**, first tries only.
   Written as a ratio, so it still means something if a round is ever not 10
   questions long.
   *Verified* by playing a real round with four deliberate mistakes:
   `6/10 · 12 s +2`, one star, goal line "⭐⭐ ab 8 von 10 richtig".

4. **The summary names the next star's price.** New pure `nextStarGoal(stars)`
   in `games/einmaleins/logic.js` returns `starGoal1|2|3` or `null`; the summary
   shows it in a muted `.sline.goal` line. This existed because a child scoring
   9/10 was told nothing about why they still had one star.

5. **Enter after tapping a keypad digit** re-entered that digit (the browser's
   default "activate the focused button" fired on top of our handler; the extra
   digit landed in `buffer` and prefilled the next question). The handler now
   `preventDefault()`s the keys it owns. Committed earlier this session
   (`9fd1a18`).

6. **`CLAUDE.md`** gained a working rule: *a merged PR ends its branch* — see
   "Dead ends / traps" below.

### In progress
Nothing. Every change is committed and pushed to `improve-map-2`.

### Not started
- Nobody has decided whether the round's **duration** should still appear in the
  summary (`{ok}/{total} · {s} s`). It is now pure information with no threshold
  attached, but it still whispers "faster is better". The user was told and has
  not answered.
- Whether the deploy workflow should bump the asset version automatically (e.g.
  from the git SHA) instead of the manual `node tools/version-assets.js N`.

## Key context

### Files that matter
- `games/einmaleins/logic.js` — pure logic. `starsFor`, `nextStarGoal`,
  `fittedFontSize`. Test it here, not through the DOM.
- `games/einmaleins/einmaleins.js` — `submit()`, `showFeedback()`,
  `continueRound()`, the document `keydown` handler, `endRound()`.
- `assets/js/rewards.js` — `roundPoints()`, `THRESHOLDS`, `tilePointsLeft()`.
- `assets/css/schlaufuchs.css` — `.feedback-aid`, `#fb-next`, `.dotgrid`, and
  two `:has()` rules on `.stage` (see below).
- `tests/keyboard.test.js`, `tests/map.test.js`, `tests/einmaleins.test.js`,
  `tests/rewards.test.js`.

### Non-obvious decisions

- **The point bonus moved.** It used to be "+1 for your first mistake-free round"
  and was derived from crossing below-2 → ≥2 stars, because two stars *meant*
  10/10. That is no longer true, so the bonus now sits on **mastery: +3 on the
  third star**. A tile is still worth exactly 6 / 12 / 18 points (Leicht ×1,
  Mittel ×2, Schwer ×3) and the trophy economy (360 points) is unchanged.
- **`THRESHOLDS[0]` dropped 3 → 2.** The cheapest first sitting (one Leicht tile
  to two stars) now pays 2, not 3, and the balance test in
  `tests/rewards.test.js` requires the first trophy to land in the first
  sitting. **The test found this, not me.** If you change `roundPoints`, run the
  balance test before assuming the thresholds still work.
- **`showFeedback()` focuses `#fb-next` inside a `setTimeout(…, 0)`.** We run
  from the answer button's `pointerdown`, but Chrome focuses that button on the
  *later* `mouseup` — a direct `focus()` here is silently undone. Verified: it
  really was leaving `document.activeElement` on the "OK" key.
- **The stage clips.** `.stage { overflow: hidden }`, and the aid card (equation
  + up to **ten** rows of dots for the 10× table + a 48 px button) is the tallest
  thing it ever holds. Two `:has()` rules pay for the button:
  `.stage:has(#feedback:not([hidden])) { padding-top: 8px }` and
  `.stage:has(#feedback:not([hidden])) .hotstreak:empty { display: none }`.
  The dots also scale: `.dotgrid i { width: clamp(5px, 1.05vh, 9px) }`, and the
  inline grid columns changed from `repeat(${b}, 8px)` to `repeat(${b}, auto)`
  so a grown dot cannot overflow its column.
- **The `tryAgainSoon` string is deleted** from both dictionaries. It said
  "Gleich nochmal!", which announced a timer that no longer exists, and it sat
  directly above a card saying the same thing. Its row was the 22 px the aid
  needed. `tests/i18n.test.js` fails on dead keys, so it had to go, not just be
  unused.

### Dead ends / traps — do not repeat

- **A `git diff` against `main` is not enough before opening a PR.** PRs here are
  **squash-merged**. `improve-map`'s PR #10 merged as one commit, so the branch
  still looked 18 commits ahead of a `main` that already contained its work.
  A PR straight from that branch would have **deleted**
  `tests/svg-icon-validator.js` and `tests/graphics-assets.test.js`, which
  arrived on `main` via PR #9 *after* the branch point. Hence `improve-map-2`,
  rebased onto `origin/main`. Always run:
  ```sh
  git diff --diff-filter=D --name-only origin/main..HEAD
  ```
- **A harness that cannot fail is not evidence.** Two CDP repro scripts "proved"
  the Enter bug before either actually reproduced it: the first sampled the
  screen after a *wrong* answer (so it showed the old question), the second
  omitted `text: "\r"` on the Enter `keyDown`, without which Chrome never
  performs Enter's default action. Same lesson in the test suite: my first
  timer-regression test used a clever regex over `submit()` and stayed green
  when I put `setTimeout(askNext, 2000)` back. It now checks the wrong-answer
  branch for the literal string `setTimeout`, and it was seen red.
- **A wrong answer does not re-ask immediately.** It leaves the item unsolved and
  the round ends after ten *solved* items — so a round with one mistake asks
  **eleven** questions. Two of my scripts hung because they answered exactly ten
  times and waited for a summary that never came.
- **`node tools/version-assets.js N` is not optional.** GitHub Pages caches each
  file for a day on its own clock; a stale `index.html` paired with a fresh
  `map.js` throws and the page renders without its buttons — invisible in
  incognito. Run it before every deploy.
- Chasing **320×568** is out of scope: `docs/SPEC.md` sets a 360 px baseline. I
  spent effort making the aid fit an iPhone SE 1 before noticing.

### Commands
```sh
python3 -m http.server 8000        # serve; never file:// (ES modules)
node --test                        # 85 tests, the only CI gate (Node 22+)
node tools/version-assets.js 21    # REQUIRED before the next deploy
```
Screenshot/CDP driver scripts from this session live in the session scratchpad
(`/tmp/claude-1000/.../scratchpad/{aid,goal,hit}.mjs`) and are **not** in the
repo. They are small; rewrite rather than hunt for them.

## Next steps

1. `gh pr view 11 --web` and get PR #11 reviewed/merged. Nothing is live until
   then.
2. After it merges: **do not commit to `improve-map-2` again.**
   `git fetch origin && git checkout -b <new-branch> origin/main`.
3. Ask the user the open question: should `{s} s` stay in the summary line at
   all? It is the last trace of the clock.
4. If the answer is "no", remove `roundStat`'s `{s}` from `assets/i18n/{de,en}.js`
   and the `seconds` computation in `endRound()`, and delete `t0`.
5. Consider whether `docs/PLAN.md` (the UI design plan) is now fully implemented
   and should be archived next to `docs/PLAN_playtest_2026-07.md`.

## Reflection

### 1. What in the delivered work am I least confident is correct?
The two `:has()` rules in `assets/css/schlaufuchs.css`. `:has()` is the newest
thing in this stylesheet and the layout it rescues is the tallest state of the
tallest screen. I verified no clipping at 360×640, 390×844 and 402×874 for the
7× and 10× tables by measuring `getBoundingClientRect()` against the stage and
the answers area — but only on desktop headless Chrome. **I never tested a real
mobile Safari**, where `100dvh`, the URL bar and `env(safe-area-inset-bottom)`
interact and shrink the stage further than my window sizes did. The next agent
should open `games/einmaleins/`, answer wrong on the 10× table, and check the
card's foot on an actual iPhone. `clippedAbove`/`clippedBelow` are one-liners to
re-add to a CDP probe. Related: I initially wrote a probe that only checked the
card's *bottom* and declared success while its *top* was being clipped — the
failure mode here is a check that inspects one edge.

### 2. What assumptions did I make that I never stated explicitly?
- **That the star ladder change is safe for the four stub games.** `starsFor`
  lives in `games/einmaleins/logic.js` and only einmaleins calls it, but
  `docs/SPEC.md` §13.3 described the same criteria for Vokabeln. I edited the
  spec to point at §10.3. If someone implements Vokabeln from an older reading of
  the spec, the two games will disagree about what a star means.
- **That `ACHIEVABLE` still matches reality.** It maps a game to its total star
  count and drives whether a region shows as "mastered" and paves its road. It is
  unchanged by this session — but it counts *stars*, and I changed what earns
  them, not how many exist, so I believe it is fine. If it is wrong, a region can
  never be mastered and its road never paves. `tests/rewards.test.js` covers
  einmaleins (81) only.
- **That the user wants the 6/8/10 ladder applied to the round's `total`, not a
  fixed 10.** I wrote it as a ratio. If a future round has 7 questions, 5/7 is a
  star. Nobody asked for that.
- **That deleting `Screenshot_20260709_062015.png` is wanted.** It is the
  screenshot the user pasted in the first message; it reached `main` through my
  own `git add -A`. I told him, and he did not object — but he also did not
  confirm. If it was meant to stay, PR #11 removes it.

### 3. What is the biggest thing the user may not realize about the broader situation?
**Four of the five games do not exist**, and this session — like the two before
it — spent all its effort polishing the one that does. `rechnungen`, `tippen`,
`vokabeln` and `lesen` are stubs, so a child who taps four of the six regions on
that carefully redrawn island finds nothing there. The map now *promises* five
games. Every hour spent on einmaleins's star curve widens the gap between what
the map says and what the site does. The adaptive engine (`adaptive.js`), the
journey strip, the rewards system and the chrome are all game-agnostic already;
the cheapest next game is probably `rechnungen`, which can reuse einmaleins's
keypad and differ only in `questionFor()`. Relatedly, `graphics.js`'s `AVAILABLE`
set is still **empty**, so all ~102 icons render as emoji — the entire graphics
brief (`docs/GRAPHICS_BRIEF.md`) is unexecuted, and the site's look is currently
"emoji on parchment", not what the brief describes.

### 4. If this work breaks in 3 months, what's the most likely reason?
A caller passes `nextStarGoal` something that is not 0–3. I checked the boundary
before writing this: `stars >= 3 → null` catches a fourth star, but
`nextStarGoal(undefined)` returns **`undefined`**, and `t(undefined)` renders an
empty string — so the summary would show a blank row instead of throwing. The
one caller currently passes the result of `starsFor`, which cannot be undefined,
so this is latent rather than live. What makes it durable damage is that the i18n
dead-key test cannot catch a *missing* `starGoalN`: `starGoal*` is on the
dynamic-key allowlist in `tests/i18n.test.js`, a regex **I widened myself** so
that runtime-built keys pass, and in doing so I removed the tripwire. A stricter
test would assert that `starGoal1`, `starGoal2` and `starGoal3` each exist in
both dictionaries, and that `nextStarGoal` returns one of them or `null` for
every input in `[undefined, null, -1, 0, 1, 2, 3, 4]`.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
Yes, and it is worth building: **a committed `tools/shoot.mjs`** — the CDP driver
I rewrote from scratch three times this session (once to probe hit-testing, once
to screenshot the aid, once to play a scripted round). It should take a URL, a
viewport, an optional cookie, a small script of clicks/keys, and dump a PNG plus
a JSON snapshot of chosen selectors' rects and text. Everything I know about this
project's bugs — the floating mountain, the clipped gear button, the clipped aid
card — was found by looking at pixels, and the tool for looking at pixels is
currently retyped every session and thrown away. A second, smaller win: a
`pre-push` hook running `node --test` and refusing a push whose
`git diff --diff-filter=D --name-only origin/main..HEAD` lists a file the commit
message does not mention.

### 6. What could the user have done differently to make this session smoother?
Two things, both about ordering. First, the star rules were changed **three
times** in three consecutive messages (drop the clock → 8/9/10 → 6/8/10), and
each change rippled into `roundPoints`, `THRESHOLDS`, four i18n strings, three
test files and two SPEC sections. Deciding the whole curve once — on paper, with
the point economy in view — would have collapsed three edit-verify cycles into
one. Second, "der branch ist schon gemerged" arrived *after* four commits had
already landed on the merged branch. Saying it at merge time (or letting me check
`gh pr list` first) would have avoided the rebase and the near-deletion of PR #9's
files. Neither is a criticism of the feedback itself — the 6/8/10 ladder is
better than what I built, and the merge was his to make.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
A **grown-up view** at `eltern.html`: a single screen, reachable from the gear
menu, that renders what the cookie already knows — which times-table facts are in
which Leitner box, as a 10×10 heat grid. No new state, no tracking, no server;
just a picture of "your child knows 7×8 and does not know 6×7". Children's
learning apps overwhelmingly show parents streaks and stars, which measure
engagement. Almost none show the *knowledge*, because almost none have it in a
form they can show. Schlaufuchs does: `boxesFromString()` already returns exactly
this array, and `storage.js` keeps it under the 3500-byte budget. It would take a
page, a grid, and no new architecture — and it would be the reason a parent
chooses this site over a polished commercial one.
