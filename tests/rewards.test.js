import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  THRESHOLDS, TROPHIES, GAMES, trophyCount, totalTrophies, TOTAL_TROPHIES,
  gameStarsOf, totalPoints, regionState, pokalraumState, starBadgeTier, nextTrophyInfo,
  roundPoints, tilePointsLeft, starValue, clampDifficulty, addPractice, MAX_ROUND_SECONDS,
  ladderFor, MAX_POINTS, TROPHIES_PER_GAME,
} from "../assets/js/rewards.js";
import { read } from "./pages.js";
import { PLAYABLE } from "../assets/js/rewards.js";
import { maxPoints as lesenMaxPoints } from "../games/lesen/logic.js";
import { CONTENT } from "../games/lesen/content.js";
import { maxPoints as rechnenMaxPoints } from "../games/rechnungen/logic.js";
import { maxPoints as drachenMaxPoints } from "../games/drachen/logic.js";
import { STORIES } from "../games/drachen/content.js";

// The album shelves and the gear's reset rows both iterate GAMES in order. A
// child looks for Lesewiese right under Einmaleins — the games she can play —
// not below three shelves of games that do not exist yet.
test("the games a child can play shelve first", () => {
  assert.deepEqual(GAMES.slice(0, PLAYABLE.length), PLAYABLE,
    "the shelves and reset rows must lead with the playable games");
});

// einmaleins' ladder is the one a real child has been climbing, so it is spelled
// out here rather than imported: if it ever changes, this file must say so.
const EM = [2, 6, 12, 20, 29, 39, 50, 62, 75, 88, 100, 112];

test("einmaleins keeps the ladder its players have been climbing (§8.3)", () => {
  // No child may lose a trophy they have already won: the counter in the store
  // is points, and the trophies are derived from it on every load.
  assert.deepEqual(THRESHOLDS.einmaleins, EM);
});

test("every game has its own ladder, and every ladder climbs", () => {
  for (const g of GAMES) {
    const ladder = THRESHOLDS[g];
    assert.equal(ladder.length, TROPHIES_PER_GAME, g);
    for (let i = 1; i < ladder.length; i++) {
      assert.ok(ladder[i] > ladder[i - 1], `${g}: threshold ${i} does not climb`);
    }
    assert.ok(ladder[0] >= 1, `${g}: a trophy for nothing`);
  }
});

// Regression: one ladder served all five games, tuned to einmaleins' 180-point
// economy. `lesen` was then budgeted at 18 points, so its thresholds 29 through
// 112 — trophies five to twelve — could never be reached, and its shelf in the
// Pokalraum could never fill. The child would never learn why.
test("every game's twelfth trophy is reachable by mastering that game", () => {
  for (const g of GAMES) {
    const max = MAX_POINTS[g];
    const last = THRESHOLDS[g].at(-1);
    assert.ok(last <= max, `${g}: the last trophy costs ${last} of ${max} obtainable points`);
    assert.equal(trophyCount(g, max), TROPHIES_PER_GAME, `${g}: mastering it must fill its shelf`);

    // and it must still be a goal, not a participation prize
    assert.ok(last / max > 0.4, `${g}: the last trophy at ${last}/${max} is given away`);
    assert.ok(last / max <= 0.7, `${g}: the last trophy at ${last}/${max} is a grind`);
  }
});

