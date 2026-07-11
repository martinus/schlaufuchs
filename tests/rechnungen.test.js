// Rechnungen pure logic (§12): the skill buckets and their generators, the
// variant-expansion the shared engine draws over, the per-bucket box fold, the
// star/tempo digit strings, and the einmaleins rules this game duplicates.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODES, DIFF_KEYS, DIFF_SLUGS, ROUND_SIZE, STAR_SLOTS, DIFF_SLOTS, VARIANTS,
  BUCKETS, BUCKET_COUNT, bucketOf, bucketsFor, poolFor, questionFor, foldBoxes,
  starsFor, nextStarGoal, starGoalNeed, ownedStars, starDigit, withStarDigit,
  fittedFontSize, retryStep, maxPoints,
  TEMPO_SLOTS, TEMPO_TIERS, TEMPO_ICONS, TEMPO_KEYS, median, tempoTier, awardTempo,
} from "../games/rechnungen/logic.js";
import {
  starsFor as emStarsFor, nextStarGoal as emNextStarGoal,
  starGoalNeed as emStarGoalNeed, ownedStars as emOwnedStars,
  fittedFontSize as emFitted, retryStep as emRetry,
  TEMPO_ICONS as emTempoIcons, TEMPO_KEYS as emTempoKeys,
  median as emMedian, awardTempo as emAwardTempo,
} from "../games/einmaleins/logic.js";
import { MAX_POINTS, THRESHOLDS, trophyCount, TROPHIES_PER_GAME } from "../assets/js/rewards.js";
import { BUDGET } from "../assets/js/storage.js";
import strings from "../games/rechnungen/i18n.js";
import { read } from "./pages.js";

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// Evaluate the printed equation the way the child (and the driver) reads it,
// so a bucket whose text and answer disagree is caught. Chains run left to
// right; a gap solves for the "?". Division uses ":" here (the sign we pass).
function evaluate(text) {
  const [lhs, rhs] = text.split("=").map((s) => s.trim());
  const tok = lhs.split(/\s+/);
  const num = (t) => Number(t);
  const apply = (x, op, y) => ({ "+": x + y, "−": x - y, "×": x * y, ":": x / y }[op]);
  if (rhs === "?") {
    let acc = num(tok[0]);
    for (let i = 1; i < tok.length; i += 2) acc = apply(acc, tok[i], num(tok[i + 1]));
    return acc;
  }
  // a gap: "? op b = c" or "a op ? = c"
  const c = num(rhs);
  const [a, op, b] = tok;
  if (a === "?") return { "+": c - num(b), "−": c + num(b), "×": c / num(b), ":": c * num(b) }[op];
  return { "+": c - num(a), "−": num(a) - c, "×": c / num(a), ":": num(a) / c }[op];
}

test("the modes and difficulties are the ones §12 names", () => {
  assert.deepEqual(MODES, ["+", "-", "x", ":", "mix"]);
  assert.equal(DIFF_KEYS.length, 3);
  assert.equal(DIFF_SLUGS.length, 3);
  assert.equal(ROUND_SIZE, 10, "rounds of ten (§12.2)");
  assert.equal(STAR_SLOTS, 3);
  assert.equal(DIFF_SLOTS, 3);
});

test("every bucket is placed in a real cell, and the list is append-only", () => {
  const ops = ["+", "-", "x", ":"]; // never "mix" — mix has no buckets of its own
  for (const b of BUCKETS) {
    assert.ok(ops.includes(b.mode), `${b.key}: bogus mode ${b.mode}`);
    assert.ok([0, 1, 2].includes(b.diff), `${b.key}: bogus difficulty ${b.diff}`);
    assert.equal(typeof b.gen, "function", `${b.key}: no generator`);
  }
  // keys are unique — the box digit string is addressed by bucket index, so a
  // duplicate would mean two skills sharing one Leitner digit
  assert.equal(new Set(BUCKETS.map((b) => b.key)).size, BUCKET_COUNT);
  assert.equal(BUCKET_COUNT, BUCKETS.length);
});

