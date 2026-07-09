import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import { read } from "./pages.js";
import {
  POOL_COUNT, EASY_TABLES, pairIndex, pairOf, poolFor, questionFor,
  choicesFor, starsFor, nextStarGoal, ownedStars, STAR_SLOTS, starDigit, withStarDigit, tableStarIndex, fittedFontSize,
} from "../games/einmaleins/logic.js";

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("canonical pair index roundtrips over the full 100-item pool (§10.4)", () => {
  assert.equal(POOL_COUNT, 100);
  for (let t = 1; t <= 10; t++) {
    for (let f = 1; f <= 10; f++) {
      const id = pairIndex(t, f);
      assert.ok(id >= 0 && id < POOL_COUNT);
      assert.deepEqual(pairOf(id), [t, f]);
    }
  }
});

test("poolFor: single table, mixed, and easy-mixed (§10.2)", () => {
  assert.equal(poolFor(7, 1).length, 10);
  assert.ok(poolFor(7, 1).every((id) => pairOf(id)[0] === 7));
  assert.equal(poolFor(0, 1).length, 100);
  const easyMixed = poolFor(0, 0);
  assert.equal(easyMixed.length, 40);
  assert.ok(easyMixed.every((id) => EASY_TABLES.includes(pairOf(id)[0])));
});

test("questions always have the correct answer for every kind", () => {
  const rng = seeded(5);
  for (let i = 0; i < 500; i++) {
    const id = Math.floor(rng() * 100);
    const q = questionFor(id, 2, rng);
    const [t, f] = pairOf(id);
    if (q.kind === "mul") assert.equal(q.answer, t * f);
    if (q.kind === "div") assert.equal(q.answer, t);
    if (q.kind === "gap") assert.ok(q.answer === t || q.answer === f);
    assert.ok(q.text.includes("?"));
  }
});

// Mara has never seen "÷": her school writes division as ":". The sign is the
// caller's to choose, so `logic.js` stays pure and free of i18n.
test("the division sign is injected, and defaults to ÷", () => {
  const rng = seeded(5);
  let divs = 0;
  for (let i = 0; i < 500; i++) {
    const id = Math.floor(rng() * 100);
    const q = questionFor(id, 2, rng, ":");
    if (q.kind !== "div") continue;
    divs++;
    assert.ok(q.text.includes(" : "), `"${q.text}" must use the injected sign`);
    assert.ok(!q.text.includes("÷"));
  }
  assert.ok(divs > 0, "the sample must contain divisions");

  // Nothing else in the equation moves: same shape, same answer.
  const withDefault = questionFor(23, 2, () => 0.9);
  const withColon = questionFor(23, 2, () => 0.9, ":");
  assert.equal(withDefault.kind, "div");
  assert.equal(withDefault.text, withColon.text.replace(" : ", " ÷ "));
  assert.equal(withDefault.answer, withColon.answer);
});

// A division question shown with ":" must not be explained with "÷" — the aid
// used to rebuild the equation from `t` and `f` instead of from what was asked.
test("the aid reprints the question that was asked, not a new one", () => {
  const src = read("games/einmaleins/einmaleins.js");
  const fn = src.slice(src.indexOf("function showFeedback"));
  assert.ok(!fn.slice(0, 600).includes("÷"), "showFeedback must not hardcode a division sign");
  assert.match(fn.slice(0, 600), /question\.text\.replace/, "it builds from question.text");
  assert.match(src, /questionFor\(id, diff, Math\.random, t\("divSign"\)\)/);
});

test("easy/medium difficulties only produce plain multiplication", () => {
  const rng = seeded(2);
  for (let d = 0; d <= 1; d++) {
    for (let i = 0; i < 100; i++) {
      assert.equal(questionFor(i, d, rng).kind, "mul");
    }
  }
});

test("multiple choice: 4 unique positive options including the answer", () => {
  const rng = seeded(8);
  for (let i = 0; i < 200; i++) {
    const id = Math.floor(rng() * 100);
    const q = questionFor(id, 0, rng);
    const opts = choicesFor(q, rng);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4);
    assert.ok(opts.includes(q.answer));
    assert.ok(opts.every((o) => o > 0));
  }
});

