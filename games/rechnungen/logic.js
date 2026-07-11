// Rechnungen pure logic (§12): mental arithmetic over ＋ − × ÷ and „Mix",
// across three difficulties. No DOM, no storage — unit-tested in
// tests/rechnungen.test.js.
//
// The model has two levels (§12.2). The adaptive engine tracks a small fixed
// set of **skill buckets** — „addition within ten", „subtraction with
// borrowing", … — one Leitner digit each in the box string. A round does NOT
// ask a bucket once; it draws ten CONCRETE questions, each freshly generated
// from a bucket. So the pool the shared engine (adaptive.js) sees is the cell's
// buckets EXPANDED into variant item-ids (`bucketId + BUCKET_COUNT * v`): the
// engine weights and re-queues real items, while the box that persists is per
// bucket. `bucketOf(itemId)` folds a variant back to its bucket; `questionFor`
// realises a variant into an actual question with fresh numbers every draw, so
// a re-queued miss returns as a NEW question of the same skill.
//
// The star/tempo digit strings are per MODE, indexed by difficulty (§12.3) —
// transposed from einmaleins/lesen, which key stars by difficulty. The star
// *ratios*, the tempo ladder, the aid's retry and the one-line fitter are the
// einmaleins rules verbatim (a shipped game is not a shared library, D11);
// tests/rechnungen.test.js pins them against einmaleins so they cannot drift.

import { clampBox } from "../../assets/js/adaptive.js";
import { questionFor as emQuestion, pairIndex } from "../einmaleins/logic.js";

// The five modes, in picker order (§12.1). These strings ARE the keys of the
// cookie's `stars`/`tempo` maps (§12.3): "x" for ×, ":" for ÷. "mix" draws from
// the other four at the chosen difficulty.
export const MODES = ["+", "-", "x", ":", "mix"];

// How the three difficulty indices are *named*: the i18n key the child reads
// and the CSS slug that colours a picker section (same contract as einmaleins).
export const DIFF_KEYS = ["diffEasy", "diffMedium", "diffHard"];
export const DIFF_SLUGS = ["easy", "medium", "hard"];

// Questions per round (§12.2). Flat ten across the difficulties — a Schwer
// chain is already work enough that a longer round would outlast a child.
export const ROUND_SIZE = 10;

// The three stars a tile can hold, and the three difficulty slots a mode's
// star/tempo string carries (§12.3). Both happen to be three.
export const STAR_SLOTS = 3;
export const DIFF_SLOTS = 3;

// How many concrete variants one bucket expands into for a round. The smallest
// cell holds a single bucket, so this is also the guaranteed pool size — it
// must clear ROUND_SIZE, or the round would be shorter than ten. A larger cell
// (Mix, or any two-bucket ± cell) draws ten weighted from a deeper pool.
export const VARIANTS = 12;

// --- the display faces --------------------------------------------------------
// The operators as the child's schoolbook writes them: a real minus sign and a
// real times sign, never the ASCII "-"/"x". Division is the caller's to pass —
// German schools write ":", English "÷" — so this module stays i18n-free, like
// einmaleins' `divSign`.
const SIGN = { "+": "+", "-": "−", x: "×" };
const sign = (op, divSign) => (op === ":" ? divSign : SIGN[op]);

// --- generation helpers -------------------------------------------------------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// A plain binary question "a op b = ?" with a known answer.
const bin = (op, a, b, answer, divSign) => ({
  kind: "op", op, a, b, answer, text: `${a} ${sign(op, divSign)} ${b} = ?`,
});

// A gap question: one operand hidden, the result shown. `hideLeft` hides the
// first operand ("? op b = c"), otherwise the second ("a op ? = c"). The answer
// is the hidden operand — a single number, so the keypad and the aid's retry
// (retryStep) answer it exactly like any other question.
function gap(op, a, b, result, hideLeft, divSign) {
  const s = sign(op, divSign);
  return hideLeft
    ? { kind: "gap", op, a, b, answer: a, text: `? ${s} ${b} = ${result}` }
    : { kind: "gap", op, a, b, answer: b, text: `${a} ${s} ? = ${result}` };
}

// A three-term chain "a op1 b op2 c = ?", evaluated left to right (§12.1). Both
// ops are ± so there is no precedence to trip over. Callers guarantee every
// intermediate and the result stay in range and non-negative.
function chain(a, op1, b, op2, c, divSign) {
  const step = (x, op, y) => (op === "+" ? x + y : x - y);
  const answer = step(step(a, op1, b), op2, c);
  return {
    kind: "chain", op: op1, answer, a, b, c,
    text: `${a} ${sign(op1, divSign)} ${b} ${sign(op2, divSign)} ${c} = ?`,
  };
}

