// The one rAF driver both foxes share (motion.js). The arithmetic of the gait
// is mapwalk's and tested there; what these tests hold is the driver's
// contract: a walk is frames, the LAST drawn point is exactly the destination,
// and `done()` fires exactly once — even when a janky frame hands in a
// timestamp far past the end, which is how a fox used to arrive mid-air.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runWalk } from "../assets/js/motion.js";
import { walkMs, ANCHORS } from "../assets/js/mapwalk.js";

// A frame queue with a controllable clock: every tick() advances the clock and
// runs the next scheduled frame, the way a browser would — minus the browser.
function fakeFrames(stepMs) {
  let t = 1000;
  const queue = [];
  return {
    now: () => t,
    raf: (fn) => queue.push(fn),
    tick: () => {
      t += stepMs;
      queue.shift()?.(t);
    },
    pending: () => queue.length,
  };
}

const FROM = ANCHORS.einmaleins;
const TO = ANCHORS.pokalraum;

test("a walk is frames, and the last one lands exactly on the destination", () => {
  const f = fakeFrames(50);
  const points = [];
  let done = 0;
  runWalk(FROM, TO, (p) => points.push(p), () => done++, { raf: f.raf, now: f.now });

  assert.equal(done, 0, "nothing is done before the first frame");
  let guard = 1000;
  while (f.pending() && guard--) f.tick();
  assert.ok(guard > 0, "the walk must terminate");

  assert.ok(points.length > 3, "a walk is frames, not a jump");
  assert.deepEqual(points.at(-1), TO, "the fox must land exactly on the anchor");
  assert.equal(done, 1, "done() fires exactly once, when the fox has landed");

  // and the walk takes as long as mapwalk says it does
  const expected = Math.ceil(walkMs(FROM, TO) / 50);
  assert.ok(Math.abs(points.length - expected) <= 1, `${points.length} frames for ${expected}`);
});

test("a janky frame past the end still lands the fox, once", () => {
  // rAF after a background tab can hand out a timestamp seconds late; the
  // driver clamps p, so the one frame it gets must draw the destination.
  const f = fakeFrames(60000);
  const points = [];
  let done = 0;
  runWalk(FROM, TO, (p) => points.push(p), () => done++, { raf: f.raf, now: f.now });
  f.tick();
  assert.deepEqual(points, [TO]);
  assert.equal(done, 1);
  assert.equal(f.pending(), 0, "a finished walk schedules no more frames");
});
