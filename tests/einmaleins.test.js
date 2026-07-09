import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POOL_COUNT, EASY_TABLES, pairIndex, pairOf, poolFor, questionFor,
  choicesFor, starsFor, nextStarGoal, starDigit, withStarDigit, tableStarIndex, fittedFontSize,
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
