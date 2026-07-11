// Lesen pure logic (§14): item addressing, the blitz clock, questions and
// options, star criteria, digit-string codecs, and the cookie budget.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUND_SIZE, DIFF_KEYS, DIFF_SLUGS, MIXED, STAR_TILES, FLASH_MS, flashMs,
  packsFor, poolFor, itemAt, questionFor, optionsFor,
  STAR_SLOTS, starsFor, nextStarGoal, starGoalNeed, ownedStars,
  starDigit, withStarDigit, maxPoints,
  TEMPO_SLOTS, TEMPO_TIERS, TEMPO_ICONS, TEMPO_KEYS, median, tempoTier, awardTempo,
} from "../games/lesen/logic.js";
import {
  starsFor as emStarsFor, nextStarGoal as emNextStarGoal,
  starGoalNeed as emStarGoalNeed, ownedStars as emOwnedStars,
  TEMPO_ICONS as emTempoIcons, TEMPO_KEYS as emTempoKeys,
  median as emMedian, awardTempo as emAwardTempo,
} from "../games/einmaleins/logic.js";
import { CONTENT, itemCount } from "../games/lesen/content.js";
import { BUDGET } from "../assets/js/storage.js";
import strings from "../games/lesen/i18n.js";
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

// --- the tempo ladder (§10.6, §14.4) -------------------------------------------

test("tempoTier: the bounds per difficulty, and on the bound still counts", () => {
  assert.equal(TEMPO_SLOTS, 3);
  for (let d = 0; d < TEMPO_TIERS.length; d++) {
    const [hare, car, rocket] = TEMPO_TIERS[d];
    assert.ok(hare > car && car > rocket, `d=${d}: the ladder must climb downward in ms`);
    assert.equal(tempoTier(rocket, d), 3, `d=${d}: on the rocket bound`);
    assert.equal(tempoTier(car, d), 2, `d=${d}: on the car bound`);
    assert.equal(tempoTier(hare, d), 1, `d=${d}: on the hare bound`);
    assert.equal(tempoTier(hare + 1, d), 0, `d=${d}: past the hare`);
  }
  // Schwer reads a whole sentence: its bounds must sit later than the word rows'
  assert.ok(TEMPO_TIERS[2][2] > TEMPO_TIERS[0][2], "a sentence rocket cannot be a word rocket");
  for (const junk of [NaN, -1, undefined, null, "3000"]) {
    assert.equal(tempoTier(junk, 0), 0, `tempoTier(${String(junk)})`);
  }
  assert.equal(tempoTier(1000, 9), 0, "an unknown difficulty pays nothing");
});

test("awardTempo: fast-and-wrong never pays, and the badge only climbs", () => {
  assert.equal(awardTempo({ stars: 1, tier: 3, best: 0 }), 0, "below ⭐⭐ nothing is paid");
  assert.equal(awardTempo({ stars: 2, tier: 2, best: 0 }), 2);
  assert.equal(awardTempo({ stars: 3, tier: 1, best: 3 }), 3, "a slower round keeps the badge");
  assert.equal(awardTempo({ stars: 0, tier: 0, best: 2 }), 2, "a failed round keeps it too");
  assert.equal(awardTempo(), 0);
});

test("median: outliers cannot veto the round, junk yields null", () => {
  assert.equal(median([1000, 2000, 60000]), 2000, "one long think is not the verdict");
  assert.equal(median([1000, 2000, 3000, 4000]), 2500);
  assert.equal(median([NaN, 2000, undefined]), 2000);
  assert.equal(median([]), null);
  assert.equal(median(undefined), null);
});

// The ladder is einmaleins' ladder (§10.6) with lesen's own bounds: the shared
// faces and mechanics must not drift apart — only TEMPO_TIERS differs, by
// design (a sentence read is not a keypad answer).
test("the tempo mechanics are the einmaleins mechanics — parity (D11)", () => {
  assert.deepEqual(TEMPO_ICONS, emTempoIcons);
  assert.deepEqual(TEMPO_KEYS, emTempoKeys);
  const grids = [[], [500], [1000, 2000], [1, 2, 3, 4], [NaN, 800, -5]];
  for (const g of grids) assert.equal(median(g), emMedian(g), JSON.stringify(g));
  for (let stars = 0; stars <= 3; stars++) {
    for (let tier = 0; tier <= 3; tier++) {
      for (let best = 0; best <= 3; best++) {
        assert.equal(
          awardTempo({ stars, tier, best }),
          emAwardTempo({ stars, tier, best }),
          `stars=${stars} tier=${tier} best=${best}`,
        );
      }
    }
  }
});

