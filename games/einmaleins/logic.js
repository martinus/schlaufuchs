// Einmaleins pure logic (§10): canonical pair pool, question generation per
// difficulty, star criteria. No DOM, no storage — unit-tested in tests/.

import {
  tempoTier as tierFor,
  starDigit as digitAt,
  withStarDigit as withDigitAt,
} from "../../assets/js/roundrules.js";

// The round rules every game shares — star criteria, tempo mechanics and
// faces, the aid's retry, the one-line fitter — live in roundrules.js; see
// there for the reasoning. This module keeps only einmaleins' own data and
// indexing.
export {
  DIFF_KEYS, DIFF_SLUGS, STAR_SLOTS, starNeeds, starsFor, ownedStars,
  TEMPO_SLOTS, TEMPO_ICONS, TEMPO_KEYS, median, awardTempo,
  retryStep, fittedFontSize, divSignHTML,
} from "../../assets/js/roundrules.js";

// Canonical item order for the box digit string: 100 pairs,
// id = (t-1)*10 + (f-1) for table t ∈ 1..10, factor f ∈ 1..10.
export const POOL_COUNT = 100;
export const EASY_TABLES = [1, 2, 5, 10]; // Leicht (§10.2)
export const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Schwer never touches a factor of 1 or 10: nothing about ×1 or ×10 is hard,
// and 1×1 inside a round sold as "Schwer" tells the child the label lies.
export const HARD_TABLES = [2, 3, 4, 5, 6, 7, 8, 9];

// Questions per round, by difficulty (§7.3): Schwer rounds run longer.
export const ROUND_SIZE = [10, 10, 12];

// Which tables a difficulty offers (§10.2): Leicht teaches four tables, Mittel
// all ten, Schwer the eight with something hard in them. Each ends with 0,
// "Alle gemischt". This list is the picker's whole vocabulary, and the round
// setup uses it to catch a saved tile the difficulty no longer offers.
export function tablesFor(difficulty) {
  const tables = difficulty === 0 ? EASY_TABLES : difficulty === 2 ? HARD_TABLES : ALL_TABLES;
  return [...tables, 0];
}

export const pairIndex = (t, f) => (t - 1) * 10 + (f - 1);
export const pairOf = (id) => [Math.floor(id / 10) + 1, (id % 10) + 1];

// table 0 = "Alle gemischt". On Leicht, mixed draws only from the easy tables.
//
// A fixed table on Mittel/Schwer holds BOTH orientations — the 4er-Reihe asks
// 4×7 and 7×4, which are separate Leitner items. That is the point: with ten
// facts and ten questions the old pool asked every fact every round, mastered
// or not, and the box weights had nothing to choose from. A pool larger than
// the round is what lets known facts rest and weak ones return (§7.2).
export function poolFor(table, difficulty) {
  const factors = difficulty === 2 ? HARD_TABLES : ALL_TABLES;
  if (table === 0) {
    const tables = difficulty === 0 ? EASY_TABLES : factors;
    const pool = [];
    for (const t of tables) for (const f of factors) pool.push(pairIndex(t, f));
    return pool;
  }
  const pool = [];
  for (const f of factors) pool.push(pairIndex(table, f));
  if (difficulty >= 1) {
    for (const f of factors) if (f !== table) pool.push(pairIndex(f, table));
  }
  return pool;
}

// How hard a fact is, before any child has touched it. Facts with a 1 or 10
// are free, 2s and 5s have a song, big odd-ish factors (6, 7, 8) are the ones
// every classroom drills longest; 9 has its finger trick, squares are chanted
// and stick better than their neighbours (7×8 is harder than 8×8).
const FACTOR_HARDNESS = { 1: 0, 2: 1, 3: 2, 4: 2, 5: 1, 6: 3, 7: 3, 8: 3, 9: 2, 10: 0 };

export function pairHardness(t, f) {
  const h = FACTOR_HARDNESS[t] + FACTOR_HARDNESS[f];
  return t === f ? Math.max(h - 1, 0) : h; // 0..6
}

// The per-item boost the session multiplies into the Leitner weights (§7.2):
// on Mittel and Schwer a hard fact is drawn up to 7× as often as a trivial
// one of the same box. Leicht keeps uniform coverage — a beginner is meant to
// meet her whole row, easy corners included.
export function hardnessBoost(id, difficulty) {
  if (difficulty === 0) return 1;
  const [t, f] = pairOf(id);
  return 1 + pairHardness(t, f);
}

