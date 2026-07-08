# Schlaufuchs — Specification

**Spielerisch lernen und ein Schlaufuchs werden.**

Schlaufuchs is a collection of small educational browser games for children,
hosted as a fully static website on GitHub Pages under the custom domain
**https://schlaufuchs.ankerl.com**. All game state (progress, high scores,
settings) is stored client-side in a cookie — there is no backend, no login,
and no data ever leaves the browser.

---

## 1. Goals

- **Kid-friendly**: playable by elementary school children (roughly ages 6–12)
  without adult help. Large touch-friendly buttons, little text, immediate
  feedback, encouraging tone. UI language is **German**.
- **Zero infrastructure**: static HTML/CSS/JS only. Deployable by pushing to
  `main`. No build step required to view the site locally — opening the HTML
  files (or `python -m http.server`) must work.
- **Privacy by design**: no accounts, no analytics, no external requests at
  runtime. Progress persists via a first-party cookie only.
- **Extensible**: adding a new game means adding a new directory and one card
  on the landing page. Games share a small common library for storage, styling
  and sounds.

### Non-goals

- No multiplayer, no leaderboards, no server-side anything.
- No cross-device sync (state is per browser).
- No build pipeline (bundlers, frameworks). Vanilla JS with ES modules.

---

## 2. Hosting & Deployment

| Item | Value |
|---|---|
| Host | GitHub Pages, project site from this repository |
| Source | `main` branch, root directory (or `/docs` — see open questions) |
| Domain | `schlaufuchs.ankerl.com` |
| HTTPS | Enforced via GitHub Pages settings |

Setup steps:

1. Add a `CNAME` file at the site root containing `schlaufuchs.ankerl.com`.
2. In the DNS zone for `ankerl.com`, add a `CNAME` record:
   `schlaufuchs` → `martinus.github.io`.
3. In the repository settings, enable GitHub Pages for `main` and turn on
   *Enforce HTTPS* once the certificate is provisioned.

Because everything is static and relative-path based, the site must also work
when served from a subpath (useful for previewing branches via
`https://martinus.github.io/schlaufuchs/` before the domain is configured).
Therefore: **only relative URLs** in HTML/CSS/JS, never absolute paths like
`/assets/...`.

---

## 3. Site Structure

```
/
├── CNAME                     # schlaufuchs.ankerl.com
├── index.html                # Landing page: game gallery
├── assets/
│   ├── css/
│   │   └── schlaufuchs.css   # Shared design system
│   ├── js/
│   │   ├── storage.js        # Cookie-backed state store (see §5)
│   │   ├── audio.js          # Small helper for feedback sounds (WebAudio)
│   │   └── confetti.js       # Celebration effect on level-up
│   └── img/
│       ├── fuchs.svg         # Mascot (clever fox), used site-wide
│       └── favicon.svg
└── games/
    ├── einmaleins/
    │   ├── index.html
    │   └── einmaleins.js
    └── tippen/
        ├── index.html
        ├── tippen.js
        └── levels.js         # Level definitions (see §7.2)
```

URLs:

- `https://schlaufuchs.ankerl.com/` — landing page
- `https://schlaufuchs.ankerl.com/games/einmaleins/` — Einmaleins trainer
- `https://schlaufuchs.ankerl.com/games/tippen/` — typing trainer

### 3.1 Landing page (`index.html`)

- Header with fox mascot and site title „Schlaufuchs".
- A responsive card grid, one card per game: icon, German title, one-line
  description, and — when progress exists — a small progress indicator
  (e.g. „Level 3" or „12/100 ⭐").
- Footer: „Deine Fortschritte werden nur auf diesem Gerät gespeichert." plus a
  „Fortschritt löschen" (reset) action with a confirmation dialog.

---

## 4. Tech Stack & Conventions

- **HTML5 + modern CSS + vanilla ES modules.** No framework, no TypeScript,
  no bundler. Target evergreen browsers (last 2 years); no IE/legacy support.
- Each game is self-contained in its directory and imports the shared modules
  from `assets/js/` via relative `import` statements.
- Mobile-first responsive layout; games must be playable on a tablet.
  (The typing game additionally requires a physical keyboard and shows a
  friendly hint when none is available.)
- Accessibility baseline: semantic HTML, visible focus states, color contrast
  ≥ 4.5:1, all interactive elements reachable by keyboard.
- German UI text throughout; encoding UTF-8; `lang="de"` on `<html>`.
- Sounds are optional and generated via WebAudio (no audio asset files),
  with a mute toggle persisted in state.

---

## 5. State Storage (Cookie)

