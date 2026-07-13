import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import { read } from "./pages.js";
import {
  POOL_COUNT, EASY_TABLES, pairIndex, pairOf, poolFor, questionFor,
  choicesFor, starsFor, ownedStars, STAR_SLOTS, starDigit, withStarDigit, tableStarIndex, fittedFontSize,
  retryStep, ALL_TABLES, HARD_TABLES, ROUND_SIZE, tablesFor, pairHardness, hardnessBoost,
  median, tempoTier, awardTempo, TEMPO_TIERS, TEMPO_SLOTS, recallStep, foldRecall,
} from "../games/einmaleins/logic.js";
import { tilePointsLeft } from "../assets/js/rewards.js";
import { starGroupsHTML, winFlightHTML } from "../assets/js/levelpicker.js";
import { BUDGET } from "../assets/js/storage.js";
import { GRAPHICS } from "../assets/js/graphics.js";
import strings from "../games/einmaleins/i18n.js";

// Type a whole string through retryStep, returning the final step.
function typeAll(keys, answer, start = "") {
  let step = { input: start, state: "typing" };
  for (const k of keys) step = retryStep(step.input, k, answer);
  return step;
}

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
  // Leicht: a row is its ten facts, one orientation, factors 1..10.
  assert.equal(poolFor(7, 0).length, 10);
  assert.ok(poolFor(7, 0).every((id) => pairOf(id)[0] === 7));
  const easyMixed = poolFor(0, 0);
  assert.equal(easyMixed.length, 40);
  assert.ok(easyMixed.every((id) => EASY_TABLES.includes(pairOf(id)[0])));
  assert.equal(poolFor(0, 1).length, 100);
});

// With ten facts and ten questions the old fixed-table pool asked every fact
// every round, known or not — the Leitner weights had nothing to choose from.
// A row on Mittel/Schwer now holds both orientations, so the pool is larger
// than the round and mastered facts can finally rest (§7.2).
test("a fixed table on Mittel/Schwer holds both orientations", () => {
  const mittel = poolFor(4, 1);
  assert.equal(mittel.length, 19, "10 facts + 9 commuted, the square only once");
  assert.equal(new Set(mittel).size, 19);
  assert.ok(mittel.every((id) => pairOf(id).includes(4)));
  assert.ok(mittel.includes(pairIndex(4, 7)) && mittel.includes(pairIndex(7, 4)));

  const schwer = poolFor(4, 2);
  assert.equal(schwer.length, 15, "8 hard factors + 7 commuted");
  assert.ok(schwer.every((id) => pairOf(id).includes(4)));
});

// "Schwer" with 1×1 and 8×10 in it tells the child the label lies: nothing
// with a factor of 1 or 10 is hard, so Schwer never draws one (§10.2).
test("Schwer pools never contain a factor of 1 or 10", () => {
  for (const table of [0, ...HARD_TABLES]) {
    for (const id of poolFor(table, 2)) {
      const [t, f] = pairOf(id);
      assert.ok(HARD_TABLES.includes(t) && HARD_TABLES.includes(f),
        `${t}×${f} has no place on Schwer (table ${table})`);
    }
  }
  assert.equal(poolFor(0, 2).length, 64, "mixed Schwer is the 8×8 hard core");
});

test("Schwer rounds run longer (§7.3)", () => {
  assert.deepEqual(ROUND_SIZE, [10, 10, 12]);
});

// The two knobs above only exist if the page actually turns them: the session
// must be created with the difficulty's round size and the hardness boost.
test("the round is drawn with the difficulty's size and the hardness boost", () => {
  const src = read("games/einmaleins/einmaleins.js");
  assert.match(src, /roundSize: ROUND_SIZE\[diff\]/);
  assert.match(src, /boost: \(id\) => hardnessBoost\(id, diff\)/);
});

test("pairHardness: trivial facts score 0, the drilled ones score highest", () => {
  assert.equal(pairHardness(1, 1), 0);
  assert.equal(pairHardness(8, 10), 3, "×10 contributes nothing");
  assert.equal(pairHardness(7, 8), 6, "the classroom's hardest");
  assert.ok(pairHardness(2, 2) < pairHardness(6, 7));
  // squares are chanted and stick better than their neighbours
  assert.ok(pairHardness(8, 8) < pairHardness(7, 8));
  // symmetric: 4×7 is the same fact as 7×4
  for (let t = 1; t <= 10; t++) {
    for (let f = 1; f <= 10; f++) {
      assert.equal(pairHardness(t, f), pairHardness(f, t));
      assert.ok(pairHardness(t, f) >= 0 && pairHardness(t, f) <= 6);
    }
  }
});

