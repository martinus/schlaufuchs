# Session Handoff — 2026-07-10 17:18

## Resume prompt
Paste this into a fresh session:
> Read `docs/handoff/2026-07-10_1718-round-leave-guard.md` and continue the work described there.

## Goal
Martin was playing Einmaleins on Android, swiped back from the screen edge by
accident, and lost the whole round. Stop the three gestures that can end an
unsaved round, and say so in the spec.

> **Written mid-session, then extended.** After the first draft, the reflection
> below was acted on: `tools/mutate.sh` (Q5) and `shoot.mjs --do back` (Q5, Q1)
> now exist, and the overlay coupling from Q4 is pinned by tests. Q1's doubt is
> narrower than it reads: the guard is now proven against Chrome's *own* history
> traversal, not just `history.back()`. Only the physical Android device is
> still untested.

## State
- Repo `schlaufuchs`, branch `round-guard`, branched from `origin/main`
  (`65c407a`). Two commits: `1a1ad4e play: a round survives the gestures that
  used to end it`, and a follow-up carrying the tooling.
- Assets bumped to **v43** (`node tools/version-assets.js 43`). The bump is in
  the feature commit rather than its own, because `cache.test.js` fails until
  the new module reaches every import map.

**Done**, and how it was verified:
- `overscroll-behavior: none` on `html, body` — closes pull-to-refresh, which
  reloaded the page and threw the round away. Guarded by a test that greps the
  `html, body` rule.
- `assets/js/leaveguard.js` — a history sentinel pushed at load and re-pushed
  on every `popstate`, so the Android back gesture lands inside the document.
  Its decision function `leaveAction({inRound, confirmOpen})` is pure and unit
  tested.
- The top bar's map button, one tap from the keypad, now goes through the same
  guard via a new `initTopBar({ onLeave })` hook. It stays a real `<a href>`.
- `docs/SPEC.md` §10.7 (new) and a cross-reference in §3.3.
- i18n: `leaveTitle/leaveBody/leaveStay/leaveGo` in `de.js` + `en.js`.
- CSS: `.ghost` (the quiet second button) and `.leaveask`.

`node --test`: **268 pass, 0 fail.** Every new test was verified to go red when
the behaviour it guards was removed (see "dead ends" for how that went wrong).

Six scenarios were driven in a real Chrome via `tools/shoot.mjs` + `play.js`,
each asserting through an `eval` step rather than by eye:

| scenario | result |
| --- | --- |
| swipe mid-round | sheet opens, page stays, focus on „Weiterspielen" |
| swipe again with the sheet up | sheet closes, question intact, still on the game page |
| swipe with the picker open (no round) | leaves to `/` with no dialog |
| tap the map button mid-round | asks |
| „Zur Karte" in the sheet | actually lands on the island |
| swipe on the summary (round already saved) | leaves to `/` |

Also re-shot `index.html`, `parents.html`, `album.html` and a stub game (all
load clean, `chrome.js` was touched) and the game page in Firefox (Gecko draws
the picker correctly; `overscroll-behavior` is inert visually).

Then, acting on the reflection below:
- `tools/mutate.sh` — mutate a file, run the tests, restore from a **copy**
  (never `git checkout`). Exits 1 on DECORATION (suite still green), 2 when the
  pattern matched nothing. Self-tested on all three paths. Documented in
  CLAUDE.md and SPEC §16.
- `shoot.mjs --do back` — walks Chrome's own navigation history via
  `Page.navigateToHistoryEntry`, the way the hardware button and the Android
  edge swipe do. **The guard was re-verified through it**: the sheet opens, the
  page stays, a second real back closes the sheet with the question intact.
- Two tests pinning what the leave sheet silently borrows from `overlay.js`:
  the safe answer is the first control in the markup, and the sheet is
  dismissible. Each was mutated and each went red alone.

`node --test`: **270 pass, 0 fail.**

**In progress:** nothing. The work is complete and committed.

**Not started:** the PR, and the sessionStorage resume from Q7.

## Key context

Files that matter:
- `assets/js/leaveguard.js` — new. Read its header comment first; it explains
  why the back gesture cannot be disabled and what the sentinel buys.
