// Lesen pure logic (§14): item addressing, the blitz clock, questions and
// options, star criteria, digit-string codecs, and the cookie budget.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUND_SIZE, DIFF_KEYS, DIFF_SLUGS, MIXED, STAR_TILES, FLASH_MS, flashMs,
  packsFor, poolFor, itemAt, questionFor, optionsFor,
  STAR_SLOTS, starsFor, nextStarGoal, starGoalNeed, ownedStars,
  starDigit, withStarDigit, maxPoints,
} from "../games/lesen/logic.js";
import {
  starsFor as emStarsFor, nextStarGoal as emNextStarGoal,
  starGoalNeed as emStarGoalNeed, ownedStars as emOwnedStars,
} from "../games/einmaleins/logic.js";
import { CONTENT, itemCount } from "../games/lesen/content.js";
import { BUDGET } from "../assets/js/storage.js";
import { read } from "./pages.js";

const DE = CONTENT.de;

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// --- item addressing ---------------------------------------------------------

test("canonical ids roundtrip over the whole content (§14.3)", () => {
  assert.equal(itemCount("de"), 128, "the box string's length — append-only");
  let id = 0;
  for (const pack of DE.packs) {
    for (const item of pack.items) {
      const found = itemAt(id, DE);
      assert.equal(found.item, item, `id ${id} resolves to its own item`);
      assert.equal(found.pack, pack, `id ${id} knows its home pack`);
      id++;
    }
  }
  assert.equal(id, itemCount("de"));
  for (const junk of [-1, itemCount("de"), 3.5, NaN, "0", null, undefined]) {
    assert.equal(itemAt(junk, DE), null, `itemAt(${String(junk)})`);
  }
});

test("pools: every tile outgrows the round, packs never overlap (§7.3)", () => {
  const packSize = [10, 10, 12];
  for (let d = 0; d < 3; d++) {
    const packs = packsFor(d, DE);
    assert.equal(packs.length, 4, `difficulty ${d} offers four packs`);
    const seen = new Set();
    packs.forEach((_, p) => {
      const pool = poolFor(d, p, DE);
      assert.equal(pool.length, packSize[d], `diff ${d} pack ${p}`);
      assert.ok(pool.length > ROUND_SIZE, "a pool must outgrow the round");
      for (const id of pool) {
        assert.ok(!seen.has(id), `id ${id} sits in two packs`);
        seen.add(id);
      }
    });
    const mixed = poolFor(d, MIXED, DE);
    assert.equal(mixed.length, packSize[d] * 4, `diff ${d} "Alle" is the union`);
    assert.deepEqual([...seen].sort((a, b) => a - b), mixed.sort((a, b) => a - b));
  }
  // a corrupt tile index reads as "Alle", never as an empty round
  for (const junk of [-1, 7, 1.5, NaN, undefined]) {
    assert.equal(poolFor(0, junk, DE).length, 40, `pack=${String(junk)}`);
  }
});

// --- the blitz clock (§14.2) ---------------------------------------------------

test("flashMs falls strictly with the box, never below half a second", () => {
  for (const d of [0, 1]) {
    for (let box = 0; box <= 4; box++) {
      const ms = flashMs(box, d);
      assert.equal(ms, FLASH_MS[d][box]);
      assert.ok(ms >= 500, `diff ${d} box ${box}: ${ms}ms is unreadably short`);
      if (box > 0) assert.ok(ms < flashMs(box - 1, d), "the child must feel getting faster");
    }
    // Mittel's words are physically longer, so its clock is more generous
    if (d === 1) for (let b = 0; b <= 4; b++) assert.ok(flashMs(b, 1) > flashMs(b, 0));
  }
  // junk boxes read as box 2, like the session itself (§7.1)
  for (const junk of [undefined, null, -1, 9, "x", NaN]) {
    assert.equal(flashMs(junk, 0), FLASH_MS[0][2], `box=${String(junk)}`);
  }
  // sentences are never flashed (§14.1)
  assert.equal(flashMs(0, 2), null);
  assert.equal(flashMs(4, 2), null);
});

// --- questions -----------------------------------------------------------------

test("word items ask for their own emoji", () => {
  const rng = seeded(3);
  for (let id = 0; id < itemCount("de"); id++) {
    const { item } = itemAt(id, DE);
    if (item.w === undefined) continue;
    const q = questionFor(id, DE, rng);
    assert.deepEqual(q, { kind: "word", text: item.w, answer: item.e });
  }
  assert.equal(questionFor(-1, DE), null);
});

