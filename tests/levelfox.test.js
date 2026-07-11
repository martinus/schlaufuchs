// The fox in the level picker (§10.2).
//
// The animation cannot be read in a diff, so the arithmetic under it is pure.
// What these tests guard is what a child sees: the fox stands ON the tile she
// is playing — both feet on it, centred, not sunk into it and not floating over
// the one below — and it walks from tile to tile with the island's own gait.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tileAnchor, foxOrigin, FOX_SIZE } from "../assets/js/levelfox.js";
import { walkPoint } from "../assets/js/mapwalk.js";
import { read } from "./pages.js";

// A tile as the picker lays them out: 76px tall, four to a row.
const tile = (offsetLeft, offsetTop) => ({
  offsetLeft, offsetTop, offsetWidth: 78, offsetHeight: 76,
});

test("the fox's feet land on the bottom centre of a tile", () => {
  const [x, y] = tileAnchor(tile(0, 0));
  assert.equal(x, 39, "the fox is centred on its tile");
  assert.ok(y > 64 && y < 76, `the feet must be near the tile's lower edge (${y})`);

  // …and the fox must leave the tile's own art room to be read: a fox that
  // reaches the top row of stars hides what the tile is promising.
  const [, top] = foxOrigin([x, y], FOX_SIZE);
  assert.ok(top > 40, `the fox reaches up to ${top}, into the tile's stars`);
});

test("the fox stands on its tile, neither sunk into it nor hovering over it", () => {
  const t = tile(20, 100);
  const [x, y] = tileAnchor(t);
  const [left, top] = foxOrigin([x, y], FOX_SIZE);

  // horizontally centred on the tile
  assert.equal(left + FOX_SIZE / 2, x);
  // The drawing's feet sit at 85% of its box. A fox positioned by its own
  // bottom edge would sink 6px into the tile; one positioned by its centre
  // would hover. Both looked like a bug in the screenshot, not like a fox.
  const feet = top + FOX_SIZE * 0.85;
  assert.ok(Math.abs(feet - y) < 0.001, `the feet are at ${feet}, the ground at ${y}`);

  // and the whole fox is above the ground it stands on
  assert.ok(top < y, "the fox is drawn upwards from its feet");
  assert.ok(y <= t.offsetTop + t.offsetHeight, "its feet never leave the tile");
});

test("a walk starts under the fox and ends on the tile she tapped", () => {
  const from = tileAnchor(tile(0, 0));
  const to = tileAnchor(tile(180, 300));
  assert.deepEqual(walkPoint(from, to, 0), from);
  assert.deepEqual(walkPoint(from, to, 1), to);
});

// The whole point of the change: the level does not open until the fox is
// standing on it. A `startRound()` reachable from the tile's click handler
// without going through the walk would put the child in a round while the fox
// is still mid-air two tiles away.
test("a tile opens its level only once the fox has arrived", () => {
  const src = read("games/einmaleins/picker.js");
  const choose = src.slice(src.indexOf("function chooseLevel"), src.indexOf("function render"));
  assert.match(choose, /walkTo\(tile, \(\) => openLevel\(/, "the walk must open the level");
  assert.ok(!/onPick\(/.test(choose), "chooseLevel must not open a level itself");
  // …except when the fox is already there: no walk, no wait.
  assert.match(choose, /if \(d === cur\.diff && tbl === cur\.table\) return openLevel/);
  // and a second tap during a walk cannot start a second one
  assert.match(choose, /if \(levelFox\?\.walking\) return/);
});

// `onDismiss` reads `roundOver` and `session`, and `startRound` writes both.
// Close the picker first and the summary of the round she just walked away from
// opens on top of the round she just chose. The contract has two halves now:
// picker.js promises `onPick` runs before the overlay closes, and einmaleins.js
// promises `onPick` is the round's start.
test("a chosen level starts before the picker closes over it", () => {
  const picker = read("games/einmaleins/picker.js");
  const open = picker.slice(picker.indexOf("function openLevel"), picker.indexOf("function chooseLevel"));
  assert.ok(
    open.indexOf("onPick(") >= 0 && open.indexOf("onPick(") < open.indexOf("overlay.close();"),
    "the picker must close onto a round that already exists",
  );
  const game = read("games/einmaleins/einmaleins.js");
  const pick = game.slice(game.indexOf("onPick(d, tbl) {"), game.indexOf("onDismiss()"));
  assert.match(pick, /startRound\(\);/, "onPick is where the round begins");
});

test("the game opens on its levels, and every round ends back on them", () => {
  const src = read("games/einmaleins/einmaleins.js");
  // The module used to end in a bare `picker.open()`. With the round mirror
  // (§10.7) the picker is the fallback: an interrupted round resumes instead,
  // and everything else still lands in the picker.
  assert.match(src, /picker\.open\(\);/, "the game must open in the level picker when nothing resumes");
  assert.match(src, /loadRound\("einmaleins"\)/, "…after asking for an interrupted round first");
  assert.match(src, /\$\("sum-ok"\)\.addEventListener\("click", picker\.open\)/);
  assert.ok(
    !/addEventListener\("click", startRound\)/.test(src),
    "the summary must not restart a round behind the child's back",
  );
});

// Dismissing the picker at startup used to be impossible — there was no picker.
// Now Escape and a backdrop tap can leave a child in front of an empty stage.
test("a dismissed picker never leaves the stage empty", () => {
  const game = read("games/einmaleins/einmaleins.js");
  const dismiss = game.slice(game.indexOf("onDismiss() {"), game.indexOf("const summary"));
  assert.match(dismiss, /if \(roundOver\) summary\.open\(\)/, "a finished round shows its summary again");
  assert.match(dismiss, /else if \(!session\) startRound\(\)/, "no round behind it: start one");
  // the walking guard lives in the picker, in front of every dismissal
  const picker = read("games/einmaleins/picker.js");
  const onClose = picker.slice(picker.indexOf("onClose() {"), picker.indexOf("function openLevel"));
  assert.match(onClose, /if \(levelFox\?\.walking\) return/, "a walk in flight owns what happens next");
  assert.match(onClose, /onDismiss\(\)/, "everything else is the game's decision");
});

test("the fox on the tile is drawn, and said", () => {
  // It is aria-hidden, so a screen reader is told in words where the fox
  // stands. The string is shared: every game's picker speaks it (§3.3).
  const src = read("games/einmaleins/picker.js");
  assert.match(src, /t\("tileHere"\)/);
  assert.match(read("assets/i18n/de.js"), /tileHere: "hier stehst du"/);
  assert.match(read("assets/i18n/en.js"), /tileHere: "you are here"/);
});

test("the fox scrolls with the tiles instead of sailing over them", () => {
  const css = read("assets/css/schlaufuchs.css");
  // `tileAnchor` reads offsetLeft/offsetTop, which are relative to the nearest
  // positioned ancestor. If `.levels` is not it, the fox lands in the overlay's
  // coordinates and stays put while the list scrolls under it.
  assert.match(css, /\.levels \{\s*position: relative;/);
  assert.match(css, /\.lvl-fox \{[^}]*position: absolute;/);
  assert.match(css, /\.lvl-fox \{[^}]*pointer-events: none;/);
});
