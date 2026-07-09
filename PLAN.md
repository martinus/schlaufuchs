# Schlaufuchs: Playtest Feedback Implementation Plan

Handoff document for an implementing LLM session. It is self-contained: all decisions are already made, all key facts are verified against the code. Execute the steps in order — the app stays fully working after each step.

## Conventions (mandatory)

- **All generated files, code, and comments in English.** The user communicates in German, but the codebase is English.
- **User-facing UI strings are bilingual** via the existing i18n system: every new string goes into BOTH `assets/i18n/de.js` and `assets/i18n/en.js` (a test enforces key parity).
- No build step may be introduced. Plain ES modules, static hosting on GitHub Pages.
- Keep the code style: small vanilla JS modules, no frameworks, no dependencies.
- Serve locally with `python3 -m http.server 8000` for manual verification — never `file://` (ES modules). Run tests with `node --test`.

## Context

Schlaufuchs is a learning-games website for kids (ages 5–15): static HTML/CSS/JS, ES modules, no build, deployed to GitHub Pages. A world map on the main page has 5 regions, each linking to a game; only `einmaleins` (times tables) is implemented, the other 4 are stubs. Progress (stars, fox level, stickers) is stored in a single cookie.

Playtest feedback revealed:
- Graphics are emoji literals scattered across `index.html`, `rewards.js`, `journey.js` — impossible to swap. Only the fox mascot is centralized (`assets/js/fox.js`).
- The fox level / stars / sticker mechanics are never explained in the UI.
- Main page and game page have inconsistent top bars (on desktop, the main-page header spans the full viewport so buttons sit flush left/right, while the game sits in a centered 560px column).
- The sticker album hides behind a small header icon.

**Decisions already made by the user (do not re-litigate):**
- Swappable graphics = individual SVG files in `assets/img/icons/`, central registry module, current emoji as fallback.
- Star displays: upgrade **both** the level chip (total stars + "X more stars to level Y") **and** the per-region map badges (gold/glow tiers).
- The journey path symbols (basket/rooster/door) become mini-milestones: small animation + sound when the fox passes them. No gameplay change.
- Sticker album gets a "Trophy Room" region on the map instead of the header icon.

## Verified codebase facts

- Pages: `index.html` (main page, inline-SVG world map at lines 22–124, viewBox `0 0 360 560`), `album.html`, `games/einmaleins/index.html` (full game), `games/{rechnungen,tippen,vokabeln,lesen}/index.html` (stubs).
- CSS: single file `assets/css/schlaufuchs.css`, linked with cache-bust `?v=3` from all 7 HTML files.
- JS modules in `assets/js/`: `map.js`, `fox.js` (foxSVG generator + level cosmetics), `rewards.js`, `journey.js`, `storage.js`, `album.js`, `adaptive.js`, `audio.js`, `confetti.js`, `i18n.js`.
- Fox level: `foxLevel(totalStars) = min(20, 1 + floor(totalStars/10))` (`rewards.js:130`). `levelInfo()` (`rewards.js:158`) already returns `{total, level, nextAt, frac}` — `total` is currently unused in the UI.
- Stickers: earned only on perfect rounds (all first-try correct). `THRESHOLDS = [1,2,3,5,7,9,12,15,18,22,26,30]` (`rewards.js:11`), `stickerCount` (`rewards.js:100`), `STICKERS` table with 12 emoji per game × 5 games (`rewards.js:14–85`, each `{e, de, en}`).
- Journey strip (`journey.js`): one node per round item (~10), obstacles at `OBSTACLE_AT = [2,5,8]`; `advance()` already finds the obstacle at `pos+1` and adds class `cleared` (lines 62–65). `THEMES` (lines 7–12) currently hold raw emoji.
- Storage: single cookie `schlaufuchs`, **3500-byte budget** (`storage.js`) — none of these steps may add persistent state (and none do).
- `translateDOM` in `i18n.js` sets `textContent` on every `[data-i18n]` element — an icon must never live inside the same element as a `data-i18n` attribute, or language switching wipes it.
- Tests: `node --test` over `tests/*.test.js`. `tests/i18n.test.js` enforces de/en key parity. `tests/rewards.test.js` requires `e`/`de`/`en` on every sticker (new fields are fine, removals are not).
- Deploy workflow copies `index.html album.html CNAME assets games` — new root-level `.md` files are NOT deployed (intended for the docs below); any new asset directory must live under `assets/`.
- SPEC.md requires subpath support → only relative URLs, never `/assets/...`.