test("hardnessBoost: neutral on Leicht, up to 7× on Mittel/Schwer", () => {
  for (let id = 0; id < 100; id++) assert.equal(hardnessBoost(id, 0), 1);
  assert.equal(hardnessBoost(pairIndex(1, 1), 2), 1);
  assert.equal(hardnessBoost(pairIndex(7, 8), 2), 7);
  for (const d of [1, 2]) {
    for (let id = 0; id < 100; id++) {
      const [t, f] = pairOf(id);
      assert.equal(hardnessBoost(id, d), 1 + pairHardness(t, f));
    }
  }
});

test("questions always have the correct answer for every kind", () => {
  const rng = seeded(5);
  for (let i = 0; i < 500; i++) {
    const id = Math.floor(rng() * 100);
    const q = questionFor(id, 2, rng);
    const [t, f] = pairOf(id);
    if (q.kind === "mul") assert.equal(q.answer, t * f);
    if (q.kind === "div") assert.ok(q.answer === t || q.answer === f);
    if (q.kind === "gap") assert.ok(q.answer === t || q.answer === f);
    assert.ok(q.text.includes("?"));
    // whatever the kind, the printed equation must hold with the answer in it
    const [lhs, rhs] = q.text.replace("?", q.answer).split(" = ").map((s) => s.trim());
    const [a, op, b] = lhs.split(" ");
    assert.equal(op === "×" ? Number(a) * Number(b) : Number(a) / Number(b), Number(rhs), q.text);
  }
});

// "12 : 3 = ?" in the 4er-Reihe answers itself: every answer in that round is
// a partner of 4. On a fixed table the gap and the division solve for the
// OTHER factor — the table the child picked is never the thing she is asked
// to produce (§10.2). Mixed rounds may ask in both directions.
test("on a fixed table, the unknown is never the table itself", () => {
  const rng = seeded(11);
  for (const table of [2, 4, 7, 9]) {
    for (const id of poolFor(table, 2)) {
      const [t, f] = pairOf(id);
      for (let i = 0; i < 30; i++) {
        const q = questionFor(id, 2, rng, ":", table);
        if (q.kind === "mul") continue;
        if (t === f) continue; // the square: both factors are the table
        assert.notEqual(q.answer, table, `"${q.text}" asks for the ${table}er row itself`);
        if (q.kind === "div") {
          assert.ok(q.text.includes(` : ${table} =`), `"${q.text}" must divide by the table`);
        }
      }
    }
  }
  // mixed rounds keep both directions
  const kinds = new Set();
  for (let i = 0; i < 300; i++) {
    const q = questionFor(pairIndex(3, 4), 2, rng, ":", 0);
    if (q.kind !== "mul") kinds.add(q.answer);
  }
  assert.deepEqual([...kinds].sort(), [3, 4], "mixed may solve for either factor");
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
  assert.match(fn.slice(0, 600), /eqHTML\(question\.text\)\.replace/, "it builds from question.text");
  assert.match(src, /questionFor\(id, diff, Math\.random, t\("divSign"\), table\)/);
});

