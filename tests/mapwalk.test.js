// The fox's walk across the island (§3.1).
//
// The animation itself cannot be read in a diff, so the arithmetic under it is
// pure and lives in its own module. What these tests guard is what a child
// sees: the fox leaves from where it is standing, it arrives exactly on the
// place she tapped, and it has both feet on the ground at both ends — a walk
// that ends mid-hop puts the fox in the sky the moment the page navigates.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ANCHORS, walkPoint, walkMs } from "../assets/js/mapwalk.js";
import { GAMES } from "../assets/js/rewards.js";

const A = ANCHORS.einmaleins;
const B = ANCHORS.pokalraum;

test("every place the fox can be sent to has an anchor", () => {
  // the five games plus the Trophy Room, which is a destination but not a game
  for (const region of [...GAMES, "pokalraum"]) {
    assert.ok(Array.isArray(ANCHORS[region]), `no fox anchor for "${region}"`);
    assert.equal(ANCHORS[region].length, 2, `${region}: an anchor is [x, y]`);
  }
});

test("every anchor stands on the island, not in the sea", () => {
  // the map's viewBox is 0 0 360 560; the fox is 44 units wide and drawn from
  // (x - 22, y - 40), so an anchor near an edge hangs the fox off the map
  for (const [region, [x, y]] of Object.entries(ANCHORS)) {
    assert.ok(x >= 22 && x <= 338, `${region}: x=${x} pushes the fox off the map`);
    assert.ok(y >= 40 && y <= 556, `${region}: y=${y} pushes the fox off the map`);
  }
});

test("a walk starts at the fox's feet and ends on the anchor it was sent to", () => {
  assert.deepEqual(walkPoint(A, B, 0), A);
  assert.deepEqual(walkPoint(A, B, 1), B);
});

// How high the fox is above the line it is walking along, at progress `p`.
function altitude(p) {
  const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
  return A[1] + (B[1] - A[1]) * e - walkPoint(A, B, p)[1];
}

test("the fox is airborne in the middle of a walk", () => {
  const high = [0.2, 0.35, 0.5, 0.65, 0.8].some((p) => altitude(p) > 4);
  assert.ok(high, "a fox that never leaves the ground is sliding, not walking");
});

test("the fox lands before it arrives, and takes off after it leaves", () => {
  // The hop is damped by a half-sine envelope over the whole walk. Without it
  // the fox is still 2.5 units in the air one frame before the page navigates,
  // and it snaps to the ground — the last thing a child sees is a glitch.
  // Checking only p = 0 and p = 1 would not catch that: the loop clamps `p`, so
  // the endpoints are exact either way.
  assert.ok(altitude(0.03) < 0.6, `takes off too fast (${altitude(0.03)})`);
  assert.ok(altitude(0.97) < 0.6, `still in the air on arrival (${altitude(0.97)})`);

  // and the ends themselves are exactly the anchors
  assert.equal(walkPoint(A, B, 0)[1], A[1]);
  assert.equal(walkPoint(A, B, 1)[1], B[1]);
});

test("a straight up-and-down walk hops sideways, so the hop is seen", () => {
  // In the level picker the tiles are one column, so a walk is purely vertical
  // and the up-down bounce hides along the line of travel — the fox reads as
  // sliding (§10.2). It leans sideways instead. The lean must be off the column.
  const from = [100, 100];
  const to = [100, 320];
  const off = [0.15, 0.3, 0.45, 0.6, 0.85]
    .map((p) => Math.abs(walkPoint(from, to, p)[0] - 100));
  assert.ok(Math.max(...off) > 3, `a vertical walk that never leaves its column is a slide (max lean ${Math.max(...off)})`);
  // …and it still lands dead on the tile it was sent to, both ends on the ground
  assert.deepEqual(walkPoint(from, to, 0), from);
  assert.deepEqual(walkPoint(from, to, 1), to);
});

test("a straight-across walk does not sway sideways off its own line", () => {
  // A horizontal walk's bounce is already visible, so the sideways lean is off:
  // its x is the plain eased interpolation with nothing added. (Guards the
  // verticality scaling — a constant sway would wobble every walk.)
  const from = [200, 200];
  const to = [360, 200];
  for (const p of [0.2, 0.5, 0.8]) {
    const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
    assert.ok(Math.abs(walkPoint(from, to, p)[0] - (200 + 160 * e)) < 1e-9,
      `x swayed on a horizontal walk at p=${p}`);
  }
});

test("progress outside 0..1 cannot throw the fox off the path", () => {
  // rAF can hand out a timestamp past the end on a janky frame
  assert.deepEqual(walkPoint(A, B, 1.4), B);
  assert.deepEqual(walkPoint(A, B, -0.3), A);
});

test("a walk is long enough to be seen and short enough to be forgiven", () => {
  const across = walkMs(ANCHORS.vokabeln, ANCHORS.pokalraum);
  const short = walkMs(ANCHORS.einmaleins, ANCHORS.pokalraum);
  assert.ok(short >= 420, "too fast to read as a walk");
  assert.ok(across <= 1100, "a child who wants to play is made to watch");
  assert.ok(across > short, "crossing the island must take longer than stepping next door");
});