---

## Step 1 — Graphics registry `assets/js/graphics.js` + tests

**New file `assets/js/graphics.js`** (English comments):

- Manifest: `export const GRAPHICS = { name: { emoji }, … }` — emoji always present (fallback).
- SVG gating: `const AVAILABLE = new Set([])` (initially empty). A name renders as an SVG file **only if listed here**. File convention: `assets/img/icons/<name>.svg`, viewBox `0 0 64 64`. No runtime probing, no 404s, no onerror hacks. Swapping in graphics later = drop files into `assets/img/icons/` and add the names to `AVAILABLE`.
- URL resolution: `const ICON_BASE = new URL("../img/icons/", import.meta.url)` then `iconURL(name)` = `new URL(name + ".svg", ICON_BASE).href`. Works from any page depth and under subpath deploys. No `document` access at module top level (module must load under `node --test`).
- API (pure string builders, node-testable):

```js
export function iconHTML(name, { size = 24, cls = "" } = {})
// AVAILABLE: `<img class="gicon ${cls}" src="${iconURL(name)}" width="${size}" height="${size}" alt="">`
// fallback:  `<span class="gicon ${cls}" style="font-size:${size}px" aria-hidden="true">${emoji}</span>`

export function iconSVG(name, { x, y, size = 16, cls = "", attrs = "" } = {})
// x = horizontal center, y = text BASELINE (matches all existing <text> call sites).
// AVAILABLE: `<image class="${cls}" ${attrs} href="${iconURL(name)}"
//             x="${x - size/2}" y="${y - size*0.85}" width="${size}" height="${size}"/>`
// fallback:  `<text class="${cls}" ${attrs} x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${emoji}</text>`