// The wiring, pinned like einmaleins': measuring is easy to lose in a refactor
// and its absence is silent — the ladder simply never pays again.
test("the tempo ladder is wired: measured on first tries, saved, painted", () => {
  const src = read("games/lesen/lesen.js");
  assert.match(src, /answerTimes = \[\];[\s\S]*?missedIds = new Set\(\);/, "the round must reset the clock");
  assert.match(src, /if \(!missedIds\.has\(currentId\)\) \{/, "only first tries feed the ladder");
  assert.match(src, /answerTimes\.push\(took\)/);
  assert.match(src, /if \(tempoTier\(took, diff\) === 3\) blitzFlash\(\)/, "the ⚡ moment");
  assert.match(src, /tempoTier\(median\(answerTimes\), diff\)/, "the round's verdict is the median");
  assert.match(src, /awardTempo\(\{ stars, tier, best: oldTempo \}\)/, "the ⭐⭐ gate");
  assert.match(src, /tempo: tempoObj/, "…and it must reach the cookie");
  // the bolt flies over the stage, not inside the flipping word card
  assert.match(src, /document\.querySelector\("\.stage"\)\.appendChild\(b\)/);

  const picker = read("games/lesen/picker.js");
  assert.match(picker, /class="ttempo"/, "the picker tile wears the medal");
  assert.match(picker, /TEMPO_ICONS\[tempo\]/);

  assert.match(read("games/lesen/index.html"), /id="sum-tempo"/, "the summary needs its quiet line");
});

// The clock's start is the whole fairness of the ladder (§14.4): a word's time
// begins at the reveal tap — the cover time is the child's for free — and a
// sentence's when it appears. Wrongly starting a word's clock in askNext would
// bill her for time she spent not yet looking.
test("the tempo clock starts at the reveal for words, at the show for sentences", () => {
  const src = read("games/lesen/lesen.js");
  const revealFn = src.slice(src.indexOf("function reveal()"), src.indexOf("function armFlash()"));
  assert.match(revealFn, /qShownAt = Date\.now\(\)/, "a word's clock starts when she taps");
  const ask = src.slice(src.indexOf("function askNext()"), src.indexOf("function setAnswersEnabled"));
  const sentenceBranch = ask.slice(ask.indexOf("} else {"));
  assert.match(sentenceBranch, /qShownAt = Date\.now\(\)/, "a sentence's clock starts at the show");
  const wordBranch = ask.slice(ask.indexOf("if (question.kind"), ask.indexOf("} else {"));
  assert.ok(!/qShownAt/.test(wordBranch), "a covered word must not start the clock");
});

// The ⚡ deserves its own small sound (§10.6) — in both games, muted like all
// the rest. A silent reward is one the child cannot brag about.
test("a rocket answer zaps audibly, in both games", () => {
  assert.match(read("assets/js/audio.js"), /blitz\(\)\s*\{/, "audio.js has no zap");
  for (const f of ["games/lesen/lesen.js", "games/einmaleins/einmaleins.js"]) {
    const fn = read(f);
    const flash = fn.slice(fn.indexOf("function blitzFlash()"), fn.indexOf("function submit"));
    assert.match(flash, /sfx\.blitz\(\)/, `${f}: the bolt must be heard`);
  }
});

test("the tempo strings exist in both languages, and none names a time", () => {
  for (const lang of ["de", "en"]) {
    for (const key of ["tempo1", "tempo2", "tempo3", "tempoBest", "tileTempo"]) {
      const s = strings[lang][key];
      assert.ok(s, `${lang}.${key} is missing`);
      assert.ok(!/\d\s*(s|ms|sek|sec)/i.test(s), `${lang}.${key} says "${s}" — never a time (§10.3)`);
    }
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
    tempo: fullStars, // same digit-string layout (§14.5)
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

test("a word waits behind the ready cover; the blitz arms only on reveal (§14.2)", () => {
  // The blitz used to start the instant a word appeared, so the first word of a
  // round flashed before the child had looked or knew one was coming. A word now
  // waits behind a tap-to-reveal cover, and the flash is armed on the reveal, not
  // on the show — otherwise the clock would run again before she is ready.
  const game = read("games/lesen/lesen.js");

  const ask = game.slice(game.indexOf("function askNext"), game.indexOf("function setAnswersEnabled"));
  assert.ok(!/armFlash\(\)/.test(ask), "askNext must NOT arm the blitz — that would flash before the tap");
  assert.match(ask, /kind === "word"[\s\S]*?phase = "ready"[\s\S]*?add\("covered"\)[\s\S]*?setAnswersEnabled\(false\)/,
    "a word starts covered, in the ready phase, with its answers disabled");
  assert.match(ask, /else \{[\s\S]*?phase = "answer"[\s\S]*?remove\("covered"\)/,
    "a sentence never covers — nothing is taken away, so it shows at once");

  // bounded to reveal itself: armFlash() is defined right after it, and its
  // `function armFlash()` header would otherwise satisfy the /armFlash\(\)/ below
  const reveal = game.slice(game.indexOf("function reveal"), game.indexOf("function armFlash"));
  assert.match(reveal, /phase !== "ready"/, "reveal is idempotent: only a covered word reveals");
  assert.match(reveal, /remove\("covered"\)[\s\S]*?setAnswersEnabled\(true\)[\s\S]*?armFlash\(\)/,
    "reveal uncovers, enables the answers, THEN starts the blitz");

  // the cover is a real button, wired to reveal, so keyboard reaches it
  assert.match(game, /fastPress\(document\.getElementById\("wc-cover"\), reveal\)/);
  const html = read("games/lesen/index.html");
  assert.match(html, /<button[^>]*id="wc-cover"/, "the cover is a button, not a bare div");
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
