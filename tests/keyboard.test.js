// Keyboard handling in the games. These are static checks: the real defect
// lives in the browser's default actions and only a real key event reproduces
// it, so the unit test guards the fix rather than the symptom. The end-to-end
// reproduction is described in the comment below and was run against Chrome.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const abs = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const einmaleins = readFileSync(abs("games/einmaleins/einmaleins.js"), "utf8");

// Regression: tapping a keypad digit focuses that button. Pressing Enter then
// did two things — our own keydown handler submitted the answer, AND the
// browser's default action clicked the still-focused digit button. That extra
// digit arrived during the post-correct transition, landed in `buffer`, and
// reappeared prefilled in the next question ("2 × 9 = 6").
test("the game owns the keys it handles, so Enter cannot re-click a focused key", () => {
  const handler = einmaleins.slice(
    einmaleins.indexOf('document.addEventListener("keydown"'),
    einmaleins.indexOf('function submit('),
  );
  assert.ok(handler.includes('e.key === "Enter"'), "Enter must still submit");
  assert.ok(
    handler.includes("e.preventDefault()"),
    "a handled key must be consumed, or its default action fires as well",
  );
  // and the guard must come after the dispatch, not swallow unhandled keys
  assert.ok(
    handler.indexOf("else return;") < handler.indexOf("e.preventDefault()"),
    "unhandled keys (Tab, F5, …) must keep their default behaviour",
  );
});

test("a new question always starts from an empty input", () => {
  // askNext() takes whatever the fast typist buffered and clears the buffer;
  // nothing else may survive into the next question.
  const askNext = einmaleins.slice(
    einmaleins.indexOf("function askNext()"),
    einmaleins.indexOf("function fitQuestion()"),
  );
  assert.ok(/input = buffer\.slice\(0, 3\);/.test(askNext), "input comes from the buffer");
  assert.ok(/buffer = "";/.test(askNext), "and the buffer is cleared straight after");
  assert.ok(
    askNext.indexOf("input = buffer") < askNext.indexOf('buffer = ""'),
    "clearing the buffer before reading it would drop the fast typist's digits",
  );
});
