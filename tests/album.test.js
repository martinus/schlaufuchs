// The trophy album (§3.2). Mara scrolled down its shelves, wanted to leave, and
// could not: the only way back to the map was a small button that had scrolled
// off the top. She also read the locked slots' "20×" tooltip as twenty of
// something — on a phone she could not have seen it at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { read } from "./pages.js";
import { GAMES, THRESHOLDS, TROPHIES_PER_GAME } from "../assets/js/rewards.js";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";

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

// Mara could not get out of this room: the way back was a button at the very
// top and she had scrolled past it. The bar was then made sticky (above) AND a
// second big button was put at the foot of the shelves — two doors side by
// side. The sticky one travels with her, so it is the one that stays.
test("the room has exactly one door, and it follows the child", () => {
  assert.match(js, /initTopBar\(\{ back: "\.\/"/, "the sticky bar carries the map button");
  assert.ok(!html.includes("maplink"), "a second door at the foot of the shelves");
  assert.ok(!css.includes(".maplink"), "…and its rule must go with it");
});

test("a locked slot says what it costs, where a child can see it", () => {
  assert.ok(!js.includes('title="'), "a tooltip is invisible on a phone");
  assert.match(js, /class="sfoot">⭐ \$\{need\}/, "the price, in the one currency there is");
  assert.match(js, /class="sbar"/, "and the next slot shows how far along she is");
  // the bar belongs to the slot she is working on, not to every locked slot
  assert.match(js, /if \(i === earned && next\) \{/);
  for (const sel of [".trophies .slot.locked .sfoot", ".trophies .slot.locked .sbar"]) {
    assert.ok(css.includes(`${sel} {`), `${sel} is unstyled`);
  }
});

// "Noch 2 ⭐ bis zum nächsten Pokal" sat above the shelf, and the trophy it was
// talking about was three slots to the right. The number belongs in that slot.
test("what the next trophy still costs is written in the next trophy", () => {
  assert.ok(!js.includes("album-progress"), "the sentence above the shelf is retired");
  assert.ok(!css.includes(".album-progress"), "…and its rule with it");
  assert.ok(!("trophyAllDone" in de) && !("trophyAllDone" in en), "…and its strings");

  assert.match(js, /class="sfoot snext">\+\$\{owed\} ⭐/, "the debt, under its own bar");
  assert.ok(js.indexOf('class="sbar"') < js.indexOf('class="sfoot snext"'), "under, not over");
  assert.ok(css.includes(".trophies .slot.locked .sfoot.snext {"), "and it must not read as a price");

  // A screen reader gets the sentence the sighted child no longer needs.
  assert.match(js, /t\("trophyNextIn1"\)/);
  assert.match(js, /t\("trophyNextIn", \{ n: owed \}\)/);
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
  assert.match(js, /openShowcase\(TROPHIES\[game\]\[Number\(i\)\]\)/);
  // A locked slot is not a door: it has nothing to show yet.
  assert.ok(!/class="slot locked"[^>]*data-trophy/.test(js));
});

// The celebration is one screen, and both places that own a trophy open it.
// The round summary's card used to be a *link to this room*, which celebrated by
// taking the child out of her finished round and dropping her among empty slots.
test("the shelf and the round summary hold a trophy up the same way", () => {
  const sc = read("assets/js/showcase.js");
  assert.match(sc, /confetti\(/, "confetti");
  assert.match(sc, /foxSVG\(\{ pose: "cheer"/, "a fox that cheers");
  assert.match(sc, /sfx\.trophy\(\)/, "and a sound");
  assert.match(sc, /createOverlay\(/, "the overlay contract, not a hand-rolled .hidden toggle (§3.3)");
  for (const sel of [".sc-stage", ".sc-sparks i", ".sc-fox", ".sc-card .tcard"]) {
    assert.ok(css.includes(`${sel} {`), `${sel} is unstyled`);
  }

  for (const f of ["assets/js/album.js", "games/einmaleins/einmaleins.js"]) {
    assert.match(read(f), /openShowcase/, `${f} must not build its own celebration`);
    assert.ok(!read(f).includes("createOverlay"), `${f} builds a second showcase`);
  }
  // The summary's trophy must not navigate: the round is not over until she says so.
  const game = read("games/einmaleins/einmaleins.js");
  assert.ok(!/href: "\.\.\/\.\.\/album\.html"/.test(game), "a won trophy must not leave the round");

  // It sits above the summary, which is z-index 40 and cannot be dismissed.
  assert.match(css, /#sum-overlay \{ z-index: 40; \}/);
  const overlay = css.slice(css.indexOf(".overlay {"), css.indexOf("}", css.indexOf(".overlay {")));
  assert.match(overlay, /z-index: 50/);
});

// Regression: the earned slot became a <button>, and a grid item's `1fr` track
// is floored at its min-content — which for a button is its longest unbreakable
// word. "Rechenschieber" pushed the four columns to 406px inside a 360px phone,
// the room scrolled sideways (nothing else on this site does), and the fixed
// showcase overlay inherited the 406px viewport and opened 46px off to one side.
test("a long German trophy name cannot widen the shelf", () => {
  const grid = css.slice(css.indexOf(".trophies {"), css.indexOf("}", css.indexOf(".trophies {")));
  // Three to a row now (§3.2), like the picker — but the guard is `minmax(0, …)`,
  // not the column count: a bare `1fr` floors the track at min-content, which for
  // a <button> is its longest unbreakable word ("Rechenschieber" → 406px inside a
  // 360px phone, and the fixed showcase inherited the sideways scroll).
  assert.match(grid, /repeat\(3, minmax\(0, 1fr\)\)/, "a bare 1fr floors the track at min-content");
  // no `.trophies` track may be a bare fraction, at any width
  assert.ok(!/\.trophies[^{]*\{[^}]*repeat\(\d+, 1fr\)/.test(css), "a bare 1fr would still overflow");

  const name = css.slice(css.indexOf(".tcard .sname,"), css.indexOf("}", css.indexOf(".tcard .sname,")));
  assert.match(name, /overflow-wrap: break-word/, "the name must be allowed to break");
  // A centred flex item is shrink-to-fit: without `stretch` its own box is as
  // wide as the word, so it never wraps — it hangs over both edges of the card.
  assert.match(name, /align-self: stretch/);
});

test("the showcase's noise stops for a child who asked it to", () => {
  // §15: the blink and the hop are CSS animations, so the site-wide
  // prefers-reduced-motion rule silences both. Confetti no-ops on its own.
  for (const kf of ["@keyframes sc-twinkle", "@keyframes sc-hop"]) {
    assert.ok(css.includes(kf), `${kf} must be a CSS animation, not a JS loop`);
  }
  assert.match(read("assets/js/confetti.js"), /prefers-reduced-motion/);
});