// The one correctness test that matters: whatever numbers a bucket rolls, the
// equation it prints must actually equal the answer it reports. A driver that
// answers `q.answer` to `q.text` proves nothing if the two disagree.
test("every generated equation evaluates to its own answer, at every difficulty", () => {
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const rng = seeded(i * 97 + 1);
    for (let k = 0; k < 2000; k++) {
      const q = questionFor(i, rng, ":");
      assert.ok(Number.isInteger(q.answer), `${BUCKETS[i].key}: non-integer answer ${q.answer}`);
      assert.equal(evaluate(q.text), q.answer, `${BUCKETS[i].key}: "${q.text}" ≠ ${q.answer}`);
      assert.ok(q.text.includes("?"), `${BUCKETS[i].key}: no gap in "${q.text}"`);
    }
  }
});

// The difficulty parameters §12.1 promises, as behaviour over many draws.
test("difficulty bands hold: no negatives, exact division, ranges per §12.1", () => {
  const draw = (key, n = 3000) => {
    const i = BUCKETS.findIndex((b) => b.key === key);
    const rng = seeded(i * 31 + 5);
    return Array.from({ length: n }, () => questionFor(i, rng, ":"));
  };
  // no result is ever negative — a child never meets "3 − 8"
  for (const b of BUCKETS) for (const q of draw(b.key)) {
    assert.ok(q.answer >= 0, `${b.key}: negative answer in "${q.text}"`);
  }
  // Leicht ± stays within ten, single digit
  for (const q of [...draw("add-l-small"), ...draw("add-l-ten")]) {
    assert.ok(q.a + q.b <= 10 && q.a <= 9 && q.b <= 9, `add-Leicht past ten: "${q.text}"`);
  }
  for (const q of [...draw("sub-l-a"), ...draw("sub-l-b")]) {
    assert.ok(q.a <= 10 && q.b <= 10 && q.answer >= 0, `sub-Leicht past ten: "${q.text}"`);
  }
  // Mittel ± stays within a hundred and actually carries / borrows
  for (const q of [...draw("add-m-1d"), ...draw("add-m-2d")]) {
    assert.ok(q.a + q.b <= 100, `add-Mittel past 100: "${q.text}"`);
    assert.ok((q.a % 10) + (q.b % 10) >= 10, `add-Mittel without a carry: "${q.text}"`);
  }
  for (const q of [...draw("sub-m-1d"), ...draw("sub-m-2d")]) {
    assert.ok(q.a <= 99 && q.answer >= 0, `sub-Mittel out of range: "${q.text}"`);
    assert.ok((q.a % 10) < (q.b % 10), `sub-Mittel without a borrow: "${q.text}"`);
  }
  // Schwer sums and differences stay within a thousand
  for (const q of [...draw("add-s-big"), ...draw("sub-s-big")]) {
    assert.ok(q.answer >= 0 && q.answer < 1000 && q.a < 1000 && q.b < 1000, `Schwer out of 0–1000: "${q.text}"`);
  }
  // division is always exact — the dividend is a real multiple of the divisor
  for (const key of ["div-l", "div-m", "div-s"]) for (const q of draw(key)) {
    assert.equal(q.a % q.b, 0, `${key}: "${q.text}" has a remainder`);
    assert.equal(q.answer, q.a / q.b);
  }
  // × Leicht keeps a factor in the 1–5 tables; Schwer goes beyond ten
  for (const q of draw("mul-l")) assert.ok(q.a <= 5, `mul-Leicht past the 5-tables: "${q.text}"`);
  for (const q of draw("mul-s")) assert.ok(q.a > 10, `mul-Schwer stayed in the tables: "${q.text}"`);
  // gaps hide exactly one operand; chains carry three terms
  for (const q of [...draw("add-s-gap"), ...draw("sub-s-gap")]) {
    assert.equal(q.kind, "gap");
    assert.equal((q.text.match(/\?/g) ?? []).length, 1, `gap has ${q.text}`);
  }
  for (const q of [...draw("add-s-chain"), ...draw("sub-s-chain")]) {
    assert.equal(q.kind, "chain");
    assert.ok([q.a, q.b, q.c].every(Number.isInteger), `chain missing a term: "${q.text}"`);
  }
});

