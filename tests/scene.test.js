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
