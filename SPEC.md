# Schlaufuchs — Specification

**Spielerisch lernen und ein Schlaufuchs werden.**

Schlaufuchs is a collection of small educational browser games for children,
hosted as a fully static website on GitHub Pages under the custom domain
**https://schlaufuchs.ankerl.com**. All game state (progress, high scores,
settings) is stored client-side in a cookie — there is no backend, no login,
and no data ever leaves the browser.

---

## 1. Goals

- **Kid-friendly**: playable by elementary school children (roughly ages 5–12)
  without adult help. Large touch targets, little text, immediate feedback,
  encouraging tone.
- **Radically simple navigation**: starting or switching a game takes at most
  **two taps from anywhere** (see §3.2). No nested menus, no splash screens.
- **Mobile first**: designed for a phone in portrait mode, then scaled up to
  tablet and desktop (see §4.1). Games must feel native to touch.
- **Really teaches something**: every game has explicit difficulty levels and
  an adaptive engine that detects what the child struggles with and practices
  exactly that more often (see §6).
- **Really motivates**: a shared reward system — stars, streaks, personal
  bests, a site-wide fox level — with celebration effects and a tone that
  never punishes mistakes (see §7).
- **Translatable**: every page ships in **German and English** from a shared
  string dictionary; adding a language means adding one file (see §5).
- **Zero infrastructure**: static HTML/CSS/JS only. Deployable by pushing to
  `main`. No build step — opening the files via `python -m http.server` works.
- **Privacy by design**: no accounts, no analytics, no external requests at
  runtime. Progress persists via a first-party cookie only.
- **Extensible**: a new game is a new directory plus one card on the landing
  page. Games share small common modules (storage, i18n, adaptive practice,
  audio, celebration effects).

### Non-goals

- No multiplayer, no leaderboards, no server-side anything.
- No cross-device sync (state is per browser).
- No build pipeline (bundlers, frameworks). Vanilla JS with ES modules.

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

Because everything is static and relative-path based, the site must also work
when served from a subpath (useful for previewing via
`https://martinus.github.io/schlaufuchs/` before the domain is configured).
Therefore: **only relative URLs** in HTML/CSS/JS, never absolute paths like
`/assets/...`.

---

## 3. Site Structure & Navigation

```
/
├── CNAME                     # schlaufuchs.ankerl.com
├── index.html                # Landing page: game gallery
├── assets/
│   ├── css/
│   │   └── schlaufuchs.css   # Shared design system (mobile first)
│   ├── i18n/
│   │   ├── de.js             # Shared UI strings, German
│   │   └── en.js             # Shared UI strings, English
│   ├── js/
│   │   ├── storage.js        # Cookie-backed state store (§8)
│   │   ├── i18n.js           # Translation runtime (§5)
│   │   ├── adaptive.js       # Weakness-tracking practice engine (§6)
│   │   ├── rewards.js        # Stars, streaks, fox level (§7)
│   │   ├── audio.js          # Feedback sounds (WebAudio, no asset files)
│   │   └── confetti.js       # Celebration effect
│   └── img/
│       ├── fuchs.svg         # Mascot (clever fox), several poses
│       └── favicon.svg
└── games/
    ├── einmaleins/           # §9  Multiplication tables
    ├── tippen/               # §10 Touch typing
    ├── rechnungen/           # §11 Arithmetic (+ − × ÷)
    ├── vokabeln/             # §12 Vocabulary trainer
    └── lesen/                # §13 Learning to read
```

Each game directory contains `index.html`, `<game>.js`, and `i18n.js`
(game-specific strings for all languages).

URLs: `https://schlaufuchs.ankerl.com/games/<name>/` — clean, shareable, and
each game is independently bookmarkable so a child's device can go straight
to their favorite game.

### 3.1 Landing page (`index.html`)

- Slim header: fox mascot, site title, fox level (§7), language toggle DE/EN.
- A responsive card grid, one card per game. **The entire card is one big tap
  target that immediately launches the game** — no detail page in between.
- Each card shows: icon, translated title, progress at a glance (stars /
  level), and a subtle „Weiter“-style hint when there is progress to resume.
- Footer: „Deine Fortschritte werden nur auf diesem Gerät gespeichert.“ plus a
  „Fortschritt löschen“ (reset) action with a confirmation dialog.

### 3.2 Navigation rules (apply to every page)

The click-count budget is a hard requirement:

