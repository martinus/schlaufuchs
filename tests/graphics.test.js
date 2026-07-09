import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPHICS, AVAILABLE, iconHTML, iconSVG } from "../assets/js/graphics.js";
import { THEMES } from "../assets/js/journey.js";
import { GAMES, TROPHIES } from "../assets/js/rewards.js";

test("every GRAPHICS entry has an emoji fallback", () => {
  for (const [name, g] of Object.entries(GRAPHICS)) {
    assert.ok(g.emoji && g.emoji.length > 0, `missing emoji for ${name}`);
  }
});

test("all 60 generated trophy names exist in GRAPHICS", () => {
  let count = 0;
  for (const g of GAMES) {
    TROPHIES[g].forEach((s, i) => {
      const name = `trophy-${g}-${i + 1}`;
      assert.ok(GRAPHICS[name], `missing ${name}`);
      assert.equal(GRAPHICS[name].emoji, s.e, `emoji mismatch for ${name}`);
      assert.equal(s.icon, name, `trophy.icon not stamped for ${name}`);
      count++;
    });
  }
  assert.equal(count, 60);
});

test("every AVAILABLE name exists in GRAPHICS", () => {
  for (const name of AVAILABLE) {
    assert.ok(GRAPHICS[name], `AVAILABLE name ${name} not in GRAPHICS`);
  }
});

// Derived from the themes themselves, not from a copy of them: a hard-coded
// list only tells you that someone once typed the same names twice. This fails
// both when a theme names an icon that does not exist, and when an icon lingers
// in the registry that no theme uses any more.
test("every journey icon a theme names exists, and none is orphaned", () => {
  const named = new Set();
  for (const th of Object.values(THEMES)) {
    named.add(th.goal);
    for (const o of th.obstacles) named.add(o);
  }
  assert.equal(named.size, 15, `themes name ${named.size} journey icons`);
  for (const name of named) assert.ok(GRAPHICS[name], `theme names a missing icon: ${name}`);

  const orphans = Object.keys(GRAPHICS).filter((k) => k.startsWith("j-") && !named.has(k));
  assert.deepEqual(orphans, [], `journey icons no theme uses: ${orphans.join(", ")}`);
});

// The basket standing in the meadow is the scene's one basket. The village's
// first obstacle used to be a second copy of it, twelve pixels wide, and read
// as a duplicate rather than as scenery.
test("the meadow's basket is not also an obstacle on the path", () => {
  for (const th of Object.values(THEMES)) {
    assert.ok(!th.obstacles.includes("ui-basket"), "the scene's basket is not scenery");
    assert.ok(!th.obstacles.some((o) => /basket/.test(o)), `${th.goal}: a second basket confuses`);
  }
});

test("iconHTML fallback contains the emoji and a font-size", () => {
  const html = iconHTML("ui-gear");
  assert.match(html, /⚙️/);
  assert.match(html, /font-size:24px/);
  assert.match(html, /class="gicon"/);
});

test("iconSVG fallback is a centered <text>", () => {
  const svg = iconSVG("ui-star", { x: 10, y: 20 });
  assert.match(svg, /<text/);
  assert.match(svg, /text-anchor="middle"/);
  assert.match(svg, /⭐/);
  assert.match(svg, /x="10"/);
  assert.match(svg, /y="20"/);
});
