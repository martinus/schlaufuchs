# Schlaufuchs — Specification

**Spielerisch lernen und ein Schlaufuchs werden.**

Schlaufuchs is a collection of educational browser games for children, framed
as a small illustrated world: the landing page is a **map**, each game is a
**region** on it, and the fox mascot travels through it as the child learns.
The site is fully static, hosted on GitHub Pages under
**https://schlaufuchs.ankerl.com**. All state (progress, trophies, settings)
is stored client-side in a cookie — no backend, no login, no data ever leaves
the browser.

> **How to use this document (for the implementing agent):** this spec is the
> single source of truth. All design decisions are already made — including
> the ones listed in §18 — so do not invent alternatives, add frameworks, or
> introduce build tooling. Where the spec gives pseudocode, data shapes,
> thresholds, or file paths, implement them exactly. Where something small is
> genuinely unspecified, choose the simplest option consistent with §1 and
> note it in the commit message. Build in the milestone order of §19; each
> milestone has acceptance criteria that must pass before moving on.

---

## 1. Goals

- **Kid-friendly**: playable by children aged 5–12 without adult help. Large
  touch targets, minimal text, immediate feedback, encouraging tone.
- **A world, not a menu**: the landing page is an illustrated map (§3.1);
  in-game progress is a journey (fox walks a path, climbs a mountain) rather
  than an abstract progress bar (§8.2).
- **Radically simple navigation**: starting or switching a game takes at most
  **two taps from anywhere** (§3.4). The map never slows this down: regions
  are tapped, never walked to.
- **Mobile first**: designed for a phone in portrait, scaled up to tablet and
  desktop (§5.1).
- **Really teaches something**: every game has explicit difficulty levels and
  a shared adaptive engine that detects what the child struggles with and
  practices exactly that more often (§7).
- **Really motivates, never punishes**: journeys, stars, trophies, streaks,
  a site-wide fox level (§8). A wrong answer never costs anything.
- **Translatable**: every page ships in **German and English** from string
  dictionaries; adding a language means adding files, not HTML (§6).
- **Zero infrastructure**: static HTML/CSS/JS, no build step; `python -m
  http.server` in the repo root must serve a fully working site.
- **Privacy by design**: no accounts, no analytics, no external requests at
  runtime.

### Non-goals

- No multiplayer, leaderboards, or server-side anything.
- No cross-device sync (state is per browser).
- No build pipeline, no frameworks, no TypeScript. Vanilla JS ES modules.
- No real-time character movement (no joysticks, no collision, no sprites
  walking under player control). The world is tapped, not steered — this is
  a deliberate scope decision, see §18.1.

---

## 2. Hosting & Deployment

| Item | Value |
|---|---|
| Host | GitHub Pages, project site from this repository |
| Source | **GitHub Actions** (`.github/workflows/deploy.yml`) |
| Domain | `schlaufuchs.ankerl.com` |
| HTTPS | Enforced via GitHub Pages settings |

Deployment is done by a workflow, not by publishing the branch directly:
on every push to `main`, `deploy.yml` runs the unit tests and — only if they
pass — assembles a curated `_site/` artifact containing **site files only**
(every root `*.html`, `CNAME`, `assets/`, `games/`) and deploys it via
`actions/deploy-pages`. Development files (`docs/`, `README.md`, `tests/`,
`tools/`, `package.json`, `.github/`) are never published. Root pages are
copied by glob, so a new one cannot be perfect on localhost and 404 in
production; `tests/cache.test.js` guards the glob.

Setup steps:

1. In the repository settings, set GitHub Pages **Source: GitHub Actions**.
2. In the DNS zone for `ankerl.com`, add a `CNAME` record:
   `schlaufuchs` → `martinus.github.io`.
3. Set the custom domain `schlaufuchs.ankerl.com` in the Pages settings and
   turn on *Enforce HTTPS* once the certificate is provisioned. (The `CNAME`
   file is also copied into the artifact, which keeps the domain stable.)

The site must also work when served from a subpath
(`https://martinus.github.io/schlaufuchs/`). Therefore: **only relative URLs**
in HTML/CSS/JS — never absolute paths like `/assets/...`.

---

## 3. Site Structure, World Map & Navigation

```
/
├── CNAME                     # schlaufuchs.ankerl.com
├── index.html                # World map (landing page), §3.1
├── album.html                # Pokalraum / Trophy Room, §3.2
├── assets/
│   ├── css/
│   │   └── schlaufuchs.css   # Shared design system (mobile first)
│   ├── i18n/
│   │   ├── de.js             # Shared UI strings, German
│   │   └── en.js             # Shared UI strings, English
│   ├── js/
│   │   ├── storage.js        # Cookie-backed state store (§9)
│   │   ├── i18n.js           # Translation runtime (§6)
│   │   ├── adaptive.js       # Weakness-tracking practice engine (§7)
│   │   ├── rewards.js        # Stars, trophies, streak, fox level (§8)
│   │   ├── journey.js        # Journey path strip used inside rounds (§8.2)
│   │   ├── audio.js          # Feedback sounds (WebAudio, no asset files)
│   │   └── confetti.js       # Celebration effect
│   └── img/
│       ├── fuchs.svg         # Mascot: poses (§15)
│       └── favicon.svg
├── games/
│   ├── einmaleins/           # §10  index.html, einmaleins.js, i18n.js
│   ├── tippen/               # §11  + levels.js
│   ├── rechnungen/           # §12
│   ├── vokabeln/             # §13  + packs.js
│   └── lesen/                # §14  + content.js
└── tests/                    # node --test unit tests (§16)
```

### 3.1 The world map (`index.html`)

The landing page is a single **inline SVG map** in portrait orientation
(viewBox `0 0 360 560`, scaling to the viewport width). The world is drawn
as an **island**: sea, a sandy coastline, land, a compass rose, and dashed
roads linking the regions from the village crossroads. It shows five themed
regions; **each region is one big tap target that immediately launches its
game** (instant resume, §3.4) — there is no walking and no intermediate page.

| Region (DE / EN) | Game | Visual anchor |
|---|---|---|
| Zahlendorf / Number Village | Einmaleins | village with a school bell |
| Rechenberg / Math Mountain | Rechnungen | mountain with a summit |
| Wörterwald / Word Forest | Vokabeln | forest with animals |
| Tippsee / Typing Lake | Tippen | lake with a boathouse |
| Lesewiese / Reading Meadow | Lesen | meadow with a giant book-tree |
| Pokalraum / Trophy Room | (the collection) | trophy hall, bottom-right |

The **Pokalraum** is a sixth region that links to the collection
(`album.html` — the filename is kept for URL stability) instead of a game; its badge shows the total number of trophies
collected across all games and it evolves (thriving ≥ 20, mastered = 60).

Map requirements:

- Each region is an SVG `<a>` group (real link, keyboard-focusable,
  `aria-label` = translated game name) with a tap target ≥ 64×64 px, a
  translated name label, and a small `region-badge` group showing that game's
  star count. The badge has three tiers via CSS class: `badge-t1` (plain),
  `badge-t2` (gold, ≥ ⅓ of achievable), `badge-t3` (glowing gold, 100 %).
- **The fox stands on the region that was last played** (`rewards.at`,
  §9.2); first visit: at Zahlendorf. Position = fixed anchor coordinates per
  region, defined in the SVG.
- **Regions visibly evolve with mastery.** Each region has 3 visual states as
  toggled SVG layers: *base* → *thriving* (≥ ⅓ of the game's achievable stars,
  per difficulty currently reachable) → *mastered* (100 %): flag on the
  summit, more animals in the forest, lanterns in the village, etc. The state
  is computed by `rewards.js` on load; layers are shown/hidden by CSS class.
- Header strip above the map (shared with the game pages, §3.3): the fox chip
  (fox, total stars, total trophies — §8.4) and a settings gear. Sound and
  language toggles live inside the gear overlay; the Pokalraum is reached via
  its own region on the map, so there is no separate header button for it.
- Below the map, a `<nav>` with the game links (and the Pokalraum). It is
  **visually hidden and revealed on focus**: the map already offers every
  destination, so the list exists for keyboard and screen-reader users and
  as the robustness fallback if SVG fails. A visible copy cost a screenful
  and pushed the page past `100dvh`.
- **The island remembers.** A mastered region's road from the village paves
  itself: dirt track (sand + dashed centre line) → cobblestone in `--depth`.
  Zahlendorf is the crossroads and has no road of its own, so mastering it
  cobbles the village square instead. The Trophy Room road paves at 20
  trophies. See `.road` / `.roadline` / `.plaza` and `pave()` in `map.js`.
- **Unbuilt games sit under fog.** A region whose game is a stub is veiled by
  code-generated mist (`fogRegion()` in `map.js`, driven by `PLAYABLE` in
  `rewards.js`), so the island never promises what the site cannot deliver.
  The link stays — its page says "coming soon" in words, and the region's
  `aria-label` carries `lockedHint` for screen readers. Two invariants: the
  fog is `pointer-events: none` (the map is hit-tested by its art, and a blob
  over the bounding box would restore the invisible hotspot), and **playable
  regions are painted last** in the SVG, because fog drawn later would grey
  out the label of the one village a child can walk into.
- Footer: „Deine Fortschritte werden nur auf diesem Gerät gespeichert."
  The global reset lives in the settings overlay only — a second copy in the
  footer said the same thing twice.
- Map art style: flat, friendly, geometric SVG shapes (no raster images, no
  external assets). A simple first version (colored shapes + emoji accents)
  ships in M1 and is refined later; the region tap behavior and state layers
  are required from M1.

### 3.2 The Pokalraum / Trophy Room (`album.html`)

**The page is named after the place on the map**, not after its contents —
one place, one name (it reuses the `region_pokalraum` string). It is styled as
a room: a warm wall, and a wooden shelf under each game's collection.

One page, five sections (one per region, translated heading). Each section
shows **12 trophy slots** in a grid: earned trophies as large emoji with a
name caption; unearned slots as **silhouettes** of the trophy you have not
won yet — you can see what is missing, which is the whole reason to keep
collecting. Earned count per region, and the size of the whole collection
beside the room's heading. An intro line (`roomIntro`) says what the room is
and how to fill it, and each section shows how many perfect rounds remain until
its next trophy. Trophies are earned via perfect rounds (§8.3). Reached from
the map via the **Pokalraum** region (§3.1).

The room carries the same top bar as every other page (§3.3), gear included —
its settings offer no reset, because the global one belongs on the map. The
shelves are built as markup, not as `[data-i18n]` nodes, so a language change
rebuilds them instead of translating them in place.

### 3.3 The top bar (every page)

One bar, one function: `initTopBar()` in `chrome.js` fills the page's empty
`<header id="topbar">`. No page writes the bar as markup — seven copies drifted
apart once, and only a screenshot noticed. It is width-matched to the 560px
game column (`max-width:560px; margin-inline:auto`) so it aligns on desktop
instead of spanning the full viewport.

The bar has exactly two shapes:

- **The child's bar** (map, Pokalraum, games, stubs): map button · fox chip ·
  gear. Three things, in the same order, always.
- **The reader's bar** (privacy, about, parents): map button · page title. No
  star count, no settings — these pages are for adults.

- **Map button (🗺️)** → back to the map (1 tap). The map icon, not the fox
  — the fox is the player, the map is the place to go back to. On the map
  itself it stays, flat and unpressable: a bar whose shape shifts between the
  map and the place it sends you is two bars.
- **Fox chip** (`renderFoxChip`): the fox, the total star count, the total
  trophy count. It is a readout, not a control: no panel, no shadow, no tap
  target.
- **Level/difficulty chip** (inside a game, below the bar) showing the current
  difficulty and table; tapping opens the picker **as an overlay** on the same
  page, never a separate page.
- **Settings gear** → shared overlay (`initSettingsOverlay`, `chrome.js`):
  sound toggle, language toggle, and reset (global on the map, per-game inside
  a game; two-step confirm on the destructive action).

Round summaries are overlays too. The browser back button always means
"back to the map".

**Every overlay obeys one contract** (`overlay.js`): the focus moves into the
sheet on open and back to the button that opened it on close; Escape and a
backdrop tap close it — *unless* it is the round summary, which a child must
not be able to dismiss into an empty finished round. While any overlay is
open, it owns the keyboard: the game behind it must not receive a keystroke.

### 3.4 Navigation rules (hard requirements)

| From | To | Taps |
|---|---|---|
| Map | playing a game (resumed) | **1** |
| Inside game A | playing game B | **2** (home → region) |
| Inside a game | different difficulty/level | **2** (chip → pick) |
| Map | trophy album | **1** |

- **Instant resume**: tapping a region drops the player directly into a
  running round at their last difficulty/level/table/pack. First visit
  starts the easiest difficulty immediately.