| From | To | Taps |
|---|---|---|
| Landing page | playing a game (resumed) | **1** |
| Inside game A | playing game B | **2** (home → card) |
| Inside a game | different difficulty/level | **2** (level chip → pick) |

How this is achieved:

- **Instant resume**: tapping a game card drops the player directly into a
  running round at their last difficulty/level — never into a menu. First
  visit starts at the easiest difficulty immediately.
- **Persistent mini-header in every game**: fox/home button (back to gallery,
  1 tap), a compact level/difficulty chip (tap to open the picker as an
  overlay, not a separate page), and a settings gear (sound, language,
  per-game reset — all in one small overlay).
- **No confirmation dialogs on the happy path** (only for destructive reset).
- **No page-to-page redirects**; pickers and summaries are overlays inside the
  game page, so the browser back button always means "back to the gallery".
- Round summaries have one primary button („Nochmal!“) focused by default, so
  replaying is a single tap.

---

## 4. Tech Stack & Conventions

- **HTML5 + modern CSS + vanilla ES modules.** No framework, no TypeScript,
  no bundler. Target evergreen browsers (last 2 years); no legacy support.
- Each game is self-contained in its directory and imports the shared modules
  from `assets/js/` via relative `import` statements.
- Accessibility baseline: semantic HTML, visible focus states, color contrast
  ≥ 4.5:1, all interactive elements reachable by keyboard,
  `prefers-reduced-motion` respected.
- Sounds are generated via WebAudio (no audio asset files) with a persisted
  mute toggle. Speech output (Lesen, Vokabeln) uses the browser's built-in
  **SpeechSynthesis API** — free, offline-capable, per-language voices.

### 4.1 Mobile first

- The CSS baseline targets a **360 px-wide portrait phone**; wider layouts are
  added with `min-width` media queries only. No `max-width` "desktop-first"
  queries.
- Touch targets ≥ 48×48 px; primary game actions sit in the **lower half of
  the screen** (thumb reach); answer input via large on-screen keypads or
  answer buttons — the OS keyboard is avoided except where it *is* the game
  (typing trainer) or typed answers are the exercise (hard modes).
- Viewport-stable layout: game screens fit `100dvh` without scrolling; no
  layout shift when overlays open.
- Works offline-ish after first visit: all assets are local; optionally a
  minimal service worker for true offline play (nice-to-have, milestone M7).
- The typing trainer is the one desktop-centric game: it requires a physical
  keyboard and shows a friendly translated hint on touch-only devices.

---

## 5. Internationalization (DE + EN)

One HTML page per game serves **all languages**; translation happens at load
time from string dictionaries. This avoids duplicating HTML per language and
keeps translations mergeable in one place.

### 5.1 Mechanics

- Shared UI strings live in `assets/i18n/de.js` / `en.js`; each game adds its
  own strings in `games/<name>/i18n.js` (one object per language in the same
  file, so a missing translation is visible in review).
- Static text in HTML is marked with `data-i18n="key"` attributes and replaced
  on load; dynamic text goes through `t(key, params)`.
- **Templates, not concatenation**: `t('roundDone', {ok: 9, total: 10})` with
  `"roundDone": "{ok} von {total} richtig!"` — never string-glued sentences,
  so word order can differ per language.
- Language selection order: `?lang=` URL parameter (shareable links, persists
  once visited) → saved setting (cookie) → `navigator.language` → `de`.
- The toggle in the header switches instantly (re-translate in place, update
  `<html lang>`, persist choice). Every page has the toggle.
- Fallback chain: missing key → German string → the key itself (visible bug,
  never a blank).

### 5.2 Language-dependent *content* (not just UI)

Translation goes deeper than labels; each game declares its content per
language:

| Game | What changes with language |
|---|---|
| Einmaleins / Rechnungen | UI strings only (math is math) |
| Tippen | word/sentence lists **and default keyboard layout** (DE → QWERTZ, EN → QWERTY), umlaut levels only in DE |
| Vokabeln | the *pair direction* (DE↔EN packs work for both audiences) |
| Lesen | fully language-specific content; German first (see §13.4) |
| Speech output | SpeechSynthesis voice matches the active language |

### 5.3 Adding a language later

Add `assets/i18n/<lang>.js`, add the language's section to each game's
`i18n.js`, add content lists where §5.2 requires them, extend the toggle.
No HTML changes.

---

## 6. Shared Adaptive Practice Engine (`adaptive.js`)

