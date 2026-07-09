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
  // and the guard must come after the dispatch, not swallow unhandled keys.
  // (The aid's own Enter branch preventDefaults earlier, so look at the last one.)
  assert.ok(
    handler.indexOf("else return;") < handler.lastIndexOf("e.preventDefault()"),
    "unhandled keys (Tab, F5, …) must keep their default behaviour",
  );
});

// Regression: a wrong answer showed the right one for 2000 ms and then took it
// away on a timer. A child who reads slowly never got to see it.
test("the feedback aid waits for a button, not for a clock", () => {
  const submit = einmaleins.slice(
    einmaleins.indexOf("function submit("),
    einmaleins.indexOf("function showFeedback()"),
  );
  // the wrong-answer branch is everything from `} else {` to the end of submit()
  const wrongBranch = submit.slice(submit.indexOf("} else {"));
  assert.ok(wrongBranch.includes("showFeedback()"), "a wrong answer must show the aid");
  assert.ok(
    !wrongBranch.includes("setTimeout"),
    "the wrong-answer branch must not schedule anything on a timer",
  );
  assert.ok(einmaleins.includes('$("fb-next")'), "the aid must offer a continue button");
  assert.ok(
    einmaleins.includes("function continueRound()"),
    "only continueRound() leaves the aid",
  );
});

// Regression: the continue button made the card taller than the stage, and the
// stage clips. The card holds up to ten rows of dots (the 10× table), so its
// parts have to scale with the viewport instead of sitting at fixed sizes.
test("the feedback card is sized to fit the shortest phone", () => {
  const css = readFileSync(abs("assets/css/schlaufuchs.css"), "utf8");
  const dot = css.slice(css.indexOf(".dotgrid i {"), css.indexOf("}", css.indexOf(".dotgrid i {")));
  assert.ok(/width:\s*clamp\(/.test(dot), "the dot must scale with the viewport height");
  // The streak line used to yield its row only while empty. It now shares that
  // row with the star basket and is therefore almost never empty, so the whole
  // status row hides while the aid is up.
  assert.ok(
    css.includes(".stage:has(#feedback:not([hidden])) .statusrow"),
    "the status row must not steal a row from the aid",
  );
  assert.ok(
    !css.includes(".hotstreak:empty"),
    "an :empty rule cannot free a row that now always has a basket in it",
  );
  assert.ok(
    einmaleins.includes("repeat(${b}, auto)"),
    "fixed 8px columns would clip a dot that grew past them",
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
