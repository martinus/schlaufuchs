// Einmaleins pure logic (§10): canonical pair pool, question generation per
// difficulty, star criteria. No DOM, no storage — unit-tested in tests/.

// Canonical item order for the box digit string: 100 pairs,
// id = (t-1)*10 + (f-1) for table t ∈ 1..10, factor f ∈ 1..10.
export const POOL_COUNT = 100;
export const EASY_TABLES = [1, 2, 5, 10]; // Leicht (§10.2)
export const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const pairIndex = (t, f) => (t - 1) * 10 + (f - 1);
export const pairOf = (id) => [Math.floor(id / 10) + 1, (id % 10) + 1];

// table 0 = "Alle gemischt". On Leicht, mixed draws only from the easy tables.
export function poolFor(table, difficulty) {
  const tables = table === 0 ? (difficulty === 0 ? EASY_TABLES : ALL_TABLES) : [table];
  const pool = [];
  for (const t of tables) for (let f = 1; f <= 10; f++) pool.push(pairIndex(t, f));
  return pool;
}

// Question formats (§10.2): Leicht/Mittel plain multiplication; Schwer mixes
// in gap questions and division. `text` uses "?" as the answer slot.
export function questionFor(id, difficulty, rng = Math.random) {
  const [t, f] = pairOf(id);
  if (difficulty < 2) {
    return { kind: "mul", t, f, text: `${t} × ${f} = ?`, answer: t * f };
  }
  const r = rng();
  if (r < 0.5) {
    return { kind: "mul", t, f, text: `${t} × ${f} = ?`, answer: t * f };
  }
  if (r < 0.75) {
    return rng() < 0.5
      ? { kind: "gap", t, f, text: `? × ${f} = ${t * f}`, answer: t }
      : { kind: "gap", t, f, text: `${t} × ? = ${t * f}`, answer: f };
  }
  return { kind: "div", t, f, text: `${t * f} ÷ ${f} = ?`, answer: t };
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

// Stars per round (§10.3): 6/10 → ⭐, 8/10 → ⭐⭐, 10/10 → ⭐⭐⭐, first try each.
// Speed is deliberately not a criterion: a child who reads or taps slowly knows
// the times tables just as well, and a clock is not something they can act on.
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

// How many first-try-correct answers each star costs, for a round of `total`
// questions. Derived from the same ratios starsFor uses, so the basket and the
// summary can never disagree.
export const starTargets = (total) => [0.6, 0.8, 1].map((r) => Math.ceil(r * total));

// The in-round star basket (§10.5). It *fills*; it never spills.
//
// `firstTrySolved` is banked and monotone, so `stars` only grows — a basket
// driven by the still-reachable maximum would drop a star on the very first
// mistake, and the first mistake usually arrives at question two. A child can
// only win here anyway: `endRound` keeps the best score, never the last one.
//
// The goal names the cheapest star that is still *reachable*. Once three
// misses have put two stars out of reach, promising them would be a lie, so
// the goal falls silent rather than dangle something unreachable.
export function basketState({ firstTrySolved = 0, firstTryOk = 0, total = 0 } = {}) {
  if (total <= 0) return { stars: 0, needed: 0, goalStars: 0 };
  const targets = starTargets(total);
  const next = targets.find((k) => k > firstTrySolved && k <= firstTryOk);
  return {
    stars: starsFor(firstTrySolved, total),
    needed: next ? next - firstTrySolved : 0,
    goalStars: next ? targets.indexOf(next) + 1 : 0,
  };
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

// The question must always stay on one line (§10.1). Given the size the CSS
// wishes for, the width the text needs at that size, and the width available,
// return the size to use: unchanged when it already fits, otherwise shrunk to
// the largest size that does. Pure so it can be tested without a DOM.
export function fittedFontSize(size, avail, width) {
  if (!(size > 0) || !(avail > 0) || !(width > 0) || width <= avail) return size;
  return Math.floor((size * avail) / width);
}
