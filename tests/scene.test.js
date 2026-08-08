// The round's scene (§10.5): sky, meadow, basket, fox. Static checks — the
// flight itself needs a browser and was measured with tools/shoot.mjs, but the
// properties that make it safe are readable here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import { starCluster, starSlotsHTML } from "../assets/js/journey.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, root)), "utf8");

const css = read("assets/css/schlaufuchs.css");
const journey = read("assets/js/journey.js");
const game = read("games/einmaleins/einmaleins.js");
const html = read("games/einmaleins/index.html");
const roundsummary = read("assets/js/roundsummary.js");

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
// appeared inside a picker she never opened. It was then written on each star
// as "×2" — a sentence, aimed at a child who cannot read one. A slot now simply
// holds the stars it pays.
test("a slot holds as many stars as it pays", () => {
  for (const [worth, n] of [[1, 1], [2, 2], [3, 3]]) {
    assert.equal(starCluster(worth).length, n, `worth ${worth} must draw ${n} stars`);
  }
  // a one-star slot keeps the big single star the scene was built around
  assert.deepEqual(starCluster(1), [{ dx: 0, dy: 0, size: 28 }]);

  // two or three stars must share roughly the room one big star took, or the
  // three slots in the sky start colliding with one another
  for (const worth of [2, 3]) {
    for (const { dx, dy, size } of starCluster(worth)) {
      assert.ok(Math.abs(dx) <= 14 && Math.abs(dy) <= 14, `worth ${worth}: (${dx},${dy}) strays`);
      assert.ok(size < 28, `worth ${worth}: a grouped star must be smaller than a lone one`);
    }
  }
  // nothing outside 1..3 can ask for an empty sky or a swarm
  assert.equal(starCluster(0).length, 1);
  assert.equal(starCluster(9).length, 3);
  assert.equal(starCluster(undefined).length, 1);
});

// Regression: a summary slot's viewBox started at y=6, but ⭐ is drawn as a
// <text> glyph that rides ABOVE its baseline — so the tip of the big single
// star (baseline 38, size 44.8) reached y≈-2 and was sheared off the top, with
// dead space left below. Making the star smaller could not help: the glyph is
// clipped by the window, not by its own size. The window must clear the glyph
// on every side, for every worth.
test("the summary's star slot never shears a star's tip", () => {
  // Emoji glyph extents relative to its baseline, as fractions of font-size:
  // the tip rides ~0.85 above the baseline, the foot ~0.15 below. Conservative
  // bounds — a real ⭐ sits inside them in the fonts we ship to.
  const RISE = 0.85, DROP = 0.15;
  for (const worth of [1, 2, 3]) {
    // three identical slots come back; one carries the whole cluster
    const full = starSlotsHTML(3, worth, 0);
    const slot = full.slice(0, full.indexOf("</svg>"));
    const vb = slot.match(/viewBox="(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)"/);
    assert.ok(vb, `worth ${worth}: a slot must carry a viewBox`);
    const [top, height] = [Number(vb[2]), Number(vb[4])];
    const bottom = top + height;
    const stars = [...slot.matchAll(/<text[^>]*\by="(-?[\d.]+)"[^>]*\bfont-size="([\d.]+)"/g)];
    assert.equal(stars.length, worth, `worth ${worth}: expected ${worth} star glyphs`);
    for (const m of stars) {
      const y = Number(m[1]), fs = Number(m[2]);
      assert.ok(y - RISE * fs >= top, `worth ${worth}: a star's tip (${(y - RISE * fs).toFixed(1)}) is sheared off the top (${top})`);
      assert.ok(y + DROP * fs <= bottom, `worth ${worth}: a star's foot is clipped at the bottom`);
    }
  }
});

