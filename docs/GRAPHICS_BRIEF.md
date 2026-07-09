# Schlaufuchs — Graphics Brief

A brief for generating the full replacement icon set for **Schlaufuchs**, a
learning-games website for children (ages 5–15). Today every icon is an emoji;
this set replaces them with hand-crafted SVG files that share one friendly
style.

## What to deliver

One standalone **SVG file per row** in the tables below. Filenames must match
exactly (they are the registry keys). Target directory: `assets/img/icons/`.

## Visual style

- Flat, friendly, rounded, warm — never scary (a "friendly troll", not a
  monster). Bold, simple shapes a 5-year-old reads instantly.
- Consistent look across the whole set: same line weight, same corner
  rounding, same level of detail, as if drawn by one illustrator.
- Palette (from the existing design — reuse these, don't introduce clashing hues):
  - orange `#e8590c` (primary/brand)
  - cream `#fdf6ec` (background tone)
  - brown ink `#4a2c17` (outlines / dark accents)
  - green `#2f9e44`
  - red `#c1121f`
  - sky blue `#cfe8f7`
  - grass green `#b6d7a8`
  - gold `#f4b400`
- No stroke thinner than 2px (relative to the 64×64 canvas).

## Hard technical requirements

- Valid, **standalone** SVG (opens on its own in a browser).
- `viewBox="0 0 64 64"`.
- **Transparent** background (no filled rect behind the motif).
- Motif centered, filling ~80% of the canvas.
- No external references, no `<script>`, no embedded raster images, no font
  dependencies (convert any text to paths).
- Must read well at **24px and at 120px**.
- Ideally **< 4 KB** per file.

## Asset list

### UI (7)

| Filename | Emoji | Description |
|---|---|---|
| ui-map.svg | 🗺️ | folded treasure map, "back to the map" |
| ui-gear.svg | ⚙️ | settings cog |
| ui-sound-on.svg | 🔊 | speaker with sound waves |
| ui-sound-off.svg | 🔇 | muted speaker |
| ui-flame.svg | 🔥 | small friendly flame (daily streak) |
| ui-star.svg | ⭐ | single gold star (score unit) |
| ui-trash.svg | 🗑️ | trash can (delete progress) |

### Region symbols (6)

Mini emblems for each map area; also shown on the nav buttons under the map.

| Filename | Emoji | Description |
|---|---|---|
| region-einmaleins.svg | 🏠 | cozy little village house (Number Village) |
| region-rechnungen.svg | ⛰️ | rounded mountain peak (Math Mountain) |
| region-tippen.svg | 🌊 | gentle lake wave (Typing Lake) |
| region-vokabeln.svg | 🌲 | friendly fir tree (Word Forest) |
| region-lesen.svg | 📖 | open book (Reading Meadow) |
| region-pokalraum.svg | 🏆 | trophy (Trophy Room / trophy album) |

### Map decorations (14)

Small scenery accents that appear on the map as regions level up.

| Filename | Emoji | Description |
|---|---|---|
| deco-goat.svg | 🐐 | mountain goat |
| deco-flag.svg | 🚩 | summit flag |
| deco-eagle.svg | 🦅 | soaring eagle |
| deco-owl.svg | 🦉 | owl |
| deco-deer.svg | 🦌 | deer |
| deco-sparkle.svg | ✨ | sparkles / twinkle |
| deco-sailboat.svg | ⛵ | small sailboat |
| deco-swan.svg | 🦢 | swan |
| deco-circus.svg | 🎪 | circus / fair tent |
| deco-flower.svg | 🌼 | daisy flower |
| deco-rainbow.svg | 🌈 | rainbow |
| deco-book.svg | 📖 | open book |
| deco-trophy.svg | 🏆 | trophy cup |
| deco-party.svg | 🎉 | party popper |

### Journey path (15)

Obstacles the fox passes and the goal at the end of each themed round. All
obstacles are cheerful milestones, never threatening.

| Filename | Emoji | Description |
|---|---|---|
| j-basket.svg | 🧺 | wicker basket |
| j-rooster.svg | 🐓 | village rooster |
| j-door.svg | 🚪 | little wooden door |
| j-rock.svg | 🪨 | smooth boulder |
| j-bridge.svg | 🌉 | small arched bridge |
| j-troll.svg | 🧌 | good-natured, funny bridge troll — friendly, not scary |
| j-mushroom.svg | 🍄 | red-capped toadstool |
| j-hedgehog.svg | 🦔 | hedgehog |
| j-butterfly.svg | 🦋 | butterfly |
| j-flower.svg | 🌼 | daisy flower |
| j-bee.svg | 🐝 | bee |
| j-goal-bell.svg | 🔔 | school bell (village goal) |
| j-goal-flag.svg | 🚩 | summit flag (mountain goal) |
| j-goal-sparkle.svg | ✨ | sparkles (forest goal) |
| j-goal-book.svg | 📖 | open book (meadow goal) |

### Trophies (60)

12 collectible trophies per game, themed to its region. Filenames follow
`trophy-<game>-<n>` where n is 1–12.

**Note on the crowns:** trophy #12 of every game is a 👑, but each must be a
**distinct, region-themed crown** (village / mountain / lake / forest / reading),
not the same crown five times.

#### einmaleins (Number Village)

| Filename | Emoji | Description |
|---|---|---|
| trophy-einmaleins-1.svg | 🔔 | School Bell |
| trophy-einmaleins-2.svg | 🏠 | Little House |
| trophy-einmaleins-3.svg | 🧮 | Abacus |
| trophy-einmaleins-4.svg | 🥨 | Pretzel |
| trophy-einmaleins-5.svg | 🐓 | Village Rooster |
| trophy-einmaleins-6.svg | 🪁 | Kite |
| trophy-einmaleins-7.svg | 🎺 | Trumpet |
| trophy-einmaleins-8.svg | 🐴 | Pony |
| trophy-einmaleins-9.svg | ⛲ | Village Fountain |
| trophy-einmaleins-10.svg | 🎪 | Village Fair |
| trophy-einmaleins-11.svg | 🌟 | Village Star |
| trophy-einmaleins-12.svg | 👑 | Number King (village-themed crown) |

#### rechnungen (Math Mountain)

| Filename | Emoji | Description |
|---|---|---|
| trophy-rechnungen-1.svg | 🥾 | Hiking Boots |
| trophy-rechnungen-2.svg | 🪨 | Lucky Stone |
| trophy-rechnungen-3.svg | ⛺ | Tent |
| trophy-rechnungen-4.svg | 🐐 | Mountain Goat |
| trophy-rechnungen-5.svg | 🦅 | Eagle |
| trophy-rechnungen-6.svg | ❄️ | Snowflake |
| trophy-rechnungen-7.svg | 🌄 | Sunrise |
| trophy-rechnungen-8.svg | 🦌 | Deer |
| trophy-rechnungen-9.svg | 🧗 | Climbing Pro |
| trophy-rechnungen-10.svg | 🏔️ | Summit |
| trophy-rechnungen-11.svg | 🚩 | Summit Flag |
| trophy-rechnungen-12.svg | 👑 | Mountain King (mountain-themed crown) |

#### tippen (Typing Lake)

| Filename | Emoji | Description |
|---|---|---|
| trophy-tippen-1.svg | 💧 | Water Drop |
| trophy-tippen-2.svg | 🐸 | Frog |
| trophy-tippen-3.svg | 🦆 | Duck |
| trophy-tippen-4.svg | 🐟 | Fish |
| trophy-tippen-5.svg | 🐚 | Seashell |
| trophy-tippen-6.svg | 🛶 | Canoe |
| trophy-tippen-7.svg | 🎣 | Fishing Rod |
| trophy-tippen-8.svg | ⛵ | Sailboat |
| trophy-tippen-9.svg | 🌊 | Wave |
| trophy-tippen-10.svg | 🦢 | Swan |
| trophy-tippen-11.svg | 🚤 | Speedy Boat |
| trophy-tippen-12.svg | 👑 | Lake King (lake-themed crown) |

#### vokabeln (Word Forest)

| Filename | Emoji | Description |
|---|---|---|
| trophy-vokabeln-1.svg | 🍄 | Toadstool |
| trophy-vokabeln-2.svg | 🌰 | Chestnut |
| trophy-vokabeln-3.svg | 🐿️ | Squirrel |
| trophy-vokabeln-4.svg | 🦔 | Hedgehog |
| trophy-vokabeln-5.svg | 🦉 | Owl |
| trophy-vokabeln-6.svg | 🦡 | Badger |
| trophy-vokabeln-7.svg | 🫐 | Berries |
| trophy-vokabeln-8.svg | 🦊 | Fox Friend |
| trophy-vokabeln-9.svg | 🐺 | Wolf |
| trophy-vokabeln-10.svg | 🌲 | Fir Tree |
| trophy-vokabeln-11.svg | 🧚 | Forest Fairy |
| trophy-vokabeln-12.svg | 👑 | Forest King (forest-themed crown) |

#### lesen (Reading Meadow)

| Filename | Emoji | Description |
|---|---|---|
| trophy-lesen-1.svg | 🌼 | Flower |
| trophy-lesen-2.svg | 🐝 | Bee |
| trophy-lesen-3.svg | 🦋 | Butterfly |
| trophy-lesen-4.svg | 🐞 | Ladybug |
| trophy-lesen-5.svg | 🐌 | Snail |
| trophy-lesen-6.svg | 🐇 | Rabbit |
| trophy-lesen-7.svg | ☀️ | Sun |
| trophy-lesen-8.svg | 🎈 | Balloon |
| trophy-lesen-9.svg | 🌈 | Rainbow |
| trophy-lesen-10.svg | 📖 | Favorite Book |
| trophy-lesen-11.svg | ⭐ | Reading Star |
| trophy-lesen-12.svg | 👑 | Reading King (reading-themed crown) |

## Out of scope

Do **not** produce these — they are generated in code, not from files:

- The **fox mascot** (`assets/js/fox.js`, drawn with per-level cosmetics).
- The **map scenery** (mountains, lake, houses, trees) — hand-drawn inline
  SVG polygons in `index.html`.

## Integration

1. Place the delivered `.svg` files in `assets/img/icons/`.
2. In `assets/js/graphics.js`, add each delivered filename (without `.svg`) to
   the `AVAILABLE` set.

Until a name is added to `AVAILABLE`, the site automatically shows its emoji
fallback, so you can drop in graphics incrementally.

## Acceptance checklist (per file)

The machine-checkable items are **enforced by `node --test`**
(`tests/graphics-assets.test.js`): for every name in `AVAILABLE`, the file
must exist and pass the validator, and no stray files may sit in
`assets/img/icons/`. So the workflow is: drop the file in, add the name to
`AVAILABLE`, run `node --test`, and fix whatever it reports.

- [ ] Transparent background — *enforced* (no opaque full-canvas rect)
- [ ] `viewBox="0 0 64 64"` — *enforced*
- [ ] Standalone, valid SVG — no external refs, scripts, raster images, or
  font/`<text>` dependencies — *enforced*
- [ ] Exact filename as listed — *enforced* (missing/stray files fail)
- [ ] Reads clearly at both 24px and 120px — manual (not enforceable)
- [ ] Style/palette consistent with the rest of the set — manual
