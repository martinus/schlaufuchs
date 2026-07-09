// Structural tests for the world map SVG (§3.1). These guard the two defects
// that shipped this session and were only caught by looking at a screenshot:
// a region whose road did not exist, and art painted in the wrong order.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GAMES, PLAYABLE, isPlayable } from "../assets/js/rewards.js";

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

// This test used to say the opposite: no `fill="transparent"` rect anywhere,
// because an earlier version wrapped every region in an unbounded hotspot that
// tiled 42% of the map. But hit-testing by the art alone failed the child it
// was written for — Mara tapped the gap between the two village houses, and the
// gap belonged to nobody. The invariant is now the middle ground: exactly one
// bounded rect per region, inside its own <a>, no smaller than a finger (§3.1).
const TAP = 64;

function hitRects() {
  const out = {};
  for (const block of regionBlocks()) {
    const id = block.match(/id="(region-[a-z]+)"/)[1].replace("region-", "");
    const rects = [...block.matchAll(/<rect class="hit"[^>]*>/g)].map((m) => m[0]);
    assert.equal(rects.length, 1, `${id} must have exactly one .hit rect, found ${rects.length}`);
    const num = (attr) => {
      const m = rects[0].match(new RegExp(`${attr}="([\\d.]+)"`));
      assert.ok(m, `${id}: .hit rect has no ${attr}`);
      return Number(m[1]);
    };
    out[id] = { x: num("x"), y: num("y"), w: num("width"), h: num("height") };
  }
  return out;
}

test("every region has one bounded hit rect, big enough for a finger", () => {
  const rects = hitRects();
  assert.equal(Object.keys(rects).length, 6, "expected six regions");
  for (const [id, r] of Object.entries(rects)) {
    assert.ok(r.w >= TAP, `${id}: hit rect is ${r.w}px wide, a finger needs ${TAP}`);
    assert.ok(r.h >= TAP, `${id}: hit rect is ${r.h}px tall, a finger needs ${TAP}`);
  }
});

test("a hit rect covers its region's own label, and never a neighbour's", () => {
  // The label anchors are the one coordinate the markup states outright. A rect
  // that does not span its own label leaves the name untappable; a rect that
  // spans someone else's steals it, because SVG paints in document order and
  // the later region wins.
  const rects = hitRects();
  const anchors = {};
  for (const block of regionBlocks()) {
    const id = block.match(/id="(region-[a-z]+)"/)[1].replace("region-", "");
    const m = block.match(/<text class="region-label" x="([\d.]+)" y="([\d.]+)"/);
    assert.ok(m, `${id}: no region-label anchor`);
    anchors[id] = { x: Number(m[1]), y: Number(m[2]) };
  }

  const spans = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  for (const id of Object.keys(rects)) {
    assert.ok(spans(rects[id], anchors[id]), `${id}: its hit rect misses its own label`);
    for (const other of Object.keys(rects)) {
      if (other === id) continue;
      assert.ok(
        !spans(rects[id], anchors[other]),
        `${id}'s hit rect swallows the "${other}" label`,
      );
    }
  }
});

test("no hit shape exists outside a region", () => {
  const inRegions = regionBlocks().join("").match(/class="hit"/g)?.length ?? 0;
  const inPage = html.match(/class="hit"/g)?.length ?? 0;
  assert.equal(inPage, inRegions, "a hit shape outside an <a> is a hotspot on open land");
  assert.equal(inPage, 6);
});

test("the fog is built from the art, never from the hit rect", () => {
  // The hit rect is deliberately larger than the art it wraps. Fogging its
  // bounding box would blow the fog out over the label and the next region.
  const fn = mapJs.slice(mapJs.indexOf("function fogRegion"), mapJs.indexOf("function ensurePlate"));
  assert.match(fn, /classList\.contains\("hit"\)/, "fogRegion must skip the .hit rect");
});

