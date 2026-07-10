// The showcase's sizing arithmetic (§3.2). The card is measured in JS because
// the cup is an emoji — its size is a font-size, and no CSS length can be
// derived from the box it has to fit into. Measured means testable: these are
// the numbers that decide whether the one screen built to be shown around
// hangs out over its own sheet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { showcaseSizes } from "../assets/js/showcase.js";

test("the card fits the sheet on real phones, and the cup fits the card", () => {
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [768, 1024]]) {
    const { card, cup } = showcaseSizes(w, h);
    assert.ok(card <= w - 2 * (12 + 16) - 8, `${w}×${h}: the card (${card}) hangs over the sheet`);
    assert.ok(card + 250 <= h, `${w}×${h}: no room left for the Close button`);
    assert.ok(cup < card, `${w}×${h}: the cup (${cup}) is larger than its card (${card})`);
    assert.ok(cup >= card * 0.5, `${w}×${h}: the cup (${cup}) is a speck in a ${card} card`);
  }
});

test("the card is capped: a desktop window does not get a poster", () => {
  assert.equal(showcaseSizes(2560, 1440).card, 340);
});

test("a tiny viewport gets a readable card, not a vanishing one", () => {
  // The 160px floor deliberately outranks the fit: on a viewport this small
  // the sheet scrolls, which beats a trophy too small to recognise.
  const { card } = showcaseSizes(120, 200);
  assert.equal(card, 160);
});