// The division sign is injected, so the module stays i18n-free (§12.1). A ÷
// round in German must print ":" and never "÷".
test("the division sign is the caller's, defaulting to ÷", () => {
  const i = BUCKETS.findIndex((b) => b.key === "div-m");
  const colon = questionFor(i, seeded(9), ":");
  const obelus = questionFor(i, seeded(9), "÷");
  assert.ok(colon.text.includes(" : ") && !colon.text.includes("÷"));
  assert.equal(colon.text.replace(" : ", " ÷ "), obelus.text);
  assert.equal(questionFor(i, seeded(9)).text, obelus.text, "the default is ÷");
});

// --- the variant expansion the shared engine draws over -----------------------

test("bucketOf folds every variant back to its bucket, total on junk", () => {
  for (let b = 0; b < BUCKET_COUNT; b++) {
    for (let v = 0; v < VARIANTS; v++) assert.equal(bucketOf(b + BUCKET_COUNT * v), b);
  }
  for (const junk of [-1, -BUCKET_COUNT - 3, 1.9, BUCKET_COUNT * 99 + 4]) {
    const b = bucketOf(junk);
    assert.ok(Number.isInteger(b) && b >= 0 && b < BUCKET_COUNT, `bucketOf(${junk}) → ${b}`);
  }
});

test("bucketsFor: a mode is its own buckets, Mix is the four operations", () => {
  for (let d = 0; d < 3; d++) {
    const single = ["+", "-", "x", ":"].flatMap((m) => bucketsFor(m, d));
    const mix = bucketsFor("mix", d);
    assert.deepEqual([...mix].sort((a, b) => a - b), [...single].sort((a, b) => a - b),
      `diff ${d}: Mix must be exactly the four operations pooled`);
    assert.ok(mix.length >= 4, `diff ${d}: Mix must pool at least the four ops`);
    // an unknown mode reads as Mix, never an empty cell
    assert.deepEqual(bucketsFor("nonsense", d), mix);
    for (const m of ["+", "-", "x", ":"]) {
      for (const b of bucketsFor(m, d)) assert.equal(BUCKETS[b].mode, m);
      for (const b of bucketsFor(m, d)) assert.equal(BUCKETS[b].diff, d);
    }
  }
});

test("every cell's pool outgrows the round the engine draws from it (§7.3)", () => {
  for (const m of MODES) {
    for (let d = 0; d < 3; d++) {
      const pool = poolFor(m, d);
      assert.ok(pool.length >= ROUND_SIZE, `${m}/${d}: pool ${pool.length} < round ${ROUND_SIZE}`);
      assert.equal(new Set(pool).size, pool.length, `${m}/${d}: a variant id appears twice`);
      // every variant resolves to a bucket that belongs to this cell
      const cell = new Set(bucketsFor(m, d));
      for (const id of pool) assert.ok(cell.has(bucketOf(id)), `${m}/${d}: ${id} is foreign`);
    }
  }
});

// --- the per-bucket box fold (§7.1, §12.2) ------------------------------------

test("foldBoxes: a touched bucket climbs, a missed one resets, others rest", () => {
  const start = "2".repeat(BUCKET_COUNT);
  // buckets 0 and 1 were solved cleanly, bucket 2 was missed, the rest untouched
  const out = foldBoxes(start, [0, 1, 2], [2]);
  assert.equal(out.length, BUCKET_COUNT);
  assert.equal(out[0], "3", "a clean bucket climbs one box");
  assert.equal(out[1], "3");
  assert.equal(out[2], "0", "a missed bucket drops to zero");
  assert.equal(out[3], "2", "an untouched bucket keeps its digit");
  // the climb caps at 4
  assert.equal(foldBoxes("4".repeat(BUCKET_COUNT), [0], [])[0], "4");
  // any variant of a bucket missing taints the whole bucket for this round
  assert.equal(foldBoxes(start, [5], [5])[5], "0");
});