test("sentence items show both faces of their pair, matched to the verdict (§14.3)", () => {
  const rng = seeded(7);
  for (let id = 0; id < itemCount("de"); id++) {
    const { item } = itemAt(id, DE);
    if (item.w !== undefined) continue;
    const faces = new Set();
    for (let i = 0; i < 40 && faces.size < 2; i++) {
      const q = questionFor(id, DE, rng);
      assert.equal(q.kind, "sent");
      if (q.answer === true) assert.equal(q.text, item.ok);
      else if (q.answer === false) assert.equal(q.text, item.no);
      else assert.fail(`answer must be a boolean, got ${String(q.answer)}`);
      faces.add(q.answer);
    }
    // truth cannot be memorized per item: both variants must actually come up
    assert.equal(faces.size, 2, `item ${id} only ever showed one face`);
  }
});

test("optionsFor: four unique emoji, the answer exactly once, all from home (§14.3)", () => {
  const rng = seeded(11);
  for (let id = 0; id < itemCount("de"); id++) {
    const found = itemAt(id, DE);
    if (found.item.w === undefined) {
      assert.equal(optionsFor(id, DE, rng), null, "sentences answer with a verdict");
      continue;
    }
    const opts = optionsFor(id, DE, rng);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4, `id ${id}: duplicate option`);
    assert.equal(opts.filter((e) => e === found.item.e).length, 1, "the answer, exactly once");
    const home = new Set(found.pack.items.map((it) => it.e));
    for (const e of opts) assert.ok(home.has(e), `id ${id}: ${e} is not a pack-mate`);
  }
  // deterministic under a seeded rng — the driver and the tests can replay it
  assert.deepEqual(optionsFor(0, DE, seeded(5)), optionsFor(0, DE, seeded(5)));
});

// --- stars (§14.3) ---------------------------------------------------------------

test("stars on a round of six: 4 → ⭐, 5 → ⭐⭐, 6 → ⭐⭐⭐", () => {
  assert.equal(ROUND_SIZE, 6);
  assert.equal(STAR_SLOTS, 3);
  const want = [0, 0, 0, 0, 1, 2, 3];
  for (let ok = 0; ok <= 6; ok++) assert.equal(starsFor(ok, 6), want[ok], `${ok}/6`);
});

test("the star rules are the einmaleins rules — parity, so they cannot drift (D11)", () => {
  for (let total = 0; total <= 12; total++) {
    for (let ok = 0; ok <= total; ok++) {
      assert.equal(starsFor(ok, total), emStarsFor(ok, total), `${ok}/${total}`);
    }
  }
  for (let s = 0; s <= 4; s++) {
    assert.equal(nextStarGoal(s), emNextStarGoal(s), `goal after ${s} stars`);
    assert.equal(starGoalNeed(s, 6), emStarGoalNeed(s, 6), `need after ${s} stars`);
  }
  for (const best of [undefined, null, -1, 2, 99, NaN]) {
    assert.equal(
      ownedStars({ firstTrySolved: 4, total: 6 }, best),
      emOwnedStars({ firstTrySolved: 4, total: 6 }, best),
      `best=${String(best)}`,
    );
  }
});

test("ownedStars is total: junk in, a sane basket out", () => {
  for (const bad of [undefined, null, -1, 4, 99, 1.5, NaN, "2", {}]) {
    const n = ownedStars({ firstTrySolved: 5, total: 6 }, bad);
    assert.ok(Number.isInteger(n) && n >= 0 && n <= STAR_SLOTS, `best=${String(bad)} -> ${n}`);
  }
  assert.equal(ownedStars(), 0);
});

// --- star digit strings (§14.5) ---------------------------------------------------

test("star digit strings: five slots, Alle at the end, junk-safe", () => {
  assert.equal(STAR_TILES, 5);
  assert.equal(MIXED, STAR_TILES - 1, "the Alle tile owns the last digit");
  assert.equal(withStarDigit(undefined, 0, 3), "30000");
  assert.equal(withStarDigit("", MIXED, 2), "00002");
  assert.equal(withStarDigit("12103", 2, 3), "12303");
  assert.equal(starDigit("12103", MIXED), 3);
  assert.equal(starDigit("12103", 0), 1);
  for (const junk of [undefined, null, "", "x?!"]) {
    for (let p = 0; p < STAR_TILES; p++) {
      assert.equal(starDigit(junk, p), 0, `starDigit(${String(junk)}, ${p})`);
    }
  }
  assert.equal(starDigit("9", 0), 3, "a corrupt digit is capped at three stars");
});

// --- the game's worth (§8.3) -------------------------------------------------------

test("maxPoints is computed from the real tiles: 5·3·1 + 5·3·2 + 5·3·3 = 90", () => {
  assert.equal(DIFF_KEYS.length, 3);
  assert.equal(DIFF_SLUGS.length, 3);
  assert.equal(maxPoints(DE), 90);
});

