import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THRESHOLDS, STICKERS, GAMES, stickerCount, foxLevel, updateStreak,
  gameStars, sumStars, regionState, ACHIEVABLE,
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