The core of "really teaches something". Used by Einmaleins, Rechnungen,
Vokabeln and Lesen (Tippen has its own level curriculum).

### 6.1 Model

Every practice item (a multiplication pair, a vocabulary word, a syllable) has
a **box number 0–4** (Leitner-light):

- New items start in box 2.
- **Wrong answer** → item drops to box 0 **and is re-queued within the next
  2–4 questions** of the same round (short-term repetition — the child must
  get it right again while it's fresh).
- **Correct answer** → item moves up one box. An item that was just wrong must
  be answered correctly again later in the round *and* in a later round to
  climb back (spaced repetition).

### 6.2 Question selection

Weighted random draw over the active pool, weight by box:
box 0 → ×8, box 1 → ×4, box 2 → ×2, box 3 → ×1, box 4 → ×0.5.
No immediate repeats (except the deliberate re-queue after a mistake).
Result: the numbers a child struggles with appear far more often, mastered
ones fade to occasional refreshers — without the child ever seeing the
mechanism.

### 6.3 Difficulty levels (every game)

Every game exposes 3 named difficulties — **Leicht / Mittel / Schwer**
(Easy / Medium / Hard) — switchable in 2 taps via the header chip (§3.2).
Difficulty changes the *content range and input mode*, never the adaptive
mechanics. Per-game definitions are in each game's section. Progress (boxes,
stars) is tracked per difficulty where meaningful.

### 6.4 Persistence

Box state is stored compactly per game as digit strings (one char per item,
see the per-game state sections) to respect the cookie budget (§8).

---

## 7. Motivation System (`rewards.js`)

Layered rewards, all positive — a wrong answer never loses points or stars.

**In the moment (every answer):**
- Correct: green flash + cheerful sound + the fox reacts (poses: happy,
  cheering, thumbs-up). In-round hot streak counter appears from 3 correct in
  a row („5 richtig hintereinander! 🔥“).
- Wrong: soft neutral sound, the answer is shown and briefly explained where
  possible, tone „Gleich nochmal!“ — never red-pen shaming, no harsh buzzer.

**Per round:**
- Stars (⭐ to ⭐⭐⭐, criteria per game), personal-best detection with confetti,
  a one-line encouraging summary from the fox.

**Long-term (site-wide, shown on the landing page):**
- **Fuchs-Level**: total stars across all games map to a level (1–20) with a
  progress bar; each level-up triggers a big celebration and the fox gets a
  small visual upgrade (scarf, glasses, hat — pure SVG variations).
- **Tagesserie** (daily streak): playing at least one round on consecutive
  days increments the streak counter; stored as `(lastDate, count)` — 2 small
  values, no history log.

---

## 8. State Storage (Cookie)

All persistent state lives in **one** first-party cookie named `schlaufuchs`.

### 8.1 Cookie parameters

| Attribute | Value | Rationale |
|---|---|---|
| Name | `schlaufuchs` | single cookie for the whole site |
| Path | `/` | shared across all games |
| Max-Age | `31536000` (1 year), refreshed on every write | progress survives long pauses |
| SameSite | `Lax` | first-party only |
| Secure | set when served over HTTPS | |

### 8.2 Payload format

URL-encoded compact JSON with a version field for future migrations:

```json
{
  "v": 1,
  "settings": { "sound": true, "lang": "de" },
  "rewards":  { "streak": [ "2026-07-08", 4 ] },
  "einmaleins": { }, "tippen": { }, "rechnungen": { },
  "vokabeln": { }, "lesen": { }
}
```

Rules:

- Each game owns exactly one top-level key and never touches the others.
- **Size budget: the encoded cookie must stay under 3500 bytes** (browsers cap
  cookies at ~4 KB). Games store aggregated, compactly encoded stats (digit
  strings, not objects), never event logs. `storage.js` warns and refuses the
  write if the budget is exceeded, so a bug cannot brick the site's state.
- Corrupt/unparsable cookie ⇒ treated as empty state (fresh start), never a
  crash.

### 8.3 `storage.js` API

```js
loadState(): object            // full parsed state, {} if absent/corrupt
getGame(name): object          // state[name] ?? {}
setGame(name, data): boolean   // merge + write cookie; false if over budget
getSettings() / setSettings()
resetGame(name)                // per-game reset (settings overlay)
resetAll()                     // delete the cookie (landing page footer)
```

