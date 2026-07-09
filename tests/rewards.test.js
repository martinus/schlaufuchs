import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  THRESHOLDS, TROPHIES, GAMES, trophyCount, foxLevel, updateStreak,
  gameStars, sumStars, regionState, ACHIEVABLE, starBadgeTier, nextTrophyInfo,
  roundPoints, tilePointsLeft, addPractice, MAX_ROUND_SECONDS,
} from "../assets/js/rewards.js";

test("trophy thresholds match spec §8.3", () => {
  assert.deepEqual(THRESHOLDS, [2, 9, 18, 30, 46, 64, 86, 112, 142, 172, 200, 225]);
});

test("trophyCount maps counters to earned trophies", () => {
  assert.equal(trophyCount(0), 0);
  assert.equal(trophyCount(1), 0);
  assert.equal(trophyCount(2), 1);
  assert.equal(trophyCount(8), 1);
  assert.equal(trophyCount(17), 2);
  assert.equal(trophyCount(18), 3);
  assert.equal(trophyCount(225), 12);
  assert.equal(trophyCount(999), 12);
  assert.equal(trophyCount(undefined), 0);
});

test("every game has exactly 12 trophies with de+en names (§8.3)", () => {
  for (const g of GAMES) {
    assert.equal(TROPHIES[g].length, 12, g);
    for (const s of TROPHIES[g]) {
      assert.ok(s.e && s.de && s.en, `${g}: ${JSON.stringify(s)}`);
    }
  }
});

test("fox level formula (§8.4)", () => {
  assert.equal(foxLevel(0), 1);
  assert.equal(foxLevel(9), 1);
  assert.equal(foxLevel(10), 2);
  assert.equal(foxLevel(190), 20);
  assert.equal(foxLevel(9999), 20);
});

test("daily streak: same day, next day, gap (§8.5)", () => {
  assert.deepEqual(updateStreak(null, "2026-07-08"), ["2026-07-08", 1]);
  assert.deepEqual(updateStreak(["2026-07-08", 4], "2026-07-08"), ["2026-07-08", 4]);
  assert.deepEqual(updateStreak(["2026-07-07", 4], "2026-07-08"), ["2026-07-08", 5]);
  assert.deepEqual(updateStreak(["2026-07-05", 4], "2026-07-08"), ["2026-07-08", 1]);
  // month boundary
  assert.deepEqual(updateStreak(["2026-06-30", 2], "2026-07-01"), ["2026-07-01", 3]);
});

test("gameStars sums digit strings and objects of digit strings", () => {
  const state = {
    einmaleins: { stars: { 0: "30200000000", 1: "111" } },
    tippen: { stars: { de: "332" } },
  };
  assert.equal(gameStars(state, "einmaleins"), 8);
  assert.equal(gameStars(state, "tippen"), 8);
  assert.equal(gameStars(state, "lesen"), 0);
  assert.equal(sumStars(state), 16);
});

test("starBadgeTier: none / some / gold / glowing (§3.1)", () => {
  assert.equal(starBadgeTier({}, "einmaleins"), 0);
  assert.equal(starBadgeTier({ einmaleins: { stars: { 0: "1" } } }, "einmaleins"), 1);
  const third = { einmaleins: { stars: { 0: "3".repeat(11) } } }; // 33 of 99
  assert.equal(starBadgeTier(third, "einmaleins"), 2);
  const full = {
    einmaleins: { stars: { 0: "3".repeat(11), 1: "3".repeat(11), 2: "3".repeat(11) } },
  };
  assert.equal(starBadgeTier(full, "einmaleins"), 3);
});

test("nextTrophyInfo: progress toward the next trophy (§8.3)", () => {
  assert.deepEqual(nextTrophyInfo(undefined), { earned: 0, threshold: 2, remaining: 2 });
  assert.deepEqual(nextTrophyInfo(3), { earned: 1, threshold: 9, remaining: 6 });
  assert.deepEqual(nextTrophyInfo(17), { earned: 2, threshold: 18, remaining: 1 });
  assert.equal(nextTrophyInfo(224).remaining, 1);
  assert.equal(nextTrophyInfo(225), null);
});

