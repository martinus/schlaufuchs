// The arithmetic behind the parents' view (§20). Pure — no DOM, no storage —
// so the numbers a parent reads can be tested rather than eyeballed.
//
// Everything here is derived from state the site already keeps. The Leitner
// box of a fact is the diagnosis; nothing extra is stored to produce it.

import { practiceTriple } from "./rewards.js";

// Box semantics (§7.1). `clampBox` defaults an unknown fact to 2, and a fact
// leaves box 2 the moment it is asked (correct → 3, wrong → 0). So box 2 means
// "not practised yet" in all but one case: a fact climbing back out of box 1.
// We therefore call it *open* rather than *unseen* — a claim we can defend.
const HEAT = { 0: "weak", 1: "weak", 2: "open", 3: "solid", 4: "solid" };

export const heatOf = (box) => HEAT[box] ?? "open";

// The recall digit of one fact, from the `rc` string the game writes (§20):
// 0 = never timed, 1..4 = the damped tracker's tempoTier + 1. Total: a short,
// missing or corrupt string reads as "never timed".
export function recallDigit(rc, id) {
  const d = Number.parseInt(String(rc ?? "")[id], 10);
  return Number.isInteger(d) && d >= 0 && d <= 4 ? d : 0;
}

// One cell of the grid: the box is the diagnosis of ACCURACY, the recall digit
// answers the question the box cannot — does she know it, or compute it? Only
// a solid fact can be "fast": speed on a fact that still slips is not
// knowledge, it is guessing. And absence of timing never demotes: a solid fact
// without a fast record is simply solid, not accused of counting.
export function cellState(box, rc) {
  const base = heatOf(box);
  return base === "solid" && rc === 4 ? "fast" : base;
}

// How the 100 facts are spread across the four states a parent can act on.
export function cellCounts(boxes, rc, count) {
  const tally = { weak: 0, open: 0, solid: 0, fast: 0 };
  for (let id = 0; id < count; id++) tally[cellState(boxes[id], recallDigit(rc, id))]++;
  return tally;
}

// The facts a parent should sit down with: box 0 or 1, hardest first, then in
// table order so the list reads like a times table and not like a shuffle.
export function weakFacts(boxes, count) {
  const out = [];
  for (let id = 0; id < count; id++) {
    const box = boxes[id];
    if (box === 0 || box === 1) out.push({ id, box });
  }
  return out.sort((a, b) => a.box - b.box || a.id - b.id);
}

// Practice time per difficulty, plus totals. Reads whatever the cookie holds,
// including nothing at all: a parent opening this page before the child has
// played must see zeroes, not a crash. `practiceTriple` is the same sanitizer
// `addPractice` writes through, so reader and writer cannot drift.
export function practiceSummary(saved = {}) {
  const seconds = practiceTriple(saved.tm);
  const rounds = practiceTriple(saved.rd);
  return {
    perDiff: seconds.map((s, i) => ({ seconds: s, rounds: rounds[i] })),
    totalSeconds: seconds.reduce((a, b) => a + b, 0),
    totalRounds: rounds.reduce((a, b) => a + b, 0),
  };
}

// Whole minutes, rounded to nearest, but never rounded down to a bare "0 min"
// for a child who did practise: some practice is not no practice.
export function minutesOf(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

// Seconds per solved round — the honest measure of pace, and the one number a
// parent can act on ("she is racing" / "he is stuck"). Null when nothing is
// known, because a made-up average is worse than a blank.
export function secondsPerRound(seconds, rounds) {
  if (!rounds || rounds <= 0 || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds / rounds);
}