export function applyIcons(root = document)
// For every element with [data-icon]: if AVAILABLE.has(name):
//   - SVG <text>: replace with an SVG-namespace <image> (createElementNS!), copying class
//     and data-* attrs; x/y from the text element's attributes, size from data-icon-size
//     (default 16), positioned like iconSVG above.
//   - HTML element: innerHTML = iconHTML(name, { size: data-icon-size ?? 24 }).
// If NOT available: do nothing — the emoji already in the static markup IS the fallback.
```

- Sticker icon names are generated, not duplicated. In `assets/js/rewards.js`, directly after the STICKERS table (~line 85):

```js
for (const g of GAMES) STICKERS[g].forEach((s, i) => { s.icon = `sticker-${g}-${i + 1}`; });
```

  In graphics.js: `import { GAMES, STICKERS } from "./rewards.js";` and register `GRAPHICS[s.icon] = { emoji: s.e }` for all 60. No import cycle (graphics → rewards → storage only).

- **Name scheme (exact — used by all later steps and by GRAPHICS_BRIEF.md):**
  - UI: `ui-map` 🗺️, `ui-gear` ⚙️, `ui-sound-on` 🔊, `ui-sound-off` 🔇, `ui-flame` 🔥, `ui-star` ⭐, `ui-trash` 🗑️
  - Regions (mini symbols): `region-einmaleins` 🏠, `region-rechnungen` ⛰️, `region-tippen` 🌊, `region-vokabeln` 🌲, `region-lesen` 📖, `region-pokalraum` 🏆
  - Map decorations: `deco-goat` 🐐, `deco-flag` 🚩, `deco-eagle` 🦅, `deco-owl` 🦉, `deco-deer` 🦌, `deco-sparkle` ✨, `deco-sailboat` ⛵, `deco-swan` 🦢, `deco-circus` 🎪, `deco-flower` 🌼, `deco-rainbow` 🌈, `deco-book` 📖, `deco-trophy` 🏆, `deco-party` 🎉
  - Journey: `j-basket` 🧺, `j-rooster` 🐓, `j-door` 🚪, `j-rock` 🪨, `j-bridge` 🌉, `j-troll` 🧌, `j-mushroom` 🍄, `j-hedgehog` 🦔, `j-butterfly` 🦋, `j-flower` 🌼, `j-bee` 🐝, `j-goal-bell` 🔔, `j-goal-flag` 🚩, `j-goal-sparkle` ✨, `j-goal-book` 📖
  - Stickers: `sticker-<game>-1` … `sticker-<game>-12` (generated)
- CSS (`schlaufuchs.css`): `.gicon { display:inline-block; vertical-align:middle; line-height:1; }` and `img.gicon { object-fit:contain; }`
- **NOT routed through the registry:** the fox (`fox.js`, code-generated with level cosmetics) and the hand-drawn map scenery polygons in `index.html`. Only emoji go through the registry.

**New test `tests/graphics.test.js`:** every GRAPHICS entry has an emoji; all 60 `sticker-*` names exist; every AVAILABLE name exists in GRAPHICS; `iconHTML("ui-gear")` fallback contains "⚙️" and a font-size; `iconSVG("ui-star", {x:10, y:20})` fallback is a `<text>` with `text-anchor="middle"`; all 15 `j-*` names resolve.

**Verify:** `node --test` green; site visually unchanged in the browser.

## Step 2 — Wire existing surfaces through the registry (no visual change yet)

1. **index.html map decorations:** add `data-icon` + `data-icon-size` to every decoration `<text>` (keep the emoji content as fallback): line 40 `deco-goat`/16, 42 `deco-flag`, 43 `deco-eagle`, 60 `deco-owl`, 62 `deco-deer`, 63 `deco-sparkle`, 76 `deco-sailboat`, 77 `deco-swan`, 97+98 `deco-sparkle`, 100 `deco-circus`, 111 `deco-book`, 113+114 `deco-flower`, 116 `deco-rainbow`. Sizes = current font-size values.
2. **map.js:** call `applyIcons(document)` once at startup (after `initI18n()`, outside `render()` — decorations are static). Streak chip (line 38): `streakEl.innerHTML = iconHTML("ui-flame", { size: 18 }) + " " + streak[1];`
3. **journey.js:** switch THEMES to icon names and render via `iconSVG`:

```js
const THEMES = {
  village:  { goal: "j-goal-bell",    obstacles: ["j-basket", "j-rooster", "j-door"],    path: "#d9b48f" },
  mountain: { goal: "j-goal-flag",    obstacles: ["j-rock", "j-bridge", "j-troll"],      path: "#b0a99f" },
  forest:   { goal: "j-goal-sparkle", obstacles: ["j-mushroom", "j-hedgehog", "j-door"], path: "#8fbf7f" },
  meadow:   { goal: "j-goal-book",    obstacles: ["j-butterfly", "j-flower", "j-bee"],   path: "#a8d08d" },
};
```

   Goal (lines 37–38): `iconSVG(th.goal, { x, y: y + 7, size: 22, cls: "j-goal", attrs: `data-j="${i}"` })`. Obstacle (lines 43–44): `iconSVG(th.obstacles[oi], { x, y: y - 12, size: 14, cls: "j-obstacle", attrs: `data-j="${i}"` })`. The `.j-goal`/`.j-obstacle` selectors in `advance()`/`finish()` keep working because iconSVG emits the class in both branches.
4. **album.js:** earned-sticker slot uses `iconHTML(s.icon, { size: 34 })` instead of raw `${s.e}` (~line 23).
5. **einmaleins.js ~line 241:** summary sticker via `iconHTML(s.icon, { size: 40 })` inside the `.se-emoji` span; check it still renders correctly.
6. **Nav buttons under the map (user item 1):** each `.fallback-nav` link (index.html:127–132) gets a mini icon span prepended. **Important:** move `data-i18n` onto an inner span, otherwise language switching wipes the icon:

```html
<a href="games/einmaleins/"><span class="nav-ico" data-icon="region-einmaleins" data-icon-size="20">🏠</span><span data-i18n="game_einmaleins">Einmaleins</span></a>
```

   Icons: 🏠 ⛰️ 🌊 (tippen) 🌲 📖 (lesen) 🏆 (album). CSS: `.fallback-nav a { display:inline-flex; align-items:center; gap:6px; }`, `.nav-ico { font-size:20px; }`
7. **Stub pages ×4** (`games/{rechnungen,tippen,vokabeln,lesen}/index.html`): `.stub-emoji` gets `data-icon="region-<game>"` + `data-icon-size="64"`; the inline module additionally imports and calls `applyIcons(document)` after `initI18n()`.
8. **Header icons:** add `data-icon="ui-map"` to all 🗺️ back links (5 games + album.html) and `data-icon="ui-gear"` to gear buttons; `einmaleins.js` and `album.js` call `applyIcons(document)` at startup.

**Verify:** `node --test`; served locally everything is pixel-identical (AVAILABLE is empty). Smoke-test the swap path once with a dummy SVG + AVAILABLE entry (confirm `<img>`/`<image>` replaces the emoji), then revert.

## Step 3 — Level transparency + celebratory star badges (user items 2+3)

1. **rewards.js** new pure function:

```js
// Badge tier for the map star badges: 0 = none, 1 = some stars,
// 2 = >= 1/3 of achievable (gold), 3 = 100 % (glowing).
export function starBadgeTier(state, game) {
  const n = gameStars(state, game);
  if (n <= 0) return 0;
  const frac = n / ACHIEVABLE[game];
  return frac >= 1 ? 3 : frac >= 1 / 3 ? 2 : 1;
}
```

2. **i18n** (both languages): `levelNext: "Noch {n} Sterne bis Level {lvl}"` / `"{n} more stars to level {lvl}"`; `levelMax: "Höchstes Level erreicht!"` / `"Top level reached!"`.
3. **map.js level chip** (lines 26–31): show total stars + progress text, keep the bar:
   - Label: `${t("foxLevel", {lvl})} · ⭐ ${info.total}`
   - below it the existing `.bar`, below that `<span class="sub">` with `levelNext` (`n = info.nextAt - info.total`, `lvl = info.level + 1`), or `levelMax` when `nextAt` is null.
   - CSS: `.levelchip .sub { display:block; font-size:0.65rem; color:var(--ink-soft); white-space:nowrap; }`
4. **Badges become dynamic groups:** in index.html replace each `<text class="region-stars" … data-stars="<game>">⭐ 0</text>` (lines 46, 66, 79, 102, 118) with `<g class="region-badge" data-badge="<game>" transform="translate(cx,cy)"></g>` using the same coordinates (e.g. einmaleins → `translate(180,463)`). In the map.js render loop:

```js
const badge = document.querySelector(`[data-badge="${game}"]`);
const n = gameStars(state, game);
badge.innerHTML = iconSVG("ui-star", { x: -8, y: 0, size: 12 })
  + `<text class="region-stars" x="0" y="0" text-anchor="start">${n}</text>`;