// The generator's shape IS the einmaleins ladder. Saying so in a test is what
// keeps the four generated ladders honest: they are the same curve, not a
// second opinion about what a trophy should cost.
test("ladderFor reproduces the hand-tuned einmaleins ladder", () => {
  // 180 is the economy the ladder was tuned in (11 Schwer tiles, before the
  // 1er and 10er left, §10.2). The ladder itself is grandfathered — no child
  // may lose a trophy — so the generator's shape is still read off 180, not
  // off today's MAX_POINTS.
  assert.deepEqual(ladderFor(180), EM);
  assert.equal(MAX_POINTS.einmaleins, 162);

  // a game too small to hold twelve climbing thresholds must say so, loudly,
  // rather than hand out two trophies for the same point
  assert.throws(() => ladderFor(TROPHIES_PER_GAME - 1), RangeError);
  assert.deepEqual(ladderFor(TROPHIES_PER_GAME), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("trophyCount maps a game's counter to its earned trophies", () => {
  assert.equal(trophyCount("einmaleins", undefined), 0);
  assert.equal(trophyCount("einmaleins", 0), 0);
  assert.equal(trophyCount("einmaleins", 1), 0);
  assert.equal(trophyCount("einmaleins", 2), 1);
  assert.equal(trophyCount("einmaleins", 11), 2);
  assert.equal(trophyCount("einmaleins", 12), 3);
  assert.equal(trophyCount("einmaleins", 112), 12);
  assert.equal(trophyCount("einmaleins", 9999), 12, "there are only twelve");

  // the same points buy different trophies in different regions
  assert.equal(trophyCount("lesen", 12), 3, "lesen (small game) paces close to einmaleins early");
  assert.equal(trophyCount("tippen", 12), 2, "tippen is a big one; 12 points is barely a start");

  assert.equal(trophyCount("nosuchgame", 9999), 0, "an unknown game has no shelf");
  assert.equal(trophyCount(undefined, 9999), 0);
});

// Each region keeps its own counter: `pr` is keyed per game, and a game's
// trophies derive ONLY from that game's key. A wall of einmaleins stars must
// never light up a single reading trophy — the shelves are earned separately.
test("a game's trophies count only its own stars, never another game's (§8.3)", () => {
  const pr = { einmaleins: 9999 }; // mastered einmaleins, never opened a book
  assert.equal(trophyCount("lesen", pr.lesen), 0, "einmaleins stars buy no reading trophy");
  assert.equal(totalTrophies(pr), 12, "…only einmaleins' own twelve");

  // and once reading is played, only the reading stars move its shelf
  assert.equal(trophyCount("lesen", ({ ...pr, lesen: 9 }).lesen), 2);
});

test("every game has exactly 12 trophies with de+en names (§8.3)", () => {
  for (const g of GAMES) {
    assert.equal(TROPHIES[g].length, 12, g);
    for (const s of TROPHIES[g]) {
      assert.ok(s.e && s.de && s.en, `${g}: ${JSON.stringify(s)}`);
    }
  }
});

// The top bar shows this number, so an empty store must produce a 0 and not a
// NaN: `pr` is absent on a first visit and holds only the games ever played.
test("trophies are counted across every game (§8.3)", () => {
  assert.equal(TOTAL_TROPHIES, 72, "six games × twelve trophies");
  assert.equal(TOTAL_TROPHIES, GAMES.length * TROPHIES_PER_GAME);

  for (const empty of [undefined, null, {}]) assert.equal(totalTrophies(empty), 0);
  assert.equal(totalTrophies({ einmaleins: THRESHOLDS.einmaleins[0] }), 1);
  assert.equal(totalTrophies({ einmaleins: THRESHOLDS.einmaleins[0], tippen: THRESHOLDS.tippen[2] }), 4);
  assert.equal(totalTrophies({ nosuchgame: 9999 }), 0, "an unknown game earns nothing");

  // each game is counted against its own ladder, not against einmaleins'
  const maxed = Object.fromEntries(GAMES.map((g) => [g, MAX_POINTS[g]]));
  assert.equal(totalTrophies(maxed), TOTAL_TROPHIES);
});

test("clampDifficulty: anything that is not a real tier reads as Leicht", () => {
  assert.deepEqual([0, 1, 2].map(clampDifficulty), [0, 1, 2]);
  for (const junk of [undefined, null, -1, 3, 1.5, "1", NaN]) {
    assert.equal(clampDifficulty(junk), 0, `d=${String(junk)}`);
  }
});

// The daily streak is gone (§8.5): a year of tracking that nothing ever
// rendered. It is not enough to stop writing it — stores in the wild still
// carry the field, and patchSection merges, so without the scrub those bytes
// would ride along until the reset button. The mechanism (undefined drops a
// key through JSON.stringify) is tested in storage.test.js.
test("recordRound scrubs the removed streak field, and nothing computes one", () => {
  const src = read("assets/js/rewards.js");
  assert.match(src, /setRewards\(\{ at: game, pr, streak: undefined \}\)/,
    "every finished round must clean the dead field out of the store");
  for (const dead of ["updateStreak", "todayLocalISO", "STREAK_MILESTONES", "streakMilestone"]) {
    assert.ok(!src.includes(dead), `${dead} survived the streak removal`);
  }
});

// The site has ONE number a child collects. `pr` — once called "Punkte" —
// counts a Leicht star as 1, a Mittel star as 2 and a Schwer star as 3, which
// is exactly what the picker has always promised with its "×2 ⭐".
test("totalPoints adds up the one currency there is", () => {
  assert.equal(totalPoints(undefined), 0, "an empty store owns nothing");
  assert.equal(totalPoints({}), 0);
  assert.equal(totalPoints({ einmaleins: 12, tippen: 4 }), 16);
  assert.equal(totalPoints({ einmaleins: 12, nosuchgame: 999 }), 12, "only the five games count");
  // junk in the store must not print "NaN ⭐" in the top bar
  for (const junk of [null, "7", NaN, -3, Infinity, {}, []]) {
    assert.equal(totalPoints({ einmaleins: junk }), 0, `pr.einmaleins = ${String(junk)}`);
  }
  assert.equal(gameStarsOf({ einmaleins: 5 }, "einmaleins"), 5);
  assert.equal(gameStarsOf(undefined, "einmaleins"), 0);
});

test("the fox chip counts stars, not a second currency", () => {
  // Regression: the bar showed a raw star count while the album counted `pr`.
  // The two numbers were both called "stars" and never agreed.
  const src = read("assets/js/rewards.js");
  const fox = src.slice(src.indexOf("export function foxInfo"), src.indexOf("const fractionOf"));
  assert.match(fox, /stars: totalPoints\(rewards\.pr\)/);
  for (const dead of ["gameStars(", "sumStars", "ACHIEVABLE"]) {
    assert.ok(!src.includes(dead), `${dead} survived the unification`);
  }
});

test("starBadgeTier: none / some / gold / glowing (§3.1)", () => {
  assert.equal(starBadgeTier({}, "einmaleins"), 0);
  assert.equal(starBadgeTier({ einmaleins: 1 }, "einmaleins"), 1);
  assert.equal(starBadgeTier({ einmaleins: 53 }, "einmaleins"), 1, "just under a third");
  assert.equal(starBadgeTier({ einmaleins: 54 }, "einmaleins"), 2, "a third of 162");
  assert.equal(starBadgeTier({ einmaleins: 161 }, "einmaleins"), 2);
  assert.equal(starBadgeTier({ einmaleins: MAX_POINTS.einmaleins }, "einmaleins"), 3);
  assert.equal(starBadgeTier({ einmaleins: 1000 }, "einmaleins"), 3, "and it cannot go higher");
});

test("nextTrophyInfo: progress toward the next trophy (§8.3)", () => {
  assert.deepEqual(nextTrophyInfo("einmaleins", undefined), { earned: 0, threshold: 2, remaining: 2 });
  assert.deepEqual(nextTrophyInfo("einmaleins", 3), { earned: 1, threshold: 6, remaining: 3 });
  assert.deepEqual(nextTrophyInfo("einmaleins", 11), { earned: 2, threshold: 12, remaining: 1 });
  assert.equal(nextTrophyInfo("einmaleins", 111).remaining, 1);
  assert.equal(nextTrophyInfo("einmaleins", 112), null);

  // the same counter, a different promise, because the region is different
  assert.equal(nextTrophyInfo("lesen", 12).threshold, 17);
  assert.equal(nextTrophyInfo("tippen", 12).threshold, 16);
  assert.equal(nextTrophyInfo("lesen", MAX_POINTS.lesen), null, "a mastered game can finish");
  assert.equal(nextTrophyInfo("nosuchgame", 0), null);
});

test("region states at 0 / one third / 100 % (§3.1)", () => {
  assert.equal(regionState({}, "einmaleins"), "base");
  assert.equal(regionState({ einmaleins: 53 }, "einmaleins"), "base");
  assert.equal(regionState({ einmaleins: 54 }, "einmaleins"), "thriving", "a third of 162");
  assert.equal(regionState({ einmaleins: 161 }, "einmaleins"), "thriving");
  assert.equal(regionState({ einmaleins: 162 }, "einmaleins"), "mastered");

  // Mastering einmaleins is exactly what MAX_POINTS says it is: 5 Leicht tiles
  // at 3 points + 11 Mittel at 6 + 9 Schwer at 9 (no 1er/10er on Schwer,
  // §10.2). If this drifts, a child can never pave the village square, or
  // paves it before she is done.
  assert.equal(5 * 3 + 11 * 6 + 9 * 9, MAX_POINTS.einmaleins);
  for (const game of GAMES) {
    assert.ok(MAX_POINTS[game] > 0, `${game}: a zero maximum divides by zero`);
    assert.equal(regionState({ [game]: MAX_POINTS[game] }, game), "mastered");
  }

  // The Trophy Room follows the same rule over TOTAL_TROPHIES (60): thriving
  // from a third (20 cups), mastered only with every cup on the shelf.
  assert.equal(pokalraumState(0), "base");
  assert.equal(pokalraumState(TOTAL_TROPHIES / 3 - 1), "base");
  assert.equal(pokalraumState(TOTAL_TROPHIES / 3), "thriving");
  assert.equal(pokalraumState(TOTAL_TROPHIES - 1), "thriving");
  assert.equal(pokalraumState(TOTAL_TROPHIES), "mastered");
});

// The lesen twin of the einmaleins balance above: its maximum is computed from
// its real tiles — 5 per difficulty, four packs and an "Alle" (§14.3) — and a
// first sitting must already pay the first trophy, so a beginner meets the
// reward system on day one.
test("lesen's economy is computed from its real tiles (§14.3)", () => {
  assert.equal(lesenMaxPoints(CONTENT.de), MAX_POINTS.lesen, "rewards.js and logic.js disagree");
  assert.equal(5 * 3 * 1 + 5 * 3 * 2 + 5 * 3 * 3, MAX_POINTS.lesen);
  assert.equal(trophyCount("lesen", MAX_POINTS.lesen), TROPHIES_PER_GAME);
  assert.ok(THRESHOLDS.lesen[0] <= 3, "a first sitting still reaches the first trophy");
});

// Regression: lesen is a small game (15 tiles for 12 trophies), and the
// generated einmaleins-curve ladder started at 1, 3, 6 over its 90-point
// economy. A single perfect Schwer round is worth 9, so it cleared all three at
// once — three trophies from the very first round, and the whole shelf full
// after roughly one play-through. That read as a bug in the Pokalraum. The
// hand-tuned LESEN_LADDER de-clumps the front and lifts the top.
test("lesen: one round no longer floods the Pokalraum (§8.3, §14.3)", () => {
  assert.deepEqual(THRESHOLDS.lesen, [3, 7, 12, 17, 23, 29, 35, 41, 47, 52, 57, 62]);

  // A first perfect Schwer round pays 3 × 3 = 9. It must buy at most two
  // trophies, the einmaleins pace (its first Schwer round buys two: 2, 6).
  assert.ok(trophyCount("lesen", 9) <= 2, "one Schwer round must not drop three trophies");
  assert.equal(trophyCount("lesen", 9), 2);

  // Filling the shelf needs play across difficulties: Schwer alone caps at
  // 5 tiles × 9 = 45, short of the twelfth trophy at 62.
  assert.ok(THRESHOLDS.lesen.at(-1) > 5 * 3 * 3, "Schwer alone must not fill the shelf");
});

// The rechnungen twin of the balance tests above: its maximum is computed from
// its real tiles — six mode chips (＋ − ×÷ 🧱 ⊞ 🎲) per difficulty (§12.2) — and
// a first sitting must already pay the first trophy.
test("rechnungen's economy is computed from its real tiles (§12.2)", () => {
  assert.equal(rechnenMaxPoints(), MAX_POINTS.rechnungen, "rewards.js and logic.js disagree");
  assert.equal(6 * (3 * 1 + 3 * 2 + 3 * 3), MAX_POINTS.rechnungen, "6 modes × three difficulties");
  assert.equal(trophyCount("rechnungen", MAX_POINTS.rechnungen), TROPHIES_PER_GAME,
    "mastering every mode must fill the shelf");
  assert.ok(THRESHOLDS.rechnungen[0] <= 3, "a first sitting still reaches the first trophy");
  // filling the shelf needs play across modes: three modes cap at 3 × (3+6+9) = 54,
  // short of the twelfth trophy
  assert.ok(THRESHOLDS.rechnungen.at(-1) > 3 * (3 + 6 + 9), "one or two modes must not fill the shelf");
});

// rechnungen scales lesen's hand-tuned ladder to its 108-point economy rather
// than taking the generated einmaleins curve — which would drop three trophies
// from one perfect Schwer round and flood the Pokalraum (§8.3, §12.2). The
// first rung stays at 3: a child's very first perfect Leicht round is a trophy.
test("rechnungen: one round no longer floods the Pokalraum", () => {
  assert.deepEqual(THRESHOLDS.rechnungen, [3, 8, 14, 20, 28, 35, 42, 49, 56, 62, 68, 74]);
  // a first perfect Schwer round pays 3 × 3 = 9 — at most two trophies
  assert.equal(trophyCount("rechnungen", 9), 2, "one Schwer round must not drop three trophies");
  // Schwer alone (6 modes × 9 = 54) must not reach the twelfth trophy
  assert.ok(THRESHOLDS.rechnungen.at(-1) > 6 * 9, "Schwer alone must not fill the shelf");
});

// The drachen twin. Its maximum is computed from its real stories — three per
// difficulty, three endings each (§21) — and that number is FROZEN: it is the
// denominator regionState/starBadgeTier/pave() measure a child against, so
// raising it would demote someone who had already mastered the cave.
test("drachen's economy is computed from its real stories (§21)", () => {
  assert.equal(drachenMaxPoints(STORIES.de), MAX_POINTS.drachen, "rewards.js and logic.js disagree");
  assert.equal(3 * 3 * (1 + 2 + 3), MAX_POINTS.drachen, "3 stories × 3 endings × three difficulties");
  assert.equal(trophyCount("drachen", MAX_POINTS.drachen), TROPHIES_PER_GAME,
    "finding every ending must fill the shelf");
  assert.ok(THRESHOLDS.drachen[0] <= 3, "a first sitting still reaches the first trophy");
});

// A story pays at most ONE star per read-through — the ending she just found —
// where a drill round pays up to three. So the cave's rungs sit closer together
// at the bottom than lesen's, and the flood test is the tighter one: a whole
// story read out to all three endings on Schwer is 9 points and must still not
// clear a third of the shelf.
test("drachen: one story never floods the Pokalraum (§8.3, §21)", () => {
  assert.deepEqual(THRESHOLDS.drachen, [2, 4, 7, 10, 13, 17, 20, 24, 28, 31, 34, 36]);
  assert.equal(trophyCount("drachen", 3), 1, "one Schwer ending is one trophy, no more");
  assert.ok(trophyCount("drachen", 9) <= 4, "a whole story on Schwer must not empty the shelf");
  // filling it needs reading across difficulties: Schwer alone caps at 3 × 9
  assert.ok(THRESHOLDS.drachen.at(-1) > 3 * 9, "Schwer alone must not fill the shelf");
  // …and it is pre-scaled for a grid that may one day grow to four stories per
  // difficulty (72 points): the twelfth must stay inside the band below, so no
  // child would ever lose a trophy she had already won.
  const grown = THRESHOLDS.drachen.at(-1) / 72;
  assert.ok(grown > 0.4 && grown <= 0.7, `at a 4×3 grid the twelfth would sit at ${grown}`);
});

// §8.3: points reward progress and difficulty. They must never reward
// repetition — otherwise a child collects all 60 trophies by replaying the
// easiest table forever, which is the opposite of what the game is for.

test("roundPoints(): a round that improves nothing pays nothing", () => {
  for (const difficulty of [0, 1, 2]) {
    for (const stars of [0, 1, 2, 3]) {
      assert.equal(roundPoints({ oldStars: stars, newStars: stars, difficulty }), 0);
    }
    // a worse round than your best never subtracts, and never pays
    assert.equal(roundPoints({ oldStars: 3, newStars: 1, difficulty }), 0);
  }
});

test("roundPoints(): every star inside a difficulty is worth the same", () => {
  // Linear (§8.3). The third star used to carry a ×3 mastery bonus, which made
  // three equal-looking stars worth 1, 1 and 4 on Leicht — the picker showed
  // three stars and paid for something else.
  for (const d of [0, 1, 2]) {
    const perStar = starValue(d);
    for (let from = 0; from < 3; from++) {
      assert.equal(roundPoints({ oldStars: from, newStars: from + 1, difficulty: d }), perStar,
        `d=${d}: star ${from + 1} must be worth ${perStar}`);
    }
    assert.equal(roundPoints({ oldStars: 0, newStars: 3, difficulty: d }), 3 * perStar);
  }
  assert.deepEqual([0, 1, 2].map(starValue), [1, 2, 3]);
});

test("roundPoints(): a mastered tile pays nothing, ever", () => {
  for (const d of [0, 1, 2]) {
    assert.equal(roundPoints({ oldStars: 3, newStars: 3, difficulty: d }), 0);
    assert.equal(roundPoints({ oldStars: 2, newStars: 1, difficulty: d }), 0, "going backwards pays nothing");
  }
  // junk difficulty must not invent a multiplier
  assert.equal(roundPoints({ oldStars: 0, newStars: 1, difficulty: 9 }), 1);
  assert.equal(roundPoints(), 0);
});

test("roundPoints(): harder tiles always pay more for the same progress", () => {
  for (let oldStars = 0; oldStars < 3; oldStars++) {
    const easy = roundPoints({ oldStars, newStars: 3, difficulty: 0 });
    const medium = roundPoints({ oldStars, newStars: 3, difficulty: 1 });
    const hard = roundPoints({ oldStars, newStars: 3, difficulty: 2 });
    assert.ok(easy <= medium && medium <= hard, `not monotonic from ${oldStars} stars`);
  }
});

test("tilePointsLeft(): a tile is exactly the sum of its three stars", () => {
  assert.equal(tilePointsLeft(0, 0), 3, "an untouched Leicht tile");
  assert.equal(tilePointsLeft(0, 1), 6, "an untouched Mittel tile");
  assert.equal(tilePointsLeft(0, 2), 9, "an untouched Schwer tile");
  assert.equal(tilePointsLeft(0, 2), 3 * tilePointsLeft(0, 0), "Schwer pays 3× Leicht");
  assert.equal(tilePointsLeft(3, 2), 0, "a mastered tile is worth nothing");

  // and it agrees with what you would actually be paid, one star at a time
  for (const difficulty of [0, 1, 2]) {
    for (let start = 0; start <= 3; start++) {
      let stepwise = 0;
      for (let k = start; k < 3; k++) {
        stepwise += roundPoints({ oldStars: k, newStars: k + 1, difficulty });
      }
      assert.equal(stepwise, tilePointsLeft(start, difficulty), `d=${difficulty} from ${start}`);
    }
  }
});

test("grinding a mastered tile can never fill the Pokalraum", () => {
  let pr = 0;
  for (let i = 0; i < 1000; i++) pr += roundPoints({ oldStars: 3, newStars: 3, difficulty: 0 });
  assert.equal(trophyCount("einmaleins", pr), 0);
});

test("balance: finishing einmaleins is possible, and 12 trophies come before the end", () => {
  // 25 tiles: Leicht offers 4 tables + "Alle"; Mittel all 10 + "Alle"; Schwer
  // its 8 hard tables + "Alle" (§10.2)
  const tiles = [[0, 5], [1, 11], [2, 9]];
  const total = tiles.reduce((sum, [d, n]) => sum + n * tilePointsLeft(0, d), 0);
  assert.equal(total, 162, "the einmaleins point economy, after Schwer lost its 1er and 10er");
  assert.equal(total, MAX_POINTS.einmaleins, "…and MAX_POINTS must agree with the tiles");

  assert.equal(trophyCount("einmaleins", total), TROPHIES_PER_GAME, "mastering everything must fill the room");

  // the first trophy must arrive in the first sitting: one Leicht tile taken to
  // two stars pays 2, which is exactly the first threshold
  assert.ok(trophyCount("einmaleins", roundPoints({ oldStars: 0, newStars: 2, difficulty: 0 })) >= 1);

  // playing only Leicht, perfectly, cannot finish the collection
  const easyOnly = 5 * tilePointsLeft(0, 0);
  assert.ok(trophyCount("einmaleins", easyOnly) < TROPHIES_PER_GAME, "Leicht alone must not fill the room");
});

// Regression: the summary rendered `newTrophies[0]` and dropped the rest. A
// round can cross several thresholds at once — a first Schwer round taken to
// three stars pays 18 points, which passes 2, 9 and 18 in one go, so a child's
// very first serious round silently lost two of its three prizes.
test("one round can win several trophies, and the summary must show them all", () => {
  // A round can still cross more than one threshold, so the summary must still
  // iterate. It used to be three at once, when a Schwer tile paid 18; linear
  // points make the best round worth 9, which crosses 2 and 6.
  const best = roundPoints({ oldStars: 0, newStars: 3, difficulty: 2 });
  assert.equal(best, 9);
  assert.equal(trophyCount("einmaleins", best) - trophyCount("einmaleins", 0), 2, "9 points cross two thresholds");

  // not a corner case of an empty account: it happens mid-collection too
  assert.ok(trophyCount("einmaleins", 11 + best) - trophyCount("einmaleins", 11) >= 2);

  // ...and the shared round-summary painter must iterate rather than index the
  // first: the game hands it every won trophy, and it maps over them all.
  const src = readFileSync(
    fileURLToPath(new URL("../assets/js/roundsummary.js", import.meta.url)),
    "utf8",
  );
  const show = src.slice(src.indexOf("function show("));
  assert.ok(
    !/trophies\[0\]/.test(show),
    "showing only trophies[0] swallows the other prizes",
  );
  assert.ok(/trophies\s*\n?\s*\.map\(/.test(show), "the summary must render every won trophy");
  // and every game feeds it the full list
  const root = new URL("../", import.meta.url);
  for (const g of ["einmaleins/einmaleins", "lesen/lesen", "rechnungen/rechnungen"]) {
    const game = readFileSync(fileURLToPath(new URL(`games/${g}.js`, root)), "utf8");
    assert.match(game, /trophies: res\.newTrophies/, `${g}.js must hand the summary every won trophy`);
  }
});

// Practice time exists for the parents' view (§20) and is the only clock in
// the product. It is aggregated per difficulty, never per question.
test("addPractice banks seconds and rounds, per difficulty, and is pure", () => {
  const first = addPractice({}, 1, 42.4);
  assert.deepEqual(first, { tm: [0, 42, 0], rd: [0, 1, 0] });

  const second = addPractice({ ...first }, 1, 17.6);
  assert.deepEqual(second, { tm: [0, 60, 0], rd: [0, 2, 0] });
  assert.deepEqual(first, { tm: [0, 42, 0], rd: [0, 1, 0] }, "must not mutate its input");

  const third = addPractice(second, 2, 10);
  assert.deepEqual(third, { tm: [0, 60, 10], rd: [0, 2, 1] });
});

test("addPractice refuses nonsense: a forgotten tab is not practice", () => {
  // a round left open all afternoon must not count as four hours of times tables
  assert.equal(addPractice({}, 0, 60 * 60 * 4).tm[0], MAX_ROUND_SECONDS);
  assert.ok(MAX_ROUND_SECONDS <= 900, "cap a single round at fifteen minutes or less");

  // negative, NaN and junk clocks bank a round but no time
  for (const bad of [-5, NaN, undefined, "abc", Infinity]) {
    const r = addPractice({}, 0, bad);
    assert.equal(r.tm[0], 0, `seconds=${String(bad)} must bank no time`);
    assert.equal(r.rd[0], 1, `seconds=${String(bad)} must still bank the round`);
  }

  // a corrupted state must not crash the parents' page
  for (const junk of [null, "x", [1, 2], [1, 2, 3, 4], { 0: 1 }, [-1, "a", NaN]]) {
    const r = addPractice({ tm: junk, rd: junk }, 0, 5);
    assert.equal(r.tm.length, 3);
    assert.ok(r.tm.every((n) => Number.isInteger(n) && n >= 0), `tm from ${JSON.stringify(junk)}`);
    assert.ok(r.rd.every((n) => Number.isInteger(n) && n >= 0));
  }

  // an out-of-range difficulty lands in a real slot rather than growing the array
  assert.equal(addPractice({}, 9, 5).tm.length, 3);
});
