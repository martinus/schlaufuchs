// Structural tests for the world map SVG (§3.1). These guard the two defects
// that shipped this session and were only caught by looking at a screenshot:
// a region whose road did not exist, and art painted in the wrong order.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GAMES, PLAYABLE, isPlayable } from "../assets/js/rewards.js";
import { ANCHORS } from "../assets/js/mapwalk.js";

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

// The room's collection used to hang beneath its house on a badge, in a column
// of region labels and star badges, where a number means nothing in particular.
// It is now written on the wall, above the cup it counts.
test("the Trophy Room counts its trophies on the cup, not under the house", () => {
  const room = html.slice(html.indexOf('id="region-pokalraum"'), html.indexOf("</a>", html.indexOf('id="region-pokalraum"')));
  assert.ok(!room.includes('data-badge="pokalraum"'), "the badge under the house is gone");
  assert.match(room, /id="pokal-count"/, "…and the count is on the facade");
  assert.match(mapJs, /getElementById\("pokal-count"\)/, "…and map.js still fills it");

  const count = Number(room.match(/id="pokal-count"[^>]*y="([\d.]+)"/)[1]);
  const cup = Number(room.match(/data-icon="deco-trophy"[^>]*y="([\d.]+)"/)[1]);
  assert.ok(count < cup, "the number must sit above the trophy, not on top of it");

  // The number is decorative markup; the link has to say what it means.
  assert.match(room, /id="pokal-count"[^>]*aria-hidden="true"/);
  assert.match(mapJs, /pkRegion\.setAttribute\("aria-label"/);
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
  // the anchors themselves are checked in mapwalk.test.js; here: the map has a
  // group for each one, and map.js reads them from the one module that owns them
  for (const game of GAMES) {
    assert.ok(html.includes(`id="region-${game}"`), `no region group for "${game}"`);
  }
  assert.match(mapJs, /from "\.\/mapwalk\.js"/, "map.js must not keep a second copy of the anchors");
  assert.ok(!mapJs.includes("const ANCHORS ="), "the anchors live in mapwalk.js");
});

// Mara tapped the Trophy Room and the page swapped under her. The fox stayed on
// the island, so nothing tied the map she left to the room she arrived in.
test("a tap sends the fox there first, and the region opens when it arrives", () => {
  const travel = mapJs.slice(mapJs.indexOf("function travelTo"));
  assert.match(travel.slice(0, 700), /setRewards\(\{ at: game \}\)/,
    "the map must remember where she went, or the fox is not there when she returns");
  // the navigation is the walk's callback, never a statement beside it
  assert.match(mapJs, /runWalk\([\s\S]{0,160}location\.href = href;/,
    "the region must open only once the fox has arrived");
  // Regression risk: two rAF loops fighting over one transform, and two
  // navigations racing each other.
  assert.match(travel.slice(0, 200), /if \(walking\) return;/);
});

// Regression: `travelTo` sets `walking = true` and never clears it — the walk's
// callback navigates away and the reload was meant to reset the flag. But the
// back-forward cache freezes the page instead of reloading it, so a
// walk-then-navigate leaves the map in bfcache with `walking` stuck true. On the
// way back (Android back gesture, browser back button) every tap then dies on
// `if (walking) return` — the label turns orange on :hover and nothing walks.
test("a bfcache restore clears the stuck walk flag, or the map goes dead", () => {
  // The one signal a bfcache restore fired is `pageshow` with `persisted`.
  assert.match(mapJs, /addEventListener\("pageshow"/, "nothing listens for a bfcache restore");
  const handler = mapJs.slice(mapJs.indexOf('addEventListener("pageshow"'));
  const body = handler.slice(0, handler.indexOf("});") + 1);
  assert.match(body, /\.persisted/, "must react to a bfcache restore, not every load");
  assert.match(body, /walking = false/, "the stuck flag must be cleared, or every tap is a no-op");
  // ...and the stars/trophies she earned in the game she left must not be stale.
  assert.match(body, /render\(\)/, "re-render, or the map shows a count from before she played");
});

// Regression: these are SVG anchors. `region.href` is an SVGAnimatedString, not
// a string, so `location.href = region.href` sent the child to the 404 page
// "/[object%20SVGAnimatedString]". Every region on the map was a dead end, and
// node --test saw nothing wrong.
test("the map navigates by the href attribute, not by an SVG anchor's href", () => {
  assert.ok(!/location\.href = region\.href/.test(mapJs), "SVGAnimatedString is not a URL");
  assert.match(mapJs, /region\.getAttribute\("href"\)/);
});

test("a fox that cannot be watched walking still ends up at the new region", () => {
  // `prefers-reduced-motion` is not negotiable (§15): no walk, and `at` is
  // written before the branch, so the fox stands there on the way back.
  const travel = mapJs.slice(mapJs.indexOf("function travelTo"));
  const head = travel.slice(0, travel.indexOf("runWalk("));
  assert.match(head, /prefersReducedMotion\(\)/);
  assert.ok(
    head.indexOf("setRewards") < head.indexOf("prefersReducedMotion"),
    "`at` must be written before the reduced-motion shortcut takes the navigation",
  );
  assert.match(head, /location\.href = href;/, "…and it must still open");
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

// SVG paints in document order, so where two hit rects overlap the later
// region silently wins the whole shared strip. Lesewiese's rect once reached
// 40px into the einmaleins village: a tap on the village's left house opened
// the reading game or the times tables depending on nothing a child can see.
test("no two hit rects overlap", () => {
  const rects = Object.entries(hitRects());
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [aId, a] = rects[i];
      const [bId, b] = rects[j];
      const overlaps = a.x < b.x + b.w && b.x < a.x + a.w
        && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlaps, `${aId} and ${bId} share tappable ground`);
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

// Regression: the cover used to be four gaussian-blurred ellipses. Blur has no
// edge, so the mountain under it read as washed-out art — a rendering mistake —
// not as weather that will lift. The clouds are drawn shapes now; only the veil
// beneath them may blur, because its one job is to have no edge.
test("the clouds have an edge; only the veil is blurred", () => {
  const cloud = mapJs.slice(mapJs.indexOf("function cloudAt"), mapJs.indexOf("function fogRegion"));
  assert.ok(!cloud.includes("fog-blur"), "a blurred cloud is the old fog again");
  // the rim pass is drawn before the puff pass, so the edge is a single outer
  // line — a stroke on each opaque puff would draw its seams inside the cloud
  assert.match(cloud, /\["cloud-rim", "cloud-puff"\]/);
  const fog = mapJs.slice(mapJs.indexOf("function fogRegion"), mapJs.indexOf("function ensurePlate"));
  assert.match(fog, /veil\.setAttribute\("filter", "url\(#fog-blur\)"\)/);
});

// A locked region's game cannot pay a star, so "⭐ 0" under its name is a
// promise the clouds just took back. The badge group stays in the markup for
// the day the game ships.
test("a fogged region carries no star badge", () => {
  const render = mapJs.slice(mapJs.indexOf("function render"));
  assert.match(render, /if \(locked\) badge\.replaceChildren\(\);/);
  assert.match(render, /else \{\n\s*const cups = trophyCount\(/, "…and a playable region keeps its badge");
  // …which now also carries the region's latest trophy — grey ghost before the
  // first is won (user request, 2026-07-13), so the map shows progress wordlessly
  assert.match(mapJs, /cup-ghost/, "a cupless region must show the ghost of the first");
  assert.match(mapJs, /TROPHIES\[game\]\[Math\.max\(cups - 1, 0\)\]/, "the cup shown is the latest won");
});

// Regression: tapping a fogged region navigated to a stub page whose single
// sentence explained that the game does not exist. Mara reads almost nothing;
// she was simply gone from the map, with no way back she recognised.
test("a fogged region does not open — it wiggles and says Bald", () => {
  const handler = mapJs.slice(mapJs.indexOf('addEventListener("click"'));
  assert.match(handler.slice(0, 600), /preventDefault/, "the navigation must be cancelled");
  // one handler, two answers: the fog wiggles, everything else is walked to
  assert.match(handler.slice(0, 600), /classList\.contains\("locked"\)\) soonBubble\(region\);/);
  assert.match(handler.slice(0, 600), /else travelTo\(region\);/);
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

// Three of the five games are stubs. A map that shows six inviting regions and
// delivers two is a map that lies, so the unbuilt ones sit under fog.
test("every region without a game is fogged, and every playable one is not", () => {
  assert.deepEqual(PLAYABLE, ["einmaleins", "lesen", "rechnungen"], "update this test when a game ships");
  assert.ok(html.includes('id="fog-blur"'), "the fog needs its blur filter in <defs>");
  assert.ok(mapJs.includes("fogRegion"), "map.js must build the fog");
  assert.ok(mapJs.includes("isPlayable"), "and it must ask which games exist");
  for (const g of GAMES) assert.equal(typeof isPlayable(g), "boolean");
  assert.ok(!isPlayable("tippen") && isPlayable("einmaleins") && isPlayable("lesen") && isPlayable("rechnungen"));
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

// The fox stood dead-centre on the Lesewiese anchor, and the anchor sat right
// on the tree's trunk — the fox's body hid it, so the tree read as a green ball
// floating over the grass. The fox is drawn 44 wide, centred on its anchor
// (map.js placeFox translates by x - 22), so its span must clear the trunk rect.
test("the fox on the Lesewiese does not stand over the tree trunk", () => {
  const region = html.slice(
    html.indexOf('id="region-lesen"'),
    html.indexOf("</a>", html.indexOf('id="region-lesen"')),
  );
  // the trunk is the short brown rect inside the region
  const trunk = region.match(/<rect x="(\d+)" y="\d+" width="(\d+)" height="\d+" fill="#6b4423"\/>/);
  assert.ok(trunk, "the Lesewiese trunk rect must exist to be cleared");
  const trunkLeft = Number(trunk[1]);
  const trunkRight = trunkLeft + Number(trunk[2]);

  const FOX_HALF = 22; // half of foxSVG size 44 (map.js: translate by x - 22)
  const [fx] = ANCHORS.lesen;
  const foxLeft = fx - FOX_HALF;
  const foxRight = fx + FOX_HALF;
  assert.ok(
    foxLeft >= trunkRight || foxRight <= trunkLeft,
    `fox span [${foxLeft}, ${foxRight}] overlaps the trunk [${trunkLeft}, ${trunkRight}]`,
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
