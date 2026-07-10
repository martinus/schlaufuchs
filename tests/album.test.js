// The trophy album (§3.2). Mara scrolled down its shelves, wanted to leave, and
// could not: the only way back to the map was a small button that had scrolled
// off the top. She also read the locked slots' "20×" tooltip as twenty of
// something — on a phone she could not have seen it at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { read } from "./pages.js";
import { GAMES, THRESHOLDS, TROPHIES_PER_GAME } from "../assets/js/rewards.js";

const css = read("assets/css/schlaufuchs.css");
const html = read("album.html");
const js = read("assets/js/album.js");

test("the bar follows the child down the shelves", () => {
  const rule = css.slice(css.indexOf(".trophyroom .topbar {"));
  const block = rule.slice(0, rule.indexOf("}"));
  assert.match(block, /position: sticky/);
  assert.match(block, /top: 0/);
  assert.match(block, /background:/, "a transparent sticky bar has trophies scrolling through it");
});

test("the room has a door at the bottom, not only at the top", () => {
  assert.match(html, /class="primary maplink"[\s\S]*?href="\.\/"/, "a big link back to the map");
  assert.match(html, /data-i18n="back"/);
  // Regression (§ icons and i18n don't mix): translateDOM overwrites the
  // textContent of a [data-i18n] node, so the icon must be its own sibling.
  assert.ok(
    !/data-i18n="back">[^<]*🗺/.test(html),
    "an icon inside a [data-i18n] element is erased on the first translation",
  );
  assert.match(css, /\.maplink \{/, "…and it must be styled as a door");
});

test("a locked slot says what it costs, where a child can see it", () => {
  assert.ok(!js.includes('title="'), "a tooltip is invisible on a phone");
  assert.match(js, /class="sfoot">⭐ \$\{need\}/, "the price, in the one currency there is");
  assert.match(js, /class="sbar"/, "and the next slot shows how far along she is");
  // the bar belongs to the slot she is working on, not to every locked slot
  assert.match(js, /i === earned\s*\?\s*`<span class="sbar">/);
  assert.match(js, /aria-label="\$\{t\("trophyLocked"\)\} — ⭐ \$\{need\}"/);
  for (const sel of [".trophies .slot.locked .sfoot", ".trophies .slot.locked .sbar"]) {
    assert.ok(css.includes(`${sel} {`), `${sel} is unstyled`);
  }
});

test("the progress bar can never overflow its track", () => {
  // `pr` outgrows the threshold the moment the trophy is won and the render
  // races the state; Math.min keeps a 140%-wide bar out of the layout.
  assert.match(js, /Math\.min\(100,/);
  for (const game of GAMES) {
    assert.equal(THRESHOLDS[game].length, TROPHIES_PER_GAME, `${game}: a slot with no price`);
    const rising = THRESHOLDS[game].every((n, i, a) => i === 0 || n > a[i - 1]);
    assert.ok(rising, `${game}: thresholds must rise, or a bar would divide by a smaller one`);
    assert.ok(THRESHOLDS[game][0] > 0, `${game}: a zero threshold divides by zero`);
  }
});

test("the album draws the shared trophy card", () => {
  assert.match(js, /trophycard\.js/);
  assert.ok(!/<div class="slot">/.test(js), "the earned slot must not build its own markup");
});

// The room named itself twice — once in the bar's own heading and once here —
// and then explained the star economy in a paragraph, to a five-year-old.
test("the room says what it is with its symbol, not with a sentence", () => {
  assert.ok(!html.includes('id="totalcount"'), "the top bar already counts the trophies");
  assert.ok(!html.includes("roomIntro"), "a paragraph nobody reads is a paragraph");
  assert.match(html, /class="roomsymbol"[\s\S]*?data-i18n-label="region_pokalraum"/,
    "the name survives for screen readers, on the heading");
  assert.match(html, /data-icon="region-pokalraum"/, "…and the eye gets the map's own symbol");
  assert.match(css, /\.roomhead \.roomsymbol \{/);
  // Regression (§ icons and i18n don't mix): translateDOM would erase an icon
  // sitting inside a [data-i18n] node. `data-i18n-label` touches aria-label only.
  assert.ok(!/data-i18n="region_pokalraum"/.test(html));
});

// A trophy on a 77px shelf slot is a receipt. A child wants to hold it up.
test("tapping a trophy she owns holds it up, loudly", () => {
  assert.match(js, /button: true/, "an earned slot must be a button, not a div with a listener");
  assert.match(js, /data-trophy="\$\{game\}:\$\{i\}"/, "…and it must say which trophy it is");
  assert.match(js, /closest\("\.slot\.earned"\)/, "one delegated listener, not one per card");
  assert.match(js, /confetti\(/, "confetti");
  assert.match(js, /foxSVG\(\{ pose: "cheer"/, "a fox that cheers");
  assert.match(js, /sfx\.trophy\(\)/, "and a sound");
  for (const sel of [".sc-stage", ".sc-sparks i", ".sc-fox", ".sc-card .tcard"]) {
    assert.ok(css.includes(`${sel} {`), `${sel} is unstyled`);
  }
  // The overlay contract, not a hand-rolled .hidden toggle (§3.3).
  assert.match(js, /createOverlay\(/);
  // A locked slot is not a door: it has nothing to show yet.
  assert.ok(!/class="slot locked"[^>]*data-trophy/.test(js));
});

test("the showcase's noise stops for a child who asked it to", () => {
  // §15: the blink and the hop are CSS animations, so the site-wide
  // prefers-reduced-motion rule silences both. Confetti no-ops on its own.
  for (const kf of ["@keyframes sc-twinkle", "@keyframes sc-hop"]) {
    assert.ok(css.includes(kf), `${kf} must be a CSS animation, not a JS loop`);
  }
  assert.match(read("assets/js/confetti.js"), /prefers-reduced-motion/);
});