test("region states at 0 / one third / 100 % (§3.1)", () => {
  assert.equal(regionState({}, "einmaleins"), "base");

  // Leicht only ever offers tables 1, 2, 5, 10 and "Alle" (index 10), so a
  // fully starred Leicht is 5 tiles, not 11. Counting the tiles Leicht never
  // shows is what made ACHIEVABLE 99 and the region impossible to master.
  // tables 1, 2, 5, 10 → digits 0, 1, 4, 9; "Alle" → digit 10
  const easyFull = "33003000033";
  const third = { einmaleins: { stars: { 1: "3".repeat(9) } } }; // 27 of 81
  assert.equal(regionState(third, "einmaleins"), "thriving");

  const full = {
    einmaleins: { stars: { 0: easyFull, 1: "3".repeat(11), 2: "3".repeat(11) } },
  };
  assert.equal(gameStars(full, "einmaleins"), ACHIEVABLE.einmaleins);
  assert.equal(regionState(full, "einmaleins"), "mastered");
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

test("roundPoints(): every new star is worth an award, times the difficulty", () => {
  assert.equal(roundPoints({ oldStars: 0, newStars: 1, difficulty: 0 }), 1);
  assert.equal(roundPoints({ oldStars: 0, newStars: 1, difficulty: 1 }), 2);
  assert.equal(roundPoints({ oldStars: 0, newStars: 1, difficulty: 2 }), 3);
  assert.equal(roundPoints({ oldStars: 1, newStars: 2, difficulty: 0 }), 1);
  assert.equal(roundPoints({ oldStars: 2, newStars: 3, difficulty: 0 }), (1 + 3) * 1);
});

test("roundPoints(): the mistake-free round pays by difficulty", () => {
  // three stars means 10/10 on the first try (§10.3) — that IS the mistake-free
  // round, so the bonus needs no stored flag of its own
  assert.equal(roundPoints({ oldStars: 2, newStars: 3, difficulty: 0 }), (1 + 3) * 1);
  assert.equal(roundPoints({ oldStars: 2, newStars: 3, difficulty: 1 }), (1 + 3) * 2);
  assert.equal(roundPoints({ oldStars: 2, newStars: 3, difficulty: 2 }), (1 + 3) * 3);
  // and only the first time: a mastered tile pays nothing, ever again
  assert.equal(roundPoints({ oldStars: 3, newStars: 3, difficulty: 2 }), 0);
  // two stars is a near-miss, not a mastery: no bonus
  assert.equal(roundPoints({ oldStars: 0, newStars: 2, difficulty: 0 }), 2);
});

test("roundPoints(): mastering a tile pays a bonus, once", () => {
  assert.equal(roundPoints({ oldStars: 0, newStars: 3, difficulty: 0 }), 6);
  assert.equal(roundPoints({ oldStars: 0, newStars: 3, difficulty: 1 }), 12);
  assert.equal(roundPoints({ oldStars: 0, newStars: 3, difficulty: 2 }), 18);
  assert.equal(roundPoints({ oldStars: 3, newStars: 3, difficulty: 2 }), 0);
});

test("roundPoints(): harder tiles always pay more for the same progress", () => {
  for (let oldStars = 0; oldStars < 3; oldStars++) {
    const easy = roundPoints({ oldStars, newStars: 3, difficulty: 0 });
    const medium = roundPoints({ oldStars, newStars: 3, difficulty: 1 });
    const hard = roundPoints({ oldStars, newStars: 3, difficulty: 2 });
    assert.ok(easy <= medium && medium <= hard, `not monotonic from ${oldStars} stars`);
  }
});

test("tilePointsLeft(): the number on the tile is what the tile still pays", () => {
  assert.equal(tilePointsLeft(0, 0), 6, "an untouched Leicht tile");
  assert.equal(tilePointsLeft(0, 1), 12, "an untouched Mittel tile");
  assert.equal(tilePointsLeft(0, 2), 18, "an untouched Schwer tile");
  // the gap must be big enough for a child to notice and act on
  assert.equal(tilePointsLeft(0, 2), 3 * tilePointsLeft(0, 0), "Schwer pays 3× Leicht");
  assert.equal(tilePointsLeft(3, 2), 0, "a mastered tile is worth nothing");
  // and it agrees with what you would actually be paid, in any number of steps
  for (const difficulty of [0, 1, 2]) {
    for (let start = 0; start <= 3; start++) {
      const stepwise =
        roundPoints({ oldStars: start, newStars: Math.min(start + 1, 3), difficulty }) +
        roundPoints({ oldStars: Math.min(start + 1, 3), newStars: Math.min(start + 2, 3), difficulty }) +
        roundPoints({ oldStars: Math.min(start + 2, 3), newStars: 3, difficulty });
      assert.equal(stepwise, tilePointsLeft(start, difficulty), `d=${difficulty} from ${start}`);
    }
  }
});

test("grinding a mastered tile can never fill the Pokalraum", () => {
  let pr = 0;
  for (let i = 0; i < 1000; i++) pr += roundPoints({ oldStars: 3, newStars: 3, difficulty: 0 });
  assert.equal(trophyCount(pr), 0);
});

test("balance: finishing einmaleins is possible, and 12 trophies come before the end", () => {
  // 27 tiles: Leicht offers 4 tables + "Alle"; Mittel and Schwer all 10 + "Alle"
  const tiles = [[0, 5], [1, 11], [2, 11]];
  const total = tiles.reduce((sum, [d, n]) => sum + n * tilePointsLeft(0, d), 0);
  assert.equal(total, 360, "the einmaleins point economy");

  assert.equal(trophyCount(total), THRESHOLDS.length, "mastering everything must fill the room");
  const last = THRESHOLDS.at(-1);
  assert.ok(last / total < 0.7, `the last trophy at ${last}/${total} is a grind`);
  assert.ok(last / total > 0.4, `the last trophy at ${last}/${total} is given away`);

  // the first trophy should arrive in the first sitting: one Leicht tile taken
  // to two stars pays 3, which is already past the first threshold
  assert.ok(trophyCount(roundPoints({ oldStars: 0, newStars: 2, difficulty: 0 })) >= 1);

  // playing only Leicht, perfectly, cannot finish the collection
  const easyOnly = 5 * tilePointsLeft(0, 0);
  assert.ok(trophyCount(easyOnly) < THRESHOLDS.length, "Leicht alone must not fill the room");
});

// Regression: the summary rendered `newTrophies[0]` and dropped the rest. A
// round can cross several thresholds at once — a first Schwer round taken to
// three stars pays 18 points, which passes 2, 9 and 18 in one go, so a child's
// very first serious round silently lost two of its three prizes.
test("one round can win several trophies, and the summary must show them all", () => {
  const best = roundPoints({ oldStars: 0, newStars: 3, difficulty: 2 });
  assert.equal(best, 18);
  assert.equal(trophyCount(best) - trophyCount(0), 3, "18 points cross three thresholds");

  // it is not a corner case of an empty account: mid-collection too
  assert.ok(trophyCount(8 + best) - trophyCount(8) >= 2);

  // ...and the round-summary code must iterate rather than index the first
  const src = readFileSync(
    fileURLToPath(new URL("../games/einmaleins/einmaleins.js", import.meta.url)),
    "utf8",
  );
  const endRound = src.slice(src.indexOf("function endRound()"));
  assert.ok(
    !/newTrophies\[0\]/.test(endRound),
    "showing only newTrophies[0] swallows the other prizes",
  );
  assert.ok(/\.map\(/.test(endRound), "the summary must render every won trophy");
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

  // a corrupted cookie must not crash the parents' page
  for (const junk of [null, "x", [1, 2], [1, 2, 3, 4], { 0: 1 }, [-1, "a", NaN]]) {
    const r = addPractice({ tm: junk, rd: junk }, 0, 5);
    assert.equal(r.tm.length, 3);
    assert.ok(r.tm.every((n) => Number.isInteger(n) && n >= 0), `tm from ${JSON.stringify(junk)}`);
    assert.ok(r.rd.every((n) => Number.isInteger(n) && n >= 0));
  }

  // an out-of-range difficulty lands in a real slot rather than growing the array
  assert.equal(addPractice({}, 9, 5).tm.length, 3);
});