All persistent state lives in **one** first-party cookie named `schlaufuchs`.

### 5.1 Cookie parameters

| Attribute | Value | Rationale |
|---|---|---|
| Name | `schlaufuchs` | single cookie for the whole site |
| Path | `/` | shared across all games |
| Max-Age | `31536000` (1 year), refreshed on every write | progress survives long pauses |
| SameSite | `Lax` | first-party only |
| Secure | set when served over HTTPS | |

### 5.2 Payload format

The cookie value is a URL-encoded, compact JSON document. A version field
allows future migrations:

```json
{
  "v": 1,
  "settings": { "sound": true },
  "einmaleins": { /* game-owned, see §6.4 */ },
  "tippen":     { /* game-owned, see §7.4 */ }
}
```

Rules:

- Each game owns exactly one top-level key and never touches the others.
- **Size budget: the encoded cookie must stay under 3500 bytes** (browsers cap
  cookies at ~4 KB). Games must store aggregated stats, not event logs.
  `storage.js` warns on the console and refuses the write if the budget is
  exceeded, so a bug cannot brick the whole site's state.
- Corrupt/unparsable cookie ⇒ treated as empty state (fresh start), never a
  crash.

### 5.3 `storage.js` API

```js
loadState(): object            // full parsed state, {} if absent/corrupt
getGame(name): object          // state[name] ?? {}
setGame(name, data): boolean   // merge + write cookie; false if over budget
getSettings() / setSettings()
resetAll()                     // delete the cookie
```

> **Note / trade-off**: `localStorage` would be the more natural fit for a
> static site (bigger quota, not sent with requests). The cookie approach is a
> deliberate product decision; since GitHub Pages ignores request cookies the
> only real cost is the 4 KB budget. If a future game needs more space, the
> `storage.js` abstraction allows swapping the backend without touching games.

---

## 6. Game 1: Einmaleins lernen (multiplication tables)

