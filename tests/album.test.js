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
