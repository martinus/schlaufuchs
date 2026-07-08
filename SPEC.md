# Schlaufuchs — Specification

**Spielerisch lernen und ein Schlaufuchs werden.**

Schlaufuchs is a collection of educational browser games for children, framed
as a small illustrated world: the landing page is a **map**, each game is a
**region** on it, and the fox mascot travels through it as the child learns.
The site is fully static, hosted on GitHub Pages under
**https://schlaufuchs.ankerl.com**. All state (progress, stickers, settings)
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
- **Really motivates, never punishes**: journeys, stars, stickers, streaks,
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
| Source | `main` branch, root directory |
| Domain | `schlaufuchs.ankerl.com` |
| HTTPS | Enforced via GitHub Pages settings |

Setup steps:

1. Add a `CNAME` file at the site root containing `schlaufuchs.ankerl.com`.
2. In the DNS zone for `ankerl.com`, add a `CNAME` record:
   `schlaufuchs` → `martinus.github.io`.
3. In the repository settings, enable GitHub Pages for `main` and turn on
   *Enforce HTTPS* once the certificate is provisioned.

The site must also work when served from a subpath
(`https://martinus.github.io/schlaufuchs/`). Therefore: **only relative URLs**
in HTML/CSS/JS — never absolute paths like `/assets/...`.

---

## 3. Site Structure, World Map & Navigation

