# Session Handoff — 2026-07-09 23:24

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-09_2324-usability-plan-from-playtest.md` and continue the work described there.

## Goal
Turn the findings of a live playtest — Martin's 8-year-old daughter Mara, who
reads almost nothing, got lost at nearly every UI seam — into a concrete,
executable usability-overhaul plan. This session PLANNED only; the next
session (intended to run on Opus) implements.

## State
- Repo: schlaufuchs, worktree `wt/claude1`, branch `big-cleanup`
  (up to date with origin), last commit `3eead76 add new prompts`.
- Uncommitted: `docs/PLAN.md` (new — the plan), `CLAUDE.md` (one edit: the
  "Where things live" section now points at `docs/PLAN.md` as the open plan).
  Both are this session's entire output; nothing else was touched.
- `node --test` is green (fail 0).
- **Done**: `docs/PLAN.md` written and approved by Martin (he approved via
  plan mode and explicitly said: do NOT start implementation yet, he wants to
  run it with Opus). Product decisions inside it were confirmed with him
  one by one.
- **In progress**: nothing.
- **Not started**: every implementation step in `docs/PLAN.md`.

## Key context
- **`docs/PLAN.md` is the deliverable and the authority for the next
  session.** It is self-contained: playtest findings, confirmed product
  decisions, verified pre-flight technical findings with file:line anchors,
  10 ordered steps (each keeps tests green), an i18n key ledger, and a
  visual-verification protocol. Line numbers were verified this session but
  will drift — the plan says to re-locate with grep.
- Product decisions Martin confirmed explicitly (do not re-litigate):
  1. Round summary = ONE random-congratulation button that starts the next
     round (map/level via topbar+chip).
  2. **Stars are the single currency** — Martin's own idea, replacing an
     earlier 💎 proposal: the weighted `pr` counter is *displayed* as stars
     (Leicht/Mittel/Schwer star = 1/2/3), album thresholds become "⭐ 62",
     "Punkte" leaves the UI. Cookie format unchanged.
  3. Wrong-answer feedback: wrong answer red + struck through, correct
     equation green, child must re-enter the correct answer to continue
     ("Verstanden" button removed).
  4. Fogged stub regions no longer navigate: fog wiggles + "Bald!" bubble,
     stays on the map.
- Non-obvious traps the plan already de-fuses (details in its "Pre-flight
  technical findings"): `tests/map.test.js:74-83` *prohibits* transparent hit
  rects and must be rewritten together with the code that adds them;
  `fogRegion()` must skip the new `.hit` rect; `overlay.js` needs an
  `initialFocus` option before the summary trophy becomes a link;
  `tools/play.js` + `tests/play.test.js` break on both the division-sign
  change and the removal of `#fb-next`; removing i18n keys (`gotIt`,
  `again`) is mandatory because the i18n test fails on unused keys.
- Branch warning: `big-cleanup` looks like a finished PR branch (see recent
  commits). Plan step 0 therefore starts with `gh pr list --state merged`
  and a fresh branch off `origin/main` — do not skip it, and note that
  `docs/PLAN.md` + the CLAUDE.md edit currently sit uncommitted on
  `big-cleanup` and must be carried onto the new branch (commit them first or
  bring them along; they are not on main).
- Commands: `sh tools/serve.sh` / `sh tools/kill-serve.sh`, `node --test`,
  `node tools/shoot.mjs --help`, `node tools/version-assets.js N` before
  deploy. Never `pkill http.server` (CLAUDE.md explains why).