> **Trade-off note**: `localStorage` would be the more natural fit (bigger
> quota). The cookie is a deliberate product decision; the budget works with
> the compact encodings specified per game — the tightest case is the
> Vokabeltrainer (§12.4), which caps its tracked packs to fit. The
> `storage.js` abstraction allows swapping/extending the backend later
> without touching games.

---

## 9. Game 1: Einmaleins (multiplication tables)

Master the multiplication tables 1–10 („das kleine Einmaleins“).

### 9.1 Game flow

1. Card tap → **instantly** into a quiz round at the last difficulty & table
   selection (first visit: Leicht, 2er-Reihe).
2. **Quiz round**: 10 questions, one at a time: `7 × 8 = ?`. Input per
   difficulty (§9.2). Big, thumb-reachable.
3. **Feedback** (per §7). Wrong → correct answer shown 2 s with a visual aid
   (e.g. 7 rows of 8 dots), item drops to box 0 and is re-queued (§6.1).
4. **Round summary overlay**: first-try score, time, stars, streaks, one
   primary „Nochmal!“ button. Table picker reachable via the header chip.

### 9.2 Difficulties

| | Content | Input |
|---|---|---|
| Leicht | Reihen 1, 2, 5, 10; factors shown with dot-grid hint | multiple choice (4 buttons) |
| Mittel | all Reihen 1–10 | on-screen keypad |
| Schwer | mixed tables, gap questions (`_ × 7 = 42`), inverse (division) sprinkled in | keypad, optional 60 s time-challenge mode |

### 9.3 Mastery & stars (per table & difficulty)

⭐ ≥ 8/10 first-try · ⭐⭐ 10/10 first-try · ⭐⭐⭐ 10/10 first-try under 60 s.
Table picker (overlay) shows the star state per table; „Alle gemischt“ is an
11th tile weighted toward weak tables.

### 9.4 Cookie state (`einmaleins` key)

```json
{
  "d": 1,                      // last difficulty 0..2
  "t": 7,                      // last table (0 = mixed)
  "box":   "3421 0342 ...",    // 100 digits: box per pair (2..10 × 1..10), §6
  "stars": { "1": "302...", "2": "..." }  // per difficulty: 10 digits (0..3 per table)
}
```

~150 bytes. The box string is shared across difficulties (a weakness is a
weakness).

---

## 10. Game 2: Tippen (touch-typing trainer)

A multi-level typing course teaching ten-finger touch typing.
Layout follows the language: **DE → QWERTZ, EN → QWERTY** (§5.2).

### 10.1 Core screen

- Top: the text to type; current character highlighted; typed characters turn
  green, errors marked red and must be corrected (accuracy first).
- Middle: live stats — accuracy %, speed (characters/minute), progress bar.
- Bottom: **on-screen keyboard visualization** (layout per language)
  highlighting the next key and, in early levels, the correct finger
  (color-coded). On by default, auto-hidden from level 10 to wean learners
  off looking; toggleable.

### 10.2 Level curriculum (~20 levels, data-driven in `levels.js`)

| Phase | Levels | DE content | EN content |
|---|---|---|---|
| Home row | 1–4 | `asdf jklö` + `g h` | `asdf jkl;` + `g h` |
| Top row | 5–8 | `qwert zuiop` | `qwert yuiop` |
| Bottom row | 9–12 | `yxcvb nm,.-` | `zxcvb nm,./` |
| Shift | 13–15 | capitals, opposite-hand shift | same |
| Specials | 16–18 | `ä ö ü ß` + punctuation | punctuation `'"!?` |
| Numbers & flow | 19–20 | number row, full paragraphs | same |

- Levels 1–8 generate pseudo-words from the allowed pool, preferring real
  words as soon as possible; from level 9 lines are sampled from built-in
  child-appropriate word/sentence lists per language (embedded, no fetches).
- Each level = 5 exercises of ~1–2 minutes.

### 10.3 Passing, stars, difficulty

- Pass thresholds ramp from ≥ 90 % accuracy (no speed floor) to ≥ 95 % and
  ~80 CPM at level 20. ⭐ passed · ⭐⭐ ≥ 97 % · ⭐⭐⭐ ≥ 97 % and 1.5× CPM floor.
- Levels unlock sequentially and stay replayable. Level picker = header chip
  overlay with a 20-tile lock/star grid (2 taps, per §3.2).
- The Leicht/Mittel/Schwer selector maps to exercise length and threshold
  strictness, so younger kids can progress with shorter drills.