- `assets/js/chrome.js` — `initTopBar` gained `onLeave`, called only when
  `back !== null` (the map's own button is a flat `<span>`, not a link).
- `games/einmaleins/einmaleins.js` — builds the guard just above `initTopBar`;
  `inRound: () => session !== null && !roundOver` is the whole definition of
  "there is something to lose".
- `tests/leaveguard.test.js` — three unit tests on `leaveAction`, three
  source-grep regression tests for the wiring.

Decisions, and why:
- **The sentinel is never disarmed.** Disarming would mean calling
  `history.back()` when a round ends, which is async and races with a real back
  press. Instead the page keeps one sentinel forever and, when leaving is the
  right answer, navigates to the map itself with `location.href`. The cost is
  that this page's back stack is a fiction; the gain is that there is no window
  in which the sentinel is missing.
- **`overscroll-behavior-x` is not the fix for the back gesture**, though it is
  the answer the internet gives. It governs the browser's own overscroll
  navigation, not Android's system gesture. It is set here anyway (via the
  shorthand) because the site never scrolls sideways.
- **The safe answer takes the focus.** `overlay.js` focuses the first control,
  so `#lg-stay` is first in the markup.
- Zoom was deliberately **not** disabled: `user-scalable=no` is an a11y
  antipattern, Safari ignores it, and a stray zoom costs no stars.

Dead ends and traps:
- **Do not run `git checkout -- <file>` to undo a mutation test while your own
  edits to that file are uncommitted.** I did, and silently reverted my own
  work in `schlaufuchs.css` and `chrome.js`; meanwhile `leaveguard.js` was
  untracked so its checkout failed and *both* mutations stayed in. The
  mutation-test results were still valid (all six tests went red), but twenty
  minutes went into restoring the code. **Commit first, then mutate, then
  `git checkout`** — or mutate a copy.
- `tools/shoot.mjs --json` writes eval results under the key **`eval`**, not
  `evals`/`results`. Costs one confused run to discover.
- A `play({stopAt: n})` run leaves the round mid-question, which is exactly the
  state the guard cares about — that is why the scenarios use it.

Commands:
```sh
sh tools/serve.sh          # :8000, idempotent
node --test                # 268 tests, the only gate
sh tools/kill-serve.sh
```

## Next steps

1. **Ask Martin to swipe back mid-round on his actual Android phone** and say
   whether the „Runde verlassen?" sheet appears. This is the one claim the
   whole feature rests on and the one no emulator can settle (Q1).
2. If it does not appear: build the sessionStorage resume (Q7). It makes the
   gesture harmless rather than caught, and it is the better design regardless.
3. After merge: `gh pr list --state merged`, then branch fresh from
   `origin/main` before the next change. Do not keep committing on `round-guard`.

## Reflection

### 1. What in the delivered work am I least confident is correct?
That the history sentinel actually catches the **Android system back gesture on
a real phone**. It is now verified against Chrome's own history traversal
(`--do back` → `Page.navigateToHistoryEntry`), which is one level below
`history.back()` and is the path the hardware button takes — so the doubt is no
longer "does the page see a back?" but "does Android deliver one?". The
remaining risk is gesture-navigation mode (Android 10+), where a fast edge
swipe *may* be delivered as an app-level back that closes the tab before the
page sees anything. **Ask Martin to swipe mid-round on his phone.** If the sheet
does not appear, there is no web fix, and the honest fallback is the
sessionStorage resume in Q7 — which would have been the better answer anyway.

A second, smaller doubt: `location.href = target` fired from inside a `popstate`
handler. Chrome accepted it in all six runs. Some browsers historically treated
a navigation during history traversal as reentrant; if it misbehaves, defer it
with `setTimeout(..., 0)`.

### 2. What assumptions did I make that I never stated explicitly?
- **That `session !== null && !roundOver` is exactly the window worth
  protecting.** If a future game writes partial progress mid-round, this
  predicate becomes wrong in the safe direction (it would ask when nothing is
  at stake). Harmless, but it would start nagging.
- **That the map is always where a back gesture should go.** I hardcoded
  `mapUrl` as the destination for an unanswered swipe rather than honouring
  real history. If a child reaches the game from the Pokalraum, back now takes
  her to the island instead of the room she came from. I judged this an
  improvement; nobody confirmed it.
- **That `bar.querySelector("a.iconbtn")` is the map button.** It is the first
  anchor with that class in the top bar, and today the bar has exactly one. A
  second `a.iconbtn` added left of it would silently steal the guard. The test
  pins the selector but cannot pin the intent.
- **That the guard should be Einmaleins-only.** The four stub games have
  nothing to lose, so they do not build one. When `tippen` or `rechnungen`
  ships with an unsaved round, whoever writes it must remember §10.7 exists.