test("foldBoxes is total: junk strings and junk ids never throw or leak", () => {
  for (const junk of [undefined, null, "", "xyz", "9".repeat(BUCKET_COUNT + 5)]) {
    const out = foldBoxes(junk, [0], []);
    assert.equal(out.length, BUCKET_COUNT, `len from ${JSON.stringify(junk)}`);
    assert.ok([...out].every((c) => "01234".includes(c)), `digits from ${JSON.stringify(junk)}`);
  }
  // out-of-range and non-integer bucket ids are ignored, not applied
  const s = "2".repeat(BUCKET_COUNT);
  assert.equal(foldBoxes(s, [-1, BUCKET_COUNT, 1.5, BUCKET_COUNT + 99], []), s);
});

// --- stars, tempo, retry: the einmaleins rules, pinned (D11) -------------------

test("the star rules are the einmaleins rules — parity so they cannot drift", () => {
  for (let total = 0; total <= 12; total++) {
    for (let ok = 0; ok <= total; ok++) {
      assert.equal(starsFor(ok, total), emStarsFor(ok, total), `${ok}/${total}`);
    }
  }
  for (let s = 0; s <= 4; s++) {
    assert.equal(nextStarGoal(s), emNextStarGoal(s), `goal after ${s}`);
    assert.equal(starGoalNeed(s, 10), emStarGoalNeed(s, 10), `need after ${s}`);
  }
  for (const best of [undefined, null, -1, 2, 99, NaN]) {
    assert.equal(
      ownedStars({ firstTrySolved: 6, total: 10 }, best),
      emOwnedStars({ firstTrySolved: 6, total: 10 }, best),
      `best=${String(best)}`,
    );
  }
});

test("stars on a round of ten: 6 → ⭐, 8 → ⭐⭐, 10 → ⭐⭐⭐", () => {
  const want = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3];
  for (let ok = 0; ok <= 10; ok++) assert.equal(starsFor(ok, 10), want[ok], `${ok}/10`);
});

test("retryStep and fittedFontSize are einmaleins' verbatim — parity", () => {
  for (let answer = 1; answer <= 300; answer++) {
    for (const key of ["1", "9", "0", "⌫", "OK", "x"]) {
      assert.deepEqual(retryStep("12", key, answer), emRetry("12", key, answer), `${answer} ${key}`);
    }
  }
  // a four-digit answer (999 + 9-term Schwer sums stay ≤ 3 digits, but the aid
  // must never strand a longer one) types in without being truncated at three
  assert.deepEqual(retryStep("123", "4", 1234), { input: "1234", state: "typing" });
  for (const [a, w] of [[76, 388], [76, 292], [30, 100]]) {
    assert.equal(fittedFontSize(a, w, 500), emFitted(a, w, 500));
  }
  assert.equal(fittedFontSize(76, 0, 0), 76);
});

test("the tempo ladder: einmaleins' faces and mechanics, rechnungen's bounds", () => {
  assert.deepEqual(TEMPO_ICONS, emTempoIcons);
  assert.deepEqual(TEMPO_KEYS, emTempoKeys);
  assert.equal(TEMPO_SLOTS, 3);
  for (const g of [[], [500], [1000, 2000], [1, 2, 3, 4], [NaN, 800, -5]]) {
    assert.equal(median(g), emMedian(g), JSON.stringify(g));
  }
  for (let stars = 0; stars <= 3; stars++) {
    for (let tier = 0; tier <= 3; tier++) {
      for (let best = 0; best <= 3; best++) {
        assert.equal(awardTempo({ stars, tier, best }), emAwardTempo({ stars, tier, best }));
      }
    }
  }
  // the bounds climb within a row and grow harder-slower across difficulty
  for (let d = 0; d < TEMPO_TIERS.length; d++) {
    const [hare, car, rocket] = TEMPO_TIERS[d];
    assert.ok(hare > car && car > rocket, `d=${d}: the ladder must climb`);
    assert.equal(tempoTier(rocket, d), 3);
    assert.equal(tempoTier(car, d), 2);
    assert.equal(tempoTier(hare, d), 1);
    assert.equal(tempoTier(hare + 1, d), 0);
    if (d > 0) for (let t = 0; t < 3; t++) {
      assert.ok(TEMPO_TIERS[d][t] > TEMPO_TIERS[d - 1][t], `d=${d}: a harder sum takes longer`);
    }
  }
  for (const junk of [NaN, -1, "3000", undefined]) assert.equal(tempoTier(junk, 0), 0);
});

