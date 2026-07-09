import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import {
  POOL_COUNT, EASY_TABLES, pairIndex, pairOf, poolFor, questionFor,
  choicesFor, starsFor, nextStarGoal, starTargets, basketState, starDigit, withStarDigit, tableStarIndex, fittedFontSize,
} from "../games/einmaleins/logic.js";

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("canonical pair index roundtrips over the full 100-item pool (§10.4)", () => {
  assert.equal(POOL_COUNT, 100);
  for (let t = 1; t <= 10; t++) {
    for (let f = 1; f <= 10; f++) {
      const id = pairIndex(t, f);
      assert.ok(id >= 0 && id < POOL_COUNT);
      assert.deepEqual(pairOf(id), [t, f]);
    }
  }
});

test("poolFor: single table, mixed, and easy-mixed (§10.2)", () => {
  assert.equal(poolFor(7, 1).length, 10);
  assert.ok(poolFor(7, 1).every((id) => pairOf(id)[0] === 7));
  assert.equal(poolFor(0, 1).length, 100);
  const easyMixed = poolFor(0, 0);
  assert.equal(easyMixed.length, 40);
  assert.ok(easyMixed.every((id) => EASY_TABLES.includes(pairOf(id)[0])));
});

test("questions always have the correct answer for every kind", () => {
  const rng = seeded(5);
  for (let i = 0; i < 500; i++) {
    const id = Math.floor(rng() * 100);
    const q = questionFor(id, 2, rng);
    const [t, f] = pairOf(id);
    if (q.kind === "mul") assert.equal(q.answer, t * f);
    if (q.kind === "div") assert.equal(q.answer, t);
    if (q.kind === "gap") assert.ok(q.answer === t || q.answer === f);
    assert.ok(q.text.includes("?"));
  }
});

test("easy/medium difficulties only produce plain multiplication", () => {
  const rng = seeded(2);
  for (let d = 0; d <= 1; d++) {
    for (let i = 0; i < 100; i++) {
      assert.equal(questionFor(i, d, rng).kind, "mul");
    }
  }
});

test("multiple choice: 4 unique positive options including the answer", () => {
  const rng = seeded(8);
  for (let i = 0; i < 200; i++) {
    const id = Math.floor(rng() * 100);
    const q = questionFor(id, 0, rng);
    const opts = choicesFor(q, rng);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4);
    assert.ok(opts.includes(q.answer));
    assert.ok(opts.every((o) => o > 0));
  }
});

test("star criteria (§10.3): accuracy only, never the clock", () => {
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(9, 10), 2);
  assert.equal(starsFor(8, 10), 2);
  assert.equal(starsFor(7, 10), 1);
  assert.equal(starsFor(6, 10), 1);
  assert.equal(starsFor(5, 10), 0);
  assert.equal(starsFor(0, 10), 0);
  // Regression: stars used to depend on the round's duration, which punished a
  // child for reading or tapping slowly. starsFor takes no time argument, and a
  // stray third argument must not be able to change the outcome.
  assert.equal(starsFor.length, 2);
  assert.equal(starsFor(10, 10, 999), 3);
});

test("the summary names the price of the next star", () => {
  // A child who scores 9/10 keeps one star and is told nothing about why.
  // Every un-earned star must have a goal line; a mastered round must not.
  assert.equal(nextStarGoal(0), "starGoal1");
  assert.equal(nextStarGoal(starsFor(6, 10)), "starGoal2");
  assert.equal(nextStarGoal(starsFor(8, 10)), "starGoal3");
  assert.equal(nextStarGoal(starsFor(10, 10)), null);
});

test("nextStarGoal is total: garbage in, a hidden row out — never a blank one", () => {
  const KEYS = ["starGoal1", "starGoal2", "starGoal3"];

  // The contract the caller leans on: a real key, or null. Never undefined —
  // t(undefined) renders "" and `hidden = goal === null` stays false, so the
  // summary would grow a blank row instead of failing loudly.
  for (const any of [undefined, null, -1, 0, 1, 2, 3, 4, 1.5, "2", NaN, true, {}]) {
    const goal = nextStarGoal(any);
    assert.ok(goal === null || KEYS.includes(goal), `nextStarGoal(${String(any)}) → ${goal}`);
  }
  for (const stars of [0, 1, 2]) assert.equal(nextStarGoal(stars), KEYS[stars]);
  for (const none of [-1, 3, 4, 1.5, NaN, undefined, null]) assert.equal(nextStarGoal(none), null);

  // The dead-key test waves `starGoal*` through on a regex allowlist, so it can
  // no longer notice one going missing. Name them here instead.
  for (const k of KEYS) {
    assert.equal(typeof de[k], "string", `de.js is missing ${k}`);
    assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
  }
});

// Regression: the summary showed "9/10 · 46 s". Stars stopped counting seconds,
// but the line still whispered "faster is better" at a child who is slow and
// right. endRound() must not measure the round at all.
test("the round summary never times the child", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../games/einmaleins/einmaleins.js", import.meta.url)),
    "utf8",
  );
  const endRound = src.slice(src.indexOf("function endRound()"));
  assert.ok(endRound.includes('t("roundStat"'), "the summary must still report the score");
  assert.ok(!endRound.includes("Date.now()"), "endRound() must not read the clock");
  assert.ok(!/\bt0\b/.test(src), "the round's start time must not be recorded at all");
  for (const [lang, dict] of [["de", de], ["en", en]]) {
    assert.ok(!dict.roundStat.includes("{s}"), `${lang}.roundStat still has a seconds slot`);
  }
});

