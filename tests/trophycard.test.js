// One trophy, one card (§3.2, §3.4). Mara did not recognise the trophy she had
// just won when she met it again on the album shelf, because the two places
// drew it differently. These tests pin the card's shape and the fact that both
// places use it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { trophyCardHTML } from "../assets/js/trophycard.js";
import { TROPHIES } from "../assets/js/rewards.js";
import { read } from "./pages.js";

const bell = TROPHIES.einmaleins[0]; // 🔔 Schulglocke / School Bell

test("the card is a cup with the trophy's own emoji in it, and its name", () => {
  const html = trophyCardHTML(bell, { lang: "de" });
  assert.match(html, /class="t-art"/, "the art block frames the two glyphs");
  assert.ok(html.includes("🏆"), "the cup is what makes a trophy look like a trophy");
  assert.ok(html.includes(bell.e), "…and the theme emoji rides in it");
  assert.match(html, /class="sname">Schulglocke</, "the name is written under it");
});

test("the name follows the language", () => {
  assert.ok(trophyCardHTML(bell, { lang: "en" }).includes("School Bell"));
  assert.ok(!trophyCardHTML(bell, { lang: "en" }).includes("Schulglocke"));
});

// The summary's trophy leads to the album; the album's opens it full size; a
// card that does neither must not look tappable, because a child taps what does.
test("href makes it a link, and nothing else does", () => {
  const plain = trophyCardHTML(bell, {});
  assert.match(plain, /^<div class="tcard"/);
  assert.ok(!plain.includes("href"));

  const linked = trophyCardHTML(bell, { href: "../../album.html", label: "Schulglocke — Pokalraum" });
  assert.match(linked, /^<a class="tcard" href="\.\.\/\.\.\/album\.html" aria-label="Schulglocke — Pokalraum">/);
  assert.match(linked, /<\/a>$/);
});

test("button makes it a button, and it carries the album's own data", () => {
  const btn = trophyCardHTML(bell, { button: true, attrs: 'data-trophy="einmaleins:0"' });
  assert.match(btn, /^<button class="tcard" type="button" data-trophy="einmaleins:0">/);
  assert.match(btn, /<\/button>$/);
  // a form on any page it lands on must not be submitted by a trophy
  assert.ok(btn.includes('type="button"'));
  // href wins: the summary's card is a link even if someone passes both
  assert.match(trophyCardHTML(bell, { button: true, href: "x" }), /^<a /);
});

// Regression: at half the cup's size the theme emoji was a speck buried in a
// gold bowl, and twelve trophies on one shelf were twelve identical cups.
test("the theme emoji is big enough to tell one trophy from another", () => {
  const html = trophyCardHTML(bell, { size: 100 });
  const theme = html.match(/class="gicon t-theme" style="font-size:(\d+)px"/);
  assert.ok(theme, "the theme icon must be sized relative to the cup");
  assert.ok(Number(theme[1]) >= 60, `the emoji is ${theme[1]}px in a 100px cup`);
});

test("extra classes ride along, so the summary can mark it as just won", () => {
  assert.match(trophyCardHTML(bell, { cls: "won" }), /class="tcard won"/);
});

// The whole point is that the two are the same card. If either page goes back
// to building its own markup, the child loses the thread again.
test("the album and the round summary both draw the shared card", () => {
  for (const f of ["assets/js/album.js", "games/einmaleins/einmaleins.js"]) {
    assert.match(read(f), /trophycard\.js/, `${f} must import the shared trophy card`);
  }
});

test("the card's frame is shared with the album shelf, not copied", () => {
  const css = read("assets/css/schlaufuchs.css");
  assert.match(css, /\.tcard,\s*\n\.trophies \.slot \{/, "one rule must dress both");
});