badge.classList.remove("badge-t1", "badge-t2", "badge-t3");
const tier = starBadgeTier(state, game);
if (tier) badge.classList.add(`badge-t${tier}`);
```

   (`innerHTML` on an SVG `<g>` works in all modern browsers.) Remove the old `[data-stars]` handling.
5. **CSS tiers:** t1 normal; t2 larger/bolder with gold fill `#b8860b`; t3 additionally `filter: drop-shadow(0 0 3px #f4b400)` + a pulsing `@keyframes badge-glow` (2s ease-in-out infinite alternate to `drop-shadow(0 0 6px #f4b400)`). Confirm the existing `prefers-reduced-motion` block covers the new animation.
6. **Tests** (tests/rewards.test.js): `starBadgeTier` at 0 stars → 0, a few → 1, one third → 2, full → 3 (reuse existing state fixtures).

## Step 4 — Trophy Room map region + album explanation (user items 6+10)

1. **rewards.js** helper + tests:

```js
// Progress toward the next sticker of one game (pr = lifetime perfect rounds).
// Returns null once all 12 stickers are earned.
export function nextStickerInfo(pr) {
  const earned = stickerCount(pr);
  if (earned >= THRESHOLDS.length) return null;
  return { earned, threshold: THRESHOLDS[earned], remaining: THRESHOLDS[earned] - (pr ?? 0) };
}
```

   Tests: pr undefined → `{earned:0, threshold:1, remaining:1}`; pr 1 → `{1,2,1}`; pr 4 → `{3,5,1}`; pr 29 → remaining 1; pr 30 → null.
