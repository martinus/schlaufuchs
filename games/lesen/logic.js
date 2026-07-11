// Lesen pure logic (§14): item addressing over the content packs, the blitz
// clock, question and option generation, star criteria. No DOM, no storage —
// unit-tested in tests/lesen.test.js.
//
// Items are addressed by one global id: packs in content order, items in
// theirs (§14.3). The id doubles as the index into the box digit string, which
// is why the content file is append-only.

import { clampBox } from "../../assets/js/adaptive.js";

// Questions per round (§7.3): Lesen rounds are short — six items, because a
// young reader's round must end before her patience does.
export const ROUND_SIZE = 6;

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
// adaptive hook — the child *feels* getting faster without being told. Mittel
// rows sit later because its words are physically longer. Deliberately plain
// named numbers — retune after watching a real child, nothing else has to move.
//
// Schwer has no row: sentences are never flashed (§14.1). The skill trained
// there is comprehension, and a timed 50/50 verdict rewards guessing — the one
// thing the Quatsch stage must never pay.
export const FLASH_MS = [
  [2400, 1700, 1200, 850, 550], // Leicht, box 0..4
  [3000, 2200, 1600, 1100, 700], // Mittel, box 0..4
];

// The flash duration for one word, or null when this difficulty does not
// flash. Junk boxes read as box 2, exactly as the session itself would.
export function flashMs(box, difficulty) {
  const row = FLASH_MS[difficulty];
  return row ? row[clampBox(box)] : null;
}

// --- item addressing ---------------------------------------------------------
// One difficulty's packs, each with the global id its first item carries.
function diffPacks(difficulty, content) {
  const out = [];
  let offset = 0;
  for (const pack of content.packs) {
    if (pack.diff === difficulty) out.push({ pack, offset });
    offset += pack.items.length;
  }
  return out;
}

// The packs a difficulty offers, in tile order — the picker's vocabulary.
export function packsFor(difficulty, content) {
  return diffPacks(difficulty, content).map((d) => d.pack);
}

// Item ids for one tile: a single pack's, or the difficulty's whole union for
// the "Alle" tile. A tile index the difficulty does not offer reads as "Alle",
// so a corrupt cookie can never open an empty round.
export function poolFor(difficulty, pack, content) {
  const dp = diffPacks(difficulty, content);
  const chosen = Number.isInteger(pack) && pack >= 0 && pack < dp.length ? [dp[pack]] : dp;
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
// A word item asks for its emoji; a sentence item shows ONE of its pair, drawn
// per encounter — so the truth of "the sentence about the moon" cannot be
// memorized, only read (§14.3).
export function questionFor(id, content, rng = Math.random) {
  const found = itemAt(id, content);
  if (!found) return null;
  const { item } = found;
  if (item.w !== undefined) return { kind: "word", text: item.w, answer: item.e };
  return rng() < 0.5
    ? { kind: "sent", text: item.ok, answer: true }
    : { kind: "sent", text: item.no, answer: false };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Four emoji for a word question: the answer plus three pack-mates, shuffled.
// Same pack means plausible (same theme) yet clearly distinct (pack emoji are
// unique, tested) — and on the "Alle" tile the item's home pack still supplies
// them, so a mixed round never pairs a word with lookalikes from elsewhere.
// Null for sentence items, which answer with a verdict, not a choice.
export function optionsFor(id, content, rng = Math.random) {
  const found = itemAt(id, content);
  if (!found || found.item.w === undefined) return null;
  const others = shuffle(found.pack.items.filter((it) => it !== found.item).map((it) => it.e), rng);
  return shuffle([found.item.e, ...others.slice(0, 3)], rng);
}

// --- stars (§14.3) -------------------------------------------------------------
// The einmaleins ratios exactly (≥60 % ⭐, ≥80 % ⭐⭐, 100 % ⭐⭐⭐ first-try): on a
// round of six that is 4, 5 and 6. Duplicated, not imported — einmaleins'
// logic is a shipped game, not a shared library, and tests/lesen.test.js pins
// the two against each other so they cannot drift apart silently.
export const STAR_SLOTS = 3;

export function starsFor(firstTryOk, total) {
  const ratio = total > 0 ? firstTryOk / total : 0;
  if (ratio >= 1) return 3;
  if (ratio >= 0.8) return 2;
  return ratio >= 0.6 ? 1 : 0;
}

// The i18n key naming what the *next* star costs; null once all three are won.
export function nextStarGoal(stars) {
  return ["starGoal1", "starGoal2", "starGoal3"][stars] ?? null;
}

// What the next star costs in first-try answers, for a round of `total`.
export function starGoalNeed(stars, total) {
  const ratio = [0.6, 0.8, 1][stars];
  return ratio === undefined || !(total > 0) ? null : Math.ceil(ratio * total);
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
