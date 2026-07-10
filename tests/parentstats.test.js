// The numbers a parent reads (§20). They are derived, not stored, so the risk
// is not corruption but misinterpretation: a fact that was never practised must
// never be reported as a fact the child got wrong.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  heatOf, weakFacts, practiceSummary, minutesOf, secondsPerRound,
  recallDigit, cellState, cellCounts,
} from "../assets/js/parentstats.js";
import { boxesFromString, clampBox } from "../assets/js/adaptive.js";
import { pairOf, POOL_COUNT } from "../games/einmaleins/logic.js";

test("a fresh child has no weak facts, because nothing has been asked yet", () => {
  // clampBox defaults an unknown fact to box 2 — not 0. Reporting a beginner's
  // whole times table as "needs help" would be a lie told to a parent.
  assert.equal(clampBox(undefined), 2);
  const fresh = boxesFromString(undefined, POOL_COUNT);
  assert.deepEqual(weakFacts(fresh, POOL_COUNT), []);
});

test("heatOf maps the Leitner boxes onto what a parent can act on", () => {
  assert.equal(heatOf(0), "weak");
  assert.equal(heatOf(1), "weak");
  assert.equal(heatOf(2), "open");
  assert.equal(heatOf(3), "solid");
  assert.equal(heatOf(4), "solid");
  for (const junk of [undefined, null, -1, 5, "x", NaN]) assert.equal(heatOf(junk), "open");
});

// The recall split (§20): the box says whether a fact is RIGHT; the recall
// digit says whether it is KNOWN — the one thing the box cannot see. A cell
// darkens to "fast" only when it is solid AND repeatedly rocket-fast.
test("cellState: only a solid fact can be 'by heart', and absence never accuses", () => {
  assert.equal(cellState(4, 4), "fast");
  assert.equal(cellState(3, 4), "fast");
  assert.equal(cellState(4, 3), "solid", "quick-but-not-rocket stays plain solid");
  assert.equal(cellState(4, 0), "solid", "no timing record does not demote to 'counting'");
  assert.equal(cellState(0, 4), "weak", "speed on a slipping fact is guessing, not knowledge");
  assert.equal(cellState(2, 4), "open");
});

test("recallDigit is total: short, missing and corrupt strings read as never-timed", () => {
  assert.equal(recallDigit("0402", 1), 4);
  assert.equal(recallDigit("0402", 0), 0);
  assert.equal(recallDigit("04", 99), 0, "beyond the string is unseen");
  for (const junk of [undefined, null, "", "x9"]) {
    assert.equal(recallDigit(junk, 0), 0, `rc=${String(junk)}`);
  }
  assert.equal(recallDigit("9", 0), 0, "a digit outside 0..4 is corrupt, not a claim");
});

test("cellCounts: a fresh child shows no red and nothing 'by heart'", () => {
  const fresh = boxesFromString(undefined, POOL_COUNT);
  assert.deepEqual(cellCounts(fresh, undefined, POOL_COUNT),
    { weak: 0, open: 100, solid: 0, fast: 0 });
  // one solid fact, timed at rocket speed, twice — exactly one dark cell
  const boxes = { ...fresh, 5: 4 };
  const rc = "0".repeat(5) + "4" + "0".repeat(POOL_COUNT - 6);
  assert.deepEqual(cellCounts(boxes, rc, POOL_COUNT),
    { weak: 0, open: 99, solid: 0, fast: 1 });
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

  // the same boxes through the grid's own tally (heatCounts is gone: parents.js
  // reads `open` off cellCounts, so the legend and the empty-state check agree)
  const tally = cellCounts(boxes, undefined, POOL_COUNT);
  assert.deepEqual(tally, { weak: 2, open: 97, solid: 1, fast: 0 });
  assert.equal(tally.weak + tally.open + tally.solid + tally.fast, POOL_COUNT, "every fact is counted once");
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