test("star criteria (§10.3): accuracy only, never the clock", () => {
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(9, 10), 2);
  assert.equal(starsFor(8, 10), 2);
  assert.equal(starsFor(7, 10), 1);
  assert.equal(starsFor(6, 10), 1);
  assert.equal(starsFor(5, 10), 0);
  assert.equal(starsFor(0, 10), 0);
  // Regression: stars used to depend on the round's duration, which punished a
  // child for reading or tapping slowly. starsFor takes no time argument, and a
  // stray third argument must not be able to change the outcome.
  assert.equal(starsFor.length, 2);
  assert.equal(starsFor(10, 10, 999), 3);
});

// Mara finished a round, met three buttons, and pressed the chip *behind* the
// sheet. The summary now offers exactly one thing to press, and the two ways
// out — the map and the level picker — stay where she already reached for them.
test("the round summary has one button and nothing else to press", () => {
  const page = read("games/einmaleins/index.html");
  const sheet = page.slice(page.indexOf('id="sum-overlay"'), page.indexOf("</div>\n\n  <script"));
  assert.equal((sheet.match(/<button/g) ?? []).length, 1, "exactly one button");
  assert.match(sheet, /id="sum-ok"/);
  for (const gone of ["sum-again", "sum-pick", "sum-secondary", "sum-link"]) {
    assert.ok(!sheet.includes(gone), `${gone} is still in the summary`);
  }
  // …and that one button must be the one the focus lands on: the trophy above
  // it is a link to the album, so Enter would otherwise leave the game.
  assert.match(read("games/einmaleins/einmaleins.js"), /initialFocus: "#sum-ok"/);
});

// The summary is the only overlay a child meets without asking for it, and the
// only one with no dismiss. So it sits UNDER the bar and the chip that let her
// leave; a backdrop over them would trap her in an endless run of rounds.
test("the top bar and the chip stay above the round summary", () => {
  const css = read("assets/css/schlaufuchs.css");
  const z = (sel) => {
    const block = css.slice(css.indexOf(`${sel} {`));
    const m = block.slice(0, block.indexOf("}")).match(/z-index:\s*(\d+)/);
    assert.ok(m, `${sel} needs a z-index`);
    return Number(m[1]);
  };
  const overlay = z(".overlay");
  assert.ok(z("#sum-overlay") < z(".topbar"), "the bar must stay reachable");
  assert.ok(z("#sum-overlay") < z(".pickheading"), "the chip must stay reachable");
  assert.ok(z(".topbar") < overlay, "a real modal sheet still covers the bar");
  assert.ok(z(".pickheading") < overlay, "…and the chip");
});

test("the round summary congratulates in six ways, in both languages", () => {
  // The dead-key scanner waves `sumOk*` through on a regex allowlist, so it can
  // no longer notice one going missing. Name them here instead.
  const src = read("games/einmaleins/einmaleins.js");
  for (let i = 1; i <= 6; i++) {
    assert.equal(typeof de[`sumOk${i}`], "string", `de.js is missing sumOk${i}`);
    assert.equal(typeof en[`sumOk${i}`], "string", `en.js is missing sumOk${i}`);
    assert.ok(src.includes(`"sumOk${i}"`), `einmaleins.js never offers sumOk${i}`);
  }
  assert.ok(!("again" in de) && !("again" in en), '"Nochmal" retired with the button');
});

test("the trophy in the summary is a link to the room it belongs in", () => {
  const src = read("games/einmaleins/einmaleins.js");
  const block = src.slice(src.indexOf("if (won.length > 0)"));
  assert.match(block.slice(0, 500), /href: "\.\.\/\.\.\/album\.html"/, "the trophy must be tappable");
  assert.match(block.slice(0, 500), /cls: "won"/, "…and still readable by tools/play.js");
});

