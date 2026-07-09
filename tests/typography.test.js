// Two faces, one rule (§15): the display face (Grandstander) carries names,
// numbers and headings; the body face (Atkinson Hyperlegible) carries
// everything else.
//
// The rule lives in a single selector list, and every drift found so far has
// been a selector that was never added to it — the in-round goal line, the
// summary's secondary buttons, the trophy names, the parents' chips. This test
// pins the list. It cannot see the cascade, so the list was also audited in a
// real browser with `getComputedStyle` before being written down here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../assets/css/schlaufuchs.css", import.meta.url)), "utf8");

// the one rule that assigns the display face
const displayRule = (() => {
  const i = css.indexOf("font-family: var(--font-display);");
  assert.notEqual(i, -1, "nothing uses the display face any more");
  const start = css.lastIndexOf("}", i) + 1;
  return css.slice(start, i);
})();

const assigns = (sel) => new RegExp(`(^|,)\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|\\{)`, "m").test(displayRule);

test("names, numbers and headings get the display face", () => {
  for (const sel of [
    "h1", "h2",
    ".question",           // the equation a child reads
    ".region-label",       // a place on the map
    ".chip",               // every chip in the top bar
    ".foxchip .lbl",       // the star count
    ".keypad button", ".mc button", ".tilegrid button",
    ".primary",
    ".summary .sline",
    ".summary button", ".summary .sum-link",  // the whole button row, not just "Nochmal"
    ".summary .trophy-earn .won",             // a trophy's name is a name
    ".pchip", ".factlist .fact",              // the parents' chips and equations
    ".feedback-aid",
  ]) {
    assert.ok(assigns(sel), `${sel} should be set in the display face`);
  }
});

// Deliberate, not forgotten. Atkinson Hyperlegible exists to make `1 l I` and
// `0 O` impossible to confuse; an email address, a URL and a column of figures
// are exactly where that matters and exactly where a rounded display face hurts.
test("prose, data and URLs stay in the body face", () => {
  for (const sel of [
    ".lede", ".muted", ".footlink", ".sub",
    ".ptable", ".legend", ".linklist a", ".mail", ".heat .hh",
  ]) {
    assert.ok(!assigns(sel), `${sel} must not be forced into the display face`);
  }
  assert.match(css, /--font-body: "Atkinson Hyperlegible"/);
  assert.match(css, /--font-display: "Grandstander"/);
});

// Regression: the in-round goal line was 0.8rem of body face beside display
// face text, because `.hotstreak` was in the list and `.goalline` was not.
// Both are gone; nothing may quietly reintroduce a stray face.
test("no rule sets a font-family outside the two tokens", () => {
  const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const f of families) {
    assert.ok(
      /var\(--font-(display|body)\)|inherit|"Grandstander"|"Atkinson Hyperlegible"/.test(f),
      `stray font-family: ${f}`,
    );
  }
});