- No confirmation dialogs on the happy path (only destructive resets).
- Round summary has one primary button („Nochmal!" / "Again!") so replaying
  is a single tap, plus a secondary row with map, level/table picker and
  settings buttons — the summary must never be a dead end.

### 3.5 The privacy page (`privacy.html`)

A plain bilingual text page, and the **only** page allowed to scroll: a legal
text that hides half its sentences is worse than one that scrolls.

- **Reachable from everywhere.** The settings overlay carries the link, which
  covers the map, the games and the stubs. The Trophy Room has no gear, so it
  and the map also carry a footer link. `tests/privacy.test.js` enforces that
  every page has one of the two.
- The URL is resolved from `chrome.js`'s own `import.meta.url`. An absolute
  `/privacy.html` would break a subpath deploy.
- **What it says must stay true.** Today: one cookie (`schlaufuchs`, one year,
  progress + settings), strictly necessary for a service the child asked for —
  which is exactly why the site shows no consent banner. No analytics, no
  third-party requests, no external fonts. GitHub Pages serves the files and
  therefore sees connection data (IP), which we never receive.
- **Adding analytics changes this.** Anything that stores or reads an
  identifier on the device needs prior opt-in consent (ePrivacy; AT §165(3)
  TKG 2021, DE §25 TDDDG) and would put a banner in front of a five-year-old.
  Worse, GDPR Art. 8 makes a child's own consent invalid below 16 (14 in AT),
  and this site's audience is 5–15. Cookieless, aggregate audience measurement
  is the only kind that fits here. If it is ever added, this page must say so.


### 3.6 The about page (`about.html`)

Who runs the site, how to reach him, and what else he built. A plain bilingual
text page like §3.5, and reachable from everywhere by the same rule: the gear
covers the map, the games and the stubs; the Trophy Room and the three text
pages carry links. `tests/about.test.js` enforces that **no page is a dead end**
— it found `parents.html` had become one.

- The contact address is a real `mailto:`, published deliberately.
- Four outbound links (keto-calculator, the blog, GitHub, the portal). They are
  the only external URLs the site names anywhere. A test holds them to `https:`
  and to being absolute; nothing else can check that they still resolve.
- It reads no state. A page that says who runs the site must not need the
  cookie to render.

---

## 4. (reserved)

Section intentionally unused to keep numbering stable across revisions.

---

## 5. Tech Stack & Conventions

- **HTML5 + modern CSS + vanilla ES modules.** No framework, no bundler, no
  TypeScript. Target evergreen browsers (last 2 years).
- Games import shared modules from `assets/js/` via relative `import`.
- Accessibility baseline: semantic HTML, visible focus states, contrast
  ≥ 4.5:1, keyboard reachability, `prefers-reduced-motion` respected.
- Sounds via WebAudio (synthesized, no audio files), persisted mute toggle.
  Speech output (Lesen, Vokabeln) via the browser **SpeechSynthesis API**
  with the voice matching the active language. iOS Safari requires a user
  gesture before speech — always trigger speech from tap handlers.

### 5.1a Graphics registry (`assets/js/graphics.js`)

All icon-like graphics (UI glyphs, region symbols, map decorations, journey
obstacles/goals, trophies) go through one registry so they are swappable
without touching the call sites.

- `GRAPHICS` maps a stable name → `{ emoji }`. The emoji is always the
  fallback. Trophy names (`trophy-<game>-<n>`, 60 total) are generated from
  the `TROPHIES` table in `rewards.js`.
- A name renders as an SVG file (`assets/img/icons/<name>.svg`, viewBox
  `0 0 64 64`) **only if listed in the `AVAILABLE` set** — otherwise the emoji
  shows. No runtime probing, no 404s. Swapping in real graphics = drop the
  files and add the names to `AVAILABLE`.
- API: `iconHTML(name, {size})` (inline HTML), `iconSVG(name, {x,y,size,...})`
  (markup inside an `<svg>`), `applyIcons(root)` (upgrade every `[data-icon]`
  element to its SVG when available). Static markup keeps the emoji as the
  `[data-icon]` element's content so pages render correctly with an empty
  `AVAILABLE` set. URLs resolve via `import.meta.url` (subpath-safe; never
  emit absolute `/assets/...` paths).
- **Not** in the registry: the fox mascot (`fox.js`, code-generated) and the
  hand-drawn map scenery polygons in `index.html`. See `GRAPHICS_BRIEF.md`.

### 5.1 Mobile first

- CSS baseline targets a **360 px-wide portrait phone**; wider layouts only
  via `min-width` media queries.

  **360 is a current number, not a legacy one.** These are CSS pixels, not
  hardware pixels: a Samsung Galaxy A- or S-series phone has a 1080 px panel
  and reports **360 × 800** to the browser, which makes 360 the single most
  common width on Android today. The narrowest current iPhone (SE 3) reports
  375. Raising the baseline to 375 or 390 would drop exactly the phones this
  audience is most likely to hold. Below 360 there is essentially only the
  first-generation iPhone SE (320), stranded on iOS 15.

  **The 640 in the `360×640` test size is not a device height.** No current
  phone is that short. It stands for the *visible* height of a 360 px-wide
  phone once the browser's own chrome is on screen: Chrome for Android's
  address bar takes ~100–130 px of an 800 px viewport, and iOS Safari adds its
  bars plus `env(safe-area-inset-bottom)`. Testing at 640 is therefore a
  deliberately pessimistic stand-in for a modern phone, not a museum piece.
  Do not "modernise" it away.

  Measured 2026-07-09 with `tools/shoot.mjs`: the Einmaleins screen never
  scrolls and its OK key never leaves the viewport at 320×568, 360×568/600/
  640/700/740/800, 375×667, 390×844 or 412×915, and the tallest state — the
  ten-row dot-grid aid on the 10× table — clears both edges of `.stage` at
  every one of them (29 px of headroom even at 320×568). Nothing in the layout
  is pinned to a height: `.stage` is a flex child, the question uses
  `clamp(2.6rem, 19vw, 5rem)` and the dots `clamp(5px, 1.05vh, 9px)`.
  A zero gap between `.stage` and the keypad is that flexbox at rest, **not**
  an overflow — do not read it as one.
- Touch targets ≥ 48×48 px; primary game actions in the lower half of the
  screen (thumb reach).
- Answer input via large on-screen keypads/answer buttons; the OS keyboard
  is used only where typing *is* the exercise (Tippen; Vokabeln „Schreiben").
- Game screens fit `100dvh` without scrolling; overlays cause no layout
  shift.
- The typing trainer requires a physical keyboard and shows a friendly
  translated hint on touch-only devices.

---

## 6. Internationalization (DE + EN)

One HTML page per game serves all languages; translation happens at load time
from string dictionaries.

### 6.1 Mechanics

- Shared UI strings: `assets/i18n/de.js` / `en.js`. Game-specific strings:
  `games/<name>/i18n.js` containing **one object per language in the same
  file** (missing translations are visible in review).
- Static HTML text carries `data-i18n="key"` attributes, replaced on load;
  dynamic text goes through `t(key, params)`.
- **Templates, not concatenation**: `t('roundDone', {ok: 9, total: 10})` with
  `"roundDone": "{ok} von {total} richtig!"`. Never glue sentence fragments.
- Language selection order: `?lang=` URL parameter (persisted once seen) →
  saved setting (cookie) → `navigator.language` prefix match → `de`.
- The header toggle switches instantly: re-translate in place, update
  `<html lang>`, persist.
- Fallback chain: missing key → the default language (first entry of
  `LANGUAGES`) → the key itself.
- **`LANGUAGES` in `i18n.js` is the single declaration of a language**: code,
  display name, and a graphics-registry flag name. Adding Spanish means writing
  `es.js`, importing it, adding one row, and registering `flag-es` — validation,
  the settings picker and the fallback chain all follow. The settings overlay
  shows **every** language as a chip with its flag and its own endonym, the
  active one marked with `aria-pressed` (a single button showing the *other*
  language never told you which one you were reading).

`i18n.js` API:

```js
initI18n(gameStrings?)   // resolve language, merge dicts, translate DOM
t(key, params?): string  // lookup + {placeholder} substitution
getLang(): "de" | "en"
setLang(lang)            // persist, re-translate DOM, update <html lang>
```

### 6.2 Language-dependent content

| Game | What changes with language |
|---|---|
| Einmaleins / Rechnungen | UI strings only |
| Tippen | word/sentence lists **and keyboard layout** (DE → QWERTZ, EN → QWERTY); umlaut levels DE-only |
| Vokabeln | question direction (DE↔EN packs serve both audiences) |
| Lesen | fully language-specific; German first (§14.4) |
| Speech | SpeechSynthesis voice matches active language |

### 6.3 CI check

A test enumerates all keys across languages and fails if any key is missing
in any language (§16).

---

## 7. Shared Adaptive Practice Engine (`adaptive.js`)

Used by Einmaleins, Rechnungen, Vokabeln, Lesen. (Tippen has its own level
curriculum.) This is the core of "really teaches something".

### 7.1 Model — Leitner-light boxes

Every practice item (a multiplication pair, a skill bucket, a word, a
letter) has a **box number 0–4**, persisted as one digit per item (§9).

- New/unseen items start in box 2.
- **Wrong answer** → box := 0, and the item is **re-queued 2–4 questions
  later in the same round** (the child must succeed again while it's fresh).
- **Correct answer** → box := min(box + 1, 4).

### 7.2 Selection algorithm (implement exactly)

```
state per round: queue = [] (requeued items: {item, dueIndex}),
                 asked = ring buffer of last 2 item ids, qIndex = 0

nextItem():
  if queue[0] exists and queue[0].dueIndex <= qIndex:
      return queue.shift().item
  weights = {0: 8, 1: 4, 2: 2, 3: 1, 4: 0.5}
  candidates = activePool minus items in `asked`
  return weighted random pick from candidates by weights[box[item]]

onAnswer(item, correct):
  qIndex += 1; push item into `asked`
  if correct: box[item] = min(box[item] + 1, 4)
  else:
      box[item] = 0
      queue.push({item, dueIndex: qIndex + 2 + randInt(0..2)})
```

Result: struggling items appear up to 16× more often than mastered ones;
the child never sees the mechanism.

### 7.3 Round composition

A round draws **10 unique items** (6 for Lesen). Re-queued repeats extend the
round; **the round only ends when every item has been answered correctly**,
so every round ends in success (see journey framing, §8.2). "First-try
correct" is tracked per item for scoring.

### 7.4 Difficulty levels

Every game exposes **Leicht / Mittel / Schwer** (Easy / Medium / Hard) via
the header chip (2 taps to switch). Difficulty changes content range and
input mode (defined per game), never the adaptive mechanics.

### 7.5 API

```js
createSession(pool, boxes, {roundSize, requeueMin: 2, requeueMax: 4})
  .next(): item | null        // null when round complete
  .answer(item, correct)
  .progress(): {solved, total, firstTryOk}
  .boxes(): updated box map    // caller persists via storage.js
```

Pure module, no DOM, no storage access — fully unit-testable.

---

## 8. Motivation System (`rewards.js`, `journey.js`)

Layered rewards, all strictly additive — a wrong answer never removes
anything, no lives, no damage, no losing.

### 8.1 In the moment (every answer)

- Correct: green flash, cheerful sound, fox reaction pose (happy / cheering /
  thumbs-up, rotating). From 3 correct in a row, a hot-streak counter appears
  („5 richtig hintereinander! 🔥").
- Wrong: soft neutral sound (no harsh buzzer), the correct answer is shown
  for 2 s with a visual aid where the game defines one, tone „Gleich
  nochmal!". The fox pauses to "catch its breath" — it never falls, never
  gets hurt.

### 8.2 The journey (round framing, `journey.js`)

Inside a round, progress is a **journey path strip**, not a progress bar: a
horizontal SVG strip (rendered above the question area) with **one node per
unique item** in the round and the fox token on the current node.

- The fox **advances one node for every item answered correctly** (first try
  or after re-queue). Because rounds only end when all items are correct
  (§7.3), the fox always reaches the goal — the journey cannot be lost.
- A wrong answer does **not** move the fox back; it plays the catch-breath
  animation in place.
- Nodes 3, 6, 9 are **obstacle nodes** — visual milestones drawn from the
  region theme (a friendly troll at a bridge, a locked gate, a river ferry).
  The question at an obstacle node is a normal question; passing it plays a
  themed mini-celebration on the obstacle glyph (bounce / wiggle / pop, one
  per obstacle index) with the normal correct-answer sound, then the glyph
  dims to a settled "done" look.
- The final node is the **goal**, themed per region (summit flag for
  Rechenberg, school bell for Zahlendorf, forest clearing for Wörterwald,
  story-tree for Lesewiese). Reaching it triggers the round summary.
- `journey.js` API: `createJourney(container, {nodes, theme})` →
  `{advance(), stumble(), finish()}`. Themes: `village | mountain | forest |
  meadow`. Tippen does not use the journey (the text line itself is the
  progress display).

### 8.3 Trophies and points

**Vocabulary (use these words everywhere, in code, UI and docs):** a **trophy**
(DE „Pokal") is one of the 60 collectibles displayed in the Pokalraum (§3.2).
**Points** (DE „Punkte") are the currency you spend nothing on — they accumulate
per region and unlock the next trophy at fixed thresholds. The word *sticker*
is retired; it does not appear anywhere.

- A **perfect round** = every item in the round correct on the first try.
- **Points come from progress, never from repetition.** Everything is derived
  from a tile's best-star count before and after the round, so nothing extra is
  stored (a *tile* = one table at one difficulty).

  **Points are linear.** One star is worth `difficulty + 1` points: **1 on
  Leicht, 2 on Mittel, 3 on Schwer**. Every star inside a difficulty is worth
  the same, so a whole tile is **3, 6 or 9**. Hard work pays three times what
  easy work pays — a gap a child can see and act on. A mastered tile is worth
  **nothing**: replaying the easiest table forever earns not one point. See
  `roundPoints()` and `starValue()`.

  The third star used to carry a `+3 × difficulty` mastery bonus, so three
  equal-looking stars were worth 1, 1 and 4 on Leicht. It made the picker's
  numbers unexplainable, and it made the star display a lie.
- **The rules are shown, not written.** Every tile in the picker shows its
  **three stars**, gold for taken and grey for still open — the same language
  the sky speaks above the round (§10.5). It does not show a point total: what a
  star is *worth* belongs to the difficulty, and the difficulty says so itself
  („Mittel ×2 ⭐"). Three tile states, three looks: **open** (grey stars),
  **mastered** (green-ringed, three gold stars, may be replayed for nothing),
  **locked** (a table Leicht does not teach — faded, padlock, promises nothing).
  The round summary shows the points just earned next to the score; that is the
  only place a number appears.
- Each region keeps a lifetime **point** counter (`rewards.pr`, §9.2). The
  field keeps its short name for the cookie budget (§9.2).
- Each region has **12 fixed trophies** (emoji + translated name, defined in
  a `TROPHIES` table in `rewards.js`, themed per region — e.g. Wörterwald:
  🦊 🦉 🐿️ 🦡 🍄 🌰 …). Trophy *s* (1-indexed) of a game is earned when **that
  game's** counter reaches `THRESHOLDS[game][s-1]`.

  **The ladder is per game, because the games are not worth the same.** It used
  to be one shared ladder, tuned to einmaleins: `lesen` is worth 18 points in
  total, so its trophies five through twelve stood at 29 … 112 points and could
  never be won. Its shelf could never fill, and nothing on screen said why.

  Each game declares `MAX_POINTS[game]` — what mastering every tile it offers
  pays — and `ladderFor(max)` scales the twelve thresholds to it. The curve's
  shape *is* the einmaleins ladder
  (`[2, 6, 12, 20, 29, 39, 50, 62, 75, 88, 100, 112]` over 180 points), which
  einmaleins keeps verbatim so no child loses a trophy already won; a test
  asserts `ladderFor(180)` reproduces it. Every ladder therefore keeps the two
  properties that were tuned by hand: the **twelfth trophy lands at ~62 %** of
  everything the game is worth (a realistic goal, not a grind), and the **first
  arrives in the first sitting**. Thresholds climb strictly, so no two trophies
  are ever bought with the same point.

  `MAX_POINTS` is exact for einmaleins (27 tiles: 5×3 + 11×6 + 11×9 = 180) and
  **provisional** for the four unbuilt games (`ACHIEVABLE × 2`). Recompute a
  game's maximum from its real tiles when it ships.

  Deterministic — no randomness, fully derivable from the counter, so only
  the counter is stored.
- Earning a trophy shows it in the round summary: the picture and its name,
  no sentence (§10.1). A round can earn more than one at a time.
- Total: 60 trophies. The Pokalraum (§3.2) renders earned/unearned from the
  counters.

### 8.4 Fuchs-Status (site-wide)

- `totalStars` = sum of all stars across all games/difficulties.
- `totalTrophies` = trophies earned across all games (§8.3), of 60.
- Both are shown in the top bar beside the fox (§3.3), and nowhere else.
- The fox itself never changes with progress. It had a level number (a second
  name for the star count), then a progress bar toward cosmetic layers — a
  scarf, a cap, glasses, a backpack, a medal, two crowns. The fox is who the
  child is, not a display of what they own; the two counters say that once.

### 8.5 Tagesserie (daily streak)

Playing ≥ 1 round on consecutive calendar days (local time) increments the
streak; a missed day resets it to 1 on the next play. Stored as
`[lastDateISO, count]` — no history log. Milestone celebrations at 3, 7, 14,
30 days. The child's top bar does not show it (§3.3); the parents' view does
(§20), because a streak is a thing a parent tracks and a child is nagged by.

---

## 9. State Storage (Cookie, `storage.js`)

All persistent state lives in **one** first-party cookie named `schlaufuchs`.

### 9.1 Cookie parameters

| Attribute | Value |
|---|---|
| Name | `schlaufuchs` |
| Path | `/` |
| Max-Age | `31536000` (1 year), refreshed on every write |
| SameSite | `Lax` |
| Secure | set when served over HTTPS |

### 9.2 Payload format

URL-encoded compact JSON with a version field:

```json
{
  "v": 1,
  "settings": { "sound": true, "lang": "de" },
  "rewards": {
    "streak": ["2026-07-08", 4],
    "at": "einmaleins",
    "pr": { "einmaleins": 3, "rechnungen": 1 }
  },
  "einmaleins": {}, "tippen": {}, "rechnungen": {},
  "vokabeln": {}, "lesen": {}
}
```

- `rewards.at` = game key of the last game played (fox map position).
- `rewards.pr` = perfect-round counters per game (trophies derive from
  these, §8.3). Fox level derives from stars stored in the game keys —
  nothing extra to store.

Rules:

- Each game owns exactly one top-level key and never touches the others;
  `rewards.js` owns `rewards`, `i18n.js`/settings UI own `settings`.
- **Size budget: encoded cookie < 3500 bytes.** Games store compact digit
  strings (per-game shapes below), never event logs. `setGame()` refuses
  writes that would exceed the budget and logs a console warning.
- Corrupt/unparsable cookie ⇒ empty state (fresh start), never a crash.
- Box digit strings are indexed by the game's canonical item order (defined
  in each game's data file); missing/short strings are padded with `2`
  (= new item) on read.

### 9.3 API

```js
loadState(): object
getGame(name): object          // state[name] ?? {}
setGame(name, data): boolean   // merge + write; false if over budget
getRewards() / setRewards()
getSettings() / setSettings()
resetGame(name)                // per-game reset (settings overlay)
resetAll()                     // delete cookie (map footer)
```

> **Trade-off note**: `localStorage` would allow more space; the cookie is a
> deliberate product decision. The budget works with the compact encodings
> specified per game — tightest case Vokabeln (§13.4), which caps tracked
> packs. `storage.js` is the single place a backend swap would happen.

---

## 10. Game 1: Einmaleins — region **Zahlendorf**

Master the multiplication tables 1–10. Journey theme: `village` — the fox
walks the village lane; goal node: ringing the school bell.

### 10.1 Flow

1. Region tap → instantly into a round at the last difficulty & table
   (first visit: Leicht, 2er-Reihe).
2. Round of 10 (per §7.3): `7 × 8 = ?`, journey strip on top (§8.2).
3. Wrong → correct answer shown **with a dot-grid visual aid** (7 rows of
   8 dots), box drops, re-queue per §7. It stays until the child presses
   „Verstanden" — a timer would take the answer away from exactly the child who
   needs longest to read it. The card can hold ten rows of dots, so the dots
   scale with the viewport and the streak line yields its row.
4. Summary overlay, kept deliberately quiet: stars, one muted line of numbers
   (`{ok}/{total}`), the price of the next star (§10.3), the trophy if
   one was earned, one primary „Nochmal" button, and two secondary actions (map, table picker). A child
   who has just won reads almost nothing — the stars say how it went and the
   trophy is the prize, so neither gets a sentence of its own. Table picker
   via the header chip: an 11-tile overlay (Reihen 1–10 + „Alle") each showing
   its star state.

### 10.2 Difficulties

| | Content | Input |
|---|---|---|
| Leicht | Reihen 1, 2, 5, 10; dot-grid hint always visible | multiple choice (4 buttons) |
| Mittel | all Reihen 1–10 | on-screen keypad |
| Schwer | mixed, gap questions (`_ × 7 = 42`), division sprinkled in | keypad |

„Alle gemischt" draws across tables weighted by the adaptive boxes.

### 10.3 Stars (per table & difficulty)

6/10 → ⭐ · 8/10 → ⭐⭐ · 10/10 → ⭐⭐⭐, counting first tries only.

**Accuracy is the only criterion.** Speed is not: a child who reads or taps
slowly knows the times tables just as well, and a clock is not something they
can act on. The round is not timed at all — a duration shown "as a fact" still
whispers *faster is better* to the child who is slow and right, so the summary
does not show one.

A wrong answer leaves its item unsolved, so the round asks it again: a round
ends after ten *solved* items, and only the first try counts for stars.

The summary names the price of the next star (`nextStarGoal`), quietly, under
the score — otherwise a child who scores 9/10 has no way to learn why they
still have one star.

### 10.4 Cookie state (`einmaleins`)

```json
{
  "d": 1, "t": 7,
  "box": "342103...",                    // 100 digits: pairs 1..10 × 1..10 canonical order
  "stars": { "0": "302...", "1": "...", "2": "..." }  // per difficulty: 11 digits (10 tables + mixed)
}
```

~160 bytes. The box string is shared across difficulties.

### 10.5 The round's scene (sky, meadow, basket, fox)

One picture, no prose. `createJourney()` in `journey.js` draws all of it:

- **the sky** holds the stars still to be won on this tile, as a small
  constellation rather than a row of three;
- **the basket stands at the end of the path** — it is the goal *and* the place
  the stars land, so the reward and the finish line are one object. The fox's
  last step lands beside it. There is no themed goal icon in any theme any
  more; `THEMES` is a path colour and three obstacles.
- **the path** carries the fox, who advances on every correct answer.

A round awards at most **three** stars in every difficulty; what scales with
difficulty is *points* (×1 / ×2 / ×3, §8.3), not stars. The sky therefore always
holds three slots. (Leicht offers fewer stars across the whole game — 5 tiles
instead of 11 — but never more than three in one round.)

An earned star flies from its sky slot into the basket and stays there, leaving
a grey ghost behind. The flight is a CSS `transform` + `transition`, never a
keyframe animation: the site-wide `prefers-reduced-motion` rule kills both
`animation` and `transition`, so a transition degrades to *the star is already
in the basket*, whereas an animation would leave it hanging in the sky for
exactly the children who asked for calm.

While the feedback aid is up the whole scene hides, which hands the aid ~50 px
it never had.

**The basket fills. It never spills.** This is the whole design:

- It is driven by `ownedStars(progress, best) = max(best, starsFor(firstTrySolved))`.
  `best` is the tile's stored star count; `firstTrySolved` counts items solved
  without ever being missed. Both terms are monotone, so a star can never leave
  the basket.
- `firstTryOk` — the best score still *reachable* — would drop a star on the
  first mistake, and the first mistake usually arrives at question two. A child
  would watch the round decay for nine more questions.
- Under the 6/8/10 ladder a spilling basket would also lie: stars are lost on
  the 1st, 3rd and 5th mistake, never on the 2nd or 4th. A basket that shook at
  every error would teach a rule that does not exist.
- Nothing is at stake anyway. `endRound()` keeps the best star count, never the
  last one (`improved = stars > old`), so a bad round takes nothing away.
- **`best` is why the basket starts full on a mastered tile.** Without it the
  round promised „noch 2 richtig bis ⭐⭐⭐" on a tile already at three stars and
  then paid nothing, because `endRound()` only pays on `stars > old`. A full
  basket under a grey sky says *this is all yours* without a word.
- Stars this round can no longer reach **stay gold**. They are still winnable —
  just not today — and dimming them would be the loss framing we refuse.

There is **no streak counter**. A flame and a number beside the basket was one
thing too many on the row, and it competed with the only count that matters.

For the same reason there is **no mid-round restart button**: it would reward
quitting after one mistake, and the Leitner boxes are only written in
`endRound()`, so a restart would hide the child's misses from the adaptive
engine and from the parents' view. „Nochmal" after the round is enough.

---

## 11. Game 2: Tippen — region **Tippsee**

Multi-level ten-finger touch-typing course. Layout follows language:
**DE → QWERTZ, EN → QWERTY**. No journey strip — the text line is the
progress display. Requires a physical keyboard (friendly hint otherwise).

### 11.1 Core screen

- Top: text to type; current char highlighted; typed chars green; errors red
  and must be corrected before continuing.
- Middle: live accuracy %, speed (chars/minute), progress bar.
- Bottom: **on-screen keyboard visualization** (layout per language)
  highlighting the next key and, through level 9, the finger to use
  (color-coded per finger). On by default, auto-hidden from level 10,
  toggleable.

### 11.2 Curriculum (~20 levels, data-driven in `levels.js`)

| Phase | Levels | DE | EN |
|---|---|---|---|
| Home row | 1–4 | `asdf jklö` + `g h` | `asdf jkl;` + `g h` |
| Top row | 5–8 | `qwert zuiop` | `qwert yuiop` |
| Bottom row | 9–12 | `yxcvb nm,.-` | `zxcvb nm,./` |
| Shift | 13–15 | capitals, opposite-hand shift | same |
| Specials | 16–18 | `ä ö ü ß`, punctuation | punctuation `'"!?` |
| Numbers & flow | 19–20 | number row, paragraphs | same |

- Levels 1–8: pseudo-words generated from the allowed pool, preferring real
  words when possible. From level 9: lines sampled from built-in
  child-appropriate word/sentence lists per language (embedded in
  `levels.js`, no fetches).
- Each level = 5 exercises of ~1–2 minutes.

### 11.3 Passing, stars, difficulty

- Pass thresholds ramp linearly from ≥ 90 % accuracy / no speed floor
  (level 1) to ≥ 95 % / 80 CPM (level 20).
- ⭐ passed · ⭐⭐ ≥ 97 % accuracy · ⭐⭐⭐ ≥ 97 % and ≥ 1.5× the level's CPM floor.
- Levels unlock sequentially, stay replayable. Level picker: header-chip
  overlay, 20-tile lock/star grid.
- Leicht/Mittel/Schwer maps to exercise length (0.6× / 1× / 1.4×) and
  threshold strictness (−5 pp / ±0 / +2 pp accuracy).

### 11.4 Cookie state (`tippen`)

```json
{
  "d": 1,
  "lvl": { "de": 7, "en": 2 },
  "stars": { "de": "33211..", "en": "1" },
  "best": { "7": { "acc": 96, "cpm": 74 } },   // 5 most recent levels only
  "kb": true
}
```

---

## 12. Game 3: Rechnungen — region **Rechenberg**

Mental arithmetic: **＋ − × ÷** and „Mix". Journey theme: `mountain` — the
fox climbs; goal node: planting the summit flag. The map's mastered-state
flag on Rechenberg mirrors this.

### 12.1 Modes & difficulties

Mode chips (＋ − × ÷ Mix) inside the difficulty picker overlay:

| | ＋ / − | × / ÷ |
|---|---|---|
| Leicht | 0–10, no carrying | tables 1–5, no remainder |
| Mittel | 0–100 with carrying/borrowing | full tables 1–10, halving/doubling |
| Schwer | 0–1000, chains (`17 + 25 − 8`), gaps | beyond tables (`14 × 6`), division with remainder |

Question generation is parameterized (range, carrying, gap position); ×/÷
reuse the Einmaleins generator. Wrong answers show a one-line visual aid
(number line for ±, dot grid for ×).

### 12.2 Adaptive & stars

The adaptive engine tracks **~30 fixed skill buckets** (e.g. „subtraction
with borrowing, tens", „division with remainder"), listed canonically in
`rechnungen.js` — not individual questions. Rounds of 10; stars per mode &
difficulty with the same criteria as Einmaleins (§10.3).

### 12.3 Cookie state (`rechnungen`)

```json
{ "d": 0, "m": "+", "box": "232...", "stars": { "+": "310", "-": "2", "x": "", ":": "", "mix": "" } }
```

---

## 13. Game 4: Vokabeln — region **Wörterwald**

German↔English vocabulary with themed packs. Journey theme: `forest`; goal
node: a clearing where the learned animals/things gather. The same packs
serve both audiences — only the question direction flips.

### 13.1 Content (`packs.js`)

- 6 launch packs of 20–40 pairs: *Tiere/Animals, Schule/School, Essen/Food,
  Familie/Family, Farben & Zahlen/Colors & Numbers, Körper/Body*
  (~180 pairs). Entry format: `["der Hund", "dog", "🐶"]` (emoji optional).
- Adding a pack = adding one array. Canonical word order per pack defines
  box-string indices (§9.2).

### 13.2 Modes (= difficulty)

| | Mode |
|---|---|
| Leicht | **Erkennen**: word shown + spoken, pick from 4 emoji/word buttons |
| Mittel | **Zuordnen**: multiple choice both directions, distractors from the same pack |
| Schwer | **Schreiben**: type the translation; tolerant check (case-insensitive, article optional, Levenshtein distance ≤ 1 counts as „Fast richtig!" and correct) |

Direction (DE→EN / EN→DE) defaults to the UI language, flippable in
settings.

### 13.3 Adaptive & stars

Leitner boxes per word pair (§7). Rounds of 10 from the selected pack (or
„Alle"). Stars per pack & difficulty follow §10.3: 6/10 · 8/10 · 10/10 first-try,
the third star additionally requiring every pack word at box ≥ 3
(„Pack gemeistert").

### 13.4 Cookie state (`vokabeln`) — budget-critical

```json
{
  "d": 0, "p": "tiere", "dir": "de-en",
  "box":   { "tiere": "34212...", "schule": "..." },
  "stars": { "tiere": "310", "schule": "..." }
}
```

6 packs × ~30 words ≈ 180 digits + overhead ≈ 350 bytes — fits. Hard cap:
box strings for ≤ 10 packs; beyond that the least-recently-played pack's box
string is dropped (stars kept).

---

## 14. Game 5: Lesen — region **Lesewiese**

Learning to read, for the youngest users: almost no UI text, everything
speakable (tap any word/letter to hear it), extra-large targets. Journey
theme: `meadow`; goal node: the giant book-tree opens. Rounds of **6** items.

### 14.1 Stages (= difficulty)

| | Stage | Exercise types |
|---|---|---|
| Leicht | **Buchstaben** | letter shown & spoken → pick from 4; sound played → tap the letter |
| Mittel | **Silben & Wörter** | syllable blending („MA + MA" → tap the word); word → pick matching emoji; emoji → assemble word from syllable tiles |
| Schwer | **Sätze** | read a short sentence, tap the matching picture („Der Hund schläft." → 3 emoji scenes) |

### 14.2 Content (`content.js`)

Data-driven: letters with example words, ~150 syllable-friendly German words
with emoji, ~60 simple sentences with 3-picture choices. All content chosen
so **emoji serve as the pictures** — no drawn assets.

### 14.3 Adaptive & rewards

Boxes per letter/word/sentence item (§7), rounds of 6, extra-frequent fox
celebrations. Stars per stage: ⭐ ≥ 5/6 first-try · ⭐⭐ 6/6 · ⭐⭐⭐ 6/6 in three
consecutive rounds (stored as a small counter).

### 14.4 English version

German content first. English reading needs a genuine phonics approach (CVC
words, sight words) — a separate content set, later milestone. The exercise
engine (pick-from-4, tile assembly, picture questions) is shared and
language-neutral.

### 14.5 Cookie state (`lesen`)

```json
{ "d": 0, "box": { "de": "3421..." }, "stars": { "de": "21" }, "c3": 1 }
```

---

## 15. Visual Design

- **Fox mascot** (`fuchs.svg`): inline SVG, poses (neutral, happy, cheering,
  thinking, catch-breath) as swappable groups. One file, used everywhere, and
  the pose is the only thing that varies (§8.4).
- **Map & journey art**: flat geometric SVG shapes, warm palette; emoji as
  accents where a full illustration would be costly. No raster images.
- Palette: **colour carries meaning.** Fox-orange (`--orange`, `#e8590c`) is
  reserved for the fox and for actions; `--depth` (`#1f6f8b`, the island's
  deep water) marks progress and ownership (level bar, paved roads, earned
  trophies); success-green and error-red are momentary answer feedback and
  nothing else. Cream background, dark-brown text, all ≥ 4.5:1 contrast. **The site is always light and friendly — no dark theme**, even
  when the device prefers dark (`color-scheme: light`); a dark UI does not
  fit the product (resolved decision, §18).
- Typography: **joy on top, clarity underneath.** `--font-display`
  Grandstander (variable 400–800) carries numbers, region names and headings;
  `--font-body` Atkinson Hyperlegible carries everything you read, and is the
  reading game's face for the same reason it is the settings face. Both are
  OFL and self-hosted under `assets/fonts/` (latin subset, ~77 KB) — no build
  step, no third-party request. Very large in-game sizes (a question readable
  from a meter away).
- Micro-animations: flash, gentle shake, confetti, journey steps — all
  respecting `prefers-reduced-motion` (reduced: instant state changes, no
  confetti).

---

## 16. Testing & Quality

- **Pure logic lives in DOM-free modules** and is unit-tested with
  `node --test` in `tests/`: adaptive engine (selection weights, re-queue
  timing, box transitions), question generators, scoring/stars, trophy
  thresholds, streak date logic, i18n lookup/fallback, cookie
  encode/decode/budget.
- GitHub Actions workflow runs the tests on every push.
- **i18n completeness test**: every key present in every language, fails CI
  otherwise.
- Manual checklist per release: fresh-profile smoke test on a real phone,
  cookie round-trip after browser restart, subpath serving, language toggle
  on every page, SpeechSynthesis on iOS Safari (user-gesture rule), map
  region states at 0/⅓/100 % stars.

---

## 17. Implementer Guide

Rules that keep the implementation on the rails:

1. **Build order = milestone order (§19).** Do not start a later milestone
   before the earlier one's acceptance criteria pass.
2. **Shared modules are contracts.** Implement `storage.js`, `i18n.js`,
   `adaptive.js`, `rewards.js`, `journey.js` exactly to the APIs given in
   §6–§9; games call them, never reimplement them.
3. **Pure logic ↔ DOM separation.** Every game splits into a logic module
   (question generation, scoring — imported by tests) and a page module
   (DOM, events). Tests never need a browser.
4. **No dependencies.** No npm packages at runtime or for the site itself;
   `node --test` is the only dev tool. No CDN links, no web fonts, no
   external requests.
5. **Relative URLs only** (subpath rule, §2).
6. **All user-visible strings through `t()`** — a hardcoded German or English
   string in JS/HTML (outside i18n files) is a bug.
7. **Cookie writes only via `storage.js`**; respect the per-game key
   ownership and the digit-string encodings exactly as specified.
8. **Numbers in this spec are normative**: thresholds, weights, box counts,
   trophy thresholds, star criteria, level formulas. Do not tune them.
9. When something small is genuinely unspecified, pick the simplest option
   consistent with §1 (kid-friendly, ≤ 2 taps, mobile first, never punish)
   and note the choice in the commit message.
10. **Bump the `?v=N` query on the stylesheet links** (all HTML files, same
    N) whenever `schlaufuchs.css` changes. GitHub Pages caches assets and
    browsers hold them longer; without the bump, users get fresh HTML with
    stale CSS and new elements render unstyled.

---

## 18. Resolved Decisions

Decisions already made — do not reopen:

1. **World map is tapped, not walked.** No player-controlled character
   movement anywhere; the "character journey" lives in the round journey
   strip (§8.2) and the fox's map position. Rationale: preserves the 2-tap
   rule, avoids an order-of-magnitude engineering/art cost, keeps
   learning-per-minute high.
2. **Obstacles, not combat.** Enemies are friendly obstacles to overcome
   with a correct answer; nothing attacks, nothing is lost on a wrong
   answer. Rationale: the never-punish principle protects exactly the kids
   the adaptive engine targets.
3. **The fox does not change** with progress (§8.4) — no cosmetics, no shop.
4. **Trophies are deterministic** (counter + thresholds), not random drops.
5. **SpeechSynthesis is good enough for launch**; recorded audio is not a
   launch requirement.
6. **Vokabeln launches with 6 packs**, Lesen with German content only.
7. **Adventure mode** (node-path campaigns per region: tap node → themed
   round → node clears → path extends; boss nodes = mixed-review rounds) is
   **deferred to M8** and must not leak complexity into earlier milestones.
   The journey strip and map states are designed so adventure mode can be
   added as a layer on top (nodes reuse round configs; map regions gain a
   path overlay).
8. **Pages deploys via GitHub Actions** (curated artifact, tests must pass),
   not from a branch — development files are never published (§2).
9. **Light theme only.** No dark mode, regardless of the device preference —
   the world must always look bright and friendly (user decision after
   playtesting).

---

## 19. Milestones & Acceptance Criteria

Each milestone ends with: tests green in CI, manual checklist (§16) passed
for the affected pages, work committed and pushed.

**M1 — Skeleton & world map.**
Repo layout, `CNAME`, mobile-first shared CSS, `storage.js` + `i18n.js` with
tests, world map page (simple flat-shape version) with all five regions
tappable, fallback nav, header (language toggle, sound toggle, placeholders
for level/streak), footer reset. Games may be "coming soon" stubs.
*Accept:* map renders and scales 360 px→desktop; regions link to game dirs;
language toggle re-translates the whole page instantly; cookie survives
reload; site works from a subpath.

**M2 — Einmaleins + shared engines.**
`adaptive.js`, `rewards.js`, `journey.js`, `audio.js`, `confetti.js`, album
page, full Einmaleins per §10.
*Accept:* §3.4 tap budgets hold; a wrong answer re-queues within 2–4
questions and drops the box to 0; round always ends at the goal node;
perfect round increments `pr` and thresholds unlock trophies exactly per
§8.3; stars appear on the map badge; fox stands on Zahlendorf after playing.

**M3 — Rechnungen.** Per §12, reusing everything from M2.
*Accept:* all four modes + Mix generate valid questions per difficulty
table; skill-bucket boxes persist; Rechenberg region evolves at ⅓ stars.

**M4 — Tippen.** Levels 1–8, DE/QWERTZ; **M4b**: EN/QWERTY + levels 9–20.
*Accept:* error must be corrected to proceed; accuracy/CPM math matches
definitions; level unlock sequence; keyboard visualization matches layout
and language; touch-only devices get the hint screen.

**M5 — Vokabeln.** Per §13 with 6 packs.
*Accept:* all three modes incl. tolerant typed checking; direction flip;
speech on tap; cookie stays under budget with all packs played.

**M6 — Lesen.** Per §14, German content.
*Accept:* every exercise fully playable without reading UI text; everything
speakable on tap; rounds of 6; iOS speech works from tap handlers.

**M7 — Polish.** Refined map/fox art, service worker for offline play,
`prefers-reduced-motion` audit.

**M8 — Adventure mode.** Per §18.7.

---

## 20. The parents' view (`parents.html`)

Children's learning apps show parents streaks and stars, because engagement is
all they have. This site has the **knowledge**, so it shows that.

- Reachable from the settings overlay on every screen, and from the map's foot.
  Not linked from inside a round: it is not for the child.
- **Read-only.** It imports no setter, writes no state, sends nothing anywhere.
  `tests/parents.test.js` enforces that it never imports `setGame`/`setRewards`.
- **The Leitner box is the diagnosis** (§7.1), and it is already stored. Boxes
  0–1 render as *slips*, 2 as *not practised yet*, 3–4 as *solid*, laid out as
  the 10×10 times table a parent learned at school. `clampBox` defaults an
  unknown fact to **2**, not 0, which is why a beginner's grid shows no red:
  reporting an unasked fact as one the child got wrong would be a lie.
- „Hier hilfst du am meisten" lists boxes 0–1, hardest first, capped at twelve.
- **Practice time is the one clock in the product** (§10.3 keeps it away from
  the child). Aggregated per difficulty as `tm`/`rd`, never per question: a
  per-fact timer would cost cookie budget and tell a parent nothing the box does
  not already say. `addPractice()` caps one round at `MAX_ROUND_SECONDS` (a
  forgotten tab is not practice) and banks **no** time for a non-finite clock —
  capping a NaN to fifteen minutes would credit practice that never happened.
  The pace line says out loud that time is not a goal.
