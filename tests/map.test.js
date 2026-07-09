// Structural tests for the world map SVG (§3.1). These guard the two defects
// that shipped this session and were only caught by looking at a screenshot:
// a region whose road did not exist, and art painted in the wrong order.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GAMES } from "../assets/js/rewards.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, root)), "utf8");

const html = read("index.html");
const mapJs = read("assets/js/map.js");

// Every region the map can mark as mastered — the five games plus the Trophy
// Room, which map.js paves at 20 trophies.
const REGIONS = [...GAMES, "pokalraum"];

test("every region has something for pave() to pave", () => {
  // Regression: `pave("einmaleins")` was a silent no-op because the village is
  // the crossroads and has no road of its own. Mastering the times tables
  // changed nothing on the map, and no error was raised.
  for (const region of REGIONS) {
    const hasRoad = html.includes(`id="road-${region}"`);
    const hasPlaza = html.includes(`id="plaza-${region}"`);
    assert.ok(
      hasRoad || hasPlaza,
      `region "${region}" has neither a road nor a plaza, so mastering it is invisible`,
    );
  }
});

test("every road has the dashed centre line that pave() hides", () => {
  const roads = [...html.matchAll(/id="road-([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(roads.length >= 5, "expected the roads to still be there");
  for (const region of roads) {
    assert.ok(
      html.includes(`id="roadline-${region}"`),
      `road-${region} has no roadline-${region}: paving would leave its dirt centre line behind`,
    );
  }
});

test("pave() targets exactly the ids the SVG offers", () => {
  // the function looks up these three ids per region; keep them in step
  for (const prefix of ["road-", "roadline-", "plaza-"]) {
    assert.ok(mapJs.includes(`\`${prefix}\${game}\``), `map.js no longer paves ${prefix}*`);
  }
});

test("every region the fox can stand on has an anchor", () => {
  const anchors = mapJs.slice(mapJs.indexOf("const ANCHORS"), mapJs.indexOf("};"));
  for (const game of GAMES) {
    assert.ok(anchors.includes(`${game}:`), `no fox anchor for "${game}"`);
    assert.ok(html.includes(`id="region-${game}"`), `no region group for "${game}"`);
  }
});

test("Tippsee: the lake is painted after the hut, so the shore is in front", () => {
  // Regression: the hut's green ground ellipse covered the lake's shore, which
  // made the hut look like it stood in front of the water it sits beside.
  const region = html.slice(
    html.indexOf('id="region-tippen"'),
    html.indexOf("</a>", html.indexOf('id="region-tippen"')),
  );
  const hut = region.indexOf('cy="264"'); // the hut's ground ellipse
  const lake = region.indexOf('cy="294"'); // the lake's shore ellipse
  assert.ok(hut > -1 && lake > -1, "hut and lake ellipses not found");
  assert.ok(hut < lake, "the hut must be painted before the lake");
});

// The island's coast runs a little inside the viewBox, so region art that
// reaches an edge is already standing in the sea. Regions carry no transform,
// which is why their raw coordinates can be read directly (the compass rose,
// which lives in a translated group, deliberately is not checked here).
const EDGE = 4;

function regionBlocks() {
  return [...html.matchAll(/<a href="[^"]*" class="region"[\s\S]*?<\/a>/g)].map((m) => m[0]);
}

test("no region art is drawn at the edge of the viewBox", () => {
  // Regression: the mountain's polygon reached x=360 and the Trophy Room's
  // shelf y=528, so both spilled across the coastline into the sea.
  assert.equal(regionBlocks().length, 6, "expected six regions");
  for (const block of regionBlocks()) {
    const id = block.match(/id="(region-[a-z]+)"/)[1];

    const check = (x, y, what) => {
      assert.ok(x >= EDGE && x <= 360 - EDGE, `${id}: ${what} x=${x} is in the sea`);
      assert.ok(y >= EDGE && y <= 560 - EDGE, `${id}: ${what} y=${y} is in the sea`);
    };

    for (const [, pts] of block.matchAll(/points="([^"]+)"/g)) {
      for (const pair of pts.trim().split(/\s+/)) {
        const [x, y] = pair.split(",").map(Number);
        check(x, y, "polygon point");
      }
    }
    for (const [, cx, cy, rx, ry] of block.matchAll(
      /<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g,
    )) {
      check(Number(cx) - Number(rx), Number(cy) - Number(ry), "ellipse");
      check(Number(cx) + Number(rx), Number(cy) + Number(ry), "ellipse");
    }
  }
});