## Next steps
1. Commit `docs/PLAN.md` + `CLAUDE.md` (message like "plan: usability
   overhaul from Mara's playtest"), then execute `docs/PLAN.md` step 0
   (branch hygiene) and continue through its steps 1–10 in order.
2. After step 10, run the plan's visual-verification protocol and attach the
   screenshots for Martin.
3. When done: archive `docs/PLAN.md` → `docs/PLAN_USABILITY.md`, update
   CLAUDE.md's pointer, bump asset version, PR.

## Reflection

### 1. What in the delivered work am I least confident is correct?
The six hit-rect coordinate sets in plan step 4 (e.g. einmaleins
118,358,124×122). I derived them from reading the SVG source, not from
rendering — I never screenshotted the map this session. They may overlap
roads or each other in ways that surprise. The plan flags them as "starting
coords, tune against screenshots"; the next agent must actually do that, and
specifically test a tap in the gap between the two Zahlendorf houses and near
the einmaleins/pokalraum border. Second doubt: step 9's claim that exactly
four i18n keys contain "Punkte/points" (`trophyNextIn`, `trophyNextIn1`,
`roomIntro`, `privacyCookieBody`) comes from the Plan subagent's grep — re-run
`grep -n "Punkt\|point" assets/i18n/*.js` before trusting it.

### 2. What assumptions did I make that I never stated explicitly?
(a) That Mara plays on a touch device — the fixes optimize tap affordances;
she actually tested in a desktop-browser mobile simulation, where hover
exists. If Martin's kids mostly play with a mouse, the label plates still
work but the priorities would shift. (b) That "Schwer 3x = 3 stars per star"
won't inflate the top-bar number in a way that feels wrong to a child who
remembers yesterday's count — the displayed total JUMPS on upgrade day
(weighted `pr` vs today's unweighted sum, e.g. ⭐20 could become ⭐45
overnight with no explanation). If that matters, the next agent should
mention it to Martin; no data migrates, only the label. (c) That
`sfx.correct()` is an acceptable "soft chime" for exiting the error card —
SPEC §8.1 wants wrong-answer flows gentle; if it sounds too celebratory,
audio.js may need a third sound.

### 3. What is the biggest thing the user may not realize about the broader situation?
One playtest with one child produced this plan, and the plan bakes several of
Martin's on-the-spot ideas into permanent UX. The cheap correction: re-test
with Mara (or a sibling) after step 4 + step 5 land, BEFORE steps 7–9, and be
ready to drop or adjust the rest. Also: the fog fix means four of six map
regions become dead-ends-with-a-bubble — the map gets honest but emptier;
shipping even one more real game changes the first impression more than any
affordance polish. And the GRAPHICS_BRIEF (102 SVG icons, unexecuted) would
address "houses don't look tappable" at the root — prettier, more
button-like art is complementary to the hit rects.

### 4. If this work breaks in 3 months, what's the most likely reason?
The star-currency unification (step 9). It deletes `gameStars`/`sumStars`/
`ACHIEVABLE` and re-bases `regionState`/`starBadgeTier` on `pr` vs
`MAX_POINTS`. `MAX_POINTS` is *provisional* for the four unbuilt games
(SPEC §8.3: `ACHIEVABLE × 2` at planning time — and ACHIEVABLE itself is
deleted, so the provisional numbers get frozen into MAX_POINTS). When a stub
game ships with a different real tile count, its badge tiers and region
states will be silently mis-scaled unless MAX_POINTS is recomputed — the
plan's SPEC edit should carry that warning forward, and a comment on
MAX_POINTS should say "recompute when the game ships".

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
A `tools/shoot.mjs` map-mode preset (seeded cookie states + fixed viewports +
elementFromPoint hit-test probes over a coordinate grid) would have let me
verify the six hit-rect candidates instead of deriving them from source —
that's the plan's least-certain part (Q1). Worth building as part of step 4:
a `--probe-hits` flag or a small `tools/hittest.js` eval script that samples
the map and reports which region each point resolves to. Everything else
(serve.sh, play.js, the test suite) already existed and worked.

### 6. What could the user have done differently to make this session smoother?
Very little — the playtest write-up was excellent: specific, behavioral,
honest about what Mara did rather than what she "should" have done, and
clearly separated observation from his own fix ideas. The one improvement:
screenshots or a screen recording of the moments she got stuck (especially
which exact spots she tapped on the map) would have replaced my inference
about dead zones with evidence, and would pin the hit-rect coordinates. Also
saying up front "I'll implement with Opus, plan only" would have shaped the
session slightly earlier, but it cost nothing this time.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
A one-tap "watch me play" replay for parents: record per-question events of
the last N rounds (question, answer given, latency, retry count) into a
ring buffer — sessionStorage or a capped cookie section if it fits the
budget — and render it in the parents' view as a timeline. Martin just spent
an evening shoulder-surfing to learn what the app couldn't tell him; the app
saw every tap. Even a 20-event buffer would turn every future playtest into
data he can read after bedtime, and it aligns with the existing
privacy stance (device-only, no server).
