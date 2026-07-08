import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POOL_COUNT, EASY_TABLES, pairIndex, pairOf, poolFor, questionFor,
  choicesFor, starsFor, starDigit, withStarDigit, tableStarIndex,
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

test("star criteria (§10.3)", () => {
  assert.equal(starsFor(10, 10, 45), 3);
  assert.equal(starsFor(10, 10, 60), 2);
  assert.equal(starsFor(9, 10, 30), 1);
  assert.equal(starsFor(8, 10, 30), 1);
  assert.equal(starsFor(7, 10, 30), 0);
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