// Question formats (§10.2): Leicht/Mittel plain multiplication; Schwer mixes
// in gap questions and division. `text` uses "?" as the answer slot.
//
// The division sign is injected, not chosen here: German schools write ":" and
// a child who has never seen "÷" reads it as a decoration. This module stays
// pure and i18n-free, so the caller passes `t("divSign")`.
//
// `table` is the round's chosen row (0 = mixed). With the 4er-Reihe picked,
// "12 : 3 = ?" answers itself — every answer in this round is a multiple's
// partner of 4, so the gap and the division must always solve for the OTHER
// factor, never for the table the child is standing on.
export function questionFor(id, difficulty, rng = Math.random, divSign = "÷", table = 0) {
  const [t, f] = pairOf(id);
  if (difficulty < 2) {
    return { kind: "mul", t, f, text: `${t} × ${f} = ?`, answer: t * f };
  }
  // Which factor may be the unknown? On a fixed table, only the other one.
  const askT = table === 0 || f === table;
  const askF = table === 0 || t === table;
  const r = rng();
  if (r < 0.5) {
    return { kind: "mul", t, f, text: `${t} × ${f} = ?`, answer: t * f };
  }
  const forT = askT && (!askF || rng() < 0.5);
  if (r < 0.75) {
    return forT
      ? { kind: "gap", t, f, text: `? × ${f} = ${t * f}`, answer: t }
      : { kind: "gap", t, f, text: `${t} × ? = ${t * f}`, answer: f };
  }
  return forT
    ? { kind: "div", t, f, text: `${t * f} ${divSign} ${f} = ?`, answer: t }
    : { kind: "div", t, f, text: `${t * f} ${divSign} ${t} = ?`, answer: f };
}

// Four multiple-choice options for Leicht: the answer plus 3 plausible,
// unique, positive distractors, shuffled.
export function choicesFor(q, rng = Math.random) {
  const { t, f, answer } = q;
  const candidates = [
    (t + 1) * f, (t - 1) * f, t * (f + 1), t * (f - 1),
    answer + t, answer - t, answer + 1, answer - 1, answer + 2,
  ];
  const distractors = [];
  for (const c of candidates) {
    if (c > 0 && c !== answer && !distractors.includes(c)) distractors.push(c);
  }
  for (let k = 3; distractors.length < 3; k++) {
    const c = answer + k;
    if (!distractors.includes(c)) distractors.push(c);
  }
  // shuffle distractors, take 3
  for (let i = distractors.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
  }
  const opts = [answer, ...distractors.slice(0, 3)];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

// --- the tempo ladder (§10.6) ------------------------------------------------
// Upper bounds (ms) on the round's median answer time, per difficulty:
// [hare, car, rocket]. Leicht is a tap on one of four choices; the keypad
// rows also pay for finding and typing one to three digits, so their bounds
// sit later. Deliberately plain named numbers — retune them after watching a
// real child, nothing else has to move.
export const TEMPO_TIERS = [
  [8000, 5000, 3000], // Leicht
  [11000, 7000, 4500], // Mittel
  [11000, 7000, 4500], // Schwer
];

// Tier for a time (the round's median — or a single answer: tier 3 on one
// answer is what triggers the in-round ⚡) against this game's bounds.
export const tempoTier = (ms, difficulty) => tierFor(ms, TEMPO_TIERS[difficulty]);

// --- per-fact recall telemetry (§20) ------------------------------------------
// One digit per pair in a 100-char string beside `box`: 0 = never timed,
// 1..4 = tempoTier + 1 of what the tracker has settled on. Written by the
// game, read only by the parents' view — the child never meets it, and it is
// the answer to the one question the Leitner box cannot answer: does she KNOW
// 7×8, or does she compute it every time?
//
// The digit drifts ONE step per observation toward what was just seen, so a
// single lucky tap or a single distracted answer cannot repaint a cell.
// "Auswendig" (digit 4) therefore means "the recent answers came repeatedly at
// rocket speed" — a claim a parent can act on. It also self-corrects: recall
// that fades drifts back down, unlike the child's own tile badge (§10.6),
// which is a reward and only ever climbs.
export function recallStep(digit, tier) {
  const d = Number.isInteger(digit) && digit >= 0 && digit <= 4 ? digit : 0;
  if (!Number.isInteger(tier) || tier < 0 || tier > 3) return d;
  const seen = tier + 1;
  return d === 0 ? seen : d + Math.sign(seen - d);
}

// Fold one round's observations ({id: tier}, first-try-correct answers only)
// into the recall string. Total, and sanitizing: whatever comes in, what goes
// back to the cookie is always `count` digits of 0–4 — a corrupt slot reads
// (and is rewritten) as "never timed", never carried along.
export function foldRecall(str, obs, count = POOL_COUNT) {
  const s = String(str ?? "").padEnd(count, "0").split("").slice(0, count)
    .map((c) => ("01234".includes(c) ? c : "0"));
  for (const [id, tier] of Object.entries(obs ?? {})) {
    const i = Number(id);
    if (!Number.isInteger(i) || i < 0 || i >= count) continue;
    s[i] = String(recallStep(Number.parseInt(s[i], 10), tier));
  }
  return s.join("");
}

// --- star digit strings (§10.4) ------------------------------------------------
// Index into the 11-digit per-difficulty star string: tables 1..10 → 0..9,
// "Alle gemischt" → 10.
export const tableStarIndex = (table) => (table === 0 ? 10 : table - 1);
export const starDigit = (starString, table) => digitAt(starString, tableStarIndex(table));
export const withStarDigit = (starString, table, value) =>
  withDigitAt(starString, tableStarIndex(table), value, 11);
