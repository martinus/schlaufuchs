// Lesen pure logic (§14): item addressing over the content packs, the blitz
// clock, question and option generation, star criteria. No DOM, no storage —
// unit-tested in tests/lesen.test.js.
//
// Items are addressed by one global id: packs in content order, items in
// theirs (§14.3). The id doubles as the index into the box digit string, which
// is why the content file is append-only.

import { clampBox } from "../../assets/js/adaptive.js";

// Questions per round (§7.3): eight items. Lesen rounds were six — kept short
// for a young reader's patience — but every tile's three stars were too quick
// to collect, so a full Pokal ladder asked too little reading. Eight makes a
// round meatier without outlasting a child, and three-starring one (all eight
// first try) is real work. Every pack still outgrows the round (smallest is 10).
export const ROUND_SIZE = 8;

// How the three difficulty indices are *named*: the i18n key the child reads
// and the CSS slug that colours a picker section (same contract as einmaleins).
export const DIFF_KEYS = ["diffEasy", "diffMedium", "diffHard"];
export const DIFF_SLUGS = ["easy", "medium", "hard"];

// Tile addressing within a difficulty: packs 0..3 in content order, and the
// "Alle" tile at index 4 that mixes the whole difficulty. Also the slot count
// of the per-difficulty star digit string (§14.5).
export const MIXED = 4;
export const STAR_TILES = 5;

// --- the blitz clock (§14.2) -------------------------------------------------
// How long a word stays readable before it hides, in ms, by Leitner box: a new
// word (box 0) is generous, a settled one (box 4) is a real blitz. This is the
// adaptive hook — the child *feels* getting faster without being told.
// Deliberately plain named numbers — retune after watching a real child.
//
// Only Leicht flashes: it is the one difficulty that shows a single word (§14.1).
// Mittel (Stimmt/Quatsch) and Schwer (reading passages) both put a whole
// sentence or passage on screen to be read and judged, and nothing is ever
// taken away — so there is no row for them, and flashMs returns null.
// Retuned harder after "the reading is too easy" (§14): the reveal is ~20–25%
// shorter across the curve, so even a fresh word is a real glance and a settled
// one is a genuine blitz. Floor is 500ms (a word must stay readable) and each
// box is strictly faster than the last — pinned by tests/lesen.test.js.
export const FLASH_MS = [
  [1900, 1350, 1000, 720, 500], // Leicht, box 0..4
];

// The flash duration for one word, or null when this difficulty does not
// flash. Junk boxes read as box 2, exactly as the session itself would.
export function flashMs(box, difficulty) {
  const row = FLASH_MS[difficulty];
  return row ? row[clampBox(box)] : null;
}

// --- double-tap guard (§14.2) ------------------------------------------------
// The answer buttons go live the instant a question is answerable, and the next
// question follows the last by only NEXT_MS (250ms). A physical double-click —
// one the child never meant — therefore lands its second tap on a button that
// has, in between, come to mean something else: the freshly shown next question,
// or the retry inside the aid. A young reader met exactly this — a stray second
// press picked a wrong answer to a Schwer passage she had not begun to read. So
// a press within GUARD_MS of the last accepted press is that bounce, and is
// swallowed. Nobody reads a word or a passage this fast; and a deliberate ⚡
// answer (§10.6) is timed from its own question — always at least NEXT_MS newer
// than the previous press — so the guard never costs a genuine fast answer.
export const GUARD_MS = 300;

// Is a press at `now` the bounce of a double-click — inside the guard window the
// last accepted press at `armedAt` opened? Pure, so the rule is unit-tested
// without a clock. A missing/never-set `armedAt` (nothing pressed yet, or a
// fresh round) is never a bounce.
export function isBounce(now, armedAt, guard = GUARD_MS) {
  return Number.isFinite(armedAt) && Number.isFinite(now) && now - armedAt < guard;
}

// --- item addressing ---------------------------------------------------------
// A pack is a *tile* — its own entry in the picker, and one slot of the star
// digit string — unless it *extends* another pack's theme. An `extends` pack is
// simply more items poured into the primary pack's pool: it carries the SAME
// theme (e.g. "tiereB" extends "tiere"), is drawn in the same round, and is
// appended at the END of the content file so no existing item's id shifts
// (§14.3, append-only). Tile count therefore stays fixed as content grows, so
// the reward economy (maxPoints, the trophy ladder) never moves under a deeper
// pool — only the variety within a tile does.
const isTile = (pack) => pack.extends === undefined;

// One difficulty's packs (tiles and their extensions), each with the global id
// its first item carries.
function diffPacks(difficulty, content) {
  const out = [];
  let offset = 0;
  for (const pack of content.packs) {
    if (pack.diff === difficulty) out.push({ pack, offset });
    offset += pack.items.length;
  }
  return out;
}

