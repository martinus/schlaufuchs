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
  **two taps from anywhere** (§3.4). A tap is never spent on a menu — the one
  thing a child chooses between two rounds is *which level*, and that choice is
  a picture of where she stands, not a list of settings.
- **Mobile first**: designed for a phone in portrait, scaled up to tablet and
  desktop (§5.1).
- **Really teaches something**: every game has explicit difficulty levels and
  a shared adaptive engine that detects what the child struggles with and
  practices exactly that more often (§7).
- **Really motivates, never punishes**: journeys, stars, trophies (§8).
  A wrong answer never costs anything.
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
│   ├── js/                   # shared modules — the full map of them, with
│   │   │                     # their dependency rules, is docs/ARCHITECTURE.md
│   │   ├── storage.js        # Cookie-backed state store (§9)
│   │   ├── i18n.js           # Translation runtime (§6)
│   │   ├── adaptive.js       # Weakness-tracking practice engine (§7)
│   │   ├── rewards.js        # Stars, trophies, region states (§8)
│   │   ├── journey.js        # Journey path strip used inside rounds (§8.2)
│   │   ├── mapwalk.js        # Fox anchors + walk arithmetic, pure (§3.1)
│   │   ├── motion.js         # The one walk driver; reduced-motion (§15)
│   │   ├── showcase.js       # One trophy, held up — shelf & summary (§3.2)
│   │   ├── audio.js          # Feedback sounds (WebAudio, no asset files)
│   │   └── confetti.js       # Celebration effect
│   └── img/
│       ├── favicon.svg
│       └── icons/            # real SVGs for the graphics registry (fox.js
│                             # draws the mascot in code — there is no fuchs.svg)
├── games/
│   ├── einmaleins/           # §10  index.html, einmaleins.js, logic.js, picker.js, i18n.js
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
regions; **each region is one big tap target.** Tapping it walks the fox there
and opens the game the moment the fox arrives (§3.1, "the fox walks") — there
is no intermediate page.

| Region (DE / EN) | Game | Visual anchor |
|---|---|---|
| Einmaleins / Times tables | Einmaleins | village with a school bell |
| Rechenberg / Math Mountain | Rechnungen | mountain with a summit |
| Wörterwald / Word Forest | Vokabeln | forest with animals |
| Tippsee / Typing Lake | Tippen | lake with a boathouse |
| Lesewiese / Reading Meadow | Lesen | meadow with a giant book-tree |
| Pokalraum / Trophy Room | (the collection) | trophy hall, bottom-right |

The village **is called after its game**: a child who plays "Einmaleins" should
not have to learn that it happens in a place called something else. The other
four regions keep a place name, because their game's name is a verb.

The **Pokalraum** is a sixth region that links to the collection
(`album.html` — the filename is kept for URL stability) instead of a game. It
evolves like the others (thriving ≥ 20 trophies, mastered = 60). It carries **no
star badge**: the number of trophies in it is written on its own facade, above
the trophy painted there (`#pokal-count`), where the number can only mean the
cup it sits on. Under the house it was one more caption on a map of captions.

Map requirements:

- Each region is an SVG `<a>` group (real link, keyboard-focusable,
  `aria-label` = translated game name) with a translated name label and a small
  `region-badge` group showing that game's star count. The badge has three
  tiers via CSS class: `badge-t1` (plain), `badge-t2` (gold, ≥ ⅓ of
  `MAX_POINTS[game]`), `badge-t3` (glowing gold, 100 %). **Only playable
  regions show the badge**: a locked game cannot pay a star, so a "⭐ 0" under
  its name would promise what the clouds just took back. The group stays in
  the markup for the day the game ships.
- **Exactly one `<rect class="hit" fill="transparent">` per region**, the first
  child of its `<a>`, ≥ 64×64 px, spanning that region's art and its own label
  anchor — and never a neighbour's, because SVG paints in document order and
  the later region would steal the tap. The art alone is not a target: an
  8-year-old tapped the gap between the two village houses and nothing
  happened. The rect is bounded on purpose; the earlier, unbounded hotspots
  tiled 42 % of the island and turned open grass and sea into links. The fill
  is an attribute, not a CSS rule, so a stylesheet that fails to load cannot
  leave six black boxes on the island.
- **A region a child can enter says so.** Its name sits on a white
  `label-plate` (built in `render()` from the label's measured bbox, so a
  language change resizes it), and the whole region bobs ±1.5 px on an idle
  loop. Fogged regions get neither. Under `prefers-reduced-motion` the global
  kill switch stops the bob and the plate carries the affordance alone.
- **The fox stands where the child last went** (`rewards.at`, §9.2); first
  visit: at the village. Position = one fixed anchor per region, in
  `mapwalk.js` — the Trophy Room has one too, because it is a destination even
  though it is not a game.
- **The fox walks.** Tapping a region cancels the navigation, writes `at`, and
  animates the fox from its anchor to the tapped region's; only when it arrives
  does the page open (`travelTo()` in `map.js`). So the child sees herself
  cross the island, and finds the fox standing in front of the place she was in
  when she comes back. The walk is three damped hops over an eased line
  (`walkPoint`), 420–1100 ms by distance (`walkMs`), both pure and tested. Each
  hop lifts the fox off the line **and leans it sideways**, the lean scaled by
  how vertical the walk is: a straight up-and-down walk — the level picker's
  single column of tiles (§10.2) — hops along its own line, so without the lean
  the bounce is invisible and the fox reads as sliding. Both are damped to zero
  at each end, so it still lands with both feet on the tile it was sent to.
  Under `prefers-reduced-motion` there is no walk: `at` is written and the page
  opens at once, so the fox is still there on the way back (§15). A fogged
  region is not walked to — it wiggles (below). These are SVG anchors, so the
  href comes from `getAttribute("href")`: `region.href` is an
  `SVGAnimatedString`, and assigning it navigates to a 404.
- **Regions visibly evolve with mastery.** Each region has 3 visual states as
  toggled SVG layers: *base* → *thriving* (≥ ⅓ of `MAX_POINTS[game]`, the stars
  that game can pay) → *mastered* (100 %): flag on the
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
  The village is the crossroads and has no road of its own, so mastering it
  cobbles the village square instead. The Trophy Room road paves at 20
  trophies. See `.road` / `.roadline` / `.plaza` and `pave()` in `map.js`.
- **Unbuilt games sit under clouds, and do not open.** A region whose game is
  a stub is covered by code-generated clouds (`fogRegion()` in `map.js`, driven
  by `PLAYABLE` in `rewards.js`), so the island never promises what the site
  cannot deliver. The clouds are drawn cumulus shapes with a visible rim over a
  soft blurred veil — pure blur had no edge, and art under an edgeless white
  wash read as a rendering mistake, not as weather that will lift. Tapping it
  **stays on the map**: the click is
  `preventDefault`ed, the cover wiggles, and a transient "Bald!" / "Soon!" bubble
  appears above the label. It is removed by a timer, never by `animationend` —
  under `prefers-reduced-motion` no animation starts, so no event would ever
  fire. The `href` stays (deep links to the stub pages still work) and the
  region carries `aria-disabled="true"` plus `lockedHint` in its `aria-label`.
  Sending a child who reads almost nothing to a page that explains itself in a
  sentence simply lost her.
  Three invariants: the fog is `pointer-events: none` and is measured from the
  art only (never from the `.hit` rect, which is larger and would balloon it);
  the tap handler is registered **once at module scope**, not inside `render()`,
  which re-runs on every settings change; and **playable regions are painted
  last** in the SVG, because fog drawn later would grey out the label of the one
  village a child can walk into.
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

One page, five sections (one per region, translated heading), shelved in
`GAMES` order — playable games first, so Lesewiese sits right under Einmaleins
and not below three shelves of games that do not exist yet. Each section
shows **12 trophy slots**, **three to a row** at every width — the same rhythm
the level picker keeps (§10.2), and enough room for a cup that reads as a cup
(the shelf used to be four across on a phone and six on a desktop, where the
trophies shrank to specks). The grid tracks are `minmax(0, 1fr)`, never a bare
`1fr`: a bare fraction floors each track at the item's longest unbreakable word,
and „Rechenschieber" once pushed the row past a 360px phone and dragged the
fixed showcase overlay off-centre with it. Earned trophies show as the shared
**trophy card** (`trophycard.js` — the trophy's own emoji **standing on** the
cup, two
thirds of its size (`THEME_RATIO`) and dipping into the bowl by about a quarter
of its own height. `.t-art` is a column, symbol above cup, so the pair is taller than
the cup alone: you see what you won before you see what it came in. Buried
inside the bowl at half the size, twelve trophies on a shelf were twelve
identical cups); unearned slots as **silhouettes** of the trophy you
have not won yet — you can see what is missing, which is the whole reason to
keep collecting. The round summary draws the same card (§3.4), so a child
recognises the trophy she just won when she meets it on the shelf.

