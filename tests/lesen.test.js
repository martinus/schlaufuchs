// Lesen pure logic (§14): item addressing, the blitz clock, questions and
// options, star criteria, digit-string codecs, and the cookie budget.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUND_SIZE, DIFF_KEYS, DIFF_SLUGS, MIXED, STAR_TILES, FLASH_MS, flashMs,
  packsFor, poolFor, itemAt, questionFor, optionsFor,
  STAR_SLOTS, starsFor, ownedStars,
  starDigit, withStarDigit, maxPoints,
  TEMPO_SLOTS, TEMPO_TIERS, TEMPO_ICONS, TEMPO_KEYS, median, tempoTier, awardTempo,
  GUARD_MS, isBounce,
} from "../games/lesen/logic.js";
import {
  starsFor as emStarsFor, ownedStars as emOwnedStars,
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
  assert.equal(itemCount("de"), 256, "the box string's length — append-only");
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

test("pools: every tile outgrows the round, tiles never overlap (§7.3)", () => {
  // Each tile is a primary pack plus its one extension, so its pool is twice the
  // difficulty's per-pack size; "Alle" unions all four tiles (§14.3).
  const tilePool = [20, 20, 24];
  for (let d = 0; d < 3; d++) {
    const tiles = packsFor(d, DE);
    assert.equal(tiles.length, 4, `difficulty ${d} offers four tiles`);
    const seen = new Set();
    tiles.forEach((_, p) => {
      const pool = poolFor(d, p, DE);
      assert.equal(pool.length, tilePool[d], `diff ${d} tile ${p}`);
      assert.ok(pool.length > ROUND_SIZE, "a pool must outgrow the round");
      for (const id of pool) {
        assert.ok(!seen.has(id), `id ${id} sits in two tiles`);
        seen.add(id);
      }
    });
    const mixed = poolFor(d, MIXED, DE);
    assert.equal(mixed.length, tilePool[d] * 4, `diff ${d} "Alle" is the union`);
    assert.deepEqual([...seen].sort((a, b) => a - b), mixed.sort((a, b) => a - b));
  }
  // a corrupt tile index reads as "Alle", never as an empty round
  for (const junk of [-1, 7, 1.5, NaN, undefined]) {
    assert.equal(poolFor(0, junk, DE).length, 80, `pack=${String(junk)}`);
  }
});

// --- the blitz clock (§14.2) ---------------------------------------------------

test("flashMs falls strictly with the box, never below half a second", () => {
  // Only Leicht flashes: it is the one difficulty that shows a single word.
  for (let box = 0; box <= 4; box++) {
    const ms = flashMs(box, 0);
    assert.equal(ms, FLASH_MS[0][box]);
    assert.ok(ms >= 500, `box ${box}: ${ms}ms is unreadably short`);
    if (box > 0) assert.ok(ms < flashMs(box - 1, 0), "the child must feel getting faster");
  }
  // junk boxes read as box 2, like the session itself (§7.1)
  for (const junk of [undefined, null, -1, 9, "x", NaN]) {
    assert.equal(flashMs(junk, 0), FLASH_MS[0][2], `box=${String(junk)}`);
  }
  // Mittel sentences and Schwer passages are never flashed (§14.1, §14.2)
  assert.equal(FLASH_MS.length, 1, "only Leicht has a flash row");
  for (const box of [0, 4]) {
    assert.equal(flashMs(box, 1), null, "Mittel is read, not blitzed");
    assert.equal(flashMs(box, 2), null, "Schwer is read, not blitzed");
  }
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

test("sentence items show one face per encounter, keyed to its verdict (§14.1)", () => {
  for (let id = 0; id < itemCount("de"); id++) {
    const { item } = itemAt(id, DE);
    if (item.ok === undefined) continue;
    // rng < 0.5 shows the true face, otherwise the nonsense one
    const yes = questionFor(id, DE, () => 0);
    assert.deepEqual(yes, { kind: "sent", text: item.ok, answer: true }, `id ${id}: the true face`);
    const no = questionFor(id, DE, () => 0.9);
    assert.deepEqual(no, { kind: "sent", text: item.no, answer: false }, `id ${id}: the nonsense face`);
    // a sentence has no options to choose from — it answers with a verdict
    assert.equal(optionsFor(id, DE), null, `id ${id}: sentences have no options`);
  }
});

test("reading items ask their question, with the correct answer first (§14.2)", () => {
  for (let id = 0; id < itemCount("de"); id++) {
    const { item } = itemAt(id, DE);
    if (item.text === undefined) continue;
    const q = questionFor(id, DE);
    assert.equal(q.kind, "read");
    assert.equal(q.passage, item.text, `id ${id}: the passage is carried`);
    assert.equal(q.text, item.q, `id ${id}: the question is what she answers`);
    assert.equal(q.answer, item.a[0], `id ${id}: the correct answer is authored first`);
    assert.equal(q.scene, item.e, `id ${id}: the scene emoji is carried for the card`);
  }
});

test("optionsFor: four unique choices with the answer among them (§14.2, §14.3)", () => {
  const rng = seeded(11);
  for (let id = 0; id < itemCount("de"); id++) {
    const found = itemAt(id, DE);
    if (found.item.ok !== undefined) continue; // a sentence answers with a verdict, no options
    const opts = optionsFor(id, DE, rng);
    assert.equal(opts.length, 4, `id ${id}: four choices`);
    assert.equal(new Set(opts).size, 4, `id ${id}: duplicate option`);
    if (found.item.w !== undefined) {
      // a word: four emoji, the answer exactly once, all from the same pack
      assert.equal(opts.filter((e) => e === found.item.e).length, 1, "the answer, exactly once");
      const home = new Set(found.pack.items.map((it) => it.e));
      for (const e of opts) assert.ok(home.has(e), `id ${id}: ${e} is not a pack-mate`);
    } else {
      // a reading passage: exactly its own four answers, the correct one present
      assert.deepEqual([...opts].sort(), [...found.item.a].sort(), `id ${id}: not the item's answers`);
      assert.ok(opts.includes(found.item.a[0]), `id ${id}: the correct answer must be an option`);
    }
  }
  // deterministic under a seeded rng — the driver and the tests can replay it
  assert.deepEqual(optionsFor(0, DE, seeded(5)), optionsFor(0, DE, seeded(5)));
});

// --- stars (§14.3) ---------------------------------------------------------------

test("stars on a round of eight: 5 → ⭐, 7 → ⭐⭐, 8 → ⭐⭐⭐", () => {
  assert.equal(ROUND_SIZE, 8);
  assert.equal(STAR_SLOTS, 3);
  // ratios 0.6 / 0.8 / 1.0: ⭐ at 5/8, ⭐⭐ at 7/8, ⭐⭐⭐ only at 8/8
  const want = [0, 0, 0, 0, 0, 1, 1, 2, 3];
  for (let ok = 0; ok <= ROUND_SIZE; ok++) assert.equal(starsFor(ok, ROUND_SIZE), want[ok], `${ok}/8`);
});

test("the star rules are the einmaleins rules — parity, so they cannot drift (D11)", () => {
  for (let total = 0; total <= 12; total++) {
    for (let ok = 0; ok <= total; ok++) {
      assert.equal(starsFor(ok, total), emStarsFor(ok, total), `${ok}/${total}`);
    }
  }
  for (let s = 0; s <= 4; s++) {
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
  // Mittel reads a sentence, Schwer a whole passage: both sit later than Leicht,
  // whose answer is a single word and a tap, and Schwer sits later than Mittel.
  for (let tier = 0; tier < 3; tier++) {
    assert.ok(TEMPO_TIERS[1][tier] > TEMPO_TIERS[0][tier], "a sentence read is slower than a word");
    assert.ok(TEMPO_TIERS[2][tier] > TEMPO_TIERS[1][tier], "a passage read is slower than a sentence");
  }
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

// The double-tap guard (§14.2): a young reader double-clicked a Schwer passage
// and the bounce picked a wrong answer to a question she had not read. A press
// within GUARD_MS of the last one is that bounce.
test("isBounce swallows a press inside the guard window, keeps the rest", () => {
  // inside the window → a bounce; at or past the edge → a real press
  assert.equal(isBounce(1000, 1000), true, "the same instant is a bounce");
  assert.equal(isBounce(1000 + GUARD_MS - 1, 1000), true, "just inside is a bounce");
  assert.equal(isBounce(1000 + GUARD_MS, 1000), false, "exactly the window is a real press");
  assert.equal(isBounce(1000 + GUARD_MS + 1, 1000), false, "past it is a real press");
  assert.equal(isBounce(5000, 1000), false, "a considered answer is never a bounce");
  // nothing pressed yet, or a fresh round: the first answer must always land
  assert.equal(isBounce(1000, 0), false, "the very first press is not a bounce");
  assert.equal(isBounce(1000, -Infinity), false);
  assert.equal(isBounce(1000, NaN), false, "an unset guard never blocks");
  assert.equal(isBounce(NaN, 1000), false);
  // a caller may narrow or widen the window
  assert.equal(isBounce(1100, 1000, 50), false);
  assert.equal(isBounce(1100, 1000, 500), true);
});

// The window must sit above NEXT_MS (250ms): the next question shows that soon
// after the last press, so a shorter guard would leave the reported bounce —
// second tap onto the fresh question — unprotected. It must also stay under the
// driver's SETTLE (350ms) so real, spaced play is never mistaken for a bounce.
test("the guard window brackets the NEXT_MS→SETTLE gap", () => {
  assert.ok(GUARD_MS > 250, "must outlast NEXT_MS or the bounce reaches the next question");
  assert.ok(GUARD_MS < 350, "must clear a genuinely spaced answer");
});

// The wiring, pinned like the tempo ladder's: the guard is a silent no-op if
// answerPress stops consulting it, and its absence is exactly the bug.
test("the double-tap guard is wired into every answer press", () => {
  const src = read("games/lesen/lesen.js");
  assert.match(src, /if \(isBounce\(now, guardArmedAt\)\) return;/, "the bounce is swallowed");
  assert.match(src, /guardArmedAt = now;/, "…and each accepted press re-arms the window");
  // it must guard the whole handler — the retry that skips the aid, too — not
  // only the first-answer branch, so it sits before the phase dispatch
  const press = src.slice(src.indexOf("function answerPress"));
  assert.ok(
    press.indexOf("isBounce(now, guardArmedAt)") < press.indexOf('phase === "answer"'),
    "the guard runs before the phase dispatch",
  );
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
  // The box string is one digit per item, so it grew with the deeper tiles
  // (256 items, §14.3); the whole maxed section is still a small fraction of the
  // budget, and the whole-purse check below proves the doubled content — plus a
  // future English box of the same length — still fits with room to spare.
  const bytes = JSON.stringify({ lesen: maxed }).length;
  assert.ok(bytes < 420, `lesen section is ${bytes} bytes`);

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
  // Nothing that HIDES the word may animate — a keyframe would never run under
  // reduced motion and the flash would silently stop flashing. A decorative
  // scene cheer (the picture-book anchor, §14.2) is a keyframe on purpose, and
  // reduced motion is meant to still it; it is whitelisted by name so any OTHER
  // keyframe or a `wc-hidden` animation still fails here.
  const wcHiddenRules = cardCss.match(/[^}]*wc-hidden[^{}]*\{[^}]*\}/g) ?? [];
  for (const r of wcHiddenRules) assert.ok(!/animation/.test(r), `the word-hide must not animate: ${r}`);
  assert.ok(!/@keyframes\s+(?!scene-cheer\b)/.test(cardCss), "only the decorative scene cheer may be a keyframe here");
});

test("the scene anchor and the lively tap moment are wired (§14.2)", () => {
  const game = read("games/lesen/lesen.js");
  // The scene emoji renders into its OWN element, and #question/#passage carry
  // only the question and passage text — the round driver reads THEIR text to
  // find the answer, and the scene (which could telegraph it) must never join it.
  const render = game.slice(game.indexOf("function renderQuestion"), game.indexOf("window.addEventListener"));
  assert.match(render, /const scene = \$\("scene"\)/, "renderQuestion fills its own scene element");
  assert.match(render, /scene\.textContent =/, "the scene emoji is written to #scene");
  assert.match(render, /\$\("question"\)\.textContent = question\.text/, "#question stays the question text");
  assert.ok(!/\$\("(?:question|passage)"\)[^\n]*scene/.test(render), "the scene must not be mixed into the question/passage text");

  // A correct answer hops with a ✓, a wrong one shakes — added on the same tile
  // the child tapped, in submit and in the aid's retry.
  const submit = game.slice(game.indexOf("function submit"), game.indexOf("function showFeedback"));
  assert.match(submit, /"ans-hop"/, "a correct tile hops");
  assert.match(submit, /"ans-shake"/, "a wrong tile shakes");

  // The ✓ badge is a ::after (not an animation), so reduced motion keeps it; the
  // hop and shake ARE keyframes, meant to be stilled under reduced motion.
  const css = read("assets/css/schlaufuchs.css");
  assert.match(css, /\.ans-hop::after\s*\{[^}]*content:\s*"✓"/, "the correct tile wears a ✓ badge");
  assert.match(css, /@keyframes ans-hop/, "the hop is a keyframe, stilled under reduced motion");
  assert.match(css, /\.ans-shake\s*\{[^}]*animation/, "the shake is an animation");
});

test("Schwer never reveals its answer — she picks again until right (§14.2)", () => {
  const game = read("games/lesen/lesen.js");

  // A wrong reading answer must NOT open the reveal aid: the passage stays on
  // screen and the tapped tile is retired. Word and Mittel still re-teach via
  // showFeedback (a blitzed word / a verdict she may not have grasped).
  const submit = game.slice(game.indexOf("function submit"), game.indexOf("function showFeedback"));
  assert.match(submit, /question\.kind === "read"\) btn\.disabled = true;\s*else showFeedback\(value\)/,
    "a wrong read tile is retired (passage stays); word/Mittel open the aid");

  // A wrong RE-PICK on Schwer retires that tile too — never reveals.
  const press = game.slice(game.indexOf("function answerPress"), game.indexOf("function blitzFlash"));
  assert.match(press, /question\.kind === "read"\)[\s\S]*?retireWrong\(btn\)/, "a wrong re-pick on Schwer is retired");

  // retireWrong disables the tile (so it cannot be tapped again) and never names
  // the answer.
  const retire = game.slice(game.indexOf("function retireWrong"), game.indexOf("function rejectRetry"));
  assert.match(retire, /btn\.disabled = true/, "the retired tile cannot be tapped again");
  assert.ok(!/question\.answer/.test(retire), "retireWrong must never name the answer");

  // The reveal is gone entirely: no reading branch in the aid, and the
  // "Correct: …" string is removed from i18n (both directions of the parity test
  // in lesen-content already guard key parity — this guards its absence).
  const aid = game.slice(game.indexOf("function showFeedback"), game.indexOf("function retireWrong"));
  assert.ok(!/lesenAnswerIs|fb-lbl|fb-scene/.test(aid), "no Schwer reveal left in the aid");
  assert.ok(!/lesenAnswerIs/.test(read("games/lesen/i18n.js")), "the reveal string is removed from i18n");
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