// The tiles a difficulty offers, in tile order — the picker's vocabulary. Only
// primary packs are tiles; an `extends` pack rides inside its primary's pool and
// is never shown or counted on its own.
export function packsFor(difficulty, content) {
  return diffPacks(difficulty, content).map((d) => d.pack).filter(isTile);
}

// Item ids for one tile: a primary pack's items UNION every extension of its
// theme, or the difficulty's whole union for the "Alle" tile. A tile index the
// difficulty does not offer reads as "Alle", so a corrupt cookie can never open
// an empty round.
export function poolFor(difficulty, pack, content) {
  const dp = diffPacks(difficulty, content);
  const tiles = dp.filter((d) => isTile(d.pack));
  const primary = Number.isInteger(pack) && pack >= 0 && pack < tiles.length
    ? tiles[pack].pack
    : null;
  const chosen = primary
    ? dp.filter((d) => d.pack === primary || d.pack.extends === primary.key)
    : dp; // "Alle": the whole difficulty, every tile and its extensions
  const pool = [];
  for (const { pack: p, offset } of chosen) {
    for (let i = 0; i < p.items.length; i++) pool.push(offset + i);
  }
  return pool;
}

// The item behind a global id, with the pack it lives in — the pack is the
// distractor source (§14.3). Null for anything that is not a valid id.
export function itemAt(id, content) {
  if (!Number.isInteger(id) || id < 0) return null;
  let offset = 0;
  for (const pack of content.packs) {
    if (id < offset + pack.items.length) return { pack, item: pack.items[id - offset] };
    offset += pack.items.length;
  }
  return null;
}

// --- questions ---------------------------------------------------------------
// A Leicht word item asks for its emoji (§14.1). A Mittel item is a Stimmt/
// Quatsch pair: one of its two faces is shown per encounter — drawn here, so the
// truth of "the sentence about the moon" cannot be memorised, only read (§14.1).
// A Schwer item is a reading passage: the child reads `text` and answers the
// question `q`, the correct answer being the first option (§14.2). `text` is
// carried as `passage`, and `text` on the question is the *question* — the same
// field the word card renders. `scene` carries the item's picture-book emoji
// (§14.2), the anchor the read card draws beside the passage.
export function questionFor(id, content, rng = Math.random) {
  const found = itemAt(id, content);
  if (!found) return null;
  const { item } = found;
  if (item.w !== undefined) return { kind: "word", text: item.w, answer: item.e };
  if (item.ok !== undefined) {
    return rng() < 0.5
      ? { kind: "sent", text: item.ok, answer: true }
      : { kind: "sent", text: item.no, answer: false };
  }
  return { kind: "read", passage: item.text, text: item.q, answer: item.a[0], scene: item.e };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The answer choices, shuffled. For a WORD: four emoji — the answer plus three
// pack-mates, so distractors are same-theme yet distinct (pack emoji are unique,
// tested); on the "Alle" tile the word's home pack still supplies them. For a
// READING passage: the item's own four answers (the correct one is authored
// first, and shuffled in here so its position never gives it away). Null for a
// Stimmt/Quatsch sentence — it answers with a verdict, not a choice of options —
// and for anything that is not a valid answerable item.
export function optionsFor(id, content, rng = Math.random) {
  const found = itemAt(id, content);
  if (!found) return null;
  const { item, pack } = found;
  if (item.w !== undefined) {
    const others = shuffle(pack.items.filter((it) => it !== item).map((it) => it.e), rng);
    return shuffle([item.e, ...others.slice(0, 3)], rng);
  }
  if (item.text !== undefined) return shuffle([...item.a], rng);
  return null;
}

// --- stars (§14.3) -------------------------------------------------------------
// The einmaleins ratios exactly (≥60 % ⭐, ≥80 % ⭐⭐, 100 % ⭐⭐⭐ first-try): on a
// round of six that is 4, 5 and 6. Duplicated, not imported — einmaleins'
// logic is a shipped game, not a shared library, and tests/lesen.test.js pins
// the two against each other so they cannot drift apart silently.
export const STAR_SLOTS = 3;

export function starNeeds(total) {
  // The three scores that pay the stars: the percent bands (≥60 % ⭐, ≥80 % ⭐⭐,
  // 100 % ⭐⭐⭐), pulled apart when a short round would drop two stars on the
  // same answer — 80 % and 100 % of three tasks are both "all three". Every
  // star group then lands on its own waypoint (§10.3, §10.5): a three-task
  // round pays at 1, 2 and 3, a four-task round at 2, 3 and 4.
  if (!(total > 0)) return null;
  const t3 = total;
  const t2 = Math.max(1, Math.min(Math.ceil(0.8 * total), t3 - 1));
  const t1 = Math.max(1, Math.min(Math.ceil(0.6 * total), t2 - 1));
  return [t1, t2, t3];
}

export function starsFor(firstTryOk, total) {
  const needs = starNeeds(total);
  if (!needs) return 0;
  return needs.filter((n) => firstTryOk >= n).length;
}



// The stars you own on this tile if the round stopped right now — the round
// scene's basket (§10.5). Monotone in both terms, so a star can never leave.
export function ownedStars({ firstTrySolved = 0, total = 0 } = {}, best = 0) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, STAR_SLOTS) : 0;
  const earned = total > 0 ? starsFor(firstTrySolved, total) : 0;
  return Math.max(held, earned);
}