// Multiplication within the tables, straight from the einmaleins generator
// (§12.1: „×/÷ reuse the Einmaleins generator"). It hands back "t × f = ?"
// with the product; we only re-shape it into this game's question object.
function emMul(t, f) {
  const q = emQuestion(pairIndex(t, f), 0);
  return { kind: "op", op: "x", a: t, b: f, answer: q.answer, text: q.text };
}

// Division without remainder: build it from a product so it always comes out
// even (§12.1 Leicht/Mittel; Schwer's division-with-remainder is scoped down to
// larger exact division — see the PR notes). `dividend : divisor = quotient`.
const evenDiv = (divisor, quotient, divSign) =>
  bin(":", divisor * quotient, divisor, quotient, divSign);

// --- the skill buckets (§12.2) ------------------------------------------------
// The canonical, APPEND-ONLY list: a bucket's index is its slot in the box
// digit string, so a new bucket joins at the END and no child's saved box
// shifts under it. Each `gen(rng, divSign)` realises the bucket into a fresh
// concrete question. `mode`/`diff` place the bucket in the picker's cells.
export const BUCKETS = [
  // ＋ Leicht: sums within ten, no carrying (§12.1)
  { key: "add-l-small", mode: "+", diff: 0, gen: (r, d) => { const a = ri(r, 1, 5), b = ri(r, 1, 5); return bin("+", a, b, a + b, d); } },
  { key: "add-l-ten", mode: "+", diff: 0, gen: (r, d) => { const a = ri(r, 2, 9), b = ri(r, 1, 10 - a); return bin("+", a, b, a + b, d); } },
  // ＋ Mittel: 0–100 with carrying
  { key: "add-m-1d", mode: "+", diff: 1, gen: (r, d) => { const b = ri(r, 2, 9), u = ri(r, 10 - b, 9), a = ri(r, 1, 8) * 10 + u; return bin("+", a, b, a + b, d); } },
  { key: "add-m-2d", mode: "+", diff: 1, gen: (r, d) => { const au = ri(r, 1, 9), bu = ri(r, 10 - au, 9), at = ri(r, 1, 4), bt = ri(r, 1, 8 - at); const a = at * 10 + au, b = bt * 10 + bu; return bin("+", a, b, a + b, d); } },
  // ＋ Schwer: three-digit sums, gaps, chains (§12.1)
  { key: "add-s-big", mode: "+", diff: 2, gen: (r, d) => { const a = ri(r, 130, 690), b = ri(r, 90, 300); return bin("+", a, b, a + b, d); } },
  { key: "add-s-gap", mode: "+", diff: 2, gen: (r, d) => { const a = ri(r, 15, 80), b = ri(r, 15, 80); return gap("+", a, b, a + b, r() < 0.5, d); } },
  { key: "add-s-chain", mode: "+", diff: 2, gen: (r, d) => { const a = ri(r, 20, 90), b = ri(r, 20, 90), c = ri(r, 5, a + b - 1); return chain(a, "+", b, "-", c, d); } },

  // − Leicht: within ten, no borrowing
  { key: "sub-l-a", mode: "-", diff: 0, gen: (r, d) => { const a = ri(r, 2, 10), b = ri(r, 1, a); return bin("-", a, b, a - b, d); } },
  { key: "sub-l-b", mode: "-", diff: 0, gen: (r, d) => { const a = ri(r, 5, 10), b = ri(r, 0, a - 1); return bin("-", a, b, a - b, d); } },
  // − Mittel: 0–100 with borrowing
  { key: "sub-m-1d", mode: "-", diff: 1, gen: (r, d) => { const b = ri(r, 2, 9), u = ri(r, 0, b - 1), a = ri(r, 1, 9) * 10 + u; return bin("-", a, b, a - b, d); } },
  { key: "sub-m-2d", mode: "-", diff: 1, gen: (r, d) => { const au = ri(r, 0, 8), bu = ri(r, au + 1, 9), at = ri(r, 2, 9), bt = ri(r, 1, at - 1); const a = at * 10 + au, b = bt * 10 + bu; return bin("-", a, b, a - b, d); } },
  // − Schwer: three-digit differences, gaps, chains
  { key: "sub-s-big", mode: "-", diff: 2, gen: (r, d) => { const a = ri(r, 320, 980), b = ri(r, 120, a - 60); return bin("-", a, b, a - b, d); } },
  { key: "sub-s-gap", mode: "-", diff: 2, gen: (r, d) => { const a = ri(r, 30, 99), b = ri(r, 10, a); return gap("-", a, b, a - b, r() < 0.5, d); } },
  { key: "sub-s-chain", mode: "-", diff: 2, gen: (r, d) => { const a = ri(r, 40, 99), b = ri(r, 10, a), c = ri(r, 5, 40); return chain(a, "-", b, "+", c, d); } },

  // × Leicht: tables 1–5 (§12.1)
  { key: "mul-l", mode: "x", diff: 0, gen: (r) => emMul(ri(r, 1, 5), ri(r, 1, 10)) },
  // × Mittel: full tables 1–10
  { key: "mul-m", mode: "x", diff: 1, gen: (r) => emMul(ri(r, 2, 10), ri(r, 2, 10)) },
  // × Schwer: beyond the tables (e.g. 14 × 6)
  { key: "mul-s", mode: "x", diff: 2, gen: (r, d) => { const a = ri(r, 11, 19), b = ri(r, 3, 9); return bin("x", a, b, a * b, d); } },

  // ÷ Leicht: tables 1–5, no remainder
  { key: "div-l", mode: ":", diff: 0, gen: (r, d) => evenDiv(ri(r, 2, 5), ri(r, 2, 10), d) },
  // ÷ Mittel: full tables, no remainder
  { key: "div-m", mode: ":", diff: 1, gen: (r, d) => evenDiv(ri(r, 2, 10), ri(r, 2, 10), d) },
  // ÷ Schwer: larger exact division (remainder scoped out — see PR notes)
  { key: "div-s", mode: ":", diff: 2, gen: (r, d) => evenDiv(ri(r, 3, 9), ri(r, 6, 15), d) },
];