### 10.4 Cookie state (`tippen` key)

```json
{
  "d": 1,
  "lvl": { "de": 7, "en": 2 },     // highest unlocked, per layout/language
  "stars": { "de": "33211..", "en": "1" },
  "best": { "7": { "acc": 96, "cpm": 74 } },   // 5 most recent levels only
  "kb": true
}
```

---

## 11. Game 3: Rechnungen (arithmetic)

General mental-arithmetic practice: **addieren, subtrahieren, multiplizieren,
dividieren** — the everyday-math complement to the Einmaleins drill.

### 11.1 Modes & difficulties

Mode chips (＋ − × ÷ and „Mix“) plus the standard difficulty selector:

| | ＋ / − | × / ÷ |
|---|---|---|
| Leicht | 0–10, no carrying | ×/÷ within tables 1–5, no remainder |
| Mittel | 0–100 with carrying/borrowing | full tables 1–10, halving/doubling |
| Schwer | 0–1000, chains (`17 + 25 − 8`), gap questions | ×/÷ beyond tables (`14 × 6`), division with remainder („Rest“) |

Question generation is parameterized (ranges, carrying yes/no, gap position),
so the same engine covers all modes. Wrong answers get a one-line visual
explanation where feasible (number line for ±, dot grid for ×).

### 11.2 Adaptive & rewards

The adaptive engine (§6) tracks *skill buckets* rather than individual
questions (e.g. „subtraction with borrowing, tens“, „÷ with remainder“) —
about 30 buckets, so the box string stays tiny. Rounds of 10, same star
criteria and summary flow as Einmaleins.

### 11.3 Cookie state (`rechnungen` key)

```json
{ "d": 0, "m": "+", "box": "232...", "stars": { "+": "31", "-": "2", ... } }
```

### 11.4 Relationship to Einmaleins

Einmaleins stays its own focused game (its own card, its own mastery grid) —
it is *the* structured tables curriculum. Rechnungen is broad practice; its
×/÷ modes reuse the Einmaleins question generator.

---

## 12. Game 4: Vokabeln (vocabulary trainer)

Learn German↔English vocabulary with built-in themed word packs. Because the
site itself is DE/EN bilingual, the same packs serve both audiences — only
the *question direction* flips.

### 12.1 Content

- Built-in packs of 20–40 word pairs each, themed and child-oriented:
  *Tiere / Animals, Schule / School, Essen / Food, Familie / Family, Farben &
  Zahlen / Colors & Numbers, Körper / Body* (~6 packs, ~180 pairs at launch).
- Each entry: `["der Hund", "dog", "🐶"]` — an emoji illustration where one
  fits, no image assets.
- Packs are data files (`packs.js`); adding a pack is adding an array.

### 12.2 Modes (= difficulty)

| | Mode |
|---|---|
| Leicht | **Erkennen**: word shown + spoken (SpeechSynthesis), pick from 4 emoji/word buttons |
| Mittel | **Zuordnen**: classic multiple choice in both directions, distractors drawn from the same pack |
| Schwer | **Schreiben**: type the translation; tolerant checking (case, article optional, 1 typo allowed with „fast richtig!“ feedback) |

Direction (DE→EN / EN→DE) follows the UI language by default, flippable in
the settings overlay.

### 12.3 Adaptive & rewards

Leitner boxes per word pair (§6) — this game is where spaced repetition
matters most. Rounds of 10 draw weighted from the selected pack (or „Alle“).
Stars per pack & difficulty: ⭐ ≥ 8/10 · ⭐⭐ 10/10 · ⭐⭐⭐ 10/10 with every
pack word at box ≥ 3 („Pack gemeistert“).

### 12.4 Cookie state (`vokabeln` key) — the budget-critical game

```json
{
  "d": 0, "p": "tiere", "dir": "de-en",
  "box":   { "tiere": "34212...", "schule": "..." },  // 1 digit per word
  "stars": { "tiere": "310", ... }                     // per difficulty
}
```

6 packs × ~30 words ≈ 180 digits + overhead ≈ **~350 bytes** — fits. Hard cap:
tracked packs ≤ 10; beyond that, the least-recently-played pack's box string
is dropped (stars are kept).

### 12.5 Later

Custom packs entered by parents (would need textarea input + storage review),
more languages.

---

## 13. Game 5: Lesen (learning to read)