2. **index.html:** new region bottom-right (verified free space: Zahlendorf hit-rect ends at x 245 / y 468, Tippsee at y 368; viewBox is 360×560). Insert before the `#map-fox` group: `<a href="album.html" class="region" id="region-pokalraum">` containing a hit rect (245,420,112,140), a trophy-hall/museum built from simple shapes (roof polygon `#b06f3c`, hall `#f5f2ec`, columns `#d9cbb8`, base `#c9b79c`), a 🏆 `<text data-icon="deco-trophy" data-icon-size="16">` above the roof, `<g class="layer-thriving">` with ✨, `<g class="layer-mastered">` with 🎉, a `region-label` with `data-i18n="region_pokalraum"` at (295,536), and `<g class="region-badge" data-badge="pokalraum" transform="translate(295,552)">`.
3. **map.js:** render the pokalraum badge as `deco-trophy` icon (size 12) + total sticker count (`GAMES.reduce((a, g) => a + stickerCount(pr[g]), 0)` with `pr = getRewards().pr ?? {}`). Tiers: >0 → t1, ≥20 → t2, ≥60 → t3. Region state classes: add `thriving` at ≥20 stickers, `mastered` at 60, mirroring the games.
4. **i18n:** `region_pokalraum: "Pokalraum"` / `"Trophy Room"`; `albumHow: "Schaffe eine perfekte Runde — alle Aufgaben beim ersten Versuch richtig — und du bekommst einen neuen Sticker!"` / `"Finish a perfect round — every answer right on the first try — and you earn a new sticker!"`; `stickerNextIn: "Noch {n} perfekte Runden bis zum nächsten Sticker"` / `"{n} more perfect rounds until the next sticker"`; `stickerNextIn1: "Noch 1 perfekte Runde bis zum nächsten Sticker"` / `"1 more perfect round until the next sticker"`; `stickerAllDone: "Alle Sticker gesammelt!"` / `"All stickers collected!"`.
5. **album.html:** explanation line `<p class="album-how" data-i18n="albumHow"></p>` above the sections. CSS: `.album-how { max-width:560px; margin:0 auto; padding:4px 14px; color:var(--ink-soft); font-weight:600; }`
6. **album.js:** per-game progress line via `nextStickerInfo(pr[game])` → `stickerAllDone` / `stickerNextIn1` / `stickerNextIn` (small, ink-soft, inside each section).
7. The album nav link under the map already has the 🏆 icon from step 2.6. The 📖 header icon is removed in step 6.

## Step 5 — Next-sticker progress in the round summary (user item 6, in-game)

1. **games/einmaleins/index.html:** add `<p class="sline" id="sum-nextsticker" hidden></p>` after `#sum-sticker`.
2. **einmaleins.js** in `endRound()` after `recordRound` (~line 229): `nextStickerInfo((getRewards().pr ?? {}).einmaleins)` (extend imports: `nextStickerInfo` from rewards.js, `getRewards` from storage.js). Always show it — it doubles as the in-game explanation of the sticker system.

**Verify:** round with a mistake → "Noch 1 perfekte Runde bis zum nächsten Sticker"; perfect round → sticker + "Noch 1 …" (threshold 2).

## Step 6 — Unified topbar + shared settings overlay (user items 4+9)

**New module `assets/js/chrome.js`** (~90 lines, vanilla, English comments):
- `renderLevelChip(el)` — exactly the markup from step 3.3 (fox + level · ⭐ total + bar + sub).
- `initSettingsOverlay({ resetKind: "all"|"game"|null, game, onChange, onClose })` — builds the overlay (`.overlay > .sheet`) via JS into `document.body`: rows for sound (`iconHTML` ui-sound-on/off), language (EN/DE), reset (only when resetKind is set; two-step ❗ confirmation exactly like the existing einmaleins.js lines 337–350, then `resetAll()`/`resetGame(game)` + `location.reload()`), close button. Returns `{ open, close }`.

