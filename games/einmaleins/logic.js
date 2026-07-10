// Einmaleins pure logic (§10): canonical pair pool, question generation per
// difficulty, star criteria. No DOM, no storage — unit-tested in tests/.

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

// Stars per round (§10.3): ≥60 % → ⭐, ≥80 % → ⭐⭐, 100 % → ⭐⭐⭐ of the round
// first-try correct — a ratio, so a 12-question Schwer round scales with it.
// Speed is deliberately not a criterion for stars: a child who reads or taps
// slowly knows the times tables just as well. Speed has its own additive
// ladder (§10.6, below), which can only ever add.
export function starsFor(firstTryOk, total) {
  const ratio = total > 0 ? firstTryOk / total : 0;
  if (ratio >= 1) return 3;
  if (ratio >= 0.8) return 2;
  return ratio >= 0.6 ? 1 : 0;
}

// The i18n key naming what the *next* star costs, so a child who scored 9/10
// can see why they still have one star. Null once all three are earned — and
// null, never undefined, for anything that is not a star count: t(undefined)
// renders an empty string, so a bad caller would print a blank row instead of
// failing. The lookup is total; only 0, 1 and 2 name a goal.
export function nextStarGoal(stars) {
  return ["starGoal1", "starGoal2", "starGoal3"][stars] ?? null;
}

// What the next star costs in first-try answers, for a round of `total`
// questions: the smallest count whose ratio clears the next threshold. The
// goal strings used to hardcode "6 von 10", which became a lie the moment a
// Schwer round grew to 12 questions.
export function starGoalNeed(stars, total) {
  const ratio = [0.6, 0.8, 1][stars];
  return ratio === undefined || !(total > 0) ? null : Math.ceil(ratio * total);
}

// The three stars a tile can ever hold (§10.3).
export const STAR_SLOTS = 3;

// --- the tempo ladder (§10.6) ------------------------------------------------
// A second, purely additive ladder beside the stars: 0 = nothing yet,
// 1 = hare, 2 = race car, 3 = rocket. Stars pay for being right; the tempo
// symbol pays for *knowing* — a child who counts her way to every answer keeps
// all her stars and simply has not won the rocket yet. Nothing is ever lost,
// and the lowest visible state is an empty slot, never a snail.
export const TEMPO_SLOTS = 3;

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

// The median, because one long think about a new fact must not cost the round
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
// round below two stars (§10.3) awards nothing — and like the star basket,
// the stored tier only ever climbs (§10.5).
export function awardTempo({ stars = 0, tier = 0, best = 0 } = {}) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, TEMPO_SLOTS) : 0;
  const won = Number.isInteger(tier) && tier > 0 ? Math.min(tier, TEMPO_SLOTS) : 0;
  return stars >= 2 ? Math.max(held, won) : held;
}

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

// The stars you own on this tile if the round stopped right now: your best ever
// on it, or what this round has already banked, whichever is higher (§10.5).
//
// This is the whole scene. The sky holds `STAR_SLOTS - owned` stars still to be
// won; the basket holds `owned`. Both terms are monotone, so a star can never
// leave the basket, and a tile already taken to three stars starts with a full
// basket and an empty sky — it cannot promise what `endRound()` will not pay,
// because `improved = stars > old` uses exactly this `best`.
export function ownedStars({ firstTrySolved = 0, total = 0 } = {}, best = 0) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, STAR_SLOTS) : 0;
  const earned = total > 0 ? starsFor(firstTrySolved, total) : 0;
  return Math.max(held, earned);
}

// Index into the 11-digit per-difficulty star string: tables 1..10 → 0..9,
// "Alle gemischt" → 10.
export const tableStarIndex = (table) => (table === 0 ? 10 : table - 1);

export function starDigit(starString, table) {
  const d = Number.parseInt((starString ?? "")[tableStarIndex(table)], 10);
  return Number.isInteger(d) ? Math.min(d, 3) : 0;
}

export function withStarDigit(starString, table, value) {
  const s = (starString ?? "").padEnd(11, "0").split("");
  s[tableStarIndex(table)] = String(value);
  return s.join("");
}

// After a wrong answer the child does not press "understood" — she enters the
// right answer (§8.1). Mara clicked "Verstanden" without ever noticing she had
// erred; typing the answer herself is the smallest act that proves she read it.
//
// **The aid is answered the way the question was.** Digits go in, OK submits.
// It used to be cleverer than the game around it: it matched on every keypress,
// so the answer completed itself without an OK and a digit that could no longer
// be right was refused before it was finished. That is a second set of rules on
// the same keypad — the child has just been told she was wrong, and the buttons
// under her thumb behave differently than they did one question ago.
//
// One keypress in, the next input and what the caller must do:
//   "typing" — keep going
//   "done"   — OK was pressed on the right answer; leave the aid
//   "reject" — OK was pressed on the wrong one; shake, and clear the input
export function retryStep(input, key, answer) {
  const want = String(answer);
  const cur = String(input ?? "");

  if (key === "⌫") return { input: cur.slice(0, -1), state: "typing" };
  if (key === "OK") {
    if (cur === "") return { input: cur, state: "typing" }; // OK on an empty gap
    return cur === want ? { input: cur, state: "done" } : { input: "", state: "reject" };
  }
  if (!/^[0-9]$/.test(key)) return { input: cur, state: "typing" };

  return { input: cur.length < 3 ? cur + key : cur, state: "typing" };
}

// The question must always stay on one line (§10.1). Given the size the CSS
// wishes for, the width the text needs at that size, and the width available,
// return the size to use: unchanged when it already fits, otherwise shrunk to
// the largest size that does. Pure so it can be tested without a DOM.
export function fittedFontSize(size, avail, width) {
  if (!(size > 0) || !(avail > 0) || !(width > 0) || width <= avail) return size;
  return Math.floor((size * avail) / width);
}
