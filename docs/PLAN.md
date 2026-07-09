# Schlaufuchs: UI Design Plan

Supersedes the playtest plan (archived as `docs/PLAN_playtest_2026-07.md`,
fully implemented). This plan covers the visual identity pass that follows the
island map redraw.

## The brief, pinned down

**Subject:** Schlaufuchs, an island of learning games. **Audience:** children
5–15, on a phone, usually alone, often for five minutes at a time.
**The map's single job:** make a child want to walk into a region and play.
Everything else on that page is in the way.

## Findings (from a critique of the shipped UI)

1. **Typography is the whole personality, and it is `system-ui`.** The island
   says "adventure"; the type says "system settings". Worst offender: the hero
   of the game screen — `2 × 7 = ?` — is set in the OS default UI face.
2. **The bottom navigation duplicates the map.** Six buttons repeating the six
   regions already tappable above them. At 390px it wraps to three rows and the
   page **scrolls**, violating SPEC §5.1 ("fits 100dvh without scrolling"). The
   class is called `fallback-nav` but is permanently visible.
3. **The game screen has a vacuum.** Journey strip at the top, answers at the
   bottom, ~300px of nothing between, question floating in it. Reads as a
   layout accident, not as calm. Question and answers must group.
4. **One accent colour carries everything.** Orange is the focus ring, the
   question gap, the fox, button rims, the level bar and the sticker borders at
   once — so orange means nothing. Progress and ownership have no colour.
5. **The album is correct and joyless.** Sixty identical dashed boxes holding
   `?`. Nothing to want. Silhouettes of the unearned stickers create the pull.
6. **`.layer-thriving` / `.layer-mastered` exist and spend themselves on 🦉 and
   ✨.** The island should visibly change because of the child.
7. **Copy leaks the system.** The album's empty state states a rule
   ("Finish a perfect round …") where it should extend an invitation.
   *Correction to an earlier reading:* the game chip `Leicht · ×2` is **not** a
   score multiplier — `×2` is the times table. It is still ambiguous next to a
   difficulty word, but it is not the bug it first appeared to be, so it is out
   of scope here.

## Token system

### Colour — derived from the island, not from a palette generator

| Token | Hex | Job — and *only* this job |
|---|---|---|
| `--bg` | `#fdf6ec` | parchment ground |
| `--panel` | `#ffffff` | raised surfaces |
| `--ink` / `--ink-soft` | `#4a2c17` / `#8a6a50` | text |
| `--orange` | `#e8590c` | **the fox and actions.** Nothing else. |
| `--depth` | `#1f6f8b` | **progress and ownership** (new) |
| `--ok` / `--err` | `#2f9e44` / `#c1121f` | right / wrong, momentary only |

`--depth` is the island's deep water. It takes over the level bar, star badges,
earned stickers and mastered regions, so that colour finally carries
information: *orange is what you do, blue is what you have.*

### Type — the deliberate pair

- **Display: Grandstander** (variable 400–800, self-hosted). Rounded, slightly
  wonky, warm without being Comic Sans. Carries numbers, region names,
  headings, and the question. Explicitly *not* Fredoka/Nunito/Baloo, the three
  faces every kids' app already uses.
- **Body & UI: Atkinson Hyperlegible.** Legibility-first, designed for low
  vision — unusually open apertures, unmistakable `1 l I` and `0 O`. It is the
  quiet layer under the display face, and it is the right face for the reading
  game for the same reason it is the right face for a settings row.

The pairing is the point: **joy on top, clarity underneath.** Both OFL, both
self-hosted under `assets/fonts/` (77 KB total, latin subset), so there is
still no build step and no third-party request.

### Layout

```
BEFORE (390px)                    AFTER
┌──────────────────┐              ┌──────────────────┐
│ chips            │              │ chips            │
│ ┌──────────────┐ │              │ ┌──────────────┐ │
│ │  map (small) │ │              │ │              │ │
│ └──────────────┘ │              │ │  map, whole  │ │
│ [btn][btn]       │              │ │  viewport    │ │
│ [btn][btn]       │  ← scrolls   │ │              │ │
│ [btn][btn]       │              │ └──────────────┘ │
└──────────────────┘              └──────────────────┘
```

The six nav buttons become a visually-hidden, keyboard-focusable skip list.
Screen readers and tab users keep every destination; eyes get the island.

### Signature: the island remembers

Mastered regions do not merely gain a sparkle — **their road paves itself.**
Dirt track → cobblestone, drawn in `--depth`. A child who has mastered the
times tables sees a stone road running from the village, and the roads to the
regions they have not touched are still dirt. The map becomes a record of the
child rather than a picture of a place.

This is the one bold element. Everything around it stays quiet: no new
animation, no gradients, no decoration that does not encode state.

## Steps

1. `assets/fonts/` + `@font-face` + type tokens; apply display/body roles.
2. Remove `.fallback-nav` visually; add `.visually-hidden` skip list.
3. Introduce `--depth`; move progress/ownership colours onto it.
4. Give each road its own `id`; `map.js` paves the roads of mastered regions.
5. Game screen: group question with answers; question in the display face.
6. Album: silhouettes instead of `?`; rewrite the empty state as an invitation.
7. `node --test`, screenshot every page at 390×844, update `docs/SPEC.md`.

## Constraints (unchanged)

- No build step, no dependencies, no framework. English code, bilingual UI.
- Cookie budget 3500 bytes — this plan adds **no** persistent state.
- Light theme only; every page fits `100dvh`.
- `prefers-reduced-motion` and visible focus are non-negotiable.
