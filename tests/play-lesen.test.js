// tools/play-lesen.js is a browser script, so it cannot be imported. Its real
// logic — the answer key built from the content, and the resolver that reads a
// question — sits on `globalThis`, and this test runs it in Node against every
// question shape `questionFor()` can produce. A driver that answers the wrong
// thing proves nothing, quietly (see tests/play.test.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { questionFor } from "../games/lesen/logic.js";
import { CONTENT, itemCount } from "../games/lesen/content.js";

const src = readFileSync(fileURLToPath(new URL("../tools/play-lesen.js", import.meta.url)), "utf8");

// Loading it must not touch the DOM: it defines functions and returns.
const sandbox = { document: undefined, window: undefined };
new Function("globalThis", `with (this) { ${src} }`).call(sandbox, sandbox);
const { resolveLesen, lesenMaps } = sandbox;

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("play-lesen.js loads without a DOM and exposes its resolver", () => {
  assert.equal(typeof resolveLesen, "function");
  assert.equal(typeof lesenMaps, "function");
  assert.equal(typeof sandbox.playLesen, "function");
  assert.equal(typeof sandbox.readLesenScene, "function");
});

test("the driver resolves every question the game can ask", () => {
  const maps = lesenMaps(CONTENT.de);
  const rng = seeded(7);
  // many passes, so every sentence item shows both of its faces
  for (let pass = 0; pass < 12; pass++) {
    for (let id = 0; id < itemCount("de"); id++) {
      const q = questionFor(id, CONTENT.de, rng);
      const res = resolveLesen(q.text, maps);
      assert.equal(res.kind, q.kind, `id ${id}: "${q.text}"`);
      assert.equal(res.answer, q.answer, `id ${id}: "${q.text}"`);
    }
  }
});

test("the resolver throws on text that is not in the content", () => {
  const maps = lesenMaps(CONTENT.de);
  assert.throws(() => resolveLesen("Der Satz steht nirgends.", maps), /not in the content/);
  // …because a driver that guesses at an unknown question hides real bugs,
  // like the aid's word being read as the next question.
});
