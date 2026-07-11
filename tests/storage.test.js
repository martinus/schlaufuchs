import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeState, decodeState, overBudget, patchSection, BUDGET, withoutGame, hasGameData, exportState, parseBackup } from "../assets/js/storage.js";
import { read } from "./pages.js";

test("state roundtrips through the cookie encoding (§9.2)", () => {
  const state = {
    v: 1,
    settings: { sound: true, lang: "de" },
    rewards: { at: "einmaleins", pr: { einmaleins: 3 } },
    einmaleins: { d: 1, t: 7, box: "3421".padEnd(100, "2"), stars: { 1: "30200000000" } },
  };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

// How a field is *removed* from the cookie: patch it with undefined, and
// JSON.stringify drops it. recordRound retires the dead streak field this way
// (§8.5) — without this, patchSection's merge would carry a removed field
// along until the reset button.
test("patching a section with undefined deletes the key from the cookie", () => {
  const state = { v: 1, rewards: { streak: ["2026-07-08", 4], at: "einmaleins", pr: { einmaleins: 3 } } };
  const scrubbed = decodeState(encodeState(patchSection(state, "rewards", { at: "tippen", streak: undefined })));
  assert.deepEqual(scrubbed.rewards, { at: "tippen", pr: { einmaleins: 3 } }, "the dead field is gone, the live ones stay");
  assert.ok(!encodeState(patchSection(state, "rewards", { streak: undefined })).includes("streak"));
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

// Per-game reset (§20): remove one game's whole footprint and nothing else.
test("withoutGame drops a game's section and its trophy counter, keeps the rest", () => {
  const state = {
    v: 1,
    settings: { sound: false, lang: "de" },
    einmaleins: { d: 1, t: 7, box: "333" },
    lesen: { d: 2, p: 4, box: { de: "2222" } },
    rewards: { at: "lesen", pr: { einmaleins: 30, lesen: 9 } },
  };
  const next = withoutGame(state, "lesen");

  assert.ok(!("lesen" in next), "the reading section is gone");
  assert.ok(!("lesen" in next.rewards.pr), "the reading trophy counter is gone");
  assert.deepEqual(next.einmaleins, { d: 1, t: 7, box: "333" }, "einmaleins is untouched");
  assert.equal(next.rewards.pr.einmaleins, 30, "einmaleins stars are untouched");
  assert.deepEqual(next.settings, { sound: false, lang: "de" }, "settings survive");

  // the fox was standing on the game we cleared, so its saved spot is scrubbed —
  // and undefined drops out of the cookie entirely, not written as null
  assert.equal(next.rewards.at, undefined);
  assert.ok(!encodeState(next).includes("%22at%22"), "at is absent from the cookie, not blanked");

  // pure: the caller's state is not mutated
  assert.ok("lesen" in state, "the input state is left intact");
  assert.equal(state.rewards.pr.lesen, 9);
});

test("withoutGame keeps the fox's spot when it sat on another game", () => {
  const state = { rewards: { at: "einmaleins", pr: { einmaleins: 30, lesen: 9 } } };
  assert.equal(withoutGame(state, "lesen").rewards.at, "einmaleins");
});

test("withoutGame survives a cookie with no rewards section", () => {
  assert.deepEqual(withoutGame({ lesen: { d: 2 } }, "lesen"), {});
  assert.deepEqual(withoutGame({}, "lesen"), {});
});

test("hasGameData: a game is resettable if it has a section or a trophy counter", () => {
  assert.equal(hasGameData({ lesen: { d: 2, box: {} } }, "lesen"), true, "a stored section counts");
  assert.equal(hasGameData({ rewards: { pr: { lesen: 9 } } }, "lesen"), true, "a trophy counter counts");
  assert.equal(hasGameData({ rewards: { pr: { lesen: 0 } } }, "lesen"), false, "zero stars is nothing to clear");
  assert.equal(hasGameData({ einmaleins: { d: 1 } }, "lesen"), false, "another game is not this one");
  assert.equal(hasGameData({}, "lesen"), false);
  assert.equal(hasGameData({ lesen: {} }, "lesen"), false, "an empty section is not progress");
});

// --- backup (§9.3) -------------------------------------------------------------
// The whole site lives in one cookie on one device: a cleared cache or a new
// phone deletes a year of stars, silently. The backup is that cookie as a
// file, and the restore is total-or-nothing: junk, arrays, or an oversized
// state must come back null — never half-written into the cookie.

test("a backup roundtrips: what exportState writes, parseBackup accepts", () => {
  const state = {
    v: 1,
    settings: { lang: "de", sound: false },
    rewards: { at: "lesen", pr: { einmaleins: 42, lesen: 9 } },
    einmaleins: { d: 1, t: 7, box: "4".repeat(100) },
  };
  const text = exportState(state);
  assert.deepEqual(parseBackup(text), state);
  // pretty-printed on purpose: a parent squinting at the file should see
  // key/value lines, not one 2000-character wall
  assert.match(text, /\n {2}"rewards"/);
});

test("exportState always stamps the version, parseBackup rejects what cannot be state", () => {
  assert.equal(JSON.parse(exportState({})).v, 1);
  for (const junk of ["", "not json", "[1,2]", '"a string"', "42", "null", "true"]) {
    assert.equal(parseBackup(junk), null, `parseBackup(${JSON.stringify(junk)})`);
  }
  // an oversized backup would be refused by save() anyway — refuse it here,
  // where the parent can still be told, not half-way through a reload
  const fat = JSON.stringify({ v: 1, blob: "x".repeat(BUDGET) });
  assert.equal(parseBackup(fat), null, "an over-budget backup must not pretend to load");
});

test("the gear offers the backup, adult-side, with the same two-step confirm", () => {
  const src = read("assets/js/chrome.js");
  // export: a real downloaded file, named so a parent finds it again
  assert.match(src, /download = "schlaufuchs-fortschritt\.json"/);
  assert.match(src, /exportState\(\)/);
  // import: total-or-nothing through parseBackup, then a reload — the page's
  // in-memory state is stale the moment the cookie is replaced
  assert.match(src, /parseBackup\(/);
  assert.match(src, /replaceState\(/);
  const imp = src.slice(src.indexOf("function importFrom"), src.indexOf("closeBtn.addEventListener"));
  assert.match(imp, /location\.reload\(\)/, "a restored cookie needs a fresh page");
  // overwriting a child's progress is the destructive act here: the import
  // button arms first, exactly like the reset rows
  assert.match(src, /id="cx-import"[^>]*data-armable/, "the import must arm before it fires");
});
