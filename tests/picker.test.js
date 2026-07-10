// The level picker's tile chrome (§10.2). These guard the two things a browser
// screenshot showed and a diff hid: the current tile drew two orange rings, and
// the grid is three to a row.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../assets/css/schlaufuchs.css", import.meta.url)), "utf8");

const ruleFor = (selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} rule is gone`);
  return css.slice(at, css.indexOf("}", at));
};

// Regression: the current tile is the one the picker focuses on open, so the
// orange `:focus-visible` outline landed on top of an inset orange box-shadow
// ring — two concentric red rings on the one tile a child looks at first. The
// fix makes `.current` an outline (it outranks `:focus-visible`, so the two
// collapse into one). If anyone gives it an inset orange box-shadow again, the
// doubling comes back — invisibly to every test but this one.
test("the current tile shows one orange ring, not two", () => {
  const rule = ruleFor(".tilegrid button.current");
  assert.match(rule, /outline:\s*3px solid var\(--orange\)/, "the ring must be an outline, to fold into :focus-visible");
  assert.doesNotMatch(
    rule,
    /box-shadow:[^;]*inset[^;]*var\(--orange\)/,
    "an inset orange ring under the focus outline is the two-ring bug",
  );
});

// Regression: four tiles to a row squeezed a Schwer tile's nine stars and its
// tempo medal into ~73px. Three is the whole point of the redesign (§10.2).
test("the level grid is three tiles to a row", () => {
  assert.match(ruleFor(".tilegrid"), /grid-template-columns:\s*repeat\(3, 1fr\)/);
});