Then:
1. **index.html header:** levelchip, streakchip, spacer, `<button class="iconbtn" id="gearbtn" data-i18n-label="settings" data-icon="ui-gear">⚙️</button>`. **Delete** the 📖, 🔊, and EN buttons (lines 16–18).
2. **map.js:** remove soundbtn/langbtn wiring (lines 64–77) and the inline levelchip markup; use `renderLevelChip` + `initSettingsOverlay({ resetKind: "all", onChange: render })`; gearbtn → `settings.open`. Keep the footer resetbtn + `#reset-overlay` unchanged.
3. **einmaleins:** delete the inline `#set-overlay` markup (index.html lines 40–48) and the settings wiring (einmaleins.js lines 307–350, 358–360); use chrome.js: `initSettingsOverlay({ resetKind: "game", game: "einmaleins", onChange() { updateChip(); if (!roundOver) renderQuestion(); }, onClose() { if (roundOver) showSummary(); } })`. Add the level chip to the game header (`🗺️ | levelchip | pickchip | spacer | gear`), call `renderLevelChip` in `startRound()` (refreshes after each round). **Width guard for 360px phones:**

```css
.game .levelchip .sub { display: none; }
@media (max-width: 430px) { .game .levelchip .bar { display: none; } }
```

4. **Stub pages ×4:** header = back + levelchip + spacer + gear; inline module: `initI18n`, `applyIcons`, `renderLevelChip`, `initSettingsOverlay` (no reset).
5. **Desktop width fix (CSS only, no wrapper):**

```css
.topbar { max-width: 560px; margin-inline: auto; width: 100%; }
```

   Inside `.game` this is a no-op (already ≤560px); on index/album it centers the bar identically.
6. **album.html:** header stays (back + title + count); the back button already has `data-icon` from step 2.8.

**Verify:** all 7 pages served locally: gear opens the overlay everywhere, sound/language toggle and re-render, per-game two-step reset works in einmaleins, global reset works from the main overlay, no 🔊/EN/📖 left in the main header, header centered at ≥600px width, check 360px in devtools.

## Step 7 — Journey obstacles get meaning (user item 5)

1. **audio.js:** new sfx `clear()` — short rising three-note twinkle (`tone(587, 0.1); tone(784, 0.12, 0.08); tone(988, 0.16, 0.16);`), distinct from `correct()`. Guard with the existing `enabled()` check.
2. **journey.js:** in `advance()`, at the existing obstacle lookup (lines 64–65), additionally:

```js
const oi = OBSTACLE_AT.indexOf(pos + 1); // 0 | 1 | 2
obstacle.classList.add("cleared", `j-clear-${oi}`);
sfx.clear();
```

   (import `sfx` from `./audio.js`).
3. **CSS:** obstacle-specific mini celebrations. SVG transform gotcha: set `transform-box: fill-box; transform-origin: 50% 50%;` on `.journey .j-obstacle` — needed for both `<text>` and `<image>`:
   - `.j-clear-0` → bounce (basket hops), `.j-clear-1` → wiggle (rooster shakes), `.j-clear-2` → pop (door pops open); ~0.7s each. Afterwards `.cleared { opacity: 0.5 }` as a settled "done" look. Adjust the existing `.j-obstacle.cleared` rule (schlaufuchs.css ~line 224) accordingly; keep `.j-goal.reached`. The `prefers-reduced-motion` block covers the animations.

**Verify:** play einmaleins; passing nodes 3/6/9 makes the symbol bounce/wiggle/pop with the new sound, then dim.

## Step 8 — `GRAPHICS_BRIEF.md` (user item 8; English; repo root — intentionally not deployed)

A standalone document the user hands to another LLM to generate the full replacement graphics set. Structure:

