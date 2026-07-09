// The round's scene (§10.5): sky, meadow, basket, fox. Static checks — the
// flight itself needs a browser and was measured with tools/shoot.mjs, but the
// properties that make it safe are readable here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, root)), "utf8");

const css = read("assets/css/schlaufuchs.css");
const journey = read("assets/js/journey.js");
const game = read("games/einmaleins/einmaleins.js");
const html = read("games/einmaleins/index.html");

// The site-wide reduced-motion rule kills `animation` and `transition`, and
// nothing else. A star moved by a keyframe animation would therefore never
// arrive — it would hang in the sky for exactly the children who asked for
// calm. Moving it with `transform` + `transition` degrades to "already there".
test("a star reaches the basket even with prefers-reduced-motion", () => {
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\* \{ animation: none !important; transition: none !important; \}/,
    "the site-wide reduced-motion rule must still be there",
  );
  const flight = css.slice(css.indexOf(".journey .j-star {"), css.indexOf(".journey .j-star.j-instant"));
  assert.match(flight, /transition: transform/, "the flight is a transition, not an animation");
  assert.ok(!/animation:/.test(flight), "an animation would never land under reduced motion");
  assert.match(css, /\.journey \.j-star\.landed \{[^}]*transform: translate/, "landing is a transform");
});

// Mara could not tell that Mittel and Schwer pay more: the claim only ever
// appeared inside a picker she never opened. Now each sky star carries what it
// counts, and carries it into the basket.
test("a star that counts double says so, and says it all the way down", () => {
  const loop = journey.slice(journey.indexOf("const tag = worth > 1"), journey.indexOf('+ "</g>"'));
  assert.match(loop, /j-worth/, "the tag must exist");
  assert.match(loop, /×\$\{worth\}/);
  // INSIDE the group: the group is what moves, so the tag rides the transition.
  // Given its own keyframe it would never move under prefers-reduced-motion.
  assert.ok(loop.indexOf("j-star") < loop.indexOf("+ tag"), "the tag is a child of the flying star");
  assert.ok(!/animation/.test(css.slice(css.indexOf(".journey .j-worth {"), css.indexOf("}", css.indexOf(".journey .j-worth {")))));

  // worth 1 is the default and prints nothing: "×1" is noise on every Leicht round
  assert.match(journey, /worth = 1/, "the default must be silent");
  assert.match(journey, /worth > 1\s*\n?\s*\?/, "…and only >1 draws a tag");
  assert.match(game, /worth: starValue\(diff\)/, "the round tells the scene what its stars are worth");
});

// The scene is the tallest thing in the stage after the aid card, and the aid
// card holds ten rows of dots. They must never be on screen together.
test("the scene yields the stage to the feedback aid", () => {
  assert.match(css, /\.stage:has\(#feedback:not\(\[hidden\]\)\) \.journey-wrap \{ display: none; \}/);
});

// Regression: the round showed a goal line in the body face at 0.8rem, next to
// display-face text, and it promised stars on a tile that could pay none.
test("the scene carries no prose, and the dead strings are gone", () => {
  for (const id of ["statusrow", "hotstreak", "goalline", "basket"]) {
    assert.ok(!html.includes(`id="${id}"`), `${id} is gone from the markup`);
  }
  assert.ok(!/\bhot\b/.test(game), "the streak counter is gone from the game");
  for (const dead of ["hotStreak", "basketGoal", "basketHave"]) {
    assert.equal(de[dead], undefined, `de.js still has ${dead}`);
    assert.equal(en[dead], undefined, `en.js still has ${dead}`);
  }
  // one string survives, and it is never painted: it names the scene for a
  // screen reader, which cannot see a basket
  assert.equal(typeof de.starsOwned, "string");
  assert.equal(typeof en.starsOwned, "string");
  assert.match(game, /setAttribute\("aria-label", t\("starsOwned"/);
});

// The basket must open holding the tile's best stars, or a mastered tile would
// promise a star that endRound() will not pay (`improved = stars > old`).
test("the round hands the scene the tile's best stars", () => {
  assert.match(game, /best = starDigit\(/, "the round must read the tile's best score");
  assert.match(game, /stars: best,/, "…and hand it to the scene at creation");
  assert.match(game, /ownedStars\(session\.progress\(\), best\)/, "…and keep using it as the round runs");
  assert.match(journey, /setStars\(stars, \{ animate: false \}\)/, "no flight for stars won long ago");
});

// Regression: the chip was rendered at startRound() and nowhere else, so the
// top bar still read "⭐ 0" while three stars lit up in the summary beneath it.
// The child only saw the real count after walking back to the map.
test("the star chip is refreshed when the round changes the stars", () => {
  const endRound = game.slice(game.indexOf("function endRound()"));
  // Bound the slice to the setTimeout body. Reading to the end of the file made
  // this test pass on the settings overlay's own refresh, so it stayed green
  // with the summary's call deleted — a guard that guarded nothing.
  const open = endRound.indexOf("setTimeout(");
  const close = endRound.indexOf("}, 700);", open);
  assert.ok(close > open, "the summary is still painted inside a setTimeout");
  const painted = endRound.slice(open, close);

  assert.ok(
    painted.includes("bar.refresh()"),
    "the summary must refresh the chip it just invalidated",
  );
});