test("every star in a slot flies into the basket, and none is left in the sky", () => {
  // ONE group per slot, and the whole cluster inside it: the group is what
  // moves. Given a keyframe each, none of them would move under reduced motion.
  const loop = journey.slice(journey.indexOf("for (let i = 0; i < SLOTS; i++) {"), journey.indexOf(".j-fox"));
  assert.match(loop, /<g class="j-star"[\s\S]*?clusterAt\(g\.sky\[i\]\.x, g\.sky\[i\]\.y, ""\)/,
    "the cluster must be a child of the flying group");
  assert.ok(!/j-worth/.test(journey) && !/j-worth/.test(css), "the ×N tag is retired, everywhere");

  // the ghost slot is the same shape, or a collected slot would not match the
  // hole it left behind
  assert.match(journey, /clusterAt\(g\.sky\[i\]\.x, g\.sky\[i\]\.y, "j-ghost"\)/);
  assert.match(game, /worth: starValue\(diff\)/, "the round tells the scene what its stars are worth");
});

// Every asked task is its own waypoint (§10.5): the fox steps forward when a
// task ends, however it went — a missed one onto a RED node, and the path
// grows by the re-queued ask. Martin watched the fox freeze on a node while
// new questions kept coming; this pins the cure in ALL games, because a
// forgotten advanceMissed() would reproduce exactly that, silently.
test("every asked task is its own waypoint — a missed one steps onto a red node", () => {
  assert.match(journey, /advanceMissed\(\)/, "journey.js must offer the missed step");
  assert.match(journey, /count \+= 1;\s*\n\s*render\(\);/, "a missed step must grow the path and re-render");
  assert.match(css, /\.journey \.j-node\.missed \{/, "the red waypoint must be styled");
  for (const g of ["einmaleins/einmaleins", "lesen/lesen", "rechnungen/rechnungen"]) {
    const src = read(`games/${g}.js`);
    assert.match(src, /journey\.advanceMissed\(\)/, `${g}.js never takes the missed step`);
  }
});

// On a short round the ⭐⭐ and ⭐⭐⭐ thresholds fall on the same last task
// (80 % and 100 % of three tasks are both "all three"), and two groups leaving
// one waypoint together read as a glitch (Martin, third play-test). At most ONE
// star group flies per waypoint; whatever is still owed lands with the fox at
// the basket.
test("at most one star group lands per waypoint", () => {
  assert.match(journey, /Math\.min\(want, Math\.max\(owned, 0\) \+ 1\)/,
    "setStars must throttle its landings to one group per call");
  const fin = journey.slice(journey.indexOf("finish() {"));
  assert.match(fin, /land\(want, true\)/, "finish() must fly the owed groups at the basket");
  // the rebuild after a missed step re-lands only what had landed — flushing
  // the backlog there would collect a group on the missed waypoint
  const rerender = journey.slice(journey.indexOf("const held = owned"), journey.indexOf("function moveFox"));
  assert.match(rerender, /land\(Math\.max\(held, 0\), false\)/, "a re-render must not flush the backlog");
});

// The round summary paints the stars as the GROUPS they are won in (§10.1) —
// the same slots the sky holds — in EVERY game. A numeric score line or a
// loose "⭐".repeat count sneaking back would fail here, not in a play-test.
test("every game's summary shows star groups, never a score line", () => {
  // The groups are painted once, by the shared summary; each game only feeds it.
  assert.match(roundsummary, /starSlotsHTML\(/, "the shared summary must paint the star groups");
  for (const g of ["einmaleins/einmaleins", "lesen/lesen", "rechnungen/rechnungen"]) {
    const src = read(`games/${g}.js`);
    assert.match(src, /showSummary\(/, `${g}.js must hand the round to the shared summary`);
    assert.ok(!src.includes("roundStat"), `${g}.js still paints the numeric score line`);
    assert.ok(!/"⭐"\.repeat/.test(src), `${g}.js still paints loose stars`);
    assert.ok(!read(`games/${g.split("/")[0]}/index.html`).includes("sum-score"),
      `${g}: the score line is still in the markup`);
  }
  // the slot builder itself: three slots, gold/fresh/ghost states
  assert.match(journey, /export function starSlotsHTML/, "journey.js must offer the slot builder");
});

// Two lines of the summary sheet are OPTIONAL: "Neuer Rekord!" and the tempo
// medal. A game may carry neither — drachen (§21) has no tempo ladder, and a
// record line says nothing about finding a story's next ending. Reaching
// straight through the lookup would throw on that game's first finished round,
// and nothing else would catch it: tests/cache.test.js greps
// `getElementById(...).`, and the summary uses a `$()` alias.
test("the summary's optional lines are optional", () => {
  for (const id of ["sum-best", "sum-tempo"]) {
    assert.ok(!new RegExp(`\\$\\("${id}"\\)\\s*\\.`).test(roundsummary),
      `roundsummary.js reaches through $("${id}") — a sheet without it throws`);
  }
  // …and the three mandatory ones are still mandatory, or "optional" would
  // quietly become "the summary paints nothing".
  for (const id of ["sum-stars", "sum-trophy", "sum-ok"]) {
    assert.ok(roundsummary.includes(`$("${id}")`), `roundsummary.js no longer paints #${id}`);
  }
});

// The scene is the tallest thing in the stage after the aid card, and the aid
// card holds ten rows of dots. They must never be on screen together.
test("the scene yields the stage to the feedback aid", () => {
  assert.match(css, /\.stage:has\(#feedback:not\(\[hidden\]\)\) \.journey-wrap \{ display: none; \}/);
});

// A reading question keeps the scene on screen so the child always sees how far
// she is (§14.2) — it does NOT hide the journey the way the old passage layout
// did. It only draws it compact, to leave room for the passage and question.
test("the scene stays for a reading question, only smaller", () => {
  assert.ok(
    !/\.stage:has\(#wordcard\.read\)\s+\.journey-wrap\s*\{[^}]*display:\s*none/.test(css),
    "a reading question must not hide the journey — the stars have to stay visible",
  );
  assert.match(css, /\.stage:has\(#wordcard\.read\) \.journey \{ max-width:/,
    "the reading journey is drawn compact so passage + question + answers still fit");
});

// The reading question is set in the SAME body font as the passage (§14.2): a
// bold display-face question stood out, and a child could skim to it and answer
// without reading the passage. Guard against a revert to the display face.
test("the reading question shares the passage's body font", () => {
  const start = css.indexOf(".wordcard .passage,");
  assert.ok(start >= 0, "the passage and the reading question must share one rule");
  const rule = css.slice(start, css.indexOf("}", start) + 1);
  assert.match(rule, /\.wordcard\.read \.question/, "the question must be in that shared rule");
  assert.match(rule, /font-family: var\(--font-body\)/,
    "the reading question must use the body font, not the bold display face");
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
  // The refresh belongs to PAINTING, not to opening: a game may paint the sheet
  // long before it shows it (drachen banks the ending's star while the child is
  // still reading the ending, §21.3), and for that whole beat the bar would go
  // on reading "⭐ 0" over a star that is already in the store. Bound the slice
  // to `paint` — reading to the end of the file let this pass on an unrelated
  // refresh, a guard that guarded nothing.
  const paint = roundsummary.slice(
    roundsummary.indexOf("function paint("),
    roundsummary.indexOf("function reveal("),
  );
  assert.ok(paint.length > 0, "the summary must still have a paint step");
  assert.ok(paint.includes("refresh()"), "the summary must refresh the chip it just invalidated");
  const reveal = roundsummary.slice(roundsummary.indexOf("function reveal("));
  assert.ok(!reveal.slice(0, reveal.indexOf("}")).includes("refresh()"),
    "refreshing on reveal would leave the bar stale for the whole beat before it");

  // …and each game supplies that refresh over its real top bar.
  for (const g of ["einmaleins/einmaleins", "lesen/lesen", "rechnungen/rechnungen", "drachen/drachen"]) {
    assert.match(read(`games/${g}.js`), /refresh: \(\) => bar\.refresh\(\)/,
      `${g}.js must hand the summary its top bar`);
  }
});