1. **Context:** Schlaufuchs learning-games site for kids ages 5–15; each asset is a standalone SVG file.
2. **Style:** flat, friendly, rounded, child-appropriate, never scary; warm palette taken from the existing design (read `assets/css/schlaufuchs.css :root` + the map for exact values): orange `#e8590c`, cream `#fdf6ec`, brown ink `#4a2c17`, green `#2f9e44`, red `#c1121f`, sky blue `#cfe8f7`, grass green `#b6d7a8`, gold `#f4b400`; bold shapes, no strokes thinner than 2px.
3. **Hard technical requirements:** valid standalone SVG; `viewBox="0 0 64 64"`; transparent background; motif centered, filling ~80% of the canvas; no external references, scripts, embedded raster images, or font dependencies (text as paths); must read well at 24px AND 120px; exact filename as specified; ideally < 4 KB per file; target directory `assets/img/icons/`.
4. **Asset list** as tables per category (`Filename | current emoji | Description`): UI (7), regions (6), map decorations (14), journey path (15), stickers (60, grouped per game — derive descriptions from the German sticker names in `STICKERS` in rewards.js; e.g. `j-troll.svg | 🧌 | good-natured, funny bridge troll — friendly, not scary`). Note: 👑 appears 5× as sticker #12 — request five *distinct* crowns, themed per region.
5. **Integration note:** after delivery, place the files in `assets/img/icons/` and add the names to `AVAILABLE` in `assets/js/graphics.js` — until then the site automatically shows the emoji.
6. **Acceptance checklist** (transparent? viewBox 64? standalone? exact filename?).

Explicitly out of scope for the brief: the fox (code-generated in fox.js with level cosmetics) and the map scenery (hand-drawn inline SVG).

## Step 9 — Housekeeping

1. Bump the stylesheet cache-bust `?v=3` → `?v=4` in all 7 HTML files.
2. **Update SPEC.md** (code comments cite its sections): §3.1 — six regions incl. Trophy Room + badge tiers; §3.3 — unified topbar (level chip left, gear right, album header icon removed, sound/language/reset in the settings overlay); §8.2 — obstacle-cleared celebration; new short subsection for the graphics registry (`assets/js/graphics.js`, emoji fallback, `assets/img/icons/` convention).
3. Final pass: `node --test` + manual walkthrough of all pages via `python3 -m http.server 8000`.

## Risks / gotchas

- `translateDOM` sets `textContent` → never put an icon inside a `data-i18n` element (step 2.6).
- `applyIcons` must use `createElementNS` for SVG `<image>` replacements; `innerHTML` on SVG `<g>` is fine in modern browsers.
- Never emit absolute `/assets/...` paths — do not "simplify" the `import.meta.url`-based URL resolution (page depth varies, subpath deploys must work).
- The i18n parity test fails if a key lands in only one language file.
- Topbar crowding at 360px on the game page → the hiding rules in step 6.3 are mandatory.
- rewards.test.js requires `e`/`de`/`en` on stickers — the `icon` field is additive only.
- Cookie budget 3500 bytes — do not add persistent state.

## End-to-end verification

1. `node --test` — all tests green (incl. new graphics/rewards tests).
2. `python3 -m http.server 8000`, click through all 7 pages:
   - Main page: centered topbar with level chip ("Fuchs-Level 1 · ⭐ 0", "Noch 10 Sterne bis Level 2") + gear; Trophy Room region bottom-right clickable → album; nav buttons with mini icons.
   - Play an einmaleins round: obstacle celebration at nodes 3/6/9; summary shows sticker progress; level chip updates.
   - Album: explanation at top + "Noch X perfekte Runden…" per game.
   - Language switch (in the overlay): icons survive, all new strings translated.
   - Devtools 360px: game topbar fits.
   - Badge tiers: manipulate the `schlaufuchs` cookie in devtools (`stars` digit strings) or play rounds.
3. Test the swap path once for real: dummy SVG in `assets/img/icons/` + AVAILABLE entry → `<img>`/`<image>` replaces the emoji; remove again.

## Appendix: future game ideas (NOT part of this implementation)

Priority is filling the 4 existing stubs (rechnungen, tippen, vokabeln, lesen). Beyond that, candidates that fit the map/star/sticker system: clock reading (set/read an analog clock), mental-math blitz (number sequences / estimation against the clock, for ages 10–15), spelling detective (find/fix the misspelled word), money & shopping (add prices, give change — fits Zahlendorf thematically), memory fox (Simon-says with number/letter sequences — works for pre-readers). The game pattern to copy: `games/<name>/{index.html, logic.js (pure, tested), <name>.js (DOM controller), i18n.js}`.