For pre-readers and first graders — the youngest audience, so: almost no UI
text, everything speakable, extra-large targets. Uses SpeechSynthesis
throughout (tap anything to hear it).

### 13.1 Levels (map to the difficulty selector)

| | Stage | Exercise types |
|---|---|---|
| Leicht | **Buchstaben** | letter shown & spoken → pick it from 4; hear a sound → tap the letter |
| Mittel | **Silben & Wörter** | syllable blending („MA + MA“ → tap the matching word); word → pick the matching emoji picture (🐶 🐱 🦊); picture → assemble the word from syllable tiles |
| Schwer | **Sätze** | read a short sentence, answer a comprehension question by tapping the right picture („Der Hund schläft.“ → which picture?) |

### 13.2 Content

- Data-driven lists: letters with example words, ~150 syllable-friendly German
  words with emoji, ~60 simple sentences with 3-picture comprehension choices.
- All content selected so **emoji can serve as the pictures** — no drawn
  assets needed at launch.

### 13.3 Adaptive & rewards

Boxes per letter/word item (§6). Shorter rounds (6 items) for short attention
spans; the fox celebrates a lot at this level. Stars per stage.

### 13.4 English version

Reading instruction is genuinely language-specific (German is phonetically
regular; English needs a phonics approach, not a transliteration). Plan:
**German content first (M6)**; the English version is a separate content set
(CVC words, sight words) built later — the game *engine* (pick-from-4,
tile-assembly, picture questions) is shared and language-neutral.

### 13.5 Cookie state (`lesen` key)

```json
{ "d": 0, "box": { "de": "3421..." }, "stars": { "de": "21" } }
```

Box digits indexed over the content list; capped like Vokabeln.

---

## 14. Visual Design

- Mascot: a friendly cartoon fox („Schlaufuchs“) as inline SVG with several
  poses (neutral, happy, cheering, thinking) and cosmetic level-up variants
  (§7).
- Palette: warm fox-orange primary (`#e8590c` range), cream background,
  dark-brown text; distinct success-green and error-red with sufficient
  contrast. `prefers-color-scheme: dark` supported from the start.
- Typography: system font stack; very large sizes inside games (a math
  question readable from a meter away). For Lesen: a font where `a` and `g`
  match handwriting forms (e.g. a rounded font with single-story a).
- Micro-animations: flash, gentle shake on error, confetti on bests and
  level-ups — all respecting `prefers-reduced-motion`.

---

## 15. Testing & Quality

- Pure logic (question generation, adaptive engine, scoring, level
  generation, i18n lookup, cookie encoding/size budget) lives in importable
  modules separate from DOM code and is unit-tested with `node --test` in
  `tests/`. The adaptive engine and the cookie budget get the densest tests.
- A GitHub Actions workflow runs tests on every push.
- i18n check in CI: every key present in every language (fails the build on
  missing translations).
- Manual checklist per release: fresh-profile smoke test on a real phone,
  cookie round-trip after browser restart, subpath serving, language toggle
  on every page, SpeechSynthesis on iOS Safari (requires a user gesture —
  design taps accordingly).

---

## 16. Open Questions

1. Word/sentence lists (Tippen, Lesen) need child-appropriate curation
   (~500 words DE + EN) — source/curation TBD.
2. Vokabeln launch packs: confirm the 6 themes, or start with 3?
3. Should the Fuchs-Level cosmetics be purchasable with stars („shop“) for
   extra motivation, or automatic? → Suggest: automatic at launch, shop later.
4. SpeechSynthesis voice quality varies by device; acceptable for launch, or
   should Lesen wait for recorded audio? → Suggest: launch with synthesis.

---

## 17. Milestones

1. **M1 — Skeleton**: repo layout, `CNAME`, mobile-first shared CSS,
   `storage.js` + `i18n.js` + tests, landing page with cards (DE+EN). Live on
   the domain.
2. **M2 — Einmaleins** (§9) incl. adaptive engine (§6) and rewards (§7) —
   these shared modules are built here.
3. **M3 — Rechnungen** (§11): fast follow, reuses everything from M2.
4. **M4 — Tippen** (§10): levels 1–8, DE layout; EN layout + remaining levels
   in M4b.
5. **M5 — Vokabeln** (§12) with 3–6 packs.
6. **M6 — Lesen** (§13), German content.
7. **M7 — Polish**: dark mode pass, service worker (offline), fox cosmetics.
