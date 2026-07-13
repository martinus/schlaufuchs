// The round rules every game shares (§10.3–§10.6, §8.1): star criteria, the
// tempo ladder's mechanics and faces, the star digit-string accessors, the
// aid's retry contract and the one-line font fitter. No DOM, no storage.
//
// These lived as verbatim copies in each game's logic.js, held together by
// parity tests (D11: "a shipped game is not a shared library"), until the
// third game shipped its third copy — the promotion trigger lesen's comment
// had set. What stays per game is DATA, not rules: TEMPO_TIERS bounds, round
// sizes, and how a game indexes its star strings (einmaleins by table, lesen
// by pack, rechnungen by difficulty — transposed). Each game's logic.js
// re-exports what it uses, so a game page still imports only its own logic
// and games never import each other.

// How the three difficulty indices are *named*: the i18n key the child reads
// and the CSS slug that colours a picker section.
export const DIFF_KEYS = ["diffEasy", "diffMedium", "diffHard"];
export const DIFF_SLUGS = ["easy", "medium", "hard"];

// The three stars a tile can ever hold (§10.3).
export const STAR_SLOTS = 3;

// Stars per round (§10.3): ≥60 % → ⭐, ≥80 % → ⭐⭐, 100 % → ⭐⭐⭐ of the round
// first-try correct — a ratio, so a 12-question Schwer round scales with it.
// Speed is deliberately not a criterion for stars: a child who reads or taps
// slowly knows the material just as well. Speed has its own additive ladder
// (§10.6, below), which can only ever add.
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

// --- star digit strings (§10.4, §12.3, §14.5) ----------------------------------
// One digit per tile. Each game maps its tile to `index` its own way and knows
// its own string length — this pair only reads and writes one slot, total:
// junk in, zero out.
export function starDigit(starString, index) {
  const d = Number.parseInt((starString ?? "")[index], 10);
  return Number.isInteger(d) ? Math.min(d, 3) : 0;
}

export function withStarDigit(starString, index, value, slots) {
  const s = (starString ?? "").padEnd(slots, "0").split("");
  s[index] = String(value);
  return s.join("");
}

// --- the tempo ladder (§10.6) ------------------------------------------------
// A second, purely additive ladder beside the stars: 0 = nothing yet,
// 1 = hare, 2 = race car, 3 = rocket. Stars pay for being right; the tempo
// symbol pays for *knowing* — a child who counts her way to every answer keeps
// all her stars and simply has not won the rocket yet. Nothing is ever lost,
// and the lowest visible state is an empty slot, never a snail. The per-game
// TEMPO_TIERS bounds stay in each logic.js — they are the tuning knob.
export const TEMPO_SLOTS = 3;

// The ladder's three faces, indexed by tier: the icon name (graphics.js) and
// the i18n key. Index 0 is the point of both: below the hare there is nothing
// to draw and nothing to say — never a snail.
export const TEMPO_ICONS = [null, "tempo-hare", "tempo-car", "tempo-rocket"];
export const TEMPO_KEYS = [null, "tempo1", "tempo2", "tempo3"];

// The median, because one long think about a new item must not cost the round
// its tempo — a sum or a mean would hand the slowest question a veto.
export function median(values) {
  const v = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Tier for a time against one difficulty's [hare, car, rocket] bounds (the
// round's median — or a single answer: tier 3 on one answer is what triggers
// the in-round ⚡). Total: junk in, no tier out.
export function tempoTier(ms, limits) {
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

// --- the aid's retry (§8.1) ----------------------------------------------------
// After a wrong answer the child does not press "understood" — she enters the
// right answer. Mara clicked "Verstanden" without ever noticing she had
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
// `maxLen` is the game's longest answer: 3 digits for einmaleins, 4 for
// rechnungen's walls.
export function retryStep(input, key, answer, maxLen = 3) {
  const want = String(answer);
  const cur = String(input ?? "");

  if (key === "⌫") return { input: cur.slice(0, -1), state: "typing" };
  if (key === "OK") {
    if (cur === "") return { input: cur, state: "typing" }; // OK on an empty gap
    return cur === want ? { input: cur, state: "done" } : { input: "", state: "reject" };
  }
  if (!/^[0-9]$/.test(key)) return { input: cur, state: "typing" };

  return { input: cur.length < maxLen ? cur + key : cur, state: "typing" };
}

// The question must always stay on one line (§10.1). Given the size the CSS
// wishes for, the width the text needs at that size, and the width available,
// return the size to use: unchanged when it already fits, otherwise shrunk to
// the largest size that does. Pure so it can be tested without a DOM.
export function fittedFontSize(size, avail, width) {
  if (!(size > 0) || !(avail > 0) || !(width > 0) || width <= avail) return size;
  return Math.floor((size * avail) / width);
}