// --- cookie budget (§9.2) -----------------------------------------------------------

test("a maxed lesen section stays a small fraction of the cookie budget", () => {
  const fullStars = { 0: "3".repeat(STAR_TILES), 1: "3".repeat(STAR_TILES), 2: "3".repeat(STAR_TILES) };
  const maxed = {
    d: 2, p: MIXED,
    box: { de: "4".repeat(itemCount("de")) },
    stars: fullStars,
  };
  const bytes = JSON.stringify({ lesen: maxed }).length;
  assert.ok(bytes < 350, `lesen section is ${bytes} bytes`);

  // …and the whole purse still fits: a maxed lesen beside a maxed einmaleins,
  // rewards and settings, with room for a future English box string (§14.6).
  const full11 = { 0: "3".repeat(11), 1: "3".repeat(11), 2: "3".repeat(11) };
  const einmaleins = {
    d: 2, t: 0, box: "4".repeat(100), stars: full11, tempo: full11,
    rc: "4".repeat(100), tm: [99999, 99999, 99999], rd: [9999, 9999, 9999],
  };
  const state = {
    v: 1,
    settings: { lang: "de", sound: false },
    rewards: { at: "einmaleins", pr: { einmaleins: 162, lesen: 90, tippen: 240, rechnungen: 90, vokabeln: 108 } },
    einmaleins,
    lesen: { ...maxed, box: { de: maxed.box.de, en: "4".repeat(itemCount("de")) } },
  };
  const total = encodeURIComponent(JSON.stringify(state)).length;
  assert.ok(total < BUDGET, `everything maxed is ${total} bytes, budget is ${BUDGET}`);
});

// --- wiring (§14.2): the parts of the blitz that a unit test cannot run -------

test("the blitz is a JS timer wearing a CSS transition, never an animation", () => {
  // prefers-reduced-motion kills transitions and animations site-wide. A
  // JS-timed hide decorated by a transition degrades to an instant flip — the
  // mechanic survives. A keyframe animation that never runs would never hide
  // the word at all, and the flash would silently stop being a flash.
  const game = read("games/lesen/lesen.js");
  const arm = game.slice(game.indexOf("function armFlash"), game.indexOf("function renderStatus"));
  assert.match(arm, /setTimeout/, "the hide must be decided by a JS timer");
  assert.match(arm, /token === qToken/, "a stale timer must not hide the next question");
  assert.match(arm, /phase === "answer"/, "the aid shows the word un-flashed; a hide must not race it");

  const css = read("assets/css/schlaufuchs.css");
  const cardCss = css.slice(css.indexOf("---- lesen:"), css.indexOf(".mc-emoji"));
  assert.match(cardCss, /transition: opacity/, "the fade is a transition");
  assert.ok(!/animation\s*:|@keyframes/.test(cardCss), "a keyframe animation would survive nothing");
});

test("the aid keeps the same buttons, and only the right one lets the round on", () => {
  // The einmaleins aid contract (§8.1): after a wrong answer the options never
  // reshuffle under the finger that is already going for one, and the way out
  // is the correct answer, given.
  const game = read("games/lesen/lesen.js");
  const aid = game.slice(game.indexOf("function showFeedback"), game.indexOf("function rejectRetry"));
  assert.ok(!/renderAnswers|answers/.test(aid), "the aid must not rebuild the answer buttons");
  const press = game.slice(game.indexOf("function answerPress"), game.indexOf("function submit"));
  assert.match(press, /value === question\.answer/, "only the right answer continues");
  assert.match(press, /rejectRetry/, "a wrong retry shakes and stays");
});

test("a finished round is written before the summary opens (§10.7)", () => {
  // The leave guard trusts `roundOver` to mean "the cookie is written": the
  // stars are banked by setGame/recordRound inside endRound, synchronously,
  // before the 700ms celebration timer that opens the summary.
  const game = read("games/lesen/lesen.js");
  const end = game.slice(game.indexOf("function endRound"), game.indexOf("$(\"sum-ok\")"));
  const write = end.indexOf("setGame(");
  const record = end.indexOf("recordRound(");
  const celebrate = end.indexOf("setTimeout(");
  assert.ok(write > -1 && record > -1 && celebrate > -1);
  assert.ok(write < celebrate && record < celebrate, "the cookie is written before the wait");
});

test("the summary holds exactly one button (§10.1)", () => {
  const html = read("games/lesen/index.html");
  const sum = html.slice(html.indexOf('id="sum-overlay"'), html.lastIndexOf("</div>"));
  const buttons = [...sum.matchAll(/<button/g)];
  assert.equal(buttons.length, 1, "a child who just won reads almost nothing");
  assert.match(sum, /id="sum-ok"/);
});