// Mara never found the level picker: the chip above the scene read as a
// caption, so she never tried pressing it.
test("the chip looks like the button it is", () => {
  const css = read("assets/css/schlaufuchs.css");
  const block = css.slice(css.indexOf(".pickheading {"), css.indexOf(".pickheading:active"));
  assert.match(block, /border: 2px solid var\(--orange-soft\)/, "a chip needs an edge");
  assert.match(css, /\.pickheading::after \{ content: " ▾"/, "…and a caret that says it opens");
  // The caret must be a pseudo-element: updateChip() writes textContent, which
  // would silently eat a glyph carried in the string.
  assert.ok(!read("games/einmaleins/einmaleins.js").includes("▾"));
  assert.match(css, /\.seg button\[aria-pressed="true"\] \{[^}]*inset 0 0 0 3px/, "the chosen level must be unmistakable");
});

test('the "Alle" tile says with a picture that it mixes the tables', () => {
  const src = read("games/einmaleins/einmaleins.js");
  assert.match(src, /tbl === 0 \? `🎲 \$\{tbl2short\(tbl\)\}`/);
});

test("the summary names the price of the next star", () => {
  // A child who scores 9/10 keeps one star and is told nothing about why.
  // Every un-earned star must have a goal line; a mastered round must not.
  assert.equal(nextStarGoal(0), "starGoal1");
  assert.equal(nextStarGoal(starsFor(6, 10)), "starGoal2");
  assert.equal(nextStarGoal(starsFor(8, 10)), "starGoal3");
  assert.equal(nextStarGoal(starsFor(10, 10)), null);
});

test("nextStarGoal is total: garbage in, a hidden row out — never a blank one", () => {
  const KEYS = ["starGoal1", "starGoal2", "starGoal3"];

  // The contract the caller leans on: a real key, or null. Never undefined —
  // t(undefined) renders "" and `hidden = goal === null` stays false, so the
  // summary would grow a blank row instead of failing loudly.
  for (const any of [undefined, null, -1, 0, 1, 2, 3, 4, 1.5, "2", NaN, true, {}]) {
    const goal = nextStarGoal(any);
    assert.ok(goal === null || KEYS.includes(goal), `nextStarGoal(${String(any)}) → ${goal}`);
  }
  for (const stars of [0, 1, 2]) assert.equal(nextStarGoal(stars), KEYS[stars]);
  for (const none of [-1, 3, 4, 1.5, NaN, undefined, null]) assert.equal(nextStarGoal(none), null);

  // The dead-key test waves `starGoal*` through on a regex allowlist, so it can
  // no longer notice one going missing. Name them here instead.
  for (const k of KEYS) {
    assert.equal(typeof de[k], "string", `de.js is missing ${k}`);
    assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
  }
});

// Regression: the summary showed "9/10 · 46 s", which whispers "faster is
// better" at a child who is slow and right.
//
// The round IS timed again — the parents' view needs it (§20) — so the rule is
// no longer "never look at the clock" but "never show it to the child". That is
// a weaker invariant and an easier one to break, so it is pinned to the only
// two places a duration could leak: the dictionaries, and the block that paints
// the summary.
test("the round is timed for the parents, and never shown to the child", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../games/einmaleins/einmaleins.js", import.meta.url)),
    "utf8",
  );
  const endRound = src.slice(src.indexOf("function endRound()"));

  // the duration is banked, which means it must be measured
  assert.ok(endRound.includes("addPractice("), "the round's duration must reach storage (§20)");
  assert.ok(endRound.includes("Date.now()"), "…so it has to be read from the clock");

  // the summary is everything the child sees of the round, and it must be mute
  const painted = endRound.slice(endRound.indexOf("setTimeout("));
  assert.ok(painted.includes('t("roundStat"'), "the summary must still report the score");
  assert.ok(
    !/Date\.now|seconds|\bt0\b|elapsed/i.test(painted),
    "the summary must not mention the round's duration",
  );
  assert.match(
    painted,
    /t\("roundStat", \{ ok: firstTryOk, total \}\)/,
    "roundStat takes the score and nothing else",
  );

  for (const [lang, dict] of [["de", de], ["en", en]]) {
    assert.ok(!dict.roundStat.includes("{s}"), `${lang}.roundStat still has a seconds slot`);
    assert.ok(!/\bs\b|sek|\bsec/i.test(dict.roundStat), `${lang}.roundStat names a unit of time`);
  }
});

test("star digit string: 11 slots, mixed table at index 10", () => {
  assert.equal(tableStarIndex(1), 0);
  assert.equal(tableStarIndex(10), 9);
  assert.equal(tableStarIndex(0), 10);
  let s = withStarDigit(undefined, 7, 2);
  assert.equal(s.length, 11);
  assert.equal(starDigit(s, 7), 2);
  assert.equal(starDigit(s, 3), 0);
  s = withStarDigit(s, 0, 3);
  assert.equal(starDigit(s, 0), 3);
  assert.equal(starDigit(s, 7), 2);
});

