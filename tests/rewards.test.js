import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THRESHOLDS, STICKERS, GAMES, stickerCount, foxLevel, updateStreak,
  gameStars, sumStars, regionState, ACHIEVABLE, starBadgeTier, nextStickerInfo,
  stickerCredit,
} from "../assets/js/rewards.js";

test("sticker thresholds match spec §8.3", () => {
  assert.deepEqual(THRESHOLDS, [1, 2, 3, 5, 7, 9, 12, 15, 18, 22, 26, 30]);
});

test("stickerCount maps counters to earned stickers", () => {
  assert.equal(stickerCount(0), 0);
  assert.equal(stickerCount(1), 1);
  assert.equal(stickerCount(4), 3);
  assert.equal(stickerCount(5), 4);
  assert.equal(stickerCount(30), 12);
  assert.equal(stickerCount(999), 12);
  assert.equal(stickerCount(undefined), 0);
});

test("every game has exactly 12 stickers with de+en names (§8.3)", () => {
  for (const g of GAMES) {
    assert.equal(STICKERS[g].length, 12, g);
    for (const s of STICKERS[g]) {
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

test("nextStickerInfo: progress toward the next sticker (§8.3)", () => {
  assert.deepEqual(nextStickerInfo(undefined), { earned: 0, threshold: 1, remaining: 1 });
  assert.deepEqual(nextStickerInfo(1), { earned: 1, threshold: 2, remaining: 1 });
  assert.deepEqual(nextStickerInfo(4), { earned: 3, threshold: 5, remaining: 1 });
  assert.equal(nextStickerInfo(29).remaining, 1);
  assert.equal(nextStickerInfo(30), null);
});

test("region states at 0 / one third / 100 % (§3.1)", () => {
  assert.equal(regionState({}, "einmaleins"), "base");
  const third = { einmaleins: { stars: { 0: "3".repeat(11) } } }; // 33 of 99
  assert.equal(regionState(third, "einmaleins"), "thriving");
  const full = {
    einmaleins: { stars: { 0: "3".repeat(11), 1: "3".repeat(11), 2: "3".repeat(11) } },
  };
  assert.equal(gameStars(full, "einmaleins"), ACHIEVABLE.einmaleins);
  assert.equal(regionState(full, "einmaleins"), "mastered");
});

// §8.3: stickers must reward difficulty and mastery, not repetition. Without
// this, a child collects all 60 by replaying Leicht until the counter fills.
test("stickerCredit(): grinding the easiest level earns nothing", () => {
  assert.equal(stickerCredit({ perfect: true, difficulty: 0 }), 0);
  assert.equal(stickerCredit({ perfect: false, difficulty: 0 }), 0);
});

test("stickerCredit(): harder rounds are worth more", () => {
  assert.equal(stickerCredit({ perfect: true, difficulty: 1 }), 1);
  assert.equal(stickerCredit({ perfect: true, difficulty: 2 }), 2);
});

test("stickerCredit(): an imperfect round is worth nothing, however hard", () => {
  for (const difficulty of [0, 1, 2]) {
    assert.equal(stickerCredit({ perfect: false, difficulty }), 0);
  }
});

test("stickerCredit(): mastering a level pays, even on Leicht", () => {
  // the escape hatch for a young child who only ever plays Leicht: the third
  // star needs 10/10 under a minute, which is skill and not repetition
  assert.equal(stickerCredit({ perfect: true, difficulty: 0, masteredNew: true }), 1);
  // and it stacks with the difficulty credit
  assert.equal(stickerCredit({ perfect: true, difficulty: 2, masteredNew: true }), 3);
  // mastery is awarded once; a later replay of the same table pays only the
  // difficulty credit, because the caller stops passing masteredNew
  assert.equal(stickerCredit({ perfect: true, difficulty: 2, masteredNew: false }), 2);
});

test("stickerCredit(): missing arguments never invent credit", () => {
  assert.equal(stickerCredit(), 0);
  assert.equal(stickerCredit({}), 0);
});

test("a Leicht-only grind cannot fill the Pokalraum", () => {
  // 200 perfect Leicht rounds, no table ever mastered
  let pr = 0;
  for (let i = 0; i < 200; i++) pr += stickerCredit({ perfect: true, difficulty: 0 });
  assert.equal(stickerCount(pr), 0, "grinding Leicht must not earn a single sticker");

  // 30 perfect Schwer rounds fill the collection, as THRESHOLDS intends
  let hard = 0;
  for (let i = 0; i < 15; i++) hard += stickerCredit({ perfect: true, difficulty: 2 });
  assert.equal(hard, 30);
  assert.equal(stickerCount(hard), THRESHOLDS.length);
});