Practice the multiplication tables 1–10 („das kleine Einmaleins").

### 6.1 Game flow

1. **Table select screen**: a 10-button grid (2er … 10er Reihe, plus „Alle
   gemischt"). Each button shows a mastery indicator: 0–3 stars.
2. **Quiz round**: 10 questions from the chosen table(s). One question at a
   time: `7 × 8 = ?` with a large numeric input (on-screen keypad on touch
   devices, keyboard input on desktop). Enter/„OK" submits.
3. **Feedback**: correct → green flash, cheerful sound, next question.
   Wrong → the correct answer is shown for 2 seconds („7 × 8 = **56**"), the
   question is re-queued later in the same round, and the pair's error count
   increases.
4. **Round summary**: score (correct on first try / 10), time, stars earned,
   confetti on a new best. Buttons: „Nochmal", „Andere Reihe".

### 6.2 Question selection (light spaced repetition)

- Within a table, questions are drawn without repetition until the pool is
  exhausted, then reshuffled.
- Pairs with a history of mistakes (per-pair `wrong` counter, see §6.4) are
  weighted 3× so weak spots come up more often.
- „Alle gemischt" draws from all tables, weighted toward tables with fewer
  stars.

### 6.3 Mastery & stars (per table)

| Stars | Requirement (best round on that table) |
|---|---|
| ⭐ | ≥ 8/10 first-try correct |
| ⭐⭐ | 10/10 first-try correct |
| ⭐⭐⭐ | 10/10 first-try correct in under 60 seconds |

Total possible: 30 stars (+3 for „Alle gemischt") shown on the landing page.

### 6.4 Cookie state (`einmaleins` key)

```json
{
  "stars":  { "2": 3, "3": 1 },          // table → 0..3
  "best":   { "2": {"ok": 10, "s": 41} },// table → best round
  "weak":   [ [7, 8], [6, 9] ]           // up to 15 pairs with most errors
}
```

The `weak` list is capped (15 entries) to respect the size budget; per-pair
error counts beyond that are folded into the cap by dropping the least-wrong
pair.

### 6.5 Nice-to-have (later)

- Division mode („56 ÷ 8 = ?") reusing the same engine.
- Configurable range up to 20 („großes Einmaleins").

---

## 7. Game 2: Tippen lernen (touch-typing trainer)

A multi-level typing course teaching correct ten-finger touch typing on a
**QWERTZ (German) keyboard layout**.

### 7.1 Core screen

- Top: the text to type, upcoming characters visible, current character
  highlighted. Typed characters turn green (correct) or are marked red and
  must be corrected before continuing (no error-skipping — accuracy first).
- Middle: live stats — accuracy %, speed (Zeichen/Minute), progress bar.
- Bottom: an **on-screen keyboard visualization** highlighting the next key
  and — in the early levels — the finger that should press it (color-coded
  per finger, matching hands graphic). Toggleable, on by default; hidden by
  default from level 10 on to wean learners off looking.

### 7.2 Level progression

Levels are data-driven (`levels.js`): each level defines the newly introduced
keys, the practice character pool, word/line generation rules, and pass
thresholds. Planned curriculum (~20 levels):

| Phase | Levels | Content |
|---|---|---|
| Grundreihe | 1–4 | `asdf jklö`, then `g h`, drills of letter groups |
| Oberreihe | 5–8 | `qwert zuiop`, mixed with home row, first real words |
| Unterreihe | 9–12 | `yxcvb nm,.-`, full alphabet words |
| Großschreibung | 13–15 | Shift keys (correct opposite-hand shift), sentences |
| Umlaute & Zeichen | 16–18 | `ä ö ü ß`, punctuation `!?":;` |
| Ziffern & Fließtext | 19–20 | number row, full German paragraphs |

Level content rules:

- Levels 1–8 generate pseudo-words from the allowed key pool (e.g. `fjf jaja
  lass falls`), preferring real German words as soon as the pool allows.
- From level 9 on, lines are sampled from a built-in German word/sentence list
  (embedded in `levels.js` — no runtime fetches), filtered to the keys
  introduced so far.
- Each level is a set of 5 exercises (~1–2 minutes each).

### 7.3 Passing, scoring, unlocking

- An exercise reports **accuracy** (correct keystrokes / total keystrokes) and
  **speed** in characters per minute (CPM).
- A level is **passed** when an exercise run meets its thresholds — early
  levels: ≥ 90 % accuracy, no speed requirement; later levels ramp up to
  ≥ 95 % accuracy and a modest CPM floor (e.g. 80 CPM by level 20).
- Stars per level: ⭐ passed · ⭐⭐ ≥ 97 % accuracy · ⭐⭐⭐ ≥ 97 % and 1.5× the
  level's CPM floor.
- Levels unlock sequentially; already-passed levels stay replayable to improve
  stars. Level select screen shows a 20-tile grid with lock/star status.

### 7.4 Cookie state (`tippen` key)

```json
{
  "lvl": 7,                      // highest unlocked level
  "stars": "3321100...",         // one digit per level, 20 chars max
  "best":  { "7": {"acc": 96, "cpm": 74} },
  "kb": true                     // keyboard visualization toggle
}
```

`best` is kept only for the 5 most recently played levels to stay within the
cookie budget; the `stars` string is the durable record.

### 7.5 Nice-to-have (later)

- Per-key error heatmap for the current session (in-memory only).
- Additional layouts (QWERTY) behind a settings switch.

---

## 8. Visual Design

- Mascot: a friendly cartoon fox („Schlaufuchs"), as inline SVG.
- Palette: warm fox-orange primary (`#e8590c` range), cream background,
  dark-brown text; distinct success-green and error-red with sufficient
  contrast. Support `prefers-color-scheme: dark` from the start.
- Typography: system font stack; very large sizes inside games (the math
  question should be readable from a meter away).
- Feedback: micro-animations (flash, shake on error, confetti on level-up),
  all respecting `prefers-reduced-motion`.

---

## 9. Testing & Quality

- Games expose their pure logic (question selection, scoring, level
  generation) as importable functions separate from DOM code, so they can be
  unit-tested with `node --test` without a browser. Tests live in `tests/`
  (excluded from the published site only by not being linked — being public
  is harmless).
- A GitHub Actions workflow runs the tests on every push.
- Manual test checklist per release: fresh-profile smoke test, cookie
  round-trip after browser restart, subpath serving, tablet viewport.

---

## 10. Open Questions

1. **Pages source**: publish from repo root or from `/docs`? Root is simplest;
   `/docs` keeps the root clean if tooling is added later. → Default: root.
2. Should the reset action also be available per game, not only globally?
   → Suggest: yes, per-game reset in each game's settings corner.
3. Typing game word lists: curate a child-appropriate German word list
   (~500 words) — source/curation TBD.

---

## 11. Milestones

1. **M1 — Skeleton**: repo layout, `CNAME`, shared CSS, `storage.js` with
   tests, landing page with two placeholder cards. Site live on the domain.
2. **M2 — Einmaleins**: full game per §6.
3. **M3 — Tippen**: levels 1–8 (Grund- + Oberreihe) per §7.
4. **M4 — Tippen complete**: remaining levels, polish, dark mode.