```
/
├── CNAME                     # schlaufuchs.ankerl.com
├── index.html                # World map (landing page), §3.1
├── album.html                # Sticker album, §3.2
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
│   │   ├── rewards.js        # Stars, stickers, streak, fox level (§8)
│   │   ├── journey.js        # Journey path strip used inside rounds (§8.2)
│   │   ├── audio.js          # Feedback sounds (WebAudio, no asset files)
│   │   └── confetti.js       # Celebration effect
│   └── img/
│       ├── fuchs.svg         # Mascot: poses + cosmetic layers (§8.4, §15)
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
(viewBox `0 0 360 560`, scaling to the viewport width, centered with sky/
grass fill bleeding to the edges on wider screens). It shows five themed
regions; **each region is one big tap target that immediately launches its
game** (instant resume, §3.4) — there is no walking and no intermediate page.

| Region (DE / EN) | Game | Visual anchor |
|---|---|---|
| Zahlendorf / Number Village | Einmaleins | village with a school bell |
| Rechenberg / Math Mountain | Rechnungen | mountain with a summit |
| Wörterwald / Word Forest | Vokabeln | forest with animals |
| Tippsee / Typing Lake | Tippen | lake with a boathouse |
| Lesewiese / Reading Meadow | Lesen | meadow with a giant book-tree |

Map requirements:

- Each region is an SVG `<a>` group (real link, keyboard-focusable,
  `aria-label` = translated game name) with a tap target ≥ 64×64 px, a
  translated name label, and a small badge showing that game's star count.
- **The fox stands on the region that was last played** (`rewards.at`,
  §9.2); first visit: at Zahlendorf. Position = fixed anchor coordinates per
  region, defined in the SVG.
- **Regions visibly evolve with mastery.** Each region has 3 visual states as
  toggled SVG layers: *base* → *thriving* (≥ ⅓ of the game's achievable stars,
  per difficulty currently reachable) → *mastered* (100 %): flag on the
  summit, more animals in the forest, lanterns in the village, etc. The state
  is computed by `rewards.js` on load; layers are shown/hidden by CSS class.
- Header strip above the map: fox level with progress bar (§8.4), daily
  streak flame (§8.5), language toggle DE/EN, sticker-album button (1 tap to
  `album.html`), sound toggle.
- Below the map, a plain `<nav>` with the five game links as text buttons —
  the accessibility/robustness fallback and the layout used if SVG fails.
- Footer: „Deine Fortschritte werden nur auf diesem Gerät gespeichert." plus
  „Fortschritt löschen" (global reset) behind a confirmation dialog.
- Map art style: flat, friendly, geometric SVG shapes (no raster images, no
  external assets). A simple first version (colored shapes + emoji accents)
  ships in M1 and is refined later; the region tap behavior and state layers
  are required from M1.

### 3.2 Sticker album (`album.html`)

One page, five sections (one per region, translated heading). Each section
shows **12 sticker slots** in a grid: earned stickers as large emoji with a
name caption; unearned slots as grey outlines with „?". Earned count per
region and total at the top. Stickers are earned via perfect rounds (§8.3).
A back-to-map button in the header (1 tap).

### 3.3 In-game chrome (every game page)

A slim persistent mini-header:

- **Fox/home button** → back to the map (1 tap).
- **Level/difficulty chip** showing the current difficulty (and table/level/
  pack where applicable); tapping opens the picker **as an overlay** on the
  same page, never a separate page.
- **Settings gear** → small overlay: sound toggle, language toggle, per-game
  reset (confirmation required).

Round summaries are overlays too. The browser back button always means
"back to the map".

### 3.4 Navigation rules (hard requirements)

| From | To | Taps |
|---|---|---|
| Map | playing a game (resumed) | **1** |
| Inside game A | playing game B | **2** (home → region) |
| Inside a game | different difficulty/level | **2** (chip → pick) |
| Map | sticker album | **1** |

- **Instant resume**: tapping a region drops the player directly into a
  running round at their last difficulty/level/table/pack. First visit
  starts the easiest difficulty immediately.
- No confirmation dialogs on the happy path (only destructive resets).
- Round summary has one primary button („Nochmal!" / "Again!") so replaying
  is a single tap.

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

### 5.1 Mobile first

- CSS baseline targets a **360 px-wide portrait phone**; wider layouts only
  via `min-width` media queries.
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
- Fallback chain: missing key → German string → the key itself.

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
- Nodes 3, 6, 9 are **obstacle nodes** — purely visual flavor drawn from the
  region theme (a friendly troll at a bridge, a locked gate, a river ferry).
  The question at an obstacle node is a normal question; answering it plays
  a slightly bigger "obstacle overcome" animation (troll waves, gate opens).
- The final node is the **goal**, themed per region (summit flag for
  Rechenberg, school bell for Zahlendorf, forest clearing for Wörterwald,
  story-tree for Lesewiese). Reaching it triggers the round summary.
- `journey.js` API: `createJourney(container, {nodes, theme})` →
  `{advance(), stumble(), finish()}`. Themes: `village | mountain | forest |
  meadow`. Tippen does not use the journey (the text line itself is the
  progress display).

### 8.3 Stickers (perfect rounds → collection)

- A **perfect round** = every item in the round correct on the first try.
- Each region keeps a lifetime perfect-round counter (`rewards.pr`, §9.2).
- Each region has **12 fixed stickers** (emoji + translated name, defined in
  a `STICKERS` table in `rewards.js`, themed per region — e.g. Wörterwald:
  🦊 🦉 🐿️ 🦡 🍄 🌰 …). Sticker *s* (1-indexed) is earned when the counter
  reaches `THRESHOLDS[s] = [1, 2, 3, 5, 7, 9, 12, 15, 18, 22, 26, 30]`.
  Deterministic — no randomness, fully derivable from the counter, so only
  the counter is stored.
- Earning a sticker triggers a celebration overlay in the round summary
  („Neuer Sticker: 🦉 Die kluge Eule!") with a link chip to the album.
- Total: 60 stickers. The album (§3.2) renders earned/unearned from the
  counters.

### 8.4 Fuchs-Level (site-wide)

- `totalStars` = sum of all stars across all games/difficulties.
- **Level = min(20, 1 + floor(totalStars / 10))**, shown on the map header
  with a progress bar to the next level.
- Level-ups trigger confetti + a big fox celebration on the map.
- Cosmetic fox upgrades (pure SVG layers in `fuchs.svg`, automatic, §18.3):
  level 3 red scarf · 6 cap · 9 glasses · 12 backpack · 15 medal ·
  18 crown · 20 golden crown. The fox wears them everywhere (map, journeys,
  reactions).

### 8.5 Tagesserie (daily streak)

Playing ≥ 1 round on consecutive calendar days (local time) increments the
streak; a missed day resets it to 1 on the next play. Stored as
`[lastDateISO, count]` — no history log. Shown as a flame with the count on
the map header; milestone celebrations at 3, 7, 14, 30 days.

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
- `rewards.pr` = perfect-round counters per game (stickers derive from
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
3. Wrong → correct answer shown 2 s **with a dot-grid visual aid** (7 rows of
   8 dots), box drops, re-queue per §7.
4. Summary overlay: first-try score, time, stars, sticker if earned, one
   primary „Nochmal!" button. Table picker via the header chip: an 11-tile
   overlay (Reihen 1–10 + „Alle gemischt") each showing its star state.

### 10.2 Difficulties

| | Content | Input |
|---|---|---|
| Leicht | Reihen 1, 2, 5, 10; dot-grid hint always visible | multiple choice (4 buttons) |
| Mittel | all Reihen 1–10 | on-screen keypad |
| Schwer | mixed, gap questions (`_ × 7 = 42`), division sprinkled in | keypad; optional 60 s challenge toggle |

„Alle gemischt" draws across tables weighted by the adaptive boxes.

### 10.3 Stars (per table & difficulty)

⭐ ≥ 8/10 first-try · ⭐⭐ 10/10 first-try · ⭐⭐⭐ 10/10 first-try in < 60 s.

### 10.4 Cookie state (`einmaleins`)

```json
{
  "d": 1, "t": 7,
  "box": "342103...",                    // 100 digits: pairs 1..10 × 1..10 canonical order
  "stars": { "0": "302...", "1": "...", "2": "..." }  // per difficulty: 11 digits (10 tables + mixed)
}
```

~160 bytes. The box string is shared across difficulties.

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
„Alle"). Stars per pack & difficulty: ⭐ ≥ 8/10 first-try · ⭐⭐ 10/10 ·
⭐⭐⭐ 10/10 **and** every pack word at box ≥ 3 („Pack gemeistert").

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
  thinking, catch-breath) as swappable groups; cosmetic items (§8.4) as
  additional layers toggled by class. One file, used everywhere.
- **Map & journey art**: flat geometric SVG shapes, warm palette; emoji as
  accents where a full illustration would be costly. No raster images.
- Palette: fox-orange primary (`#e8590c` range), cream background,
  dark-brown text; distinct success-green and error-red, all ≥ 4.5:1
  contrast. `prefers-color-scheme: dark` supported from the start (dark
  map = evening mood, same layout).
