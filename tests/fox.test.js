// The fox wears nothing, and the chip beside him says exactly three things.
//
// The mascot used to grow a cap, glasses, a backpack, a medal and two crowns
// out of the star count (§8.4), and the chip carried a progress bar toward the
// next one. Both are gone. These tests fail on that older fox: it rendered a
// different animal for a different `stars` argument, and the chip's markup had
// a `bar` in it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { foxSVG } from "../assets/js/fox.js";
import { read } from "./pages.js";

const fox = read("assets/js/fox.js");
const chrome = read("assets/js/chrome.js");

test("the fox looks the same no matter how many stars were collected", () => {
  const plain = foxSVG({ pose: "neutral" });
  for (const stars of [0, 20, 50, 170, 9999]) {
    assert.equal(foxSVG({ pose: "neutral", stars }), plain, `${stars} stars changed the fox`);
  }
  // the pose is the only thing that may
  assert.notEqual(foxSVG({ pose: "cheer" }), plain);
});

test("no cosmetic layer survives in fox.js", () => {
  for (const gone of ["cap", "crown", "goldcrown", "glasses", "backpack", "medal", "scarf"]) {
    assert.ok(!new RegExp(`"${gone}"`).test(fox), `fox.js still knows about the ${gone}`);
  }
  // the outfit was the fox's only reason to read the reward state
  assert.ok(!/rewards\.js/.test(fox), "fox.js must not import the reward system");
});

test("the chip shows the fox, the stars and the trophies — and nothing else", () => {
  const chip = chrome.slice(chrome.indexOf("export function renderFoxChip"));
  const body = chip.slice(0, chip.indexOf("\n}"));

  assert.match(body, /foxSVG\(/, "the fox");
  assert.match(body, /iconHTML\("ui-star"/, "the star count");
  assert.match(body, /iconHTML\("deco-trophy"/, "the trophy count");

  for (const gone of ["bar", "sub", "streak", "foxMax", "foxNext"]) {
    assert.ok(!body.includes(gone), `the chip still carries its ${gone}`);
  }
});
