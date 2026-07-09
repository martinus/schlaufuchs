// The numbers a parent reads (§20). They are derived, not stored, so the risk
// is not corruption but misinterpretation: a fact that was never practised must
// never be reported as a fact the child got wrong.

import { test } from "node:test";
import assert from "node:assert/strict";
import { heatOf, weakFacts, heatCounts, practiceSummary, minutesOf, secondsPerRound } from "../assets/js/parentstats.js";
import { boxesFromString, clampBox } from "../assets/js/adaptive.js";
import { pairOf, POOL_COUNT } from "../games/einmaleins/logic.js";

test("a fresh child has no weak facts, because nothing has been asked yet", () => {
  // clampBox defaults an unknown fact to box 2 — not 0. Reporting a beginner's
  // whole times table as "needs help" would be a lie told to a parent.
  assert.equal(clampBox(undefined), 2);
  const fresh = boxesFromString(undefined, POOL_COUNT);
  assert.deepEqual(weakFacts(fresh, POOL_COUNT), []);
  assert.deepEqual(heatCounts(fresh, POOL_COUNT), { weak: 0, open: 100, solid: 0 });
});

test("heatOf maps the Leitner boxes onto what a parent can act on", () => {
  assert.equal(heatOf(0), "weak");
  assert.equal(heatOf(1), "weak");
  assert.equal(heatOf(2), "open");
  assert.equal(heatOf(3), "solid");
  assert.equal(heatOf(4), "solid");
  for (const junk of [undefined, null, -1, 5, "x", NaN]) assert.equal(heatOf(junk), "open");
});

test("weakFacts lists the hardest first, and names real questions", () => {
  const boxes = boxesFromString("2".repeat(POOL_COUNT), POOL_COUNT);
  boxes[67] = 1;   // 7 × 8
  boxes[56] = 0;   // 6 × 7  — hardest, must come first
  boxes[99] = 4;
  const weak = weakFacts(boxes, POOL_COUNT);
  assert.deepEqual(weak.map((w) => w.id), [56, 67]);
  assert.deepEqual(pairOf(weak[0].id), [6, 7]);
  assert.deepEqual(pairOf(weak[1].id), [7, 8]);

  const tally = heatCounts(boxes, POOL_COUNT);
  assert.deepEqual(tally, { weak: 2, open: 97, solid: 1 });
  assert.equal(tally.weak + tally.open + tally.solid, POOL_COUNT, "every fact is counted once");
});

test("practiceSummary survives an empty, absent or corrupted cookie", () => {
  assert.deepEqual(practiceSummary(), {
    perDiff: [{ seconds: 0, rounds: 0 }, { seconds: 0, rounds: 0 }, { seconds: 0, rounds: 0 }],
    totalSeconds: 0, totalRounds: 0,
  });
  for (const junk of [{ tm: "x" }, { tm: [1, 2] }, { tm: [-1, NaN, 3], rd: null }]) {
    const s = practiceSummary(junk);
    assert.equal(s.perDiff.length, 3);
    assert.ok(s.totalSeconds >= 0 && Number.isInteger(s.totalSeconds));
  }
  const real = practiceSummary({ tm: [60, 300, 0], rd: [2, 5, 0] });
  assert.equal(real.totalSeconds, 360);
  assert.equal(real.totalRounds, 7);
});

test("minutes never round a real practice session down to nothing", () => {
  assert.equal(minutesOf(0), 0);
  assert.equal(minutesOf(20), 1, "twenty seconds of work is not zero minutes");
  assert.equal(minutesOf(90), 2);
  assert.equal(minutesOf(3600), 60);
  for (const bad of [NaN, -5, undefined, Infinity]) assert.equal(minutesOf(bad), 0);
});

test("secondsPerRound refuses to invent a pace it does not know", () => {
  assert.equal(secondsPerRound(0, 0), null, "a blank beats a made-up average");
  assert.equal(secondsPerRound(300, 0), null);
  assert.equal(secondsPerRound(0, 5), null);
  assert.equal(secondsPerRound(300, 5), 60);
  assert.equal(secondsPerRound(NaN, 5), null);
});