export const BUCKET_COUNT = BUCKETS.length;

// The bucket a variant item-id stands for. Total: junk folds to bucket 0 rather
// than throwing, so a corrupt cookie can never open an empty round.
export function bucketOf(itemId) {
  const b = Math.trunc(itemId) % BUCKET_COUNT;
  return b < 0 ? b + BUCKET_COUNT : b;
}

// The buckets a cell offers. "mix" is the difficulty's four operations pooled;
// any other mode is its own single operation. An unknown mode reads as "mix",
// never an empty cell.
export function bucketsFor(mode, diff) {
  const known = MODES.includes(mode) && mode !== "mix";
  const out = [];
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const b = BUCKETS[i];
    if (b.diff !== diff) continue;
    if (known ? b.mode === mode : b.mode !== "mix") out.push(i);
  }
  return out;
}

// The round's pool: the cell's buckets expanded into `VARIANTS` variant ids
// each, so the shared engine has more items than a round to weight and rest.
export function poolFor(mode, diff) {
  const buckets = bucketsFor(mode, diff);
  const pool = [];
  for (let v = 0; v < VARIANTS; v++) for (const b of buckets) pool.push(b + BUCKET_COUNT * v);
  return pool;
}

// Realise a variant item-id into a concrete question with fresh numbers. Pure
// under a seeded rng, so the driver and the tests can replay it.
export function questionFor(itemId, rng = Math.random, divSign = "÷") {
  return BUCKETS[bucketOf(itemId)].gen(rng, divSign);
}

// --- the per-bucket box fold (§7, §12.2) --------------------------------------
// The round's answers, folded back onto the bucket box string. A bucket TOUCHED
// this round climbs one Leitner box on a clean round and drops to 0 if any of
// its variants was missed — the standard Leitner move (§7.1), applied once per
// bucket. Untouched buckets keep their digit. Total and sanitising: whatever
// comes in, what goes back to the cookie is `count` digits of 0–4.
export function foldBoxes(boxStr, touched = [], missed = [], count = BUCKET_COUNT) {
  const s = String(boxStr ?? "").padEnd(count, "2").slice(0, count).split("").map((c) => clampBox(c));
  const missedSet = new Set(missed);
  for (const bi of new Set(touched)) {
    if (!Number.isInteger(bi) || bi < 0 || bi >= count) continue;
    s[bi] = missedSet.has(bi) ? 0 : Math.min(s[bi] + 1, 4);
  }
  return s.join("");
}

// --- stars (§10.3, §12.2) -----------------------------------------------------
// The einmaleins ratios exactly (≥60 % ⭐, ≥80 % ⭐⭐, 100 % ⭐⭐⭐ first-try).
// Duplicated, not imported — pinned against einmaleins by tests/rechnungen.test.js.
export function starsFor(firstTryOk, total) {
  const ratio = total > 0 ? firstTryOk / total : 0;
  if (ratio >= 1) return 3;
  if (ratio >= 0.8) return 2;
  return ratio >= 0.6 ? 1 : 0;
}

