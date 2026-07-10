// The round is only saved when it ends (§10.7), so every way off the page is a
// way to lose it. These tests hold the three of them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leaveAction } from "../assets/js/leaveguard.js";

const abs = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(abs(p), "utf8");

test("a leave attempt mid-round asks before it costs stars", () => {
  assert.equal(leaveAction({ inRound: true, confirmOpen: false }), "ask");
});

test("a leave attempt with nothing at stake just goes", () => {
  // the level picker (no session) and the summary (already written to the
  // cookie) must not put a dialog between a child and the map
  assert.equal(leaveAction({ inRound: false, confirmOpen: false }), "leave");
});

// Regression: the sentinel is re-pushed on every pop, so a child swiping twice
// in a second arrives here with the question already on screen. Asking again
// would stack a second sheet; leaving would answer her own question for her.
test("a second swipe answers the open question with 'keep playing'", () => {
  assert.equal(leaveAction({ inRound: true, confirmOpen: true }), "stay");
  assert.equal(leaveAction({ inRound: false, confirmOpen: true }), "stay");
});

// Regression: `overscroll-behavior` was never set, so a downward drag near the
// top of an Android screen reloaded the page and threw the round away. This is
// the whole of the fix, and it is one declaration — easy to lose in a reformat.
test("the page refuses overscroll, so pull-to-refresh cannot eat a round", () => {
  const css = read("assets/css/schlaufuchs.css");
  const root = css.match(/\bhtml,\s*body\s*\{([^}]*)\}/);
  assert.ok(root, "the html, body rule is gone");
  assert.match(root[1], /overscroll-behavior:\s*none/);
});

// The back gesture belongs to the OS; the only defence is owning a history
// entry for it to consume, and re-owning one the moment it is consumed. A guard
// that pushes no sentinel is a guard that never runs.
test("the guard owns a history entry and re-arms after every pop", () => {
  const src = read("assets/js/leaveguard.js");
  assert.match(src, /history\.pushState/, "no sentinel is pushed");
  const pop = src.match(/addEventListener\("popstate",[\s\S]*?\n  \}\);/);
  assert.ok(pop, "nothing listens for popstate");
  assert.match(pop[0], /arm\(\);[\s\S]*attempt\(/, "re-arm must precede the decision");
});

// Regression: the map button sits one tap from the keypad and was a bare <a>.
// It must stay a real link (it says where it goes, and works without JS), and
// the game must be the thing that decides whether the tap is free.
test("the top bar offers the map button to a page that has something to lose", () => {
  const chrome = read("assets/js/chrome.js");
  assert.match(chrome, /onLeave\?\.\(bar\.querySelector\("a\.iconbtn"\)\)/);
  assert.match(chrome, /back !== null/, "the map's own flat button is not a link");

  const game = read("games/einmaleins/einmaleins.js");
  assert.match(game, /onLeave:\s*guard\.guardLink/, "einmaleins does not guard its map button");
  assert.match(game, /inRound:\s*\(\)\s*=>\s*session !== null && !roundOver/);
});
