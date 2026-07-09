import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPHICS, AVAILABLE, iconHTML, iconSVG } from "../assets/js/graphics.js";
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

test("all 15 journey icon names resolve", () => {
  const jNames = [
    "j-basket", "j-rooster", "j-door", "j-rock", "j-bridge", "j-troll",
    "j-mushroom", "j-hedgehog", "j-butterfly", "j-flower", "j-bee",
    "j-goal-bell", "j-goal-flag", "j-goal-sparkle", "j-goal-book",
  ];
  for (const name of jNames) assert.ok(GRAPHICS[name], `missing ${name}`);
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