export function nextStarGoal(stars) {
  return ["starGoal1", "starGoal2", "starGoal3"][stars] ?? null;
}

export function starGoalNeed(stars, total) {
  const ratio = [0.6, 0.8, 1][stars];
  return ratio === undefined || !(total > 0) ? null : Math.ceil(ratio * total);
}

// The stars you own on this tile if the round stopped now — the round scene's
// basket (§10.5). Monotone in both terms, so a star can never leave.
export function ownedStars({ firstTrySolved = 0, total = 0 } = {}, best = 0) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, STAR_SLOTS) : 0;
  const earned = total > 0 ? starsFor(firstTrySolved, total) : 0;
  return Math.max(held, earned);
}

// --- star digit strings (§12.3) -----------------------------------------------
// One digit per DIFFICULTY in a 3-char string, held per mode. Junk in, zero out.
export function starDigit(starString, diff) {
  const d = Number.parseInt((starString ?? "")[diff], 10);
  return Number.isInteger(d) ? Math.min(d, 3) : 0;
}

export function withStarDigit(starString, diff, value) {
  const s = (starString ?? "").padEnd(DIFF_SLOTS, "0").split("");
  s[diff] = String(value);
  return s.join("");
}

// The question must always stay on one line (§10.1). Same fitter as einmaleins,
// duplicated and pinned by the parity test.
export function fittedFontSize(size, avail, width) {
  if (!(size > 0) || !(avail > 0) || !(width > 0) || width <= avail) return size;
  return Math.floor((size * avail) / width);
}

// After a wrong answer the child re-enters the right answer (§8.1): the aid is
// answered the way the question was — digits, then OK. The einmaleins contract
// verbatim, pinned by parity.
export function retryStep(input, key, answer) {
  const want = String(answer);
  const cur = String(input ?? "");
  if (key === "⌫") return { input: cur.slice(0, -1), state: "typing" };
  if (key === "OK") {
    if (cur === "") return { input: cur, state: "typing" };
    return cur === want ? { input: cur, state: "done" } : { input: "", state: "reject" };
  }
  if (!/^[0-9]$/.test(key)) return { input: cur, state: "typing" };
  return { input: cur.length < 4 ? cur + key : cur, state: "typing" };
}

// --- the tempo ladder (§10.6) -------------------------------------------------
// The same purely additive collectible einmaleins pays: 🐇 → 🚗 → 🚀, only ever
// upward. Faces and mechanics are einmaleins' (pinned by parity); only the
// bounds differ — a three-digit sum or a chain is not a single-digit fact.
export const TEMPO_SLOTS = 3;

// Upper bounds (ms) on the round's median answer time, per difficulty:
// [hare, car, rocket]. Leicht mirrors einmaleins' keypad Leicht; Mittel adds
// carrying/borrowing; Schwer carries chains and three-digit work, so it sits
// later still. Deliberately plain named numbers — retune after a real child.
export const TEMPO_TIERS = [
  [8000, 5000, 3000], // Leicht
  [12000, 8000, 5000], // Mittel
  [16000, 11000, 7000], // Schwer
];

export const TEMPO_ICONS = [null, "tempo-hare", "tempo-car", "tempo-rocket"];
export const TEMPO_KEYS = [null, "tempo1", "tempo2", "tempo3"];

export function median(values) {
  const v = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function tempoTier(ms, difficulty) {
  const limits = TEMPO_TIERS[difficulty];
  if (!limits || !Number.isFinite(ms) || ms < 0) return 0;
  if (ms <= limits[2]) return 3;
  if (ms <= limits[1]) return 2;
  return ms <= limits[0] ? 1 : 0;
}

export function awardTempo({ stars = 0, tier = 0, best = 0 } = {}) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, TEMPO_SLOTS) : 0;
  const won = Number.isInteger(tier) && tier > 0 ? Math.min(tier, TEMPO_SLOTS) : 0;
  return stars >= 2 ? Math.max(held, won) : held;
}

// --- the game's worth (§8.3, §12.2) -------------------------------------------
// Everything the game can pay, computed from its real tiles: five modes × three
// difficulties, each tile three stars, a star worth difficulty + 1. This is
// what MAX_POINTS.rechnungen must equal — tests/rewards.test.js holds them
// together. 5·(3·1 + 3·2 + 3·3) = 90.
export function maxPoints() {
  let total = 0;
  for (let d = 0; d < DIFF_SLOTS; d++) total += MODES.length * STAR_SLOTS * (d + 1);
  return total;
}