// German divides with a colon, which sits on the baseline: between two 40px
// numerals "12 : 3" reads as a label and its value. It is lifted to the optical
// middle — in the question AND in the aid, which prints the same equation twice.
test("the division colon is lifted wherever the equation is drawn", () => {
  const src = read("games/einmaleins/einmaleins.js");
  const css = read("assets/css/schlaufuchs.css");
  assert.match(src, /function eqHTML/);
  for (const caller of ["function renderQuestion", "function showFeedback"]) {
    const fn = src.slice(src.indexOf(caller), src.indexOf(caller) + 700);
    assert.match(fn, /eqHTML\(/, `${caller} draws an unlifted colon`);
  }
  // "÷" is already centred, so only the colon may ever be wrapped
  assert.match(src, /replaceAll\(":"/);
  assert.ok(!/replaceAll\("÷"/.test(src), "the English sign must not be moved");
  assert.match(css, /\.question \.divsign,\s*\n\.feedback-aid \.divsign \{/, "both places, one rule");
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
  // …and that one button must be the one the focus lands on. The trophy row is
  // injected above it and its cards are buttons too, so Enter would otherwise
  // hold a trophy up instead of starting the next round. The focus is set by the
  // shared summary that all three games drive.
  assert.match(read("assets/js/roundsummary.js"), /initialFocus: "#sum-ok"/);
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

  // The level picker sits under the bar too: the map button is the one-tap way
  // out of a game, and the picker (where nothing is at stake) must not swallow
  // it. But it stays above the summary — the summary opens the picker and both
  // remain open, and the picker comes first in the DOM, so at equal z the
  // summary would paint over the picker it just opened. And above the chip,
  // whose lit pill would otherwise sit as a dead spot on the picker's sheet.
  assert.ok(z("#pick-overlay") < z(".topbar"), "the map button must stay reachable over the picker");
  assert.ok(z("#sum-overlay") < z("#pick-overlay"), "the picker opens over the summary, not under it");
  assert.ok(z(".pickheading") < z("#pick-overlay"), "the chip must dim under the picker's backdrop");
  assert.ok(z("#pick-overlay") < overlay, "a real modal sheet still covers the picker");

  // …and the sheet must not claim otherwise: a screen reader told that the
  // summary is modal is told that its only exit does not exist.
  const page = read("games/einmaleins/index.html");
  const sheet = page.slice(page.indexOf('id="sum-overlay"'), page.indexOf("</div>\n\n  <script"));
  assert.match(sheet, /aria-modal="false"/);
});

test("the round summary congratulates in six ways, in both languages", () => {
  // The dead-key scanner waves `sumOk*` through on a regex allowlist, so it can
  // no longer notice one going missing. Name them here instead. The keys are
  // offered by the shared summary now, not the game.
  const src = read("assets/js/roundsummary.js");
  for (let i = 1; i <= 6; i++) {
    assert.equal(typeof de[`sumOk${i}`], "string", `de.js is missing sumOk${i}`);
    assert.equal(typeof en[`sumOk${i}`], "string", `en.js is missing sumOk${i}`);
    assert.ok(src.includes(`"sumOk${i}"`), `roundsummary.js never offers sumOk${i}`);
  }
  assert.ok(!("again" in de) && !("again" in en), '"Nochmal" retired with the button');
});

// Mara tapped the trophy she had won and nothing happened. It was then a link to
// the Pokalraum — which celebrated by taking her out of the round she had just
// finished and dropping her in a room full of empty slots. It holds the trophy
// up where she is standing.
test("tapping a trophy she just won holds it up, without leaving the round", () => {
  // The trophy row is painted by the shared summary, one card per won trophy.
  const src = read("assets/js/roundsummary.js");
  const block = src.slice(src.indexOf("if (trophies.length > 0)"), src.indexOf("sfx.trophy()"));
  assert.match(block, /button: true/, "the trophy must be tappable");
  assert.match(block, /attrs: `data-won="\$\{i\}"`/, "…and say which of them it is");
  assert.match(block, /cls: "won"/, "…and still readable by tools/play.js");
  assert.ok(!block.includes("href"), "a won trophy must not navigate anywhere");
  // one delegated listener: the summary rewrites the row on every round that pays
  assert.match(src, /\$\("sum-trophy"\)\.addEventListener\("click"/);
  assert.match(src, /openShowcase\(wonTrophies\[Number\(card\.dataset\.won\)\]\)/);
  // Regression: `.won { width: 5.5em }` with `.tcard { font-size: 1.9rem }` made
  // a 167px card, and the cup inside it stayed 44px — a token adrift in a square.
  const css = read("assets/css/schlaufuchs.css");
  assert.match(css, /\.summary \.trophy-earn \.won \{ width: \d+(\.\d+)?rem; \}/, "em here is 1.9rem");
  assert.ok(!/\.trophy-earn[^{]*\{ width: [\d.]+em/.test(css));
  assert.match(block, /\[82, 68, 48\]\[trophies\.length - 1\]/, "the cup must fill the card it is given");
});

// Mara never found the level picker: the chip above the scene read as a
// caption, so she never tried pressing it.
test("the chip looks like the button it is", () => {
  const css = read("assets/css/schlaufuchs.css");
  // The comments in this rule explain what was removed, so they name it. Read
  // the declarations, not the prose around them.
  const block = css
    .slice(css.indexOf(".pickheading {"), css.indexOf(".pickheading::after"))
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(block, /border: 2px solid var\(--orange\)/, "a chip needs an edge");

  // Regression, reported from a phone: `.stage` is a flex column, so this button
  // is a flex item, and a flex item shrinks. With `min-height: 0` the Schwer
  // keypad — one row taller than Leicht's four choice buttons — squeezed the
  // button to 16px while its content needed 27px, and the bottom border cut
  // through the text. Invisible on Leicht, and invisible to any probe that
  // measured only the label.
  assert.match(block, /flex: 0 0 auto/, "a control must not give up its size");
  assert.match(block, /min-height: 44px/, "…nor its touch target");
  assert.ok(!block.includes("min-height: 0"), "min-height: 0 is what let it be crushed");

  // The caret is geometry, not a glyph. `content: "▾"` is U+25BE, and on a phone
  // that is whatever font the device falls back to — on Android Firefox it came
  // out small and sitting on the baseline.
  const caret = css.slice(css.indexOf(".pickheading::after {"));
  const rule = caret.slice(0, caret.indexOf("}"));
  assert.match(rule, /content: "";/, "no glyph");
  assert.match(rule, /border-top: \d+px solid var\(--orange\)/, "a drawn triangle");
  assert.ok(!css.replace(/\/\*[\s\S]*?\*\//g, "").includes("▾"), "the glyph must be gone from the stylesheet");
  // …and it must stay a pseudo-element: updateChip() writes innerHTML, and a
  // caret carried in the label would be rewritten away on every round.
  assert.ok(!read("games/einmaleins/einmaleins.js").includes("▾"));
});

test('the "Alle" tile is the die alone — a picture, no word', () => {
  // Every game's mixed tile wears the same bare 🎲 (user cleanup, 2026-07-13);
  // the spoken name stays tableName for the aria-label.
  const src = read("games/einmaleins/picker.js");
  assert.match(src, /tbl === 0 \? "🎲" : tableName\(tbl\)/);
  assert.ok(!src.includes("`🎲 ${"), "no text may ride along with the die");
});

// The picker was two controls: three difficulty buttons that silently rewrote
// the grid of tables under them, and a "×2 ⭐" promise on a button nobody had
// pressed. It is now one scrollable list of every level the game has.
test("the picker is one list of levels, not a switch above a grid", () => {
  const page = read("games/einmaleins/index.html");
  // the tile machinery is the shared picker; the game file only adapts tiles
  const shared = read("assets/js/levelpicker.js");
  const css = read("assets/css/schlaufuchs.css");

  assert.match(page, /id="pick-levels"/);
  for (const gone of ["pick-diff", "pick-tables", 'class="seg"']) {
    assert.ok(!page.includes(gone), `${gone} survived in the picker markup`);
  }
  for (const src of [shared, read("games/einmaleins/picker.js")]) {
    assert.ok(!/aria-pressed/.test(src), "nothing in the picker is a toggle any more");
    assert.ok(!/dmul|×\$\{v\}|diffWorth/.test(src), "the ×2 / ×3 promise is gone from the picker");
  }
  assert.ok(!/\.seg\b|\.dmul\b/.test(css), "dead rules for a control that no longer exists");

  // A difficulty is a heading, not a control: choosing one IS choosing a tile.
  assert.match(shared, /const head = document\.createElement\("h3"\)/);
  assert.ok(!/head\.addEventListener/.test(shared), "a heading must not be clickable");
  for (const slug of ["easy", "medium", "hard"]) {
    assert.ok(css.includes(`.lvl-head.lvl-${slug}`), `no colour for the ${slug} heading`);
    assert.ok(css.includes(`.tilegrid.lvl-${slug} button`), `no colour for the ${slug} tiles`);
  }
});

// The whole rulebook, as a picture: a fresh Leicht tile holds 3 stars, Mittel 6,
// Schwer 9 — so "harder pays three times as much" needs no words. As she wins
// them the tile empties, and an empty one shows a tick.
test("a tile shows the stars it still has to give", () => {
  // the game's adapter computes what is left; the shared picker draws it
  assert.match(read("games/einmaleins/picker.js"), /tilePointsLeft\(starDigit\(starsByDiff\[d\], tbl\), d\)/);
  const shared = read("assets/js/levelpicker.js");
  assert.match(shared, /left > 0 \? starGroupsHTML\(left, d\) : '<b class="tdone">✓<\/b>'/);
  assert.match(shared, /if \(left === 0\) b\.classList\.add\("mastered"\)/);

  // 3 / 6 / 9 on an untouched tile, nothing on a finished one — the numbers the
  // colour bands promise. tilePointsLeft is unit-tested in rewards.test.js.
  for (const [d, fresh] of [[0, 3], [1, 6], [2, 9]]) {
    assert.equal(tilePointsLeft(0, d), fresh, `a fresh tile of difficulty ${d}`);
    assert.equal(tilePointsLeft(3, d), 0, `a mastered tile of difficulty ${d}`);
  }
});

// The stars are drawn in the UNITS they are won in: a round pays a whole group
// at once (§10.4), one star on Leicht, a pair on Mittel, a triple on Schwer —
// never a single star out of a group. So the picture is always as many groups as
// there are rounds left (a fresh tile: three, on every difficulty), and it is the
// GROUP that grows with difficulty, not the number of groups.
test("the picker clusters a tile's stars into the rounds that pay them", () => {
  // the group's SHAPE is the round scene's own constellation, reused not
  // re-drawn — so the tile and the Wegbild can never disagree about it
  const shared = read("assets/js/levelpicker.js");
  assert.match(shared, /import \{ starCluster \} from "\.\/journey\.js"/);
  assert.match(shared, /starCluster\(worth\)/);

  // group size = difficulty + 1; group count = rounds left, never a loose count
  for (const [d, size] of [[0, 1], [1, 2], [2, 3]]) {
    const fresh = starGroupsHTML(tilePointsLeft(0, d), d); // an untouched tile
    const groups = fresh.match(/class="sgroup"/g) ?? [];
    assert.equal(groups.length, 3, `a fresh difficulty-${d} tile is three rounds`);
    const stars = fresh.match(/⭐/g) ?? [];
    assert.equal(stars.length, 3 * size, `three groups of ${size} on difficulty ${d}`);
    // every group carries a whole round's worth of stars, not a leftover
    for (const g of fresh.split("</span>").filter(Boolean)) {
      assert.equal((g.match(/⭐/g) ?? []).length, size, `a group holds exactly ${size}`);
    }
  }
  // one round already won on Mittel leaves two pairs, not four loose stars
  const partial = starGroupsHTML(tilePointsLeft(1, 1), 1);
  assert.equal((partial.match(/class="sgroup"/g) ?? []).length, 2);
  assert.equal((partial.match(/⭐/g) ?? []).length, 4);
});

// When the picker reopens after a round that paid stars, the played tile replays
// the win (§10.1): `winFlightHTML(from, to, d)` draws the tile as it stood BEFORE
// the round (3-from groups), tags the (to-from) groups just earned `.won-depart`
// to fly off, and hands the groups still to win the anchor a settled tile puts
// them at (`data-to-left`) so they can glide there.
test("the win replay flies off exactly the groups a round earned", () => {
  const groups = (s) => (s.match(/class="sgroup(?:| won-depart)"/g) ?? []).length;
  const depart = (s) => (s.match(/won-depart/g) ?? []).length;
  const glide = (s) => (s.match(/data-to-left/g) ?? []).length;

  for (const [from, to, d] of [[0, 1, 1], [1, 2, 1], [2, 3, 0], [0, 3, 2], [0, 2, 2]]) {
    const html = winFlightHTML(from, to, d);
    // the tile starts at its pre-round fullness…
    assert.equal(groups(html), 3 - from, `${from}->${to} d${d}: starts with 3-from groups`);
    // …the earned groups fly off…
    assert.equal(depart(html), to - from, `${from}->${to} d${d}: to-from groups depart`);
    // …and every group still to win carries a glide target, none of the departing ones
    assert.equal(glide(html), 3 - to, `${from}->${to} d${d}: 3-to groups glide`);
    // a group is still a whole round's worth of stars (§10.4)
    assert.equal((html.match(/⭐/g) ?? []).length, (3 - from) * (d + 1));
  }
  // mastering a tile (to = 3) flies off every group and glides none — the tick is
  // what the picker restores behind them
  assert.equal(glide(winFlightHTML(0, 3, 2)), 0);
});

// Leicht teaches four tables, Mittel all ten, Schwer the eight with something
// hard in them. The old picker showed tables a difficulty does not teach as
// padlocked tiles — dead buttons a child could tap and be refused by.
test("each difficulty offers its own tiles, and nothing is disabled anywhere", () => {
  // tablesFor is pure now (logic.js), so the offer is asserted as behaviour,
  // not as a source pattern
  assert.deepEqual(tablesFor(0), [...EASY_TABLES, 0]);
  assert.deepEqual(tablesFor(1), [...ALL_TABLES, 0]);
  assert.deepEqual(tablesFor(2), [...HARD_TABLES, 0]);
  assert.equal(EASY_TABLES.length + 1, 5, "four easy tables plus 'Alle'");
  assert.equal(ALL_TABLES.length + 1, 11);
  assert.equal(HARD_TABLES.length + 1, 9, "no 1er or 10er on Schwer");
  const src = read("games/einmaleins/picker.js");
  assert.ok(!/b\.disabled|classList\.add\("locked"\)|ui-lock/.test(src), "no padlocked tiles");

  // a saved tile the current difficulty does not offer must fall back, not
  // leave the fox standing on a level that no longer exists
  assert.match(read("games/einmaleins/einmaleins.js"),
    /if \(!tablesFor\(diff\)\.includes\(table\)\) table = 2;/);
});

// The list is long enough to scroll. It must open on the level she is playing.
test("the picker opens on the tile she is on", () => {
  const src = read("assets/js/levelpicker.js");
  assert.match(src, /initialFocus: "\[aria-current='true'\]"/);
  assert.match(src, /b\.setAttribute\("aria-current", "true"\)/);
  assert.match(read("assets/css/schlaufuchs.css"), /\.tilegrid button\.current \{/);
});

// Mara clicked "Verstanden" after a wrong answer without ever registering that
// she had erred. Now the aid asks her to enter the right answer herself, which
// is the smallest act that proves she read it (§8.1).
// The aid is answered the way the question was: digits, then OK. It used to be
// cleverer than the game around it — the answer completed itself at the last
// digit, and a digit that could no longer be right was refused before it was
// finished. Two sets of rules on one keypad, told apart only by whether the
// child had just been wrong.
test("retryStep: typing never ends the aid, however right it looks", () => {
  for (let answer = 1; answer <= 100; answer++) {
    const digits = [...String(answer)];
    for (let i = 1; i <= digits.length; i++) {
      const step = typeAll(digits.slice(0, i), answer);
      assert.deepEqual(step, { input: digits.slice(0, i).join(""), state: "typing" },
        `${answer}: "${step.input}" must wait for OK`);
    }
    // …and OK on the full answer is what ends it
    assert.deepEqual(retryStep(String(answer), "OK", answer),
      { input: String(answer), state: "done" });
  }
});

test("retryStep: a wrong digit is refused by OK, not while it is being typed", () => {
  // 30: "4" can never become 30, and the aid says nothing until OK
  assert.deepEqual(retryStep("", "4", 30), { input: "4", state: "typing" });
  assert.deepEqual(retryStep("4", "9", 30), { input: "49", state: "typing" });
  assert.deepEqual(retryStep("49", "OK", 30), { input: "", state: "reject" });

  // a rejected input is cleared, so the child starts from an empty gap
  assert.equal(typeAll(["4", "9", "OK"], 30).input, "");

  // backspace still repairs a typo, exactly as in the round
  assert.deepEqual(typeAll(["4", "⌫", "3", "0", "OK"], 30), { input: "30", state: "done" });
});

test("retryStep: backspace, OK and junk keys never strand the child", () => {
  assert.deepEqual(retryStep("4", "⌫", 42), { input: "", state: "typing" });
  assert.deepEqual(retryStep("", "⌫", 42), { input: "", state: "typing" }, "backspace on empty is harmless");

  assert.deepEqual(retryStep("42", "OK", 42), { input: "42", state: "done" });
  assert.deepEqual(retryStep("", "OK", 42), { input: "", state: "typing" }, "OK on empty does nothing");
  assert.deepEqual(retryStep("4", "OK", 42), { input: "", state: "reject" });

  for (const junk of ["x", "", "-", "1.5", "Enter", " "]) {
    const step = retryStep("4", junk, 42);
    assert.deepEqual(step, { input: "4", state: "typing" }, `junk key ${JSON.stringify(junk)}`);
  }
  // and the input never grows past what a two-digit answer could need
  assert.ok(typeAll(["1", "0", "0", "0"], 100).input.length <= 3);
});

// The aid's keypad IS the round's keypad — the same DOM, built once per round.
// So whatever `retryStep` does, it must do it with the same three verbs the
// round's own `keyPress` uses: a digit, a backspace, an OK.
test("retryStep answers to exactly the keys the round's keypad sends", () => {
  const src = read("games/einmaleins/einmaleins.js");
  const build = src.slice(src.indexOf("function buildKeypad"), src.indexOf("function keyPress"));
  for (const key of ["⌫", "OK"]) {
    assert.ok(build.includes(`"${key}"`), `the keypad has no ${key}`);
    assert.notDeepEqual(retryStep("1", key, 12), { input: "1", state: "typing" },
      `${key} must mean something to the aid`);
  }
});

test("the aid shows the child's own wrong answer, struck through", () => {
  const src = read("games/einmaleins/einmaleins.js");
  const fn = src.slice(src.indexOf("function showFeedback"), src.indexOf("function continueRound"));
  assert.match(fn, /eq-wrong/, "the wrong answer must be marked as wrong");
  assert.match(fn, /<s>/, "…and struck through, so it reads as retracted");
  assert.match(fn, /retry-gap/, "…and the child gets a gap to fill");
  assert.ok(!fn.includes("fb-next"), "the 'Verstanden' button is retired");
  assert.ok(!src.includes("fb-next"), "…everywhere");
  assert.ok(!("gotIt" in de) && !("gotIt" in en), "…and so is its string");
  assert.match(src, /retryStep/, "the aid is driven by the pure retryStep");
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

  // the summary is everything the child sees of the round, and it must be mute.
  // It is painted by the shared roundsummary.js now.
  const painted = readFileSync(
    fileURLToPath(new URL("../assets/js/roundsummary.js", import.meta.url)),
    "utf8",
  );
  // the stars are shown as the GROUPS they are won in (§10.1) — never as a
  // numeric score line ("8/8 +6 ⭐" read as homework) and never as a flat
  // count of loose stars
  assert.ok(painted.includes("starSlotsHTML("), "the summary must paint the star groups");
  assert.ok(!painted.includes("roundStat"), "the numeric score line is retired");
  assert.ok(!/"⭐"\.repeat/.test(painted), "loose star counts are retired");
  assert.ok(
    !/Date\.now|seconds|\bt0\b|elapsed|\bms\b|sekunde|answerTimes|qShownAt|median/i.test(painted),
    "the summary must not mention the round's duration — the tempo ladder is painted as a symbol, never a number (§10.6)",
  );
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

// --- the tempo ladder (§10.6) ------------------------------------------------
// Stars pay for being right; the tempo symbol pays for KNOWING. A child who
// counts her way to every answer keeps every star and simply has not won the
// rocket yet — nothing is ever lost, and the lowest visible state is an empty
// corner, never a snail.

test("median: robust round verdict — one slow question has no veto", () => {
  assert.equal(median([1000, 2000, 60000]), 2000, "the outlier does not move the middle");
  assert.equal(median([4000]), 4000);
  assert.equal(median([1000, 3000]), 2000, "even count averages the middle two");
  assert.equal(median([3000, 1000, 2000]), 2000, "order must not matter");
  // total: an empty or junk-filled round yields null, never NaN
  assert.equal(median([]), null);
  assert.equal(median(), null);
  assert.equal(median([NaN, undefined, "9"]), null);
  assert.equal(median([NaN, 5000]), 5000, "junk entries are dropped, not counted");
});

test("tempoTier: bounds per difficulty, and junk earns nothing", () => {
  assert.equal(TEMPO_SLOTS, 3);
  for (const d of [0, 1, 2]) {
    const [hare, car, rocket] = TEMPO_TIERS[d];
    assert.ok(rocket < car && car < hare, `difficulty ${d}: tiers must climb`);
    assert.equal(tempoTier(rocket, d), 3, "on the bound still counts");
    assert.equal(tempoTier(rocket + 1, d), 2);
    assert.equal(tempoTier(car, d), 2);
    assert.equal(tempoTier(hare, d), 1);
    assert.equal(tempoTier(hare + 1, d), 0, "slower than the hare is simply nothing");
  }
  // the keypad rows pay for typing too, so their bounds sit later than a tap
  assert.ok(TEMPO_TIERS[1][2] > TEMPO_TIERS[0][2]);
  for (const junk of [null, undefined, NaN, -1, "3000", Infinity]) {
    assert.equal(tempoTier(junk, 1), 0, `tempoTier(${String(junk)})`);
  }
  assert.equal(tempoTier(1000, 9), 0, "an unknown difficulty awards nothing");
});

test("awardTempo: fast-and-wrong never pays, and the tier only ever climbs", () => {
  // gated by two stars (§10.6): guessing at speed must be worthless
  assert.equal(awardTempo({ stars: 0, tier: 3, best: 0 }), 0);
  assert.equal(awardTempo({ stars: 1, tier: 3, best: 0 }), 0);
  assert.equal(awardTempo({ stars: 2, tier: 3, best: 0 }), 3);
  assert.equal(awardTempo({ stars: 3, tier: 1, best: 0 }), 1);
  // monotone like the star basket: a slow day takes nothing away
  assert.equal(awardTempo({ stars: 3, tier: 1, best: 3 }), 3);
  assert.equal(awardTempo({ stars: 0, tier: 0, best: 2 }), 2, "a failed round keeps the badge");
  // total: junk in, a sane tier out
  for (const bad of [undefined, null, -1, 9, 1.5, NaN, "2"]) {
    const n = awardTempo({ stars: 3, tier: bad, best: bad });
    assert.ok(Number.isInteger(n) && n >= 0 && n <= TEMPO_SLOTS, `tier=${String(bad)} -> ${n}`);
  }
  assert.equal(awardTempo(), 0, "no round, no tempo");
});

test("the tempo ladder is wired: first tries only, symbol only above nothing", () => {
  const src = read("games/einmaleins/einmaleins.js");
  // only a first try feeds the ladder — an item missed this round is out
  assert.match(src, /if \(!missedIds\.has\(currentId\)\)/);
  assert.match(src, /missedIds\.add\(currentId\)/);
  assert.match(src, /missedIds = new Set\(\)/, "…and the set resets with the round");
  // the round's verdict: median, gated award, stored beside the stars
  assert.match(src, /tempoTier\(median\(answerTimes\), diff\)/);
  assert.match(src, /awardTempo\(\{ stars, tier, best: oldTempo \}\)/);
  assert.match(src, /tempo: tempoObj/);
  // the picker draws a badge only when there is one; tier 0 draws NOTHING
  assert.match(read("assets/js/levelpicker.js"), /const badge = tempo > 0\n\s*\? `<span class="ttempo"/);
  // the ⚡ moment: a single rocket-speed answer, marked as it lands
  assert.match(src, /tempoTier\(took, diff\) === 3\) blitzFlash\(/);
  // the summary line exists in the sheet
  assert.match(read("games/einmaleins/index.html"), /id="sum-tempo"/);
  // the three faces live in the registry, with their emoji fallbacks
  for (const [name, emoji] of [["tempo-hare", "🐇"], ["tempo-car", "🚗"], ["tempo-rocket", "🚀"]]) {
    assert.equal(GRAPHICS[name]?.emoji, emoji, `${name} missing from the registry`);
  }
});

// The tempo ladder's names live in the shared dictionaries (every game shows
// them); tests/i18n.test.js holds "exist in both languages, never a time".

// --- per-fact recall telemetry (§20) ------------------------------------------
// The digit a parent reads must be earned repeatedly: it drifts ONE step per
// observation toward what was seen, so a lucky tap cannot paint "auswendig"
// and one distracted answer cannot erase it.
test("recallStep: damped — no single observation repaints a cell", () => {
  assert.equal(recallStep(0, 3), 4, "the first observation seeds the digit directly");
  assert.equal(recallStep(0, 0), 1, "…including a slow one: counting is information");
  assert.equal(recallStep(1, 3), 2, "a settled digit moves one step, not four");
  assert.equal(recallStep(4, 0), 3, "…in both directions: recall that fades drifts down");
  assert.equal(recallStep(4, 3), 4, "confirmed is confirmed");
  // total: junk observations change nothing, junk digits read as unseen
  for (const junk of [undefined, null, -1, 4, 1.5, NaN, "2"]) {
    assert.equal(recallStep(2, junk), 2, `tier=${String(junk)}`);
  }
  assert.equal(recallStep(9, 3), 4, "a corrupt digit is treated as unseen, then seeded");
});

test("foldRecall: a round's observations land in the right slots, junk does not", () => {
  const rc = foldRecall(undefined, { [pairIndex(7, 8)]: 3, [pairIndex(2, 2)]: 0 });
  assert.equal(rc.length, POOL_COUNT);
  assert.equal(rc[pairIndex(7, 8)], "4");
  assert.equal(rc[pairIndex(2, 2)], "1");
  assert.equal(rc[pairIndex(3, 3)], "0", "unobserved facts stay unseen");
  // folding again drifts, never jumps
  const rc2 = foldRecall(rc, { [pairIndex(7, 8)]: 0 });
  assert.equal(rc2[pairIndex(7, 8)], "3");
  // junk ids and a short/corrupt string never throw and never leak
  const rc3 = foldRecall("x9", { "-1": 3, 999: 3, abc: 3 });
  assert.equal(rc3.length, POOL_COUNT);
  assert.ok([...rc3].every((c) => "01234".includes(c)), rc3);
  assert.equal(foldRecall("", null).length, POOL_COUNT);
});

test("the recall tracker is wired: observed on first tries, folded at round end", () => {
  const src = read("games/einmaleins/einmaleins.js");
  assert.match(src, /recallObs\[currentId\] = tempoTier\(took, diff\)/);
  assert.match(src, /recallObs = \{\}/, "…and the observations reset with the round");
  assert.match(src, /rc: foldRecall\(saved\.rc, recallObs\)/);
});

// The child must never meet this data: it exists for the parents' page only.
// The two places the child looks — the painted summary and the level picker —
// must not touch a recall digit.
test("the recall digits never surface in the child's own UI", () => {
  const src = read("games/einmaleins/einmaleins.js");
  const painted = src.slice(src.indexOf("function endRound"))
    .slice(src.slice(src.indexOf("function endRound")).indexOf("setTimeout("));
  const picker = src.slice(src.indexOf("function renderPicker"), src.indexOf("$(\"pickchip\")"));
  for (const [name, block] of [["summary", painted], ["picker", picker]]) {
    assert.ok(!/\brc\b|foldRecall|recallObs|recallDigit/.test(block),
      `the ${name} reads the parents' recall data`);
  }
});

// The cookie carries a second digit-string family now. It must stay far from
// the 3500-byte budget even at its fullest (§9.2, §10.4).
test("a maxed einmaleins section stays a small fraction of the cookie budget", () => {
  const full11 = { 0: "3".repeat(11), 1: "3".repeat(11), 2: "3".repeat(11) };
  const maxed = {
    d: 2, t: 0, box: "4".repeat(100), stars: full11, tempo: full11,
    rc: "4".repeat(100),
    tm: [99999, 99999, 99999], rd: [9999, 9999, 9999],
  };
  const bytes = JSON.stringify({ einmaleins: maxed }).length;
  assert.ok(bytes < 550, `einmaleins section is ${bytes} bytes`);
  assert.ok(bytes < BUDGET / 6, "…and a small fraction of the whole budget");
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