test("star digit string: 11 slots, mixed table at index 10", () => {
  assert.equal(tableStarIndex(1), 0);
  assert.equal(tableStarIndex(10), 9);
  assert.equal(tableStarIndex(0), 10);
  let s = withStarDigit(undefined, 7, 2);
  assert.equal(s.length, 11);
  assert.equal(starDigit(s, 7), 2);
  assert.equal(starDigit(s, 3), 0);
  s = withStarDigit(s, 0, 3);
  assert.equal(starDigit(s, 0), 3);
  assert.equal(starDigit(s, 7), 2);
});

// Regression: at 19vw the longest equation wrapped to two lines on a phone.
// The rendered width of a question in the display face is ~5.1em for the
// shortest ("2 × 2 = ?") and ~7.5em for the longest ("100 ÷ 10 = 100").
test("fittedFontSize(): the question never needs a second line", () => {
  const EM_SHORT = 5.07;
  const EM_LONG = 7.51;

  // a short question at the wished-for size already fits: leave it alone
  const wish = 76; // 19vw at 402px
  assert.equal(fittedFontSize(wish, 388, EM_SHORT * wish), wish);

  // the long one does not fit, so it shrinks — and then it does fit
  const fitted = fittedFontSize(wish, 388, EM_LONG * wish);
  assert.ok(fitted < wish, "long question must shrink");
  assert.ok(EM_LONG * fitted <= 388, "shrunk question must fit the line");

  // every phone width we target, for the longest question
  for (const avail of [292, 332, 388, 532]) {
    const size = fittedFontSize(wish, avail, EM_LONG * wish);
    assert.ok(EM_LONG * size <= avail, `overflows at ${avail}px`);
    assert.ok(size > 0, `nonsense size at ${avail}px`);
  }
});

test("fittedFontSize(): degenerate measurements never change the size", () => {
  // an element that is not laid out yet reports 0 — do not divide by it
  assert.equal(fittedFontSize(76, 0, 0), 76);
  assert.equal(fittedFontSize(76, 388, 0), 76);
  assert.equal(fittedFontSize(76, 0, 500), 76);
});

// The in-round basket (§10.5). Its whole reason to exist is that it fills and
// never spills: a basket that drops a star on the first mistake — and the
// first mistake usually arrives at question two — is a machine for making a
// child quit. A bad round cannot take anything away anyway; endRound() keeps
// the best score, never the last one.
test("the star basket only ever fills, whatever order the mistakes arrive in", () => {
  const TOTAL = 10;
  assert.deepEqual(starTargets(TOTAL), [6, 8, 10]);

  // Simulate a whole round: `wrongAt` marks which of the ten items get missed.
  const play = (wrongAt) => {
    const seen = [];
    let missed = 0, banked = 0;
    for (let i = 0; i < TOTAL; i++) {
      if (wrongAt.has(i)) missed++; else banked++;
      // firstTryOk is the best score still reachable; firstTrySolved is banked
      seen.push(basketState({ firstTrySolved: banked, firstTryOk: TOTAL - missed, total: TOTAL }));
    }
    return seen;
  };

  const orders = [new Set(), new Set([0]), new Set([0, 1]), new Set([9]), new Set([0, 4, 9]),
    new Set([0, 1, 2, 3, 4]), new Set([2, 5]), new Set([1, 3, 5, 7])];
  for (const wrongAt of orders) {
    const steps = play(wrongAt);
    for (let i = 1; i < steps.length; i++) {
      assert.ok(
        steps[i].stars >= steps[i - 1].stars,
        `basket lost a star with mistakes at ${[...wrongAt]}: ${steps[i - 1].stars} -> ${steps[i].stars}`,
      );
    }
    // and it ends where the summary says it does
    const final = TOTAL - wrongAt.size;
    assert.equal(steps.at(-1).stars, starsFor(final, TOTAL), "basket and summary must agree");
  }
});

test("the basket's goal only ever names a star that is still reachable", () => {
  const TOTAL = 10;
  // three misses put two and three stars out of reach: 7/10 is one star, max.
  const afterThreeMisses = basketState({ firstTrySolved: 6, firstTryOk: 7, total: TOTAL });
  assert.equal(afterThreeMisses.stars, 1);
  assert.equal(afterThreeMisses.goalStars, 0, "must not dangle a star that cannot be earned");
  assert.equal(afterThreeMisses.needed, 0);

  // a clean start: the cheapest star is six right
  assert.deepEqual(basketState({ firstTrySolved: 0, firstTryOk: 10, total: TOTAL }),
    { stars: 0, needed: 6, goalStars: 1 });
  // banked six, still perfect-ish: two more for the second star
  assert.deepEqual(basketState({ firstTrySolved: 6, firstTryOk: 10, total: TOTAL }),
    { stars: 1, needed: 2, goalStars: 2 });
  // banked nine of ten with one miss: the third star is gone, the second is held
  assert.deepEqual(basketState({ firstTrySolved: 9, firstTryOk: 9, total: TOTAL }),
    { stars: 2, needed: 0, goalStars: 0 });

  // degenerate rounds must not divide by zero or promise anything
  assert.deepEqual(basketState({}), { stars: 0, needed: 0, goalStars: 0 });
  assert.deepEqual(basketState({ firstTrySolved: 0, firstTryOk: 0, total: 0 }),
    { stars: 0, needed: 0, goalStars: 0 });
});
