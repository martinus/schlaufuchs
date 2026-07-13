// The round's scene (§10.5). 184 lines of geometry that no test had ever seen:
// every defect in it — a basket standing in the sea, a star landing beside its
// mouth — was found by looking at a screenshot, if at all.
//
// `sceneGeometry` is the arithmetic, pulled out of the DOM code, so the shapes
// can be checked here and the screenshot can go back to checking how it looks.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneGeometry, THEMES } from "../assets/js/journey.js";

// A short round used to keep the stride and shrink the width — a four-node
// scene was nearly square, and at CSS width 100 % it blew up to fill half a
// phone (Martin, first Rechenberg play-test). Now the sky stays a wide strip:
// the fox simply takes bigger strides.
test("a short round keeps the ten-node scene's width — wider strides, same sky", () => {
  const ten = sceneGeometry(10);
  for (const n of [3, 4, 5, 8]) {
    const g = sceneGeometry(n);
    assert.equal(g.width, ten.width, `${n} nodes must fill the same width`);
    assert.ok(g.nodes[1].x - g.nodes[0].x > ten.nodes[1].x - ten.nodes[0].x,
      `${n} nodes: the stride must widen`);
    assert.ok(Math.abs(g.basket.x - ten.basket.x) <= 2, `${n} nodes: the basket stays at the finish`);
  }
  // a LONGER round still grows to the right, step by fixed step
  const twelve = sceneGeometry(12);
  assert.ok(twelve.width > ten.width, "a longer round grows, it does not squeeze");
  assert.equal(twelve.nodes[1].x - twelve.nodes[0].x, ten.nodes[1].x - ten.nodes[0].x);
  assert.equal(ten.nodes.length, 10);
});

test("nothing the scene draws falls outside the scene", () => {
  for (const nodes of [1, 2, 5, 10, 20]) {
    for (const theme of Object.keys(THEMES)) {
      const g = sceneGeometry(nodes, theme);
      const inside = ({ x, y }, what) => {
        assert.ok(x >= 0 && x <= g.width, `${theme}/${nodes}: ${what} x=${x} of ${g.width}`);
        assert.ok(y >= 0 && y <= g.height, `${theme}/${nodes}: ${what} y=${y} of ${g.height}`);
      };
      g.nodes.forEach((p, i) => inside(p, `node ${i}`));
      g.sky.forEach((p, i) => inside(p, `sky slot ${i}`));
      g.landing.forEach((p, i) => inside(p, `landing ${i}`));
      inside(g.basket, "basket");
    }
  }
});

test("the basket stands past the last node, and the stars land in its mouth", () => {
  const g = sceneGeometry(10);
  const last = g.nodes.at(-1);
  assert.ok(g.basket.x > last.x, "the basket is the finish line, so it comes after the path");

  for (const p of g.landing) {
    // within the basket's half-width (52px icon), and above its rim
    assert.ok(Math.abs(p.x - g.basket.x) <= 26, `a star lands beside the basket at x=${p.x}`);
    assert.ok(p.y < g.basket.y, "a star lands in the basket's mouth, not under its foot");
    assert.ok(g.basket.y - p.y < 52, "…and not above it either");
  }
});

test("the stars wait in the sky and fall downward into the basket", () => {
  const g = sceneGeometry(10);
  assert.equal(g.sky.length, 3, "three stars, always");
  for (const [i, s] of g.sky.entries()) {
    assert.ok(s.y < g.landing[i].y, `sky slot ${i} is below its landing spot`);
  }
  // the constellation is not a row: the middle star hangs higher than its neighbours
  assert.ok(g.sky[1].y < g.sky[0].y && g.sky[1].y < g.sky[2].y);
});

test("only the mountain climbs", () => {
  const flat = sceneGeometry(10, "village");
  assert.equal(new Set(flat.nodes.map((p) => p.y)).size, 1, "the village path is flat");

  const climb = sceneGeometry(10, "mountain");
  assert.ok(climb.nodes.at(-1).y < climb.nodes[0].y, "the mountain path rises to the right");
  // strictly monotone: a path that levels off mid-climb looks like a mistake
  for (let i = 1; i < climb.nodes.length; i++) {
    assert.ok(climb.nodes[i].y < climb.nodes[i - 1].y, `step ${i} does not climb`);
  }
});

// A round of one question is legal (a pool can be that small), and a round of
// none is not — but neither may produce NaN coordinates that render nothing.
test("a degenerate round still has a scene", () => {
  for (const bad of [0, 1, -3, NaN, undefined, "10"]) {
    const g = sceneGeometry(bad);
    assert.ok(g.nodes.length >= 1, `${String(bad)} nodes`);
    for (const p of [...g.nodes, ...g.sky, ...g.landing, g.basket]) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${String(bad)}: NaN coordinate`);
    }
  }
});