// --- star digit strings (§12.3) ------------------------------------------------

test("star digit strings: three slots, indexed by difficulty, junk-safe", () => {
  assert.equal(withStarDigit(undefined, 0, 3), "300");
  assert.equal(withStarDigit("", 2, 2), "002");
  assert.equal(withStarDigit("120", 1, 3), "130");
  assert.equal(starDigit("120", 0), 1);
  assert.equal(starDigit("120", 2), 0);
  for (const junk of [undefined, null, "", "x?!"]) {
    for (let d = 0; d < DIFF_SLOTS; d++) assert.equal(starDigit(junk, d), 0);
  }
  assert.equal(starDigit("9", 0), 3, "a corrupt digit caps at three stars");
});

// --- the game's worth (§8.3, §12.2) -------------------------------------------

test("maxPoints is computed from the real tiles: 5·(3·1+3·2+3·3) = 90", () => {
  assert.equal(maxPoints(), 90);
  assert.equal(maxPoints(), MODES.length * (STAR_SLOTS * 1 + STAR_SLOTS * 2 + STAR_SLOTS * 3));
  assert.equal(maxPoints(), MAX_POINTS.rechnungen, "rewards.js and logic.js must agree");
  assert.equal(trophyCount("rechnungen", MAX_POINTS.rechnungen), TROPHIES_PER_GAME,
    "mastering every mode fills the shelf");
  assert.ok(THRESHOLDS.rechnungen[0] <= 3, "a first sitting reaches the first trophy");
});

// --- cookie budget (§9.2) -----------------------------------------------------

test("a maxed rechnungen section stays a small fraction of the cookie budget", () => {
  const modeStars = Object.fromEntries(MODES.map((m) => [m, "3".repeat(DIFF_SLOTS)]));
  const maxed = {
    d: 2, m: "mix",
    box: "4".repeat(BUCKET_COUNT),
    stars: modeStars,
    tempo: modeStars,
  };
  const bytes = JSON.stringify({ rechnungen: maxed }).length;
  assert.ok(bytes < 220, `rechnungen section is ${bytes} bytes`);
  assert.ok(bytes < BUDGET / 6, "…and a small fraction of the whole budget");
});

// The mode names are looked up at runtime — `t({...}[mode])` in picker.js — so
// both i18n scans (tests/i18n.test.js) are blind to them: a missing modePlus
// would render as the literal "modePlus" and no test would notice. So they are
// named here, both directions, the way lesen names its runtime pack keys.
test("every mode has a spoken name in both languages, and the picker uses them", () => {
  const src = read("games/rechnungen/picker.js");
  for (const key of ["modePlus", "modeMinus", "modeTimes", "modeDivide", "modeMix"]) {
    assert.ok(strings.de[key], `de.js is missing ${key}`);
    assert.ok(strings.en[key], `en.js is missing ${key}`);
    assert.ok(src.includes(`"${key}"`), `picker.js never looks up ${key}`);
  }
  // …and no mode-name key is dead: every one the picker maps must exist
  const mapped = [...src.matchAll(/"(mode[A-Z][a-z]+)"/g)].map((m) => m[1]);
  for (const key of mapped) assert.ok(strings.de[key] && strings.en[key], `${key} is mapped but untranslated`);
  // the division sign and the tempo faces exist in both languages, none a time
  for (const lang of ["de", "en"]) {
    assert.ok(strings[lang].divSign, `${lang}.divSign is missing`);
    for (const key of ["tempo1", "tempo2", "tempo3", "tempoBest", "tileTempo"]) {
      const s = strings[lang][key];
      assert.ok(s, `${lang}.${key} is missing`);
      assert.ok(!/\d\s*(s|ms|sek|sec)/i.test(s), `${lang}.${key} names a time`);
    }
  }
});
