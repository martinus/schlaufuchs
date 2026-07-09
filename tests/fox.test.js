// The fox wears nothing, and the chip beside him says exactly three things.
//
// The mascot used to grow a cap, glasses, a backpack, a medal and two crowns
// out of the star count (§8.4), and the chip carried a progress bar toward the
// next one. Both are gone. These tests fail on that older fox: it rendered a
// different animal for a different `stars` argument, and the chip's markup had
// a `bar` in it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { foxSVG } from "../assets/js/fox.js";
import { GAMES } from "../assets/js/rewards.js";

const abs = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const fox = readFileSync(abs("assets/js/fox.js"), "utf8");
const chrome = readFileSync(abs("assets/js/chrome.js"), "utf8");

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

// Every screen a child can reach wears the same bar: map button, fox chip,
// gear. The Trophy Room was the exception — it carried its title as a chip and
// had no gear at all — and an exception is what a child notices.
test("every child-facing page carries the same top bar (§3.3)", () => {
  const pages = ["index.html", "album.html", ...GAMES.map((g) => `games/${g}/index.html`)];
  for (const page of pages) {
    const html = readFileSync(abs(page), "utf8");
    const bar = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    assert.ok(bar.length > 0, `${page} has no top bar`);
    assert.match(bar, /data-icon="ui-map"/, `${page}: no map button`);
    assert.match(bar, /class="foxchip" id="foxchip"/, `${page}: no fox chip`);
    assert.match(bar, /id="gearbtn"/, `${page}: no settings gear`);
    // and nothing else: the bar holds three children, no chips, no spacers
    assert.ok(!bar.includes("spacer"), `${page}: the bar still has a spacer in it`);
    assert.ok(!/class="[^"]*\bchip\b/.test(bar), `${page}: a chip sits in the top bar`);
  }
});

// A page that renders the chip in its markup but never fills it shows an empty
// box. `pave("einmaleins")` taught us that a silent no-op looks like a feature.
test("every page with a fox chip also renders and wires one", () => {
  // The four stubs carry their module inline in the page; the others import.
  const modules = {
    "index.html": ["assets/js/map.js"],
    "album.html": ["assets/js/album.js"],
    "games/einmaleins/index.html": ["games/einmaleins/einmaleins.js"],
    ...Object.fromEntries(GAMES.filter((g) => g !== "einmaleins")
      .map((g) => [`games/${g}/index.html`, []])),
  };
  for (const [page, extra] of Object.entries(modules)) {
    const src = [page, ...extra].map((f) => readFileSync(abs(f), "utf8")).join("\n");
    assert.match(src, /renderFoxChip\(/, `${page}: the chip is never filled`);
    assert.match(src, /initSettingsOverlay\(/, `${page}: the gear opens nothing`);
    assert.match(src, /"gearbtn"[^\n]*addEventListener/, `${page}: the gear is never wired`);
  }
});
