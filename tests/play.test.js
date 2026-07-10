// tools/play.js is a browser script, so it cannot be imported. Its one piece of
// real logic — reading a question and working out the answer — is put on
// `globalThis`, and this test runs it in Node against every question shape
// `questionFor()` can produce.
//
// A driver that answers the wrong thing proves nothing, quietly. The three
// sessions before this one each rewrote that parser from memory, and one of
// them read the child's own half-typed answer as the question.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { questionFor, POOL_COUNT } from "../games/einmaleins/logic.js";

const src = readFileSync(fileURLToPath(new URL("../tools/play.js", import.meta.url)), "utf8");

// Loading it must not touch the DOM: it defines functions and returns.
const sandbox = { document: undefined, window: undefined };
new Function("globalThis", `with (this) { ${src} }`).call(sandbox, sandbox);
const { solveQuestion } = sandbox;

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("play.js loads without a DOM and exposes its solver", () => {
  assert.equal(typeof solveQuestion, "function");
  assert.equal(typeof sandbox.play, "function");
  assert.equal(typeof sandbox.readScene, "function");
});

// Both division signs, because the page picks one per language: ":" is what a
// German child is taught, "÷" is what an English one reads.
for (const divSign of ["÷", ":"]) {
  test(`the driver solves every question the game can ask ("${divSign}")`, () => {
    const rng = seeded(7);
    const seen = new Set();
    for (let i = 0; i < 3000; i++) {
      const id = Math.floor(rng() * POOL_COUNT);
      const diff = Math.floor(rng() * 3);
      // mixed rounds and fixed tables shape their questions differently (the
      // fixed table is never the unknown, §10.2) — the driver must read both
      const table = rng() < 0.5 ? 0 : 1 + Math.floor(id / 10);
      const q = questionFor(id, diff, rng, divSign, table);
      seen.add(q.kind);
      // the page renders `text` with "?" replaced by the gap span, whose text is
      // "?" before anything is typed — so this is exactly what the driver reads
      assert.equal(solveQuestion(q.text), q.answer, `${q.kind}: "${q.text}"`);
    }
    assert.deepEqual([...seen].sort(), ["div", "gap", "mul"], "all three shapes were exercised");
  });
}

test("the driver reads a German division", () => {
  assert.equal(solveQuestion("10 : 2 = ?"), 5);
});

// The aid lost its "Verstanden" button: the driver leaves it the way a child
// does now, by answering correctly.
test("the driver leaves the aid by answering, not by pressing a button", () => {
  assert.ok(!src.includes("fb-next"), "the driver still reaches for a button that is gone");
  const aid = src.slice(src.indexOf("if (aidUp())"));
  assert.match(aid.slice(0, 700), /await answer\(want\)/, "it must enter the right answer");
});

// `delayMs` is what makes the tempo ladder's slow tiers (§10.6) reachable in a
// driven round: the driver "thinks" before answering, inside the game's tempo
// clock — and the deadline grows with it, or a slow round would look hung.
test("the driver can play slowly on purpose, without timing itself out", () => {
  assert.match(src, /delayMs = 0/);
  assert.match(src, /if \(pause\) await sleep\(pause\);\s*\/\/.*\n\s*await answer\(/,
    "the pause must sit between reading the question and answering it");
  assert.match(src, /60000 \+ pause \* \d+/, "the deadline must scale with the pause");
});

test("the driver refuses what it cannot read, instead of guessing", () => {
  assert.throws(() => solveQuestion("7 x 8 = ?"), /unknown operator/);
  assert.throws(() => solveQuestion("nonsense"), /not an equation/);
  // a half-typed answer is not a question: "7 × 8 = 5" would "solve" to 0.625,
  // which is not an integer — the caller checks that and throws
  assert.ok(!Number.isInteger(solveQuestion("7 × 8 = 5")));
});
