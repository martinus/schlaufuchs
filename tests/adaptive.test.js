import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSession, clampBox, boxesFromString, boxesToString, WEIGHTS,
} from "../assets/js/adaptive.js";

const seeded = (seed = 42) => () => {
  // deterministic LCG for reproducible tests
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const pool10 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

test("clampBox: valid digits pass, everything else becomes 2", () => {
  assert.equal(clampBox("0"), 0);
  assert.equal(clampBox(4), 4);
  assert.equal(clampBox("7"), 2);
  assert.equal(clampBox(undefined), 2);
  assert.equal(clampBox("x"), 2);
});

test("box string codec: roundtrip and padding with 2", () => {
  const boxes = boxesFromString("340", 5);
  assert.deepEqual(boxes, { 0: 3, 1: 4, 2: 0, 3: 2, 4: 2 });
  assert.equal(boxesToString(boxes, 5), "34022");
});

test("correct answer moves box up, capped at 4 (§7.1)", () => {
  const s = createSession(pool10, { 0: 4, 1: 3 }, { roundSize: 10, rng: seeded() });
  for (let id = s.next(); id !== null; id = s.next()) s.answer(id, true);
  const b = s.boxes();
  assert.equal(b[0], 4); // capped
  assert.equal(b[1], 4);
  for (const id of pool10.slice(2)) assert.equal(b[id], 3); // 2 → 3
});

test("wrong answer drops box to 0 and re-queues within 2–4 questions (§7.1)", () => {
  const s = createSession(pool10, {}, { roundSize: 10, rng: seeded(7) });
  const first = s.next();
  s.answer(first, false);
  assert.equal(s.boxes()[first], 0);
  // the item must come back after 2–4 other questions
  let gap = 0;
  let seenAgain = -1;
  for (let i = 0; i < 10; i++) {
    const id = s.next();
    if (id === first) {
      seenAgain = gap;
      break;
    }
    gap++;
    s.answer(id, true);
  }
  assert.ok(seenAgain >= 2 && seenAgain <= 4, `re-queued after ${seenAgain}`);
});

test("round only ends when every item answered correctly (§7.3)", () => {
  const rng = seeded(3);
  const s = createSession(pool10, {}, { roundSize: 10, rng });
  let answers = 0;
  let id;
  while ((id = s.next()) !== null) {
    // fail every item once, then succeed
    s.answer(id, s.progress().solved + 99 > 0 && answers % 2 === 1);
    answers++;
  }
  const p = s.progress();
  assert.equal(p.solved, 10);
  assert.ok(answers > 10, "failed items were re-asked");
});

test("firstTryOk counts only untouched items", () => {
  const s = createSession(pool10, {}, { roundSize: 10, rng: seeded(9) });
  let i = 0;
  let id;
  while ((id = s.next()) !== null) {
    const failThis = i === 0; // fail exactly the first question once
    s.answer(id, !failThis);
    i++;
  }
  assert.equal(s.progress().firstTryOk, 9);
});

test("weighted selection prefers weak items (§7.2)", () => {
  // pool of 20: item 0 in box 0, the rest in box 4
  const pool = Array.from({ length: 20 }, (_, i) => i);
  const boxes = { 0: 0 };
  for (let i = 1; i < 20; i++) boxes[i] = 4;
  let included = 0;
  const runs = 300;
  const rng = seeded(11);
  for (let r = 0; r < runs; r++) {
    const s = createSession(pool, boxes, { roundSize: 5, rng });
    if (s.items().includes(0)) included++;
  }
  // weight 8 vs 0.5: item 0 should be drawn far more often than 25 % chance
  assert.ok(included / runs > 0.75, `weak item drawn in ${included}/${runs} rounds`);
  assert.equal(WEIGHTS[0] / WEIGHTS[4], 16);
});

// The boost multiplies into the Leitner weight at draw time (§7.2): a game can
// say "this item is intrinsically hard, show it more" without touching the box
// mechanics. Zero weight is the strongest statement, and while any positive
// weight remains, a zero-weight item must never be drawn.
test("boost multiplies into the draw, and a zero boost excludes an item", () => {
  const pool = Array.from({ length: 20 }, (_, i) => i);
  const rng = seeded(13);
  for (let r = 0; r < 100; r++) {
    const s = createSession(pool, {}, { roundSize: 10, rng, boost: (id) => (id < 10 ? 1 : 0) });
    assert.ok(s.items().every((id) => id < 10), `drew a zero-weight item: ${s.items()}`);
  }
  // …and a large boost dominates equal boxes: item 0 boosted 50× is all but
  // certain to be in a half-pool draw
  let included = 0;
  for (let r = 0; r < 100; r++) {
    const s = createSession(pool, {}, { roundSize: 10, rng, boost: (id) => (id === 0 ? 50 : 1) });
    if (s.items().includes(0)) included++;
  }
  assert.ok(included > 90, `boosted item drawn in ${included}/100 rounds`);
});

test("roundSize larger than pool shrinks to pool size", () => {
  const s = createSession([1, 2, 3], {}, { roundSize: 10, rng: seeded() });
  assert.equal(s.items().length, 3);
  assert.equal(s.progress().total, 3);
});