// Regression: at 19vw the longest equation wrapped to two lines on a phone.
// The rendered width of a question in the display face is ~5.1em for the
// shortest ("2 × 2 = ?") and ~7.5em for the longest ("100 ÷ 10 = 100").
test("fittedFontSize(): the question never needs a second line", () => {
  const EM_SHORT = 5.07;
  const EM_LONG = 7.51;

  // a short question at the wished-for size already fits: leave it alone
  const wish = 76; // 19vw at 402px
  assert.equal(fittedFontSize(wish, 388, EM_SHORT * wish), wish);

  // the long one does not fit, so it shrinks — and then it does fit
  const fitted = fittedFontSize(wish, 388, EM_LONG * wish);
  assert.ok(fitted < wish, "long question must shrink");
  assert.ok(EM_LONG * fitted <= 388, "shrunk question must fit the line");

  // every phone width we target, for the longest question
  for (const avail of [292, 332, 388, 532]) {
    const size = fittedFontSize(wish, avail, EM_LONG * wish);
    assert.ok(EM_LONG * size <= avail, `overflows at ${avail}px`);
    assert.ok(size > 0, `nonsense size at ${avail}px`);
  }
});

test("fittedFontSize(): degenerate measurements never change the size", () => {
  // an element that is not laid out yet reports 0 — do not divide by it
  assert.equal(fittedFontSize(76, 0, 0), 76);
  assert.equal(fittedFontSize(76, 388, 0), 76);
  assert.equal(fittedFontSize(76, 0, 500), 76);
});

// The scene (§10.5): the basket holds what you own, the sky what is left.
//
// Its whole reason to exist is that it fills and never spills. A basket that
// drops a star on the first mistake — and the first mistake usually arrives at
// question two — is a machine for making a child quit. Nothing is at stake
// anyway: endRound() keeps the best score, never the last one.
test("the basket only ever fills, whatever order the mistakes arrive in", () => {
  const TOTAL = 10;
  assert.equal(STAR_SLOTS, 3);

  const play = (wrongAt, best) => {
    const seen = [];
    let banked = 0;
    for (let i = 0; i < TOTAL; i++) {
      if (!wrongAt.has(i)) banked++;
      seen.push(ownedStars({ firstTrySolved: banked, total: TOTAL }, best));
    }
    return seen;
  };

  const orders = [new Set(), new Set([0]), new Set([0, 1]), new Set([9]), new Set([0, 4, 9]),
    new Set([0, 1, 2, 3, 4]), new Set([2, 5]), new Set([1, 3, 5, 7])];
  for (const best of [0, 1, 2, 3]) {
    for (const wrongAt of orders) {
      const steps = play(wrongAt, best);
      assert.ok(steps[0] >= best, "the basket opens with what the tile already holds");
      for (let i = 1; i < steps.length; i++) {
        assert.ok(steps[i] >= steps[i - 1], `basket lost a star: best=${best}, wrong at ${[...wrongAt]}`);
      }
      const earned = starsFor(TOTAL - wrongAt.size, TOTAL);
      assert.equal(steps.at(-1), Math.max(best, earned), "basket and summary must agree");
    }
  }
});

// Regression: the round told a child "noch 2 richtig bis ⭐⭐⭐" on a tile they
// had already taken to three stars — and then paid nothing, because
// `endRound()` only pays on `stars > old`. The scene must know what is owned.
test("a mastered tile opens with a full basket and promises nothing more", () => {
  const TOTAL = 10;
  for (let solved = 0; solved <= TOTAL; solved++) {
    assert.equal(ownedStars({ firstTrySolved: solved, total: TOTAL }, 3), 3,
      "a three-star tile can never show fewer than three, nor more");
  }
  assert.equal(ownedStars({ firstTrySolved: 0, total: TOTAL }, 2), 2);
  assert.equal(ownedStars({ firstTrySolved: 9, total: TOTAL }, 2), 2, "9/10 is still two stars");
  assert.equal(ownedStars({ firstTrySolved: 10, total: TOTAL }, 2), 3, "10/10 wins the last one");
  assert.equal(ownedStars({ firstTrySolved: 0, total: TOTAL }, 0), 0);
  assert.equal(ownedStars({ firstTrySolved: 6, total: TOTAL }, 0), 1);
});

test("ownedStars is total: junk in, a sane basket out", () => {
  for (const bad of [undefined, null, -1, 4, 99, 1.5, NaN, "2", {}]) {
    const n = ownedStars({ firstTrySolved: 5, total: 10 }, bad);
    assert.ok(Number.isInteger(n) && n >= 0 && n <= STAR_SLOTS, `best=${String(bad)} -> ${n}`);
  }
  assert.equal(ownedStars(), 0, "no round, no stars");
  assert.equal(ownedStars({}, 2), 2);
  assert.equal(ownedStars({ firstTrySolved: 0, total: 0 }, 0), 0, "never divide by an empty round");
});
