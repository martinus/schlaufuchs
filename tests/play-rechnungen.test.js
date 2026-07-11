// tools/play-rechnungen.js is a browser script, so it cannot be imported. Its
// real logic — the resolver that reads a printed equation — sits on
// `globalThis`, and this test runs it in Node against every question shape
// `questionFor()` can produce, at every difficulty. A driver that answers the
// wrong thing proves nothing, quietly (see tests/play.test.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUCKETS, BUCKET_COUNT, questionFor } from "../games/rechnungen/logic.js";

const src = readFileSync(fileURLToPath(new URL("../tools/play-rechnungen.js", import.meta.url)), "utf8");

// Loading it must not touch the DOM: it defines functions and returns.
const sandbox = { document: undefined, window: undefined };
new Function("globalThis", `with (this) { ${src} }`).call(sandbox, sandbox);
const { resolveRechnung } = sandbox;

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("play-rechnungen.js loads without a DOM and exposes its resolver", () => {
  assert.equal(typeof resolveRechnung, "function");
  assert.equal(typeof sandbox.playRechnung, "function");
  assert.equal(typeof sandbox.readRechnungScene, "function");
});

test("the driver resolves every question the game can ask, in both languages", () => {
  // Every bucket, many draws, both division signs — the driver must read what
  // the game prints and arrive at exactly `questionFor`'s answer.
  for (const divSign of [":", "÷"]) {
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const rng = seeded(i * 53 + 3);
      for (let k = 0; k < 800; k++) {
        const q = questionFor(i, rng, divSign);
        assert.equal(resolveRechnung(q.text), q.answer, `${BUCKETS[i].key}: "${q.text}"`);
      }
    }
  }
});

test("the resolver refuses an equation with no operator it knows", () => {
  assert.throws(() => resolveRechnung("5 ⊕ 3 = ?"), /unknown operator/);
  assert.throws(() => resolveRechnung("hello"), /not an equation/);
});