// Regression: tapping a fogged region navigated to a stub page whose single
// sentence explained that the game does not exist. Mara reads almost nothing;
// she was simply gone from the map, with no way back she recognised.
test("a fogged region does not open — it wiggles and says Bald", () => {
  const handler = mapJs.slice(mapJs.indexOf('addEventListener("click"'));
  assert.match(handler.slice(0, 300), /a\.region\.locked/, "only fogged regions are caught");
  assert.match(handler.slice(0, 300), /preventDefault/, "the navigation must be cancelled");
  assert.match(mapJs, /t\("soonBubble"\)/, "and the child must be told, without a sentence");
  assert.ok(
    mapJs.indexOf('addEventListener("click"') < mapJs.indexOf("function render()"),
    "the handler must be registered once at module scope, not inside render()",
  );
  // The bubble goes away on a timer. Under prefers-reduced-motion no animation
  // starts, so `animationend` would never fire and the bubble would stay.
  const bubble = mapJs.slice(mapJs.indexOf("function soonBubble"));
  assert.match(bubble.slice(0, 900), /setTimeout/);
  assert.ok(!bubble.slice(0, 900).includes("animationend"));
});

test("only a region a child can enter wears a label plate", () => {
  assert.match(mapJs, /ensurePlate\(region\)/);
  const render = mapJs.slice(mapJs.indexOf("function render"));
  // the plate is the affordance: it must be behind the `else` of `if (locked)`
  assert.match(render, /if \(locked\) \{[\s\S]*?\} else \{\s*ensurePlate\(region\);/);
  assert.match(read("assets/css/schlaufuchs.css"), /\.worldmap \.label-plate \{/);
});

test("the idle bob never runs on a region that cannot be entered", () => {
  const css = read("assets/css/schlaufuchs.css");
  assert.match(css, /\.worldmap \.region:not\(\.locked\) \{[^}]*animation: region-bob/);
  // Without transform-box an SVG group pivots on the viewport corner, and the
  // region sails off the island instead of bobbing.
  assert.match(css, /\.worldmap \.region:not\(\.locked\) \{[^}]*transform-box: fill-box/);
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

// Four of the five games are stubs. A map that shows six inviting regions and
// delivers one is a map that lies, so the unbuilt ones sit under fog.
test("every region without a game is fogged, and every playable one is not", () => {
  assert.deepEqual(PLAYABLE, ["einmaleins"], "update this test when a game ships");
  assert.ok(html.includes('id="fog-blur"'), "the fog needs its blur filter in <defs>");
  assert.ok(mapJs.includes("fogRegion"), "map.js must build the fog");
  assert.ok(mapJs.includes("isPlayable"), "and it must ask which games exist");
  for (const g of GAMES) assert.equal(typeof isPlayable(g), "boolean");
  assert.ok(!isPlayable("lesen") && isPlayable("einmaleins"));
});

// Regression: the fog is drawn inside its own <a>, and SVG paints in document
// order — so Lesewiese's fog bank greyed out "Zahlendorf", the one region a
// child can actually walk into. Playable regions must be painted last.
test("playable regions are painted after the fogged ones", () => {
  const at = (id) => {
    const i = html.indexOf(`id="region-${id}"`);
    assert.notEqual(i, -1, `region-${id} is missing from the map`);
    return i;
  };
  const lockedLast = Math.max(...GAMES.filter((g) => !isPlayable(g)).map(at));
  const playableFirst = Math.min(...PLAYABLE.map(at), at("pokalraum"));
  assert.ok(
    lockedLast < playableFirst,
    "a fogged region painted after a playable one washes out its label",
  );
});

// The map is hit-tested by its art. A fog blob spans the region's bounding box,
// so if it ever took pointer events it would hand back the invisible hotspot
// that was deliberately deleted from this map.
test("fog never takes the tap", () => {
  const css = read("assets/css/schlaufuchs.css");
  assert.match(
    css,
    /\.worldmap \.region \.fog \{[^}]*pointer-events:\s*none/,
    "fog must be pointer-events: none, or empty land becomes clickable again",
  );
});