**A locked slot states its distance where a child can see it**: `+13 ⭐` under
the silhouette — how many stars are still missing, not the total threshold. It
used to live in a `title` tooltip, which no child on a phone will ever see, and
then stated the total (`⭐ 62`), a price tag a child cannot relate to what she
already owns. **The next slot to fall** additionally wears a progress bar, its
`+2 ⭐` in the ownership colour, because it is the one number on this shelf
worth chasing. That number used to be a sentence above the shelf ("Noch 2 ⭐
bis zum nächsten Pokal"), about a trophy three slots to the right; the screen
reader hears that sentence on every locked slot.

**The room says what it is with its symbol**, not with a sentence: the heading
is the same trophy that marks the room on the map, and it carries the room's
name as an `aria-label` for the people who listen to the page. The written
heading, and a paragraph explaining where trophies come from, are gone — the
child this room is for reads neither, and the top bar already counts the
trophies. Each section still shows its earned count and how many stars remain
until its next trophy. Trophies are earned via stars (§8.3). Reached from the
map via the **Pokalraum** region (§3.1).

**Tapping a trophy she owns holds it up** (`openShowcase()` in `showcase.js`):
the cup fills the screen — the card is sized against the viewport in JS, because
the cup is an emoji and no CSS length can be derived from the box it has to fit
into — confetti rains, the fox jumps at its corner and stars blink around it.
The confetti does not stop: `confettiRain()` fills a full-view layer **behind**
the sheet and each piece fades to nothing the further down it falls (a mask on
the layer plus a per-piece opacity ramp), so the blue-bordered plaque stays the
one crisp, solid thing while the celebration keeps going until she puts it down.
It is looping CSS, so `prefers-reduced-motion` stills it — and it is not even
built in that case — and the showcase tears the layer down when it closes.

**The round summary opens the same showcase**, from the trophy it just handed
over (§10.1). That card used to be a *link to this room*, which celebrated by
taking the child out of the round she had just finished and dropping her among
empty slots. The showcase's overlay sits above the summary's (z-index 50 vs 40),
so the round is still there behind it, and the focus goes back to the trophy she
pressed. One celebration, one module, two callers. A trophy is for showing to somebody, and a shelf slot that does
nothing when pressed is a receipt. An earned slot is therefore a `<button>`
(`trophyCardHTML({ button: true })`) carrying `data-trophy="<game>:<index>"`,
and one delegated listener on `#album` opens the showcase. A locked slot is not
a door. The blink and the hop are CSS animations, so `prefers-reduced-motion`
silences both and leaves the trophy, full size (§15).

The room carries the same top bar as every other page (§3.3), gear and reset
included (§3.4). The bar is **sticky**, so the way out follows the child down
the shelves — which is also why the room no longer ends with a second big
button back to the map: the sticky bar carries the map button already, and the
room's own symbol sits under it. The shelves are built as markup, not as
`[data-i18n]` nodes, so a
language change rebuilds them instead of translating them in place.

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
  map and the place it sends you is two bars. A page with something to lose on
  that tap takes it back through `initTopBar({ onLeave })` and asks first
  (§10.7); it is a real link either way.
- **Fox chip** (`renderFoxChip`): the fox, the total star count, the total
  trophy count. It is a readout, not a control: no panel, no shadow, no tap
  target.
- **Level/difficulty chip** (inside a game, below the bar) showing the current
  difficulty and table; tapping opens the picker **as an overlay** on the same
  page, never a separate page.
- **Settings gear** → shared overlay (`initSettingsOverlay`, `chrome.js`):
  the **same rows on every page that has a gear** — sound, language, reset,
  and the three links out. The overlay used to take a `resetKind` and open
  three different sheets (all / game / nothing); it is one sheet now, identical
  everywhere. **Reset is per game**: the "Fortschritt löschen" section lists one
  row per game the cookie holds progress for (`hasGameData`), plus an "Alles"
  row for the whole site — each a named, two-step confirm calling
  `resetGame(name)` or `resetAll()` (`storage.js`). This is where reset lives;
  the parents' view is read-only information (§20). A fresh cookie shows only
  the "Alles" row, so the sheet is never empty of a reset.

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
| Map | playing a game (resumed) | **2** (region → the tile the fox is on) |
| Inside game A | playing game B | **2** (home → region) |
| Inside a game | different difficulty/level | **2** (chip → pick) |
| After a round | the same level again | **1** (the tile the fox is on) |
| Map | trophy album | **1** |

- **A game opens on its levels, with the fox standing on the last one played.**
  Every round ends back there, so the level she is about to play is a thing she
  saw, not a thing she has to remember. Pressing the tile under the fox is one
  tap and plays it again; any other tile is the same one tap. First visit stands
  the fox on the easiest level.
- **The fox walks to the level she taps, and the level opens when it arrives**
  — the same rule the map keeps for its regions (§3.1). A tap during the walk
  is ignored; `prefers-reduced-motion` skips it and opens at once (§15).
- No confirmation dialogs on the happy path (only destructive resets).
- **No fullscreen toggle.** A remembered fullscreen mode was built and then
  removed: on the very common phones with a centred punch-hole camera, hiding
  the browser chrome let the top bar — the fox chip, the star count — slide up
  under the camera cutout. Respecting `env(safe-area-inset-top)` might have
  dropped the bar back below it, but that inset is unreliable in web fullscreen
  across Android devices and could not be verified on the real hardware, and the
  one benefit fullscreen offered — a harder-to-reach edge swipe — the round
  guard (§10.7) already delivers. So the round is protected without it.
- **The round summary has exactly ONE button**, carrying a randomly chosen
  congratulation („Super!", "Well done!", …); pressing it opens the level
  picker on the level just played, where one more tap plays it again. A wall of
  three buttons made an 8-year-old reach past the sheet for the chip behind it. Any trophy it hands out is the shared trophy card
  (§3.2), and it links to the album — a trophy that does nothing when tapped
  is a picture, not a prize.
- The summary must never be a dead end, and its one button is not the way out:
  **the top bar stays above it and above the level picker** — in the picker
  nothing is at stake, so the map button must be one straight tap (§10.7). The
  layers, top down: modal sheets 50 > top bar 45 > picker 44 > level chip 41 >
  summary 40. The picker sits above the summary because „sum-ok" opens the
  picker while the summary stays open underneath, and above the chip so the
  chip's lit pill cannot sit on the picker's sheet as a dead spot. Only the
  genuinely modal sheets (settings, aid, leave — `z-index` 50) cover the bar.
  Consequently the summary's focus goes to its button, not to the trophy
  link above it, or Enter would leave the game.

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
  Speech output (Vokabeln; Lesen defers it, §14.6) via the browser
  **SpeechSynthesis API** with the voice matching the active language. iOS
  Safari requires a user gesture before speech — always trigger speech from
  tap handlers.

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
| Lesen | fully language-specific; German first (§14.6) |
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

A round draws **10 unique items** (8 for Lesen; einmaleins Schwer draws 12,
§10.2). Re-queued repeats extend the round; **the round only ends when every
item has been answered correctly**, so every round ends in success (see
journey framing, §8.2). "First-try correct" is tracked per item for scoring.

The draw multiplies an optional per-item **boost** into the box weight
(`opts.boost`, default 1): a game can say "this item is intrinsically hard,
show it more often" without touching the box mechanics (einmaleins uses it for
its hardness weighting, §10.2). The boost never affects re-queueing or box
movement. For the weighting to have anything to choose from, **the pool should
be larger than the round** — a pool the size of the round is asked in full,
mastered or not.

### 7.4 Difficulty levels

Every game exposes **Leicht / Mittel / Schwer** (Easy / Medium / Hard) via
the header chip (2 taps to switch). Difficulty changes content range and
input mode (defined per game), never the adaptive mechanics.

### 7.5 API

```js
createSession(pool, boxes, {roundSize, requeueMin: 2, requeueMax: 4, boost})
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
  thumbs-up, rotating). There is **no hot-streak counter** — see §10.5, and the
  flame that went with it is gone from the graphics registry too. In
  einmaleins, an answer at rocket speed additionally flashes the **⚡ moment**
  (§10.6) — visible only when it happens; a slow answer sees nothing, because
  there is no negative moment.
- Wrong: soft neutral sound (no harsh buzzer). The fox pauses to "catch its
  breath" — it never falls, never gets hurt. The aid card then shows, in this
  order: **the child's own answer, struck through in red**; the true equation
  in green, with the answer highlighted; a visual aid where the game defines
  one (§10.1's dot grid).
- **The child leaves the aid by entering the correct answer**, not by
  dismissing it. On multiple choice the same four options return and a wrong
  tap shakes.
  **On a keypad the aid is answered exactly the way the question was**: digits
  go in, backspace repairs, and **OK submits**. A wrong OK shakes and clears the
  gap. The aid used to be cleverer than the game around it — the answer
  completed itself at the last digit, and a digit that could no longer be right
  was refused before it was finished — which is a second set of rules on the
  same keypad, told apart only by whether the child had just been wrong.
  There is no timer (it took the answer away from exactly the child who reads
  slowest) and no "Verstanden" button (an 8-year-old pressed it every time
  without ever registering that she had erred). The arithmetic is `retryStep()`
  in `games/einmaleins/logic.js` — pure, and unit-tested against every answer.

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
  Rechenberg, school bell for the village, forest clearing for Wörterwald,
  story-tree for Lesewiese). Reaching it triggers the round summary.
- `journey.js` API: `createJourney(container, {nodes, theme})` →
  `{advance(), stumble(), finish()}`. Themes: `village | mountain | forest |
  meadow`. Tippen does not use the journey (the text line itself is the
  progress display).

### 8.3 Trophies and stars

**Vocabulary (use these words everywhere, in code, UI and docs):** a **trophy**
(DE „Pokal") is one of the 60 collectibles displayed in the Pokalraum (§3.2).
The **star** (⭐) is the site's **one and only currency**: it accumulates per
region and unlocks the next trophy at fixed thresholds. The words *sticker* and
*Punkte / points* are retired; **neither appears anywhere a child can read**.
(The tempo badge of §10.6 is not a currency: it counts toward nothing, unlocks
nothing, and is never a number — it is a per-tile collectible, like the fox's
poses.)

Internally the counter is still called `pr`, and the functions still say
`roundPoints`, `starValue`, `MAX_POINTS` — those names are cheap and the cookie
field is budget-critical (§9.2). The UI says ⭐ and nothing else. There used to
be two numbers, both called stars: a raw count of three per tile, and this
weighted one shown as „Punkte". They stood in different places, never agreed,
and an 8-year-old understood neither.

- A **perfect round** = every item in the round correct on the first try.
- **Stars come from progress, never from repetition.** Everything is derived
  from a tile's best-star count before and after the round, so nothing extra is
  stored (a *tile* = one table at one difficulty).

  **A star's worth is its difficulty.** One star counts `difficulty + 1`: **1 on
  Leicht, 2 on Mittel, 3 on Schwer**. Every star inside a difficulty is worth
  the same, so a whole tile is **3, 6 or 9**. Hard work pays three times what
  easy work pays — a gap a child can see and act on, and one the round's scene
  now states outright (§10.5). A mastered tile is worth **nothing**: replaying
  the easiest table forever earns not one star. See `roundPoints()` and
  `starValue()`.

  The third star used to carry a `+3 × difficulty` mastery bonus, so three
  equal-looking stars were worth 1, 1 and 4 on Leicht. It made the picker's
  numbers unexplainable, and it made the star display a lie.
- **The rules are shown, not written.** Every tile in the picker draws **the
  stars it still has to give** (`tilePointsLeft`): three on a fresh Leicht tile,
  six on Mittel, nine on Schwer, emptying as they are won. Nobody has to be told
  that hard work pays three times as much — the tile is three times as full. No
  tile carries a „×2" or „×3" anywhere; that claim used to sit on a difficulty
  button a child had never pressed, promising stars she could not see. Two tile
  states, two looks: **open** (the stars it owes you) and **mastered**
  (green-ringed, a tick, may be replayed for nothing). The round summary shows
  the stars just earned next to the score („+6 ⭐"); that is the only place a
  number appears.
- Each region keeps a lifetime **star** counter (`rewards.pr`, §9.2). The
  field keeps its short name for the cookie budget (§9.2).
- Each region has **12 fixed trophies** (emoji + translated name, defined in
  a `TROPHIES` table in `rewards.js`, themed per region — e.g. Wörterwald:
  🦊 🦉 🐿️ 🦡 🍄 🌰 …). Trophy *s* (1-indexed) of a game is earned when **that
  game's** counter reaches `THRESHOLDS[game][s-1]`.

  **The ladder is per game, because the games are not worth the same.** It used
  to be one shared ladder, tuned to einmaleins: `lesen` was then budgeted at 18
  points, so its trophies five through twelve stood at 29 … 112 points and could
  never be won. Its shelf could never fill, and nothing on screen said why.

  Each game declares `MAX_POINTS[game]` — what mastering every tile it offers
  pays — and `ladderFor(max)` scales the twelve thresholds to it. The curve's
  shape *is* the einmaleins ladder
  (`[2, 6, 12, 20, 29, 39, 50, 62, 75, 88, 100, 112]` over the 180 points the
  game was worth when the ladder was tuned), which einmaleins keeps verbatim so
  no child loses a trophy already won; a test asserts `ladderFor(180)`
  reproduces it. The three **unbuilt** games use the generated ladder. Every
  ladder keeps the two properties that were tuned by hand: the **twelfth trophy
  lands at ~62–69 %** of everything the game is worth (a realistic goal, not a
  grind), and the **first arrives in the first sitting**. Thresholds climb
  strictly, so no two trophies are ever bought with the same point.

  **lesen is hand-tuned, not generated.** It is a small game — 15 tiles for 12
  trophies, where einmaleins has 25 — so the generated einmaleins curve
  (thresholds 1, 3, 6 over lesen's 90) started too low: one perfect Schwer
  round is worth 9 and cleared all three, so a single round dropped three
  trophies and the shelf filled after roughly one play-through. Its ladder is
  therefore `[3, 7, 12, 17, 23, 29, 35, 41, 47, 52, 57, 62]`: a first Schwer
  round now buys two trophies (the einmaleins pace), and the twelfth at 62 of
  90 needs play across all three difficulties, since Schwer alone caps at 45.

  `MAX_POINTS` is exact for einmaleins (25 tiles: 5×3 + 11×6 + 9×9 = 162 —
  Schwer lost its 1er and 10er tiles, §10.2, and the hand-tuned ladder tops out
  at 112, still comfortably below) and
  **a guess** for the four unbuilt games — it was once "achievable stars × 2",
  from a raw star count that no longer exists. It is now the sole denominator of
  a region's badge tier and its thriving/mastered state (§3.1), so **recompute a
  game's maximum from its real tiles the day it ships**, exactly as einmaleins'
  162 was computed. Until then those four regions are scaled against a number
  nobody has checked.

  Deterministic — no randomness, fully derivable from the counter, so only
  the counter is stored.
- Earning a trophy shows it in the round summary as the shared trophy card
  (§3.2): the cup, its emoji, its name, no sentence (§10.1). Tapping it opens
  the same showcase the Pokalraum opens, over the summary — it does not
  navigate. A round can earn more than one at a time.
- Total: 60 trophies. The Pokalraum (§3.2) renders earned/unearned from the
  counters.

### 8.4 Fuchs-Status (site-wide)

- `totalPoints(pr)` = the child's stars, summed over the five games — the one
  currency (§8.3), weighted by the difficulty each was won at.
- `totalTrophies` = trophies earned across all games (§8.3), of 60.
- Both are shown in the top bar beside the fox (§3.3), and nowhere else. The
  parents' view shows the same two numbers (§20) — never a second star count.
- The fox itself never changes with progress. It had a level number (a second
  name for the star count), then a progress bar toward cosmetic layers — a
  scarf, a cap, glasses, a backpack, a medal, two crowns. The fox is who the
  child is, not a display of what they own; the two counters say that once.

### 8.5 Tagesserie (daily streak) — removed

There is no daily streak. One existed — consecutive local calendar days,
stored as `[lastDateISO, count]`, with milestones at 3/7/14/30 — and it was
never rendered anywhere: not in the child's top bar (§3.3, §10.5 — a streak
is a thing a child is nagged by), and after its 🔥 chip left the parents'
view, not there either. A year of tracking with no consumer was dead state
in a 3500-byte cookie, so in July 2026 the machinery went too.

`recordRound` actively scrubs the old `rewards.streak` field from cookies
that still carry it (a patch of `streak: undefined` — JSON.stringify drops
the key). If a streak ever comes back, it belongs on the parents' page, and
it starts from zero.

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
    "at": "einmaleins",
    "pr": { "einmaleins": 3, "rechnungen": 1 }
  },
  "einmaleins": {}, "tippen": {}, "rechnungen": {},
  "vokabeln": {}, "lesen": {}
}
```

- `rewards.at` = game key of the last game played (fox map position).
- `rewards.pr` = the lifetime **star** counter per game, weighted by the
  difficulty each star was won at (trophies derive from these, §8.3; the top
  bar's star total is their sum). The short field name is a cookie-budget
  decision; the UI never says "points".

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
resetAll()                     // delete the cookie (settings gear "Alles" row — §3.4)
resetGame(name): boolean       // drop one game's section + its pr counter (settings gear — §3.4)
withoutGame(state, name)       // the pure core of resetGame, unit-tested
exportState(state?): string    // the whole state as pretty JSON — the backup file
parseBackup(text): object|null // total-or-nothing: junk/arrays/over-budget → null
replaceState(state): boolean   // a parsed backup becomes the cookie, whole
```

**Backup (the gear, adult-side, §3.4):** the whole site lives in one cookie on
one device, so a cleared cache or a new phone silently deletes every star. The
gear's „Fortschritt sichern" downloads `exportState()` as
`schlaufuchs-fortschritt.json`; „Fortschritt laden" reads a file back through
`parseBackup` (total-or-nothing — a bad file changes NOTHING and says so) and
replaces the cookie, then reloads. Importing overwrites a child's progress, so
the button arms first, exactly like the reset rows. The file is a
user-initiated download that never leaves the device by itself — the privacy
page stays true.

> **Trade-off note**: `localStorage` would allow more space; the cookie is a
> deliberate product decision. The budget works with the compact encodings
> specified per game — tightest case Vokabeln (§13.4), which caps tracked
> packs. `storage.js` is the single place a backend swap would happen.

---

## 10. Game 1: Einmaleins — region **Einmaleins**

Master the multiplication tables 1–10. Journey theme: `village` — the fox
walks the village lane; goal node: ringing the school bell.

### 10.1 Flow

1. Region tap → instantly into a round at the last difficulty & table
   (first visit: Leicht, 2er-Reihe).
2. Round of 10 — 12 on Schwer (§7.3, `ROUND_SIZE`): `7 × 8 = ?`, journey
   strip on top (§8.2).
   German divides with a **colon**, and a colon sits on the baseline: between
   two 40px numerals `12 : 3` reads as a label and its value. It is wrapped
   (`eqHTML()`) and lifted to the optical middle, in the question and in the
   aid, which prints the same equation twice. `÷` is already centred and is
   never touched.
3. Wrong → her own answer struck through in red, the correct equation in green
   under it, **a dot-grid visual aid** (7 rows of 8 dots), box drops, re-queue
   per §7. It stays until **she enters the correct answer herself** (§8.1) —
   a timer would take the answer away from exactly the child who needs longest
   to read it, and a "Verstanden" button was pressed without being read. The
   card can hold ten rows of dots, so the dots scale with the viewport and the
   scene yields its row.
4. Summary overlay, kept deliberately quiet: stars, one muted line of numbers
   (`{ok}/{total}` and `+6 ⭐`), the price of the next star (§10.3), the tempo
   symbol when the round awarded one (§10.6 — a symbol and its name, never a
   time), the trophy if one was earned, and **one** button carrying a random
   congratulation, which opens the level picker (§3.4). A child who has just
   won reads almost nothing — the stars say how it went and the trophy is the
   prize, so neither gets a sentence of its own. The map and the level picker
   stay reachable above the sheet, in the bar and on the chip.
5. **The level picker** is where the game starts and where every round ends. It
   also opens from the chip (which wears a border and a caret, because it read
   as a caption and was never pressed). The chip carries the **village's own
   symbol** (`region-einmaleins`, the houses), so the game says which place on
   the map it is without naming it — the same job the trophy does for the
   Pokalraum (§3.2).

   **The fox stands on the level she is playing** (`levelfox.js`). A coloured
   border was the only thing saying "you are here", and a border is not a
   place. Tapping another tile sends the fox hopping across the list — the
   island's own gait (`mapwalk.js`) — and the level opens when it lands. Since
   the picker is dismissible, closing it with no round behind it starts the
   level the fox is standing on, rather than leaving an empty stage.

   The chip is `flex: 0 0 auto` inside `.stage`'s flex column and keeps a 44px
   `min-height`. With `min-height: 0` it was a shrinkable flex item: on Schwer,
   whose keypad is a row taller than Leicht's four choice buttons, the stage
   crushed it to 16px around 27px of content and its bottom border ran through
   the label. Its caret is drawn from two borders, not typed as `▾` (U+25BE) —
   a glyph is whatever font the phone falls back to.

   It is **one scrollable
   list of every level the game has**, in three colour-coded bands — Leicht
   green, Mittel amber, Schwer red — each under a plain, unclickable heading,
   **three tiles to a row**. Four to a row squeezed a Schwer tile's nine stars
   and its tempo badge into ~73px, where six stars read as three and the badge
   read as a smudge; three gives each tile the room to carry its two promises at
   a legible size, and the list simply scrolls a little further.
   The bands are **saturated enough to carry a gold star**, and each star wears
   a **white outline** (four hard drop-shadows — `-webkit-text-stroke` does not
   touch a colour emoji). Gold on a warm band is gold on gold at any opacity;
   what separates them is an edge, not more colour. The stars a tile still has
   to give are the whole promise of the tile, set three to a row so nine read as
   a filled 3×3 card and six as two even rows — the fullness is the message. A
   tile that has also been *known fast* wears its tempo badge as a small **medal
   — a white disc** — in the corner (§10.6): the disc lifts 🐇/🚗/🚀 off the busy
   band and marks it as a thing *won*, apart from the stars still on *offer*. It
   is what a mastered tile, all stars taken, still has left to promise.
   Difficulty is not a control: choosing a tile chooses both. Leicht shows its
   five tiles (Reihen 1, 2, 5, 10 + „🎲 Alle"), Mittel eleven, Schwer nine
   (Reihen 2–9 + „🎲 Alle" — nothing about ×1 or ×10 is hard, §10.2); **no
   tile is ever disabled**, where six padlocked ones used to sit in the Leicht
   grid. A saved tile the current difficulty does not offer falls back to the
   2er-Reihe (`coerceTable`). The list opens focused on the tile being played
   (`aria-current`), which scrolls it into view.

### 10.2 Difficulties

| | Content | Round | Input |
|---|---|---|---|
| Leicht | Reihen 1, 2, 5, 10; dot-grid hint always visible | 10 | multiple choice (4 buttons) |
| Mittel | all Reihen 1–10 | 10 | on-screen keypad |
| Schwer | Reihen 2–9, factors 2–9 only; gap questions (`_ × 7 = 42`) and division mixed in | 12 | keypad |

„Alle gemischt" draws across tables weighted by the adaptive boxes.

**Schwer must be hard** (`HARD_TABLES`). No question on Schwer ever contains a
factor of 1 or 10 — 1×1 or 8×10 inside a round sold as "Schwer" tells the
child the label lies — and the 1er and 10er tiles do not exist on Schwer at
all. Its mixed pool is the 8×8 hard core (factors 2–9).

**A fixed Reihe on Mittel/Schwer holds both orientations** (the 4er-Reihe asks
4×7 *and* 7×4, separate Leitner items). With ten facts and ten questions the
old pool asked every fact every round, mastered or not; a pool larger than the
round (19 items on Mittel, 15 on Schwer) is what lets the box weights of §7.2
actually choose — known facts rest, weak ones return, like a vocabulary
trainer. Leicht keeps the plain ten-fact row: a beginner is meant to meet her
whole Reihe.

**Intrinsic hardness weights the draw** on Mittel and Schwer:
`pairHardness(t, f)` scores a fact 0–6 from its factors (1/10 free, 2/5 easy,
3/4/9 medium, 6/7/8 hard, squares one step easier than their neighbours), and
the session is created with `boost = 1 + hardness` (§7.3). 7×8 comes up about
seven times as often as 2×2 in the same box; the Leitner weight still
dominates, so a *struggling* easy fact outranks a mastered hard one.

**On a fixed Reihe the unknown is never the Reihe itself.** `12 : 3 = ?`
inside the 4er-Reihe answers itself — every answer in that round is a partner
of 4. Gap and division questions solve for the *other* factor (`28 : 4 = ?`,
`4 × _ = 28`); only „Alle gemischt" may ask in both directions. `questionFor`
takes the round's table for this (0 = mixed).

**The division sign follows the language**: `":"` in German, because that is
what German schools write and a child who has only ever seen `:` reads `÷` as a
decoration; `"÷"` in English. It is the `divSign` key, injected into the pure
`questionFor(id, difficulty, rng, divSign, table)` — `logic.js` stays free of
i18n. Anything that reprints the equation (the aid card) must build it from
`question.text`, never from `t` and `f`.

### 10.3 Stars (per table & difficulty)

≥ 60 % → ⭐ · ≥ 80 % → ⭐⭐ · 100 % → ⭐⭐⭐ of the round first-try correct
(`starsFor`/`starNeeds` scale with the round, so a 12-question Schwer round
needs 8 / 10 / 12 where a 10-question round needs 6 / 8 / 10). **The percent
bands are taken loosely, not literally** (§10.5): on a short round two bands
can name the same score — 80 % and 100 % of three tasks are both „all three" —
and two star groups would then land on one waypoint together. `starNeeds`
pulls the thresholds apart so every star has its own score: a three-task round
pays at 1 / 2 / 3, a four-task round at 2 / 3 / 4. Ten-question rounds are
unchanged. (The same rule, duplicated per game as ever, D11.)

**Accuracy is the only criterion for stars.** Speed is not: a child who reads
or taps slowly knows the times tables just as well, and being slow must never
cost anything. Speed has its own, purely additive ladder (§10.6), and the rule
that survives is: **the child never sees a number of time** — no seconds, no
duration "shown as a fact", because a number still whispers *faster is better*
to the child who is slow and right. A symbol that only ever climbs is allowed;
a figure is not.

A wrong answer leaves its item unsolved, so the round asks it again: a round
ends only when every drawn item is *solved*, and only the first try counts for
stars.

The summary names the price of the next star (`nextStarGoal`), quietly, under
the score — otherwise a child who scores 9/10 has no way to learn why they
still have one star.

### 10.4 Cookie state (`einmaleins`)

```json
{
  "d": 1, "t": 7,
  "box": "342103...",                    // 100 digits: pairs 1..10 × 1..10 canonical order
  "stars": { "0": "302...", "1": "...", "2": "..." },  // per difficulty: 11 digits (10 tables + mixed)
  "tempo": { "0": "030...", "1": "...", "2": "..." },  // same layout: tempo tier 0-3 per tile (§10.6)
  "rc": "040100..."                      // 100 digits: recall class per pair, parents only (§20)
}
```

~320 bytes. The box and rc strings are shared across difficulties.

### 10.5 The round's scene (sky, meadow, basket, fox)

One picture, no prose. `createJourney()` in `journey.js` draws all of it:

- **the sky** holds the stars still to be won on this tile, as a small
  constellation rather than a row of three;
- **the basket stands at the end of the path** — it is the goal *and* the place
  the stars land, so the reward and the finish line are one object. The fox's
  last step lands beside it. There is no themed goal icon in any theme any
  more; `THEMES` is a path colour and three obstacles.
- **the path** carries the fox. **Every asked question is its own waypoint**:
  the fox steps forward when a question ends, however it went — onto a green
  node for a clean answer, onto a **red** node for a missed one. A missed item
  is re-queued within the round, so the red step also **grows the path by one
  node** (the scene re-renders in place, strides narrowing — `sceneGeometry`
  keeps the ten-node width, §10.5): the fox reaches the basket exactly on the
  round's last answer, and never freezes on a node while new questions come.
  This holds in **every game and every level**; `advanceMissed()` is the shared
  journey API for it, called when an aided question finally ends.

A round awards at most **three** stars in every difficulty; what scales with
difficulty is what each star *counts* (×1 / ×2 / ×3, §8.3). The sky therefore
always holds three slots. (Leicht offers fewer stars across the whole game —
5 tiles to Mittel's 11 and Schwer's 9 — but never more than three in one
round.)

**On Mittel and Schwer a sky slot holds the stars it pays** — two of them, or
three, drawn smaller so the group takes about the room one big star took
(`starCluster(worth)`, `createJourney(…, { worth })`). It used to be one star
with a `×2` tag written under it, and a tag is a sentence: a child who cannot
read one still had to be told. Now a Schwer sky simply holds nine stars and a
Leicht sky three. Until any of this existed, the claim that harder work pays
more appeared only inside a picker a child never opened.

The whole cluster is one `<g>`, so one transform carries every star in it into
the basket; given a keyframe each, none of them would move under reduced motion.

**At most one group flies per waypoint.** On a short round the ⭐⭐ and ⭐⭐⭐
thresholds fall on the same last task (80 % and 100 % of three tasks are both
„all three"), and two groups leaving one waypoint together read as a glitch.
`setStars` therefore throttles its landings to one group per call — the game
calls it once per waypoint — and `finish()` flies whatever is still owed as
the fox reaches the basket.

An earned slot flies into the basket and stays there, leaving a grey ghost of
the same shape behind. The flight is a CSS `transform` + `transition`, never a
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

### 10.6 The tempo ladder (memorized, not counted)

A child who counts her way to every answer keeps every star — accuracy is all
they measure — and that is exactly why counting is the rational strategy. The
tempo ladder is the reward that counting can never reach: **a second, purely
additive collectible** for *knowing* the fact.

- **Three tiers, only upward**: 🐇 hare → 🚗 race car → 🚀 rocket
  (`tempo-hare/-car/-rocket` in the graphics registry). Tier 0 draws
  **nothing at all** — an empty corner is the lowest state. There is no snail:
  the ladder must pull, never label.
- **Measured per question**: time from the question appearing to its first
  answer, kept only for **first-try-correct** questions. The round's verdict
  is the **median** of those times (`median` in `logic.js`) — one long think
  about a new fact must not hand the slowest question a veto, as a sum or a
  mean would.
- **Tiers** (`tempoTier(ms, difficulty)`, bounds in `TEMPO_TIERS`): Leicht is
  a tap on one of four choices (🚀 ≤ 3 s, 🚗 ≤ 5 s, 🐇 ≤ 8 s median); the
  keypad rows also pay for typing, so their bounds sit later (≤ 4.5 / 7 /
  11 s). Plain named constants — retune them after watching a real child.
- **Gated by two stars** (`awardTempo`): a round below ⭐⭐ (80 % first-try)
  awards no tier, so fast-and-wrong never pays. The stored tier merges by
  `max` — like the star basket, it can only climb (§10.5).
- **The ⚡ moment**: a single answer at rocket speed flashes a small decorative
  bolt the instant it lands (transition, not keyframe — reduced motion sees it
  briefly and calmly, §10.5), with a short bright zap (`sfx.blitz`, muted like
  every sound, §5). A slow answer sees *nothing*; there is no negative moment
  anywhere in the ladder.
- **Where it shows**: as a corner medal — a small white disc — on the picker
  tile (`aria-label` says it in words: „Tempo: Rennauto"), and as one quiet line
  in the summary —
  symbol and name, with „Neuer Tempo-Rekord!" when the tile's tier improved.
  **Never a number with a unit of time**, anywhere the child can see (§10.3).
- **Worth nothing but itself**: no stars, no points, no trophies. ⭐ stays the
  site's only currency (§8.3); the badge is the prize, like the fox's poses.
  What it buys the game is a reason to replay a mastered (✓) tile — which is
  exactly where fluency training happens.
- The same per-question observations feed the parents' **per-fact recall
  grid** (§20) — as a damped class per pair, never as a stored time.
- **Lesen carries the same ladder** with its own bounds and clock start
  (§14.4); the mechanics are duplicated, pinned by a parity test.

### 10.7 Guarding a round that is not saved yet

Nothing is written until `endRound()` (§10.4), so a round exists only in memory
while it is played, and every way off the page costs all of it. A child on a
phone finds three of them by accident, and each needs its own answer.

- **Pull-to-refresh** — a downward drag near the top of the screen. Closed for
  good with `overscroll-behavior: none` on the root (`schlaufuchs.css`). The
  stage never scrolls, so no overscroll on this site was ever doing anything a
  child wanted.
- **The Android back gesture** — a swipe in from the screen's edge. **It cannot
  be disabled.** It belongs to the operating system; no web API suppresses it,
  and `overscroll-behavior-x` — routinely named as the fix — is not one, since
  it governs only the browser's own overscroll navigation. What a page *can* do
  is own a history entry for the gesture to consume, so that going back lands
  inside the document instead of leaving it. `leaveguard.js` pushes that
  sentinel, and pushes another on every `popstate`: a child swiping twice in a
  second is caught twice. The page therefore never travels backwards on its
  own — when leaving is the answer, the guard navigates to the map itself.
- **The map button** in the top bar (§3.3), one tap from the keypad. It stays a
  real link — it says where it goes, and it works with JS broken — and
  `initTopBar({ onLeave })` hands it to the same guard.

All three arrive at one decision (`leaveAction`, pure and tested):

| on screen | what a leave attempt does |
| --- | --- |
| the question is already up | **stay** — this gesture answers it with „Weiterspielen", like Escape |
| a round is running and an answer was given | **ask** — „Runde verlassen? Die Sterne aus dieser Runde sind dann weg." |
| a round with nothing answered yet, the picker, or the summary | **leave** — nothing is at stake; no dialog nobody needs |

Whether "an answer was given" is `hasProgress(session.progress())`
(`adaptive.js`, pure and tested): a solve grows `solved`, and a first miss
drops `firstTryOk` below `total`. A round the child has merely looked at costs
nothing to leave, so leaving it deserves no question.

The question is a normal overlay (§3.4), so Escape and the backdrop answer it
with „Weiterspielen". That safe answer is the orange button and it takes the
focus: a child who presses Enter on a question she did not ask keeps her round.
„Zur Karte" is the quiet second button — never the reflex, always reachable.

**Resume, not just guard.** The guard covers the exits a page can see; an
incoming call, a tab evicted under memory pressure, or a gesture that slips
past it still cost the round. So after every recorded answer the round is
mirrored into `sessionStorage` (`roundstore.js`: the queue snapshot from
`session.snapshot()`, the level, the tempo raw material), and on load the game
rehydrates it — same tile, same question queue, the fox standing where she
stood — with no picker and no dialog: the best interruption is one a child
never has to think about. The mirror lives in sessionStorage on purpose (a
round resurrected a week later over long-moved boxes would be a lie), is only
trusted after `validResume` (a foreign or truncated snapshot falls back to the
picker), and is dropped at the three moments it stops being true: a finished
round (`endRound` wrote the cookie), a fresh start from the picker (a chosen
tile outranks an interrupted round), and a **confirmed** „Zur Karte" on the
guard's sheet — leaving on purpose means it. The guard stays underneath as the
answer for exactly that deliberate exit.

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

Workbook-style arithmetic within the number range **100**: **＋ − ×÷**, number
walls (Rechenmauern), operation grids (Rechenquadrate) and „Mix". Journey theme:
`mountain` — the fox climbs; the basket at the summit is the goal, exactly as in
the other games (§10.5). Keypad input on every difficulty (like einmaleins,
§10; never multiple choice). The task types are modelled on a real 2nd-grade
workbook. **Shipped 2026-07; redesigned around the workbook before release.**

### 12.1 Tasks, cells, modes & difficulties

**The task/cell model.** A round is a sequence of *tasks*; a task holds one or
more *cells* — the numbers the child types, each on the same keypad. A plain
equation is a task with one cell; a number wall has three, a decomposition
scaffold seven, a division with remainder two. The line kinds and the scaffold
read in one order, so their cells activate themselves; **in a wall or grid the
child picks which blank to fill herself** — tapping a „?" activates it, only
then does the keypad apply, and after every fill she picks again. The numbers
she entered herself stay marked (blue, the colour of what you have) next to
the printed givens. One task is one engine item, and **every asked task is
its own waypoint** (§10.5): when the task ends the fox steps forward — onto a
green node if it went cleanly, onto a red one if any cell was wrong, and then
the path grows by one node for the re-queued ask, so she still reaches the
basket exactly on the round's last answer. She stumbles at the moment of the
wrong cell, and a task counts as first-try only if every cell was — with ONE
exception: **a task with more than one cell forgives its first wrong answer**.
A wall or a seven-cell scaffold is a lot of typing, and one slip must not sink
the whole waypoint: the cell shakes, the entry clears, the child rethinks — no
aid card (it would give the answer away), no penalty. Only the second wrong
answer in the task is a real miss. A one-cell task is one calculation and
keeps the einmaleins contract: wrong is wrong. Every cell has an *aid* — a binary
sub-equation the wrong-answer card draws (§8.1: number line for ±, dot grid
for ×/÷; no timer, no „Verstanden" — the way out is entering the right
answer). A wall brick's aid is chosen at miss time from the bricks visible
right now; a grid cell's is rowHeader ∘ colHeader. A plain ± miss at
Mittel/Schwer additionally shows the **tens-first decomposition** of the
failed sum — the workbook's own teaching device, lent to the aid.

**Six mode tiles** (＋ − ×÷ 🧱 ⊞ 🎲Mix) per difficulty section in the picker
overlay. ×÷ is one tile: einmaleins already trains the tables deeply — on the
Rechenberg they are applied, not drilled. „Mix" pools the *equation* modes
(＋ − ×÷) at the chosen difficulty — not walls or grids, whose multi-cell tasks
would balloon a mixed round. The difficulty × mode grid the generators realise:

| | ＋ / − | ×÷ | 🧱 Mauern | ⊞ Quadrate |
|---|---|---|---|---|
| Leicht | within 20 · ±  whole tens (`27 + 60`) | ×→+ link (`3 × 6 = 6 + 6 + 6 = ?`) · exact ÷, tables 1–5 | base given, climb with + (3 cells) | 2×2 „+" grid, small numbers (4 cells) |
| Mittel | crossing the ten: ± one-digit with carry/borrow (`54 + 9`, `80 − 4`) · two-digit with and without (`25 + 32`, `22 + 38`, `91 − 36`) | × full tables · exact ÷ full tables | top + one flank given, descend with − (3 cells) | 2×2 „−" grid ≤ 100 with a **hidden column header** and its anchor cell (4 cells) — a given cell only exists to buy a header |
| Schwer | **Zerlegen** scaffold (7 cells, below) · gaps (`? + 27 = 61`, `82 − ? = 10`) — no mixed-operator chains: too hard, and a ＋ chain carries a −, so both tiles would ask the same questions | **division with remainder** (`49 : 5 = ? R ?`, 2 cells — the remainder slot is always asked and is sometimes genuinely 0: „R 0" is an answer the child gives) · ×/÷ gaps (`? × 7 = 28`) | mixed blanks, + and − in both directions | 2×2 ± grid with a **hidden row AND column header**, each bought from its own anchor cell (no × grid: the tables are einmaleins' whole game) |

A wall's six values are pairwise **distinct**, and so are a grid's four headers
and its four interior values — a puzzle with two 9s reads as a trick.

Every number a task shows or asks stays **within 100** — Schwer gets hard
through *format* (steps, gaps, remainders, missing bricks), never through more
digits. × reuses the einmaleins multiplication generator where it overlaps the
tables (`games/einmaleins/logic.js`). The division sign is injected
(`t("divSign")`: „:" German, „÷" English), so the logic module stays i18n-free —
the einmaleins convention; the remainder is written `? R ?` in both languages.

**The Zerlegen scaffold** is the workbook's „rechne schriftlich" with its
blank rows („  +   =  "): the head sum is printed, the two strategy rows are
EMPTY, and the child constructs the whole tens-first scheme herself — for
`13 + 69` she enters, in reading order, `13`, `60`, `73`; `73`, `9`, `82`; and
`82` into the head. Seven cells: the copies teach the scheme's shape, the
split is the actual decision, the last cell is the head's answer. (A
free-choice split strategy is not validatable with a keypad — the tens-first
scheme is the one being taught.)

**Consciously skipped:** the workbook's hardest wall variant (assemble a wall
from loose numbers, one left over) is not a keypad answer and is out of scope.

### 12.2 Adaptive & stars

The adaptive engine tracks a small fixed set of **skill buckets** (28 as
shipped — e.g. „addition with carrying, two-digit", „number wall with a missing
base brick", „division with remainder"), listed canonically and **append-only**
in `games/rechnungen/logic.js` (`BUCKETS`): a bucket's index is its slot in the
Leitner box string, so a new one joins at the end and no saved box shifts. (The
list was rewritten wholesale for the workbook redesign — legal exactly once,
because the game had never shipped.)

A round does not ask a bucket once — it asks **concrete tasks**, each freshly
generated from a bucket, so a re-queued miss returns as the same skill with new
numbers. The shared engine (`adaptive.js`) draws over the cell's buckets
*expanded* into variant item-ids (`bucketId + BUCKET_COUNT · v`); each
variant's box is seeded from its bucket, so weak skills are weighted up, and the
round's per-bucket outcome is folded back at the end (`foldBoxes`).

**Round sizes are per mode and difficulty** (`roundSizeFor`): equations **10**
tasks (Schwer ± **6** — half of them are seven-cell scaffolds), Mix **8**
(Schwer **7**), walls **4** (12 cells), grids **3** (9–12 cells) — every round
lands at roughly 10–20 keypad entries, a comparable effort per star. Stars
per mode & difficulty with the einmaleins criteria (§10.3). The tempo ladder
(§10.6) rides along per mode; its clock runs **per cell** — a wall brick and a
plain sum are each one thinking step, and in a wall/grid the choosing counts as
thinking (switching blanks does not reset the clock) — with its own bounds per
difficulty, loosened after the first play-test so the ⚡ is genuinely
reachable.

The Rechenberg point economy is **108** (six modes × three difficulties, three
stars each, worth 1/2/3): `maxPoints()` in `logic.js` computes it and
`rewards.js`'s `MAX_POINTS.rechnungen` must equal it. The trophy ladder is
lesen's hand-tuned shape scaled to 108 with the first rung pinned at 3, so the
very first perfect Leicht round is a trophy, a first perfect Schwer round buys
two (not three), and Schwer alone (54) cannot fill the shelf (§8.3).

### 12.3 Cookie state (`rechnungen`)

`box` is one Leitner digit per skill bucket (not per task). `stars`/`tempo`
are keyed by mode, each a three-digit string indexed by difficulty — transposed
from einmaleins/lesen, which key by difficulty.

```json
{ "d": 0, "m": "+", "box": "22322...", "stars": { "+": "310", "-": "2", "x:": "", "mauer": "", "quad": "", "mix": "" }, "tempo": { "+": "200" } }
```

The round mirror (§10.7) is written at **task boundaries** only, so a resumed
round re-asks the interrupted task with fresh numbers — same skill, no stale
half-wall.

The parents' view (§20) has **no Rechenberg section**: its skill buckets do not
map to a fact grid a parent recognises, so a report was consciously skipped and
the game writes no telemetry beyond `box` — no dead cookie bytes.

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

Reading **fluency**, not first decoding: the target reader has finished her
letters (2nd grade) and reads sentences correctly but slowly, word by word.
Fluency is fast whole-word recognition, and the two exercise forms here are
the two the reading didactics know for training it as a game: **Blitzlesen**
(a word shown too briefly to spell through — it must be grasped whole) and
**sense decisions** (read a sentence, judge it). There is deliberately **no
letter stage** — this supersedes the earlier "Leicht = Buchstaben" plan
(resolved decision; a reader who still needs letters is below this game's
floor, and speech support for true beginners is deferred with §14.6).

Journey theme: `meadow`. Rounds of **8** items (§7.3) — lengthened from six so a
tile's three stars are real work to collect and a full Pokal ladder asks enough
reading. No SpeechSynthesis in this version: **emoji are the meaning anchors**,
and everything is playable without reading any UI text.

### 14.1 Stages (= difficulty)

| | Stage | Exercise |
|---|---|---|
| Leicht | **Blitzwörter** | a word flashes on a card, then hides; pick its emoji from 4. Short frequent words, 1–2 syllables |
| Mittel | **Stimmt/Blödsinn** | a whole sentence shown **statically, never flashed**; read it and judge it — tap **Stimmt!** or **Blödsinn!**. Two verdicts, but guessing does not pay (below) |
| Schwer | **Leseverständnis** | a short passage (~3 lines) shown **statically, never flashed**; read it, then answer a question about it by picking one of **4 answers**. Comprehension, not a coin-flip verdict |

The three stages climb the fluency ladder: a single word grasped whole (Leicht),
a whole sentence read and judged (Mittel), a passage read and understood
(Schwer). Only Leicht flashes — Mittel and Schwer put the text on screen to be
read, and neither shows a clock. The two-choice Stimmt/Blödsinn is the *easier*
reading step, not a coin-flip pay-out: stars count first-try only (all 8 by
coin-flip ≈ 0.4 %), a wrong verdict forces the aid and re-queues the item
(guessing is slower than reading), the tempo ladder's ⭐⭐ gate makes a fast
guess unprofitable, and `roundPoints` pays only improvements. Schwer raises the
bar to four answers over a passage she must actually read. The tempo ladder
(§14.4) observes silently, its bounds sized to real reading time.

### 14.2 The blitz (`flashMs`, the adaptive hook)

Only **Leicht** flashes — it is the one stage that shows a single word; Mittel
(a sentence) and Schwer (a passage) are read, so `FLASH_MS` has one row and
`flashMs` returns `null` for both. How long a word stays readable comes from its
own Leitner box: `FLASH_MS` (games/lesen/logic.js) runs from generous (box 0:
1.9s) to a real blitz (box 4: 0.5s). A word the child misses drops to box 0 and
comes back generous. This is the mechanic that makes fluency *felt*: the same
word flashes shorter and shorter, and she keeps catching it. The bounds are
plain named numbers to be retuned after watching a real child, like
`TEMPO_TIERS` (§10.6).

- **The child starts the blitz, not the clock.** A word waits behind a
  tap-to-reveal cover (👀 „Bereit? Tippen"); the flash is armed only when she
  taps it, so it never runs before she has looked or even knows a word is
  coming. Until the reveal the four answer emoji are shown but **disabled** —
  she can see what is coming without being able to guess at a word she has not
  seen. A Mittel sentence and a Schwer passage never cover (they do not flash —
  nothing is taken away), so their answers are live at once. The cover is a real
  `<button>` (keyboard-reachable); `armFlash()` lives in `reveal()`, not `askNext()`.
- Answering **during** the flash is allowed — that is the fluent path.
- The hide is **decided by a JS timer and decorated by a CSS transition**,
  never a keyframe animation: `prefers-reduced-motion` kills transitions
  site-wide, so the fade degrades to an instant flip and the mechanic
  survives (same rule as the star flight, §10.5). A stale timer is fenced by
  a question token, so a fast answer plus the 250ms transition can never hide
  the *next* word.
- The word never wraps; an overlong word is shrunk to fit its one line
  (`fittedFontSize`, the §10.1 contract).
- **Wrong answer** (§8.1 aid contract): on Leicht the tapped emoji struck
  through in red, the word shown again **persistently** — no blitz — over the
  SAME four options; the way out is tapping the right one. On Mittel the sentence
  is shown again with the verdict it should have got (😊 „Das stimmt wirklich!"
  or 😜 „Das ist Blödsinn!"); the way out is the right verdict on the same two
  buttons. On Schwer the question is shown again with the answer she should have
  chosen in green („Richtig: …"); the way out is that answer on the same four
  buttons. No timer, no "Verstanden" button.
- **Schwer's question runs on as the passage's last sentence** — same body font,
  size and weight, in one flowing block, not a line of its own. A question that
  stood out (its own line, or the bold display face) let a child skim straight to
  it and answer without reading the passage; run inline she has to read down the
  text to find it. The round's scene (sky + basket, §10.5) also stays on screen
  for a reading question — drawn large, since a reading screen has no keypad to
  leave room for — so she always sees how far she is; it steps aside only while
  the wrong-answer aid is up (as for every kind).

### 14.3 Content (`content.js`), tiles and the adaptive engine

Data-driven and **append-only**: the canonical item order (packs in file
order, items in theirs) is the box digit string's index, so reordering
shifts every child's boxes. German first; content is keyed by language.

- **12 tiles**: per difficulty four themed tiles — Leicht short words `{ w, e }`,
  Mittel Stimmt/Blödsinn pairs `{ ok, no }`, Schwer reading passages `{ text, q, a }`
  (the correct answer authored first, shuffled by `optionsFor`). Both non-word
  difficulties were rewritten **in place** — Schwer from the old Quatsch pairs to
  passages, Mittel from the old long-word packs to pairs (their pack keys kept, so
  their i18n names stayed too): same item positions, so no child's Leitner box
  shifted (the append-only invariant is about order, which was preserved).
- **Deeper tiles (append, never grow-in-place):** a themed tile's pool is grown
  by adding a new pack at the **end of the file** with an `extends: "<primaryKey>"`
  field — same theme, same difficulty, drawn in the same round, but never a tile
  of its own. Appending there keeps every existing id (so no box shifts), and the
  **tile count is unchanged**, so `maxPoints` and the trophy ladder never move
  under the deeper pool. Today each tile is doubled (Leicht 20 words, Mittel 20
  pairs, Schwer 24 passages), so a round of eight samples a large well and rarely
  repeats between runs — 256 items in all. `packsFor` lists only tiles; `poolFor`
  unions a tile with its extensions (`isTile`/`extends`, logic.js).
- A Leicht word carries ONE unambiguous mainstream emoji, unique inside its
  pack, no near-twins. **Distractors are the item's own pack-mates**
  (`optionsFor`): same theme ⇒ plausible, pack-unique emoji ⇒ clearly
  distinct. That holds on the mixed tile too — the home pack supplies them.
- A Mittel item is a **pair** `{ ok, no }`: a true sentence and a silly one on
  the same theme, alike in shape and length (each ≤ 60 chars). `questionFor`
  draws which face shows per encounter, so an item's verdict cannot be memorized
  — only read. Guessing stays unprofitable by the existing machinery alone
  (§14.1): first-try-only stars, the aid re-queue, the tempo ⭐⭐ gate, and
  improvement-only points. `optionsFor` returns `null` — a verdict is not a
  choice of options.
- **Tiles** (the picker): difficulty × (4 packs + „🎲 Alle" mixing the whole
  difficulty) = 15 tiles, each worth three stars. Same picker contract as
  einmaleins (§10.2): stars-left drawn on the tile, the fox walks, the walk
  opens the tile. `MAX_POINTS.lesen = 5·3·1 + 5·3·2 + 5·3·3 = 90`, computed
  from the real tiles (`maxPoints()`), no longer a guess.
- Boxes per item (§7), rounds of 8, no hardness boost — the Leitner weights
  alone decide what returns.

### 14.4 Stars & tempo

Stars are the einmaleins ratios exactly (§10.3): ≥60 % ⭐ · ≥80 % ⭐⭐ · 100 %
⭐⭐⭐ first-try — on a round of eight that is 5, 7, 8. The earlier "⭐⭐⭐ = three
consecutive perfect rounds" plan and its `c3` counter are **dropped**
(resolved): a counter that resets is loss framing (§8), and it bought nothing
the ratio does not.

**The tempo ladder applies, per §10.6** (the earlier deferral is lifted: with
the tap-to-reveal cover every tile can be timed fairly, so all fifteen tiles
can earn the badge and the picker reads consistently). Everything §10.6 says
holds — median of first-try-correct answers, `awardTempo`'s ⭐⭐ gate, stored
only upward as `tempo` digit strings beside `stars`, shown as the corner medal
on the picker tile and one quiet summary line, never a number of time — with
two lesen-specific rules:

- **The clock starts when the child can see the question**: at the reveal tap
  for a Blitzwort (the cover time is hers for free — she starts the blitz
  *and* the clock, §14.2), and at the show for a Mittel sentence or a Schwer
  passage.
- **`TEMPO_TIERS` are lesen's own** (games/lesen/logic.js): Leicht mirrors
  einmaleins' Leicht (a tap on one of four choices); Mittel is sized to
  *reading* a whole sentence then judging it (rocket ≤ 5s); Schwer's bounds are
  the most generous, sized to reading a whole passage (rocket ≤ 10s). Each stage
  sits strictly later than the one before, so the rocket rewards fluent reading,
  never lucky guessing. Educated guesses — retune after watching a real child,
  via `playLesen({ delayMs })`.

The mechanics (`median`, `tempoTier`, `awardTempo`, the icons and keys) are
duplicated from einmaleins like the star rules, pinned by the D11 parity test;
no recall telemetry (`rc`, §20) for lesen. The ⚡ moment additionally plays a
small zap (`sfx.blitz`, §10.6) — in both games.

### 14.5 Cookie state (`lesen`)

```json
{ "d": 1, "p": 2, "box": { "de": "3421…(128)" }, "stars": { "0": "31000", "1": "00000", "2": "00000" }, "tempo": { "0": "30000", "1": "00000", "2": "00000" } }
```

`d` difficulty 0–2, `p` tile 0–4 (4 = Alle), star and tempo digit strings with
five slots per difficulty (Alle last; `tempo` per §14.4, same layout as
einmaleins' §9.2). `box` is keyed by language, so an English set adds a second
string without migration. Maxed ≈ 270 bytes raw — the budget test in
tests/lesen.test.js holds the whole cookie under §9.2's 3500 even with every
game maxed.

### 14.6 English version & speech

German content only for now. English reading needs a genuine phonics
approach (CVC words, sight words) — a separate content set, later milestone;
the engine and the cookie shape are ready for it. SpeechSynthesis (tap a
word to hear it) is deferred to the same milestone: for a fluency trainer
the emoji anchor suffices, and speech is what a true-beginner stage would
need first.

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
- **Buttons — one shape, three roles.** Every button is the same raised tile:
  one corner (`--radius`), one shadow (`--shadow`), one press dip (`--btn-press`
  / `--btn-press-lg` for full-width), the display face. Only the FILL varies,
  and it obeys the palette law above:
  - **Action** — solid `--orange`, white text (`.primary`). One per screen.
  - **Choice** — white `--panel`, ink text (`.mc`/`.keypad`/`.verdict`/
    `.tilegrid`/`.langbtn`/`.iconbtn`). The default tappable tile.
  - **Info** — `--depth-soft` fill, `--depth` text (`.btn-menu`: For parents,
    Save/Load) — it goes to what-you-have / the grown-up's side.
  - **Selected** (a toggle that is on) flips to solid `--orange` (the language
    chip, the sound switch).
  - **Destructive** arms from a quiet Choice tile to solid `--err` (`.resetbtn`).

  The one deliberate exception is `.ghost` (§10.7): a text-only "no, don't" that
  must not look like a tile. A new button picks a role above — it does not invent
  a sixth look. The full token block and rationale live at the top of
  `assets/css/schlaufuchs.css`.
- **Reward & currency type scale.** ⭐ is the only currency, so the two labels
  that carry it are single `:root` tokens, one legible size each on the 360px
  baseline: `--fs-trophy-name` (a trophy's name under its cup, shelf and summary)
  and `--fs-star-note` (every "+N ⭐ until the next thing" — locked shelf slots
  and the summary's goal line). Colour follows the law: `--depth` when it is the
  very next thing to chase or a thing owned, muted otherwise. New reward text
  reuses a token; it does not pick a fresh px size.

---

## 16. Testing & Quality

- **Pure logic lives in DOM-free modules** and is unit-tested with
  `node --test` in `tests/`: adaptive engine (selection weights, re-queue
  timing, box transitions), question generators, scoring/stars, trophy
  thresholds, i18n lookup/fallback, cookie encode/decode/budget.
- GitHub Actions workflow runs the tests on every push.
- **i18n completeness test**: every key present in every language, fails CI
  otherwise.
- **A test that cannot fail is decoration.** Every new test is verified by
  breaking the behaviour it guards and watching it go red — `tools/mutate.sh`
  does this safely, restoring the file from a copy rather than from git, and
  refusing to claim anything when its pattern matched nothing.
- Manual checklist per release: fresh-profile smoke test on a real phone,
  cookie round-trip after browser restart, subpath serving, language toggle
  on every page, SpeechSynthesis on iOS Safari (user-gesture rule), map
  region states at 0/⅓/100 % stars, **and the back gesture mid-round** —
  §10.7 is the one guarantee no emulator can fully confirm.

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
§8.3; stars appear on the map badge; fox stands on the village after playing.

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

**M6 — Lesen.** Per §14, German content, no speech (§14.6).
*Accept:* every exercise fully playable without reading UI text; rounds of
6; the blitz survives `prefers-reduced-motion`; Schwer is four-answer reading
comprehension over a passage, where a guess never pays.

**M7 — Polish.** Refined map/fox art, service worker for offline play,
`prefers-reduced-motion` audit.

**M8 — Adventure mode.** Per §18.7.

---

## 20. The parents' view (`parents.html`)

Children's learning apps show parents streaks and stars, because engagement is
all they have. This site has the **knowledge**, so it shows that.

- Reachable from the settings overlay on every screen, and from the map's foot.
  Not linked from inside a round: it is not for the child.
- **Read-only.** It imports no writer, writes no state, sends nothing anywhere —
  one stray `setGame` while drawing the heat grid would rewrite the boxes it is
  drawing. `tests/parents.test.js` enforces that it never imports any setter,
  reset included. Resetting progress is not here at all: it is a per-game reset
  in the settings gear (§3.4), so this page is only ever information.
- **The Leitner box is the diagnosis of accuracy** (§7.1), and it is already
  stored. Boxes 0–1 render as *slips*, 2 as *not practised yet*, 3–4 as
  *solid*, laid out as the 10×10 times table a parent learned at school.
  `clampBox` defaults an unknown fact to **2**, not 0, which is why a
  beginner's grid shows no red: reporting an unasked fact as one the child got
  wrong would be a lie.
- **The recall digit answers the one question the box cannot**: does she
  *know* 7×8, or does she compute it every time? The game writes one digit per
  pair (`rc`, 100 chars beside `box`): 0 = never timed, 1–4 = the tempo tier
  (§10.6) + 1 that a **damped tracker** has settled on — each first-try-correct
  answer moves the digit one step toward what was just seen
  (`recallStep`/`foldRecall` in `games/einmaleins/logic.js`), so a lucky tap
  cannot paint "auswendig" and one distracted answer cannot erase it. Unlike
  the child's tile badge it also drifts *down*: this is diagnosis, not reward,
  and recall that fades must show. In the grid, a **solid** fact whose digit
  is 4 darkens to **auswendig / by heart** (`cellState` in `parentstats.js`);
  a solid fact without a fast record is simply solid — absence of timing never
  accuses a child of counting, and speed on a slipping fact is guessing, not
  knowledge, so it never lightens *weak*. The legend carries all four counts.
- „Hier hilfst du am meisten" lists boxes 0–1, hardest first, capped at twelve.
- **Lesen reports beside einmaleins**, from the same boxes and nothing more:
  every word as a small card whose colour square is its box state
  (`sightState` in `parentstats.js`). For a word, **box 4 honestly means „auf
  einen Blick"** — the blitz (§14.2) shortens the flash as the box climbs, so
  box 4 is only reached and held by reading the word at the shortest flash;
  the box itself carries the speed story and no `rc`-style second tracker is
  needed. Sentences get a tally line, not a card wall (a parent acts on
  words; box 4 counts as *sitzt* there — a sentence is comprehension, not
  sight speed). Each game's block appears only once that game has been
  played, and either alone defeats the page's empty state. Lesen keeps no
  `tm`/`rd` practice counters yet, so it has no time table — deliberate:
  cookie state earns its bytes only with a consumer, and the word cards are
  the consumer the boxes already pay for.
- **Practice time is the one clock in the product** (§10.3 keeps it away from
  the child). Aggregated per difficulty as `tm`/`rd`; per question only the
  recall *class* above survives the round — never a stored time.
  `addPractice()` caps one round at `MAX_ROUND_SECONDS` (a forgotten tab is
  not practice) and banks **no** time for a non-finite clock — capping a NaN
  to fifteen minutes would credit practice that never happened. The pace line
  says out loud that time is not a goal.

Resetting progress is **not** on this page — it is the per-game reset in the
settings gear (§3.4). `resetGame(name)` (and its pure core `withoutGame`) drop
one game's section (stars, boxes, practice time) **and** its `pr` trophy
counter, scrub the fox's saved spot if it sat there, and leave every other game,
the settings and the language untouched. It doubles as the way to tidy a stale
dev cookie.