- Typography: system font stack; very large in-game sizes (a question
  readable from a meter away). Lesen uses a rounded font with a single-story
  `a` to match handwriting forms.
- Micro-animations: flash, gentle shake, confetti, journey steps — all
  respecting `prefers-reduced-motion` (reduced: instant state changes, no
  confetti).

---

## 16. Testing & Quality

- **Pure logic lives in DOM-free modules** and is unit-tested with
  `node --test` in `tests/`: adaptive engine (selection weights, re-queue
  timing, box transitions), question generators, scoring/stars, sticker
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
   sticker thresholds, star criteria, level formulas. Do not tune them.
9. When something small is genuinely unspecified, pick the simplest option
   consistent with §1 (kid-friendly, ≤ 2 taps, mobile first, never punish)
   and note the choice in the commit message.

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
3. **Fox cosmetics are automatic** at fixed levels (§8.4) — no shop at
   launch.
4. **Stickers are deterministic** (counter + thresholds), not random drops.
5. **SpeechSynthesis is good enough for launch**; recorded audio is not a
   launch requirement.
6. **Vokabeln launches with 6 packs**, Lesen with German content only.
7. **Adventure mode** (node-path campaigns per region: tap node → themed
   round → node clears → path extends; boss nodes = mixed-review rounds) is
   **deferred to M8** and must not leak complexity into earlier milestones.
   The journey strip and map states are designed so adventure mode can be
   added as a layer on top (nodes reuse round configs; map regions gain a
   path overlay).
8. **Pages source = repo root** (not `/docs`).

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
perfect round increments `pr` and thresholds unlock stickers exactly per
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

**M7 — Polish.** Dark-mode pass, refined map/fox art, cosmetic layers,
service worker for offline play, `prefers-reduced-motion` audit.

**M8 — Adventure mode.** Per §18.7.
