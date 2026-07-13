# Session Handoff — 2026-07-13 11:42

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-13_1142-rechenberg-playtests-and-infra.md` and continue the work described there.

## Goal
Ship the Rechenberg (rechnungen) redesign built around Martin's daughter's
2nd-grade workbook, iterate it through his phone play-tests, and fix the
merge/deploy friction the project had accumulated. Everything landed; the
session ended with a string of map/UI polish requests, all deployed.

## State
- Repo `martinus/schlaufuchs`, everything merged to `main` (last commit
  `69ec3b4 map: the label plate holds the badge row too (#74)`), deployed and
  live at https://schlaufuchs.ankerl.com with a green test→deploy→smoke run.
- The local checkout sits on the STALE branch `rechnungen-workbook` (its
  content is on main via PR #63, SHAs differ — rebase-merge). Working tree
  clean. Start any new work with `git checkout -b <new> origin/main`.
- `git stash list` holds one FOREIGN entry (`WIP on lesen-comprehension`)
  from another session — do not drop it, it is not ours.
- Local `node --test` on this stale branch reports 384 (older state); main's
  suite is 389, verified green in CI on every merged PR.

**Done this session** (each verified with driven rounds via
`tools/play*.js`, screenshots read at 360×640/390×844, `node --test`,
`sh tools/smoke.sh`, and post-merge deploy watching):
- Rechenberg redesign shipped (PRs #62→#63; #58 and #62 closed as superseded):
  task/cell model on one keypad, six tiles ＋ − ÷R 🧱 ⊞ 🎲, all within 100,
  108-point economy, ladder `[3,8,14,…,74]`.
- Nine play-test rounds folded in, each its own commit on main: free brick
  choice + blue own-numbers; no duplicate numbers in walls/grids; journey
  stretched to constant width; every asked task is its own waypoint (red node
  + path grows via `journey.advanceMissed()`, all three games); star groups
  land at most one per waypoint; `starNeeds()` spreads thresholds on short
  rounds; first slip forgiven on multi-cell tasks; chains cut; ×/÷ tile became
  ÷R (division with remainder only — no einmaleins overlap, pinned); Zerlegen
  scaffold cut (strategy lives on in the ± aid card), Schwer ± = gaps +
  Ergänzen.
- Summary redesign: star GROUPS (`starSlotsHTML` in journey.js) instead of
  "8/8 +6 ⭐"; goal line removed entirely; `roundStat`/`starGoal*` i18n keys
  and `nextStarGoal`/`starGoalNeed` deleted with their feature.
- Merge/deploy infra: "Protect main" ruleset now allows squash+rebase (was
  rebase-only — that's why #62 needed linearized #63); auto-delete branches ON;
  the asset version is stamped AT DEPLOY TIME (deploy.yml, commit count; repo
  stays `?v=dev`; tests/cache.test.js pins it) so PRs no longer conflict.
- Three real smoke-tool flakes root-fixed (cold Chrome port wait + one smoke
  retry; ff-probe mid-navigation None; ff-probe cleanup race) — all pinned in
  tests/shoot.test.js. The live site was healthy in every red run.
- Map/album polish: shelf headings are just the region name; bare 🎲 faces
  everywhere; drawn pyramid glyph for the wall tile; region badges say
  "⭐ N 🏆 M" (fox-chip grammar, greyed cup at 0) and sit INSIDE the label
  plaque (`ensurePlate` unions label+badge bboxes).

**In progress** — nothing. No open PRs, no unfinished threads.

**Not started** — the two stub games (`tippen`, `vokabeln`); the offline/
service-worker idea (SPEC M7); the graphics brief (`AVAILABLE` still empty).

## Key context
- `games/rechnungen/{logic,rechnungen,picker,i18n}.js` — the game. logic.js is
  pure and heavily tested (`tests/rechnungen.test.js`); BUCKETS is append-only
  NOW that the game is live (the wholesale rewrites this session were legal
  only because it hadn't shipped).
- `assets/js/journey.js` — shared scene: `advanceMissed()` (red waypoint +
  path growth), `starSlotsHTML()` (summary groups), landing throttle
  (`want`/`land`), `sceneGeometry` keeps ten-node width on short rounds.
- `.github/workflows/deploy.yml` — stamps `version-assets.js
  "$(git rev-list --count HEAD)"` before assembling; smoke refuses `v=dev`
  live. NEVER hand-bump; after adding a module/page run
  `node tools/version-assets.js dev`.
- Drivers `tools/play-rechnungen.js` (`resolveMauer`/`resolveQuad`, clicks
  blanks like a child, `slipAt`/`stopKind` options), plus play.js/play-lesen.js
  — their `readSummary` now counts `.sslot.owned/.fresh` (no score element).
- Decisions & reasons live in commit messages and SPEC §10/§12 — both were
  kept current each round; trust them over memory.
- Dead ends: rebase-merging a branch containing origin/main merge commits
  (GitHub refuses; squash now allowed instead); `git restore .` to undo a
  simulated version stamp (ate all uncommitted work once — undo with
  `node tools/version-assets.js dev`); showing the latest trophy's ITEM emoji
  on the map (read as decoration; the 🏆-count grammar replaced it);
  worth-clusters as single stars (Martin wanted the groups kept, only their
  landing spread out).
- Commands: `sh tools/serve.sh` / `kill-serve.sh`, `node --test`,
  `sh tools/smoke.sh`, `sh tools/mutate.sh <file> <perl> [tests]`,
  `node tools/shoot.mjs … --do 'eval @tools/play-rechnungen.js' --do 'eval
  playRechnung({…})'`. Merge flow: branch from origin/main → PR → CI →
  `gh pr merge N --squash` → `gh run watch` the deploy.

## Next steps
1. Nothing is owed. If Martin sends the next play-test screenshot, branch from
   `origin/main`, fix, verify with the drivers + screenshots, PR, squash-merge,
   watch the deploy — the loop used ~12 times this session.
2. Worth proposing when idle: the offline service worker (SPEC M7, ~20 lines,
   big parent-facing win) — pitched once, never scheduled.
3. If a deploy smoke goes red again: check the live site FIRST (it was healthy
   all three times), then read `gh run view <id> --log` — remaining flake
   causes should be new ones; fix at the root and pin, as tests/shoot.test.js
   models.

## Reflection

### 1. What in the delivered work am I least confident is correct?
The summary star-group SVGs (`starSlotsHTML`) size emoji glyphs by font-size
inside a hand-tuned viewBox (`4 6 56 50`); I verified Chrome at two viewports
and Firefox only via smoke (loads, no layout probe). A Gecko emoji-metric
difference could clip the top star of a ×3 group. Check:
`sh tools/firefox-shot.sh` a finished round's summary and look at the groups.
Second: the map plate union reads `badge.transform.baseVal.consolidate()` —
fine in both engines today, but it assumes the badge transform stays a single
translate in index.html.

### 2. What assumptions did I make that I never stated explicitly?
(a) That "Schwer" on the Rechenberg targets Martin's 8-year-old (2nd grade) —
the whole ≤100 redesign rests on it; if he also wants it to serve his older
kids, Schwer now has no headroom. (b) That `git rev-list --count HEAD` only
grows — true for merges, but a history rewrite/shallow mirror of main would
break version monotonicity silently (the smoke only checks ≠dev, not order).
(c) That Marionette stays protocol 3 on the runner's Firefox — ff-probe
asserts it, so drift fails loudly, but nobody is watching for the
deprecation.

### 3. What is the biggest thing the user may not realize about the broader situation?
The balance numbers his daughter will actually feel (TEMPO_TIERS, the
first-slip forgiveness, round sizes, ladder rungs) were tuned by an adult and
a robot driver. Every constant carries a "retune after a real child" comment —
one afternoon of watching her play is worth more than the next three polish
PRs, and nothing in the repo schedules that.

### 4. If this work breaks in 3 months, what's the most likely reason?
A new game (tippen/vokabeln) built by copying einmaleins instead of working
through docs/NEW_GAME.md: the summary now REQUIRES `starSlotsHTML` and no
score line (scene.test pins it repo-wide), the journey contract requires
`advanceMissed()` on aided completion, and the drivers' readers assume
`.sslot` markup. A copy of an old game body violates three pins at once —
which is fine (tests go red) but will confuse whoever didn't read the
checklist. Second candidate: GitHub runner image changes shifting
Chrome/Firefox launch behavior past the new 20s/retry budgets.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session?
A `tools/pr.sh` that does branch-push-PR-wait-squash-watch-deploy in one
command: I hand-rolled that loop ~12 times, each with the same 15s-polling
boilerplate, and typo'd the session URL into two PR bodies doing it. Worth
building now (it's ~40 lines of gh calls). Smaller: a screenshot helper that
waits 900ms for the slot-pop animation before shooting — I rediscovered that
delay three times.

### 6. What could the user have done differently to make this session smoother?
Batch the play-test feedback: rounds 3–5 (star groups, thresholds, landing)
were three corrections to one feature because each message described the
symptom of the previous fix rather than the desired end state ("pro Wegpunkt
maximal eine Sternengruppe" round 3 vs "nimm die Prozentregeln nicht so genau"
round 4). One message with the intended behavior — "groups stay, at most one
per waypoint, loosen thresholds if needed" — would have been one PR instead of
three. That said, the fast single-issue loop also caught things a batch
review would have missed.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
The offline service worker (SPEC M7) — but framed as what it really is: a
"works on the school tablet / on the train / in the dead zone" guarantee.
The site is fully static with one cookie; ~20 lines of SW make it installable
and offline-first. Almost no commercial kids' learning product can do this
because their business model needs the network — for parents choosing what
goes on a child's tablet, it's a headline differentiator, not polish.
