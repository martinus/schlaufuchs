// A round survives an interruption (§10.7): after every answer the round is
// mirrored into sessionStorage, and on load the game rehydrates it — a call,
// an accidental swipe, a tab evicted under memory pressure, and the fox is
// standing exactly where the child left it. No dialog, nothing to explain.
//
// The snapshot/restore arithmetic is unit-tested in adaptive.test.js; these
// are the wiring pins — mirroring is easy to lose in a refactor, and its
// absence is silent: the guard still catches the deliberate exits, and only
// the accidents start costing rounds again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { read } from "./pages.js";

const GAMES = ["games/einmaleins/einmaleins.js", "games/lesen/lesen.js"];

test("the round store is sessionStorage, and it never throws at the child", () => {
  const src = read("assets/js/roundstore.js");
  assert.match(src, /sessionStorage/, "the mirror lives in sessionStorage — per tab, gone with it");
  assert.ok(!/localStorage\s*\./.test(src), "localStorage would outlive the session and resurrect stale rounds");
  for (const fn of ["saveRound", "loadRound", "clearRound"]) {
    assert.match(src, new RegExp(`export function ${fn}`), `${fn} is missing`);
  }
  // Private mode and full quotas throw; a reward mirror must never take the
  // round down with it.
  const bodies = src.match(/try \{/g) ?? [];
  assert.ok(bodies.length >= 3, "every touch of sessionStorage needs its try");
});

test("both games mirror after every answer, and rehydrate on load", () => {
  for (const f of GAMES) {
    const src = read(f);
    // mirrored after the answer is recorded — both branches funnel through one call
    assert.match(src, /saveRound\(/, `${f} never saves the round`);
    assert.ok(
      src.indexOf("session.answer(") < src.indexOf("saveRound("),
      `${f}: the mirror must be written after the answer is recorded`,
    );
    // rehydrated on load: with a snapshot the game skips the picker entirely
    assert.match(src, /loadRound\(/, `${f} never reads the mirror back`);
    assert.match(src, /validResume\(/, `${f} must validate before trusting a snapshot`);
    // consumed on the two ends of a round: a fresh start clears a stale
    // mirror, a finished round clears its own
    const start = src.slice(src.indexOf("function startRound"), src.indexOf("function askNext"));
    assert.match(start, /clearRound\(/, `${f}: a fresh start must drop a stale mirror`);
    const end = src.slice(src.indexOf("function endRound"));
    assert.match(end, /clearRound\(/, `${f}: a written round needs no mirror`);
    // the fox walks back to where she stood — the loop, not submit()'s own
    // single advance, is what a resume adds
    assert.match(
      src,
      /for \(let i = session\.progress\(\)\.solved; i > 0; i--\) journey\.advance\(\);/,
      `${f}: the journey must be walked forward on resume`,
    );
  }
});

test("a confirmed 'Zur Karte' clears the mirror — leaving on purpose means it", () => {
  const guard = read("assets/js/leaveguard.js");
  assert.match(guard, /onGo\?\.\(\)/, "the guard must announce the confirmed leave");
  for (const f of GAMES) {
    assert.match(read(f), /onGo:\s*\(\)\s*=>\s*clearRound\(/, `${f} must clear on a confirmed leave`);
  }
});