// --- star digit strings (§14.5) ------------------------------------------------
// One digit per tile in a 5-char per-difficulty string: packs 0..3, "Alle" at
// index 4. Junk in, zero out.
export function starDigit(starString, pack) {
  const d = Number.parseInt((starString ?? "")[pack], 10);
  return Number.isInteger(d) ? Math.min(d, 3) : 0;
}

export function withStarDigit(starString, pack, value) {
  const s = (starString ?? "").padEnd(STAR_TILES, "0").split("");
  s[pack] = String(value);
  return s.join("");
}

// The word must always stay on one line — a broken "Geburtstags-kuchen" is two
// reads, and the blitz pays for one. Same contract as the einmaleins question
// (§10.1), duplicated like the star rules and pinned by the same parity test.
export function fittedFontSize(size, avail, width) {
  if (!(size > 0) || !(avail > 0) || !(width > 0) || width <= avail) return size;
  return Math.floor((size * avail) / width);
}

// --- the tempo ladder (§10.6, §14.4) -------------------------------------------
// The same second, purely additive collectible einmaleins pays: 🐇 → 🚗 → 🚀,
// only ever upward, worth nothing but itself. Duplicated from einmaleins'
// logic.js like the star rules above — a shipped game is not a shared library
// — and pinned against it by the parity test in tests/lesen.test.js. When a
// third game wants the ladder, promote the shared parts to assets/js/tempo.js.
export const TEMPO_SLOTS = 3;

// Upper bounds (ms) on the round's median answer time, per difficulty:
// [hare, car, rocket]. The clock starts when the child sees the question — the
// reveal tap for a word (§14.2), the show for a sentence or passage — so Leicht
// mirrors einmaleins' Leicht (a tap on one of four choices). Mittel is a whole
// SENTENCE read (§14.1) plus a Stimmt/Quatsch verdict: reading ~8 words at one
// or two a second is several seconds before she can judge it, so its bounds sit
// well past the word rows'. Schwer is a whole PASSAGE read (~3 lines) plus a
// four-way comprehension choice, more generous still — the rocket rewards fluent
// reading, never a guess (the ⭐⭐ gate below keeps guessing unprofitable).
// Deliberately plain named numbers — retune after watching a real child.
export const TEMPO_TIERS = [
  [8000, 5000, 3000], // Leicht — a word and four emoji
  [12000, 8000, 5000], // Mittel — read a sentence, then judge it
  [25000, 16000, 10000], // Schwer — reading a passage takes real time
];

// The ladder's three faces, indexed by tier: the icon name (graphics.js) and
// the i18n key. Index 0 is the point of both: below the hare there is nothing
// to draw and nothing to say — never a snail.
export const TEMPO_ICONS = [null, "tempo-hare", "tempo-car", "tempo-rocket"];
export const TEMPO_KEYS = [null, "tempo1", "tempo2", "tempo3"];

// The median, because one long think about a new word must not cost the round
// its tempo — a sum or a mean would hand the slowest question a veto.
export function median(values) {
  const v = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Tier for a time (the round's median — or a single answer: tier 3 on one
// answer is what triggers the in-round ⚡). Total: junk in, no tier out.
export function tempoTier(ms, difficulty) {
  const limits = TEMPO_TIERS[difficulty];
  if (!limits || !Number.isFinite(ms) || ms < 0) return 0;
  if (ms <= limits[2]) return 3;
  if (ms <= limits[1]) return 2;
  return ms <= limits[0] ? 1 : 0;
}

// What the tile stores after the round: fast-and-wrong must never pay, so a
// round below two stars (§14.3) awards nothing — and like the star basket,
// the stored tier only ever climbs.
export function awardTempo({ stars = 0, tier = 0, best = 0 } = {}) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, TEMPO_SLOTS) : 0;
  const won = Number.isInteger(tier) && tier > 0 ? Math.min(tier, TEMPO_SLOTS) : 0;
  return stars >= 2 ? Math.max(held, won) : held;
}

// Everything the game can pay, computed from its real tiles (§8.3): each
// difficulty offers its packs plus "Alle", each tile holds three stars, and a
// star is worth difficulty + 1. This is what MAX_POINTS.lesen must equal —
// tests/lesen.test.js holds the two together.
export function maxPoints(content) {
  let total = 0;
  for (let d = 0; d < DIFF_KEYS.length; d++) {
    total += (packsFor(d, content).length + 1) * STAR_SLOTS * (d + 1);
  }
  return total;
}
