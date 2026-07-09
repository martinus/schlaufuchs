import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeState, decodeState, overBudget, patchSection, BUDGET } from "../assets/js/storage.js";
import { read } from "./pages.js";

test("state roundtrips through the cookie encoding (§9.2)", () => {
  const state = {
    v: 1,
    settings: { sound: true, lang: "de" },
    rewards: { streak: ["2026-07-08", 4], at: "einmaleins", pr: { einmaleins: 3 } },
    einmaleins: { d: 1, t: 7, box: "3421".padEnd(100, "2"), stars: { 1: "30200000000" } },
  };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

test("corrupt cookie decodes to empty state, never throws (§9.2)", () => {
  assert.deepEqual(decodeState("%%%garbage"), {});
  assert.deepEqual(decodeState("not json"), {});
  assert.deepEqual(decodeState(""), {});
  assert.deepEqual(decodeState(encodeURIComponent('"a string"')), {});
  assert.deepEqual(decodeState(encodeURIComponent("[1,2]")), {});
});

test("budget check: realistic full state fits, oversized state is refused", () => {
  const fullState = {
    v: 1,
    settings: { sound: true, lang: "de" },
    rewards: {
      streak: ["2026-07-08", 30],
      at: "vokabeln",
      pr: { einmaleins: 30, tippen: 30, rechnungen: 30, vokabeln: 30, lesen: 30 },
    },
    einmaleins: {
      d: 2, t: 0, box: "3".repeat(100),
      stars: { 0: "3".repeat(11), 1: "3".repeat(11), 2: "3".repeat(11) },
      // practice time for the parents' view (§20): three years of daily rounds
      tm: [98765, 98765, 98765], rd: [1200, 1200, 1200],
    },
    tippen: {
      d: 1, lvl: { de: 20, en: 20 },
      stars: { de: "3".repeat(20), en: "3".repeat(20) },
      best: { 16: { acc: 99, cpm: 120 }, 17: { acc: 99, cpm: 120 }, 18: { acc: 99, cpm: 120 }, 19: { acc: 99, cpm: 120 }, 20: { acc: 99, cpm: 120 } },
      kb: false,
    },
    rechnungen: { d: 2, m: "mix", box: "3".repeat(30), stars: { "+": "333", "-": "333", x: "333", ":": "333", mix: "333" } },
    vokabeln: {
      d: 2, p: "tiere", dir: "de-en",
      box: Object.fromEntries(["tiere", "schule", "essen", "familie", "farben", "koerper"].map((p) => [p, "3".repeat(40)])),
      stars: Object.fromEntries(["tiere", "schule", "essen", "familie", "farben", "koerper"].map((p) => [p, "333"])),
    },
    lesen: { d: 2, box: { de: "3".repeat(250) }, stars: { de: "333" }, c3: 3 },
  };
  assert.ok(!overBudget(fullState), `full realistic state is ${encodeState(fullState).length} bytes, must be < ${BUDGET}`);

  const oversized = { blob: "x".repeat(BUDGET) };
  assert.ok(overBudget(oversized));
});

// The settings, the rewards and each game were three copies of one merge. The
// copies agreed; the next one would not have.
test("patchSection merges into one section and copies the rest", () => {
  const state = { v: 1, settings: { sound: false }, einmaleins: { d: 1, t: 7 } };
  const next = patchSection(state, "settings", { lang: "en" });

  assert.deepEqual(next.settings, { sound: false, lang: "en" }, "the patch merges, it does not replace");
  assert.deepEqual(next.einmaleins, { d: 1, t: 7 }, "the other sections are untouched");
  assert.equal(next.v, 1);

  // A writer that mutates the state it was handed turns every read into a
  // write: `loadState()` hands out the object the next reader will see.
  assert.deepEqual(state.settings, { sound: false }, "the caller's state was mutated");
  assert.notEqual(next, state);
  assert.notEqual(next.settings, state.settings);

  // an absent section is created, not crashed into
  assert.deepEqual(patchSection({}, "rewards", { at: "einmaleins" }).rewards, { at: "einmaleins" });
});

// Regression: `readRaw` matched a hard-coded "schlaufuchs=" while every write
// used the NAME constant. Renaming the cookie would have made the site forget
// everything on the next deploy, silently, and only for people who had played.
test("the cookie is read under the same name it is written", () => {
  const src = read("assets/js/storage.js");
  const literals = [...src.matchAll(/"schlaufuchs/g)];
  assert.equal(literals.length, 1, "the cookie's name is written once, as NAME");
  assert.match(src, /const NAME = "schlaufuchs"/);
  assert.ok(!/document\.cookie\.match\(\/[^/]*schlaufuchs/.test(src), "the reader hard-codes the name");
});