### 3. What is the biggest thing the user may not realize about the broader situation?
The round is not the only thing that lives in one place with no backup — **the
entire progress of the site is a single cookie on one device**. A cleared
browser, a new phone, or Chrome's own storage eviction under pressure takes
every star and every trophy with it, permanently and silently. This session
made a round survive a swipe; nothing makes a year of rounds survive a cache
clear. That is a deliberate privacy decision (§9, and the privacy page says so
proudly), and it is the right default — but the failure mode has never been
softened. An export/import of the cookie as a file, or even a printed code, is
a few hours of work and is the difference between "we store nothing about your
child" and "we lost your child's trophies".

Related and cheaper: the cookie has a **3500-byte hard budget** and writes over
it are *refused*. Four unbuilt games will each want state in there.

### 4. If this work breaks in 3 months, what's the most likely reason?
A neighbouring change to `overlay.js`. The guard leans on three of its
behaviours: that `createOverlay` appends a *dismissible* sheet, that Escape
closes the **topmost** one (so the leave sheet, opened over the picker, is what
Escape answers), and that `open()` focuses the **first** focusable control
(which is why `#lg-stay` is first in the markup and therefore the safe default).

Two of the three are now pinned from this side (`tests/leaveguard.test.js`
asserts the markup order and the dismissibility), and `tests/overlay.test.js`
holds the other end. **The unguarded one is Escape-closes-the-topmost.** If
someone makes Escape close the *bottom* overlay, or all of them, a child who
presses it with the leave sheet over the picker gets something other than
„Weiterspielen", and every test still passes. Worth a test the day anyone
touches `topmost()`.

The second candidate is the version bump: edit `leaveguard.js` without running
`node tools/version-assets.js` and a browser can pair a cached v43 module with
a fresh page. `cache.test.js` catches a *new* module, not a changed one — the
bump ritual is what catches this, and nothing enforces it.

### 5. Were there any tools, scripts, or hooks that would have reduced my churn this session if they had existed when we started?
Two. **Both were built before the session ended**; this entry records why.

**`tools/mutate.sh`** — the "break it and watch it fail" rule in CLAUDE.md is
right, and the mechanics of obeying it by hand are dangerous. Undoing a mutation
with `git checkout -- <file>` reverts to HEAD, so it silently ate my own
uncommitted edits to `schlaufuchs.css` and `chrome.js`; and it *fails* on an
untracked file, so `leaveguard.js` quietly kept both mutations I had applied to
it. One command, two opposite failures, twenty minutes to notice. The script
restores from a copy taken before the mutation, on every exit path including
Ctrl-C, and it exits 2 when the pattern matched nothing — the other silent lie,
where the code was never broken and the green suite means nothing.

**`shoot.mjs --do back`** — I had been simulating the swipe with
`eval history.back()`, which tests what the *page* thinks a back is, and the
page is precisely the thing under test. `Page.navigateToHistoryEntry` walks
Chrome's own history the way the hardware button does. Re-running the scenarios
through it is what moved Q1 from "unverified" to "verified everywhere except a
physical phone".

### 6. What could the user have done differently to make this session smoother?
Very little — the report was unusually good: a concrete action ("swiped left"),
a concrete platform ("Android"), a concrete loss ("Progress im Spiel"), and the
right follow-up question ("gibt es noch andere Sachen?"), which is what turned a
one-gesture fix into finding pull-to-refresh and the map button.

The one thing that would help: **say which browser.** Chrome, Firefox and
Samsung Internet differ in exactly this area — whether the gesture is delivered
as a history back at all — and I guessed Chrome. And when the bug is a gesture,
the fastest possible loop is Martin swiping on the real phone against a
`sh tools/serve.sh` exposed on the LAN. I could not close that loop, so Q1's
doubt remains open when it need not have.

### 7. If I could add one unrequested, industry-leading feature, what would it be?
**Resume the round instead of guarding it.** Mirror the round's state into
`sessionStorage` after every answer — question index, boxes, times, missed ids —
and rehydrate on load. Then the swipe is not a threat to be caught but simply
harmless: the child comes back and the fox is standing where she left it, the
question still on screen. No dialog, no decision, nothing to explain to a
seven-year-old. It also covers the cases the guard cannot: an incoming call, a
tab evicted under memory pressure, a phone that dies.

That is the version of this feature a child would never notice, which is the
right standard for a children's game — a confirmation sheet is an adult's
solution to an adult's model of the problem. It is maybe half a day: the round
state is already a handful of plain values in `einmaleins.js`, and `adaptive.js`
already knows how to serialise boxes. The guard stays underneath as the answer
for a *deliberate* exit.
