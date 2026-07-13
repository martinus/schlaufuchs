// Rechnungen pure logic (§12): the skill buckets and their generators, the
// task/cell model (walls, grids, scaffolds, remainders), the variant-expansion
// the shared engine draws over, the per-bucket box fold, the star/tempo digit
// strings, and the einmaleins rules this game duplicates.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODES, DIFF_KEYS, DIFF_SLUGS, STAR_SLOTS, DIFF_SLOTS, VARIANTS, roundSizeFor,
  BUCKETS, BUCKET_COUNT, bucketOf, bucketsFor, poolFor, questionFor, foldBoxes,
  mauerAidFor, quadAidFor,
  starsFor, nextStarGoal, starGoalNeed, ownedStars, starDigit, withStarDigit,
  fittedFontSize, retryStep, maxPoints,
  TEMPO_SLOTS, TEMPO_TIERS, TEMPO_ICONS, TEMPO_KEYS, median, tempoTier, awardTempo,
} from "../games/rechnungen/logic.js";
import {
  starsFor as emStarsFor, nextStarGoal as emNextStarGoal,
  starGoalNeed as emStarGoalNeed, ownedStars as emOwnedStars,
  fittedFontSize as emFitted, retryStep as emRetry,
  TEMPO_ICONS as emTempoIcons, TEMPO_KEYS as emTempoKeys,
  median as emMedian, awardTempo as emAwardTempo,
} from "../games/einmaleins/logic.js";
import { MAX_POINTS, THRESHOLDS, trophyCount, TROPHIES_PER_GAME } from "../assets/js/rewards.js";
import { BUDGET } from "../assets/js/storage.js";
import strings from "../games/rechnungen/i18n.js";
import { read } from "./pages.js";

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// Evaluate a printed one-gap equation the way the child (and the driver) reads
// it, so an aid whose text and answer disagree is caught. Chains run left to
// right; a gap solves for the "?". Division uses ":" here (the sign we pass).
function evaluate(text) {
  // the ×→+ link prints two "=" ("3 × 6 = 6 + 6 + 6 = ?"): first and last count
  const parts = text.split("=").map((s) => s.trim());
  const lhs = parts[0];
  const rhs = parts[parts.length - 1];
  const tok = lhs.split(/\s+/);
  const num = (t) => Number(t);
  const apply = (x, op, y) => ({ "+": x + y, "−": x - y, "×": x * y, ":": x / y }[op]);
  if (rhs === "?") {
    let acc = num(tok[0]);
    for (let i = 1; i < tok.length; i += 2) acc = apply(acc, tok[i], num(tok[i + 1]));
    return acc;
  }
  // a gap: "? op b = c" or "a op ? = c"
  const c = num(rhs);
  const [a, op, b] = tok;
  if (a === "?") return { "+": c - num(b), "−": c + num(b), "×": c / num(b), ":": c * num(b) }[op];
  return { "+": c - num(a), "−": num(a) - c, "×": c / num(a), ":": num(a) / c }[op];
}

// Draw many fresh tasks from one bucket, by key.
const drawKey = (key, n = 2000) => {
  const i = BUCKETS.findIndex((b) => b.key === key);
  assert.ok(i >= 0, `no bucket ${key}`);
  const rng = seeded(i * 31 + 5);
  return Array.from({ length: n }, () => questionFor(i, rng, ":"));
};

test("the modes and difficulties are the ones §12 names", () => {
  assert.deepEqual(MODES, ["+", "-", "x:", "mauer", "quad", "mix"]);
  assert.equal(DIFF_KEYS.length, 3);
  assert.equal(DIFF_SLUGS.length, 3);
  assert.equal(STAR_SLOTS, 3);
  assert.equal(DIFF_SLOTS, 3);
});

// Round sizes per mode and difficulty (§12.2): a wall is three answers, a grid
// up to four, and Schwer ± rounds carry seven-cell scaffolds — those rounds
// hold fewer tasks, so every round is a comparable effort.
test("roundSizeFor: equations 10 (Schwer ± 8), mix 8/7, walls 4, grids 3", () => {
  for (const d of [0, 1]) {
    assert.equal(roundSizeFor("+", d), 10);
    assert.equal(roundSizeFor("-", d), 10);
    assert.equal(roundSizeFor("mix", d), 8);
  }
  assert.equal(roundSizeFor("+", 2), 8, "Schwer ± carries scaffolds — shorter round");
  assert.equal(roundSizeFor("-", 2), 8);
  assert.equal(roundSizeFor("x:", 2), 10);
  assert.equal(roundSizeFor("mix", 2), 7);
  for (const d of [0, 1, 2]) {
    assert.equal(roundSizeFor("mauer", d), 4);
    assert.equal(roundSizeFor("quad", d), 3);
  }
});

test("every bucket is placed in a real cell, and the keys are unique", () => {
  const modes = ["+", "-", "x:", "mauer", "quad"]; // never "mix" — mix has no buckets of its own
  for (const b of BUCKETS) {
    assert.ok(modes.includes(b.mode), `${b.key}: bogus mode ${b.mode}`);
    assert.ok([0, 1, 2].includes(b.diff), `${b.key}: bogus difficulty ${b.diff}`);
    assert.equal(typeof b.gen, "function", `${b.key}: no generator`);
  }
  // keys are unique — the box digit string is addressed by bucket index, so a
  // duplicate would mean two skills sharing one Leitner digit
  assert.equal(new Set(BUCKETS.map((b) => b.key)).size, BUCKET_COUNT);
  assert.equal(BUCKET_COUNT, BUCKETS.length);
});

// The one correctness test that matters: whatever numbers a bucket rolls, every
// CELL's aid equation must actually equal the cell's answer, and every number
// the task prints stays within the workbook's range of 100 (§12.1). A child
// never meets a negative, and never a number she cannot picture yet. Walls and
// grids compute their aid at miss time (the child picks her own order), so
// their helpers are asked here with everything visible.
test("every cell's aid evaluates to its own answer, within 100, at every difficulty", () => {
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const rng = seeded(i * 97 + 1);
    for (let k = 0; k < 1500; k++) {
      const task = questionFor(i, rng, ":");
      assert.ok(Array.isArray(task.cells) && task.cells.length >= 1, `${BUCKETS[i].key}: no cells`);
      const aids = [];
      for (const cell of task.cells) {
        assert.ok(Number.isInteger(cell.answer), `${BUCKETS[i].key}: non-integer answer ${cell.answer}`);
        assert.ok(cell.answer >= 0 && cell.answer <= 100, `${BUCKETS[i].key}: answer ${cell.answer} out of 0–100`);
        const aid = task.kind === "mauer" ? mauerAidFor(task.vals, task.vals.map(() => true), cell.pos)
          : task.kind === "quad" ? quadAidFor(task, cell.pos)
          : cell.aid;
        aids.push(aid);
        assert.ok(aid && typeof aid.text === "string", `${BUCKETS[i].key}: cell without aid`);
        assert.equal(aid.answer, cell.answer, `${BUCKETS[i].key}: aid disagrees with its cell`);
        assert.equal((aid.text.match(/\?/g) ?? []).length, 1, `${BUCKETS[i].key}: aid "${aid.text}"`);
        // the remainder aids carry an "R"; evaluate() only reads plain one-gap forms
        if (!/\sR\s/.test(aid.text)) {
          assert.equal(evaluate(aid.text), aid.answer, `${BUCKETS[i].key}: "${aid.text}" ≠ ${aid.answer}`);
        }
      }
      // every number printed anywhere (task text, head, wall, grid, aids) is ≤ 100
      const printed = [task.text, task.head, ...(task.vals ?? []), ...(task.rows ?? []),
        ...(task.cols ?? []), ...(task.grid ?? []).flat(), ...aids.map((a) => a.text)]
        .filter((x) => x !== undefined)
        .flatMap((x) => String(x).match(/\d+/g) ?? [])
        .map(Number);
      for (const v of printed) assert.ok(v <= 100, `${BUCKETS[i].key}: prints ${v} > 100`);
    }
  }
});

// The one-line kinds: the task's text carries exactly one "?" per cell, in cell
// order — that is the contract the renderer interleaves on.
test("one-line tasks carry one '?' per cell in their text", () => {
  for (const b of BUCKETS) {
    if (["zerlege", "mauer", "quad"].some((k) => b.key.includes(k))) continue;
    for (const task of drawKey(b.key, 500)) {
      assert.ok(typeof task.text === "string", `${b.key}: no text`);
      assert.equal((task.text.match(/\?/g) ?? []).length, task.cells.length,
        `${b.key}: "${task.text}" vs ${task.cells.length} cells`);
    }
  }
});

// The workbook's decomposition scaffold (§12.1): the child constructs the
// whole scheme herself — a, the tens of b, the first result; that result
// again, the ones of b, the final result; and the head's answer last. Seven
// cells, in that reading order.
test("zerlege: the child builds the whole tens-first scheme, seven cells", () => {
  for (const key of ["add-s-zerlege", "sub-s-zerlege"]) {
    for (const task of drawKey(key)) {
      assert.equal(task.kind, "zerlege");
      const bt = task.b - (task.b % 10);
      const bu = task.b % 10;
      assert.ok(bt >= 10 && bu >= 1, `${key}: ${task.b} has no tens or no ones — nothing to decompose`);
      const s1 = task.head.includes("+") ? task.a + bt : task.a - bt;
      assert.deepEqual(task.cells.map((c) => c.answer), [task.a, bt, s1, s1, bu, task.answer, task.answer],
        `${key}: the seven cells are the scheme in reading order`);
      assert.equal(evaluate(`${task.a} ${task.head.split(" ")[1]} ${task.b} = ?`), task.answer);
      // every cell's aid names its relation without contradicting it
      for (const cell of task.cells) assert.equal(evaluate(cell.aid.text), cell.answer, `${key}: "${cell.aid.text}"`);
    }
  }
});

// Division with remainder (§12.1 Schwer): two cells on one line — quotient,
// then remainder. The remainder slot is ALWAYS asked, and it is sometimes
// genuinely zero: "no remainder" is an answer the child gives (R 0), not a
// case the format hides.
test("rest: dividend = divisor · quotient + remainder, 0 ≤ remainder < divisor", () => {
  let zeros = 0;
  let nonzeros = 0;
  for (const task of drawKey("div-s-rest")) {
    assert.equal(task.kind, "rest");
    assert.equal(task.cells.length, 2);
    const [q, r] = task.cells.map((c) => c.answer);
    assert.equal(task.b * q + r, task.a, `${task.a} : ${task.b} ≠ ${q} R ${r}`);
    assert.ok(r >= 0 && r < task.b, `remainder ${r} out of 0–${task.b - 1}`);
    assert.equal(Math.floor(task.a / task.b), q, "the quotient is not the floor");
    assert.equal((task.text.match(/\?/g) ?? []).length, 2);
    assert.ok(/\sR\s/.test(task.text), `no R in "${task.text}"`);
    if (r === 0) zeros++;
    else nonzeros++;
  }
  assert.ok(zeros > 0, "a zero remainder must occur — the child answers R 0 herself");
  assert.ok(nonzeros > zeros, "…but real remainders must dominate");
});

// The ×→+ link (§12.1 Leicht): the plus form is printed with the times form,
// one addend per multiplier — reading it IS the lesson.
test("mulplus: the plus form spells out the times form", () => {
  for (const task of drawKey("mul-l-plus")) {
    assert.equal(task.kind, "mulplus");
    const m = task.text.match(/^(\d+) × (\d+) = (.+) = \?$/);
    assert.ok(m, `mulplus text "${task.text}"`);
    const addends = m[3].split(" + ").map(Number);
    assert.equal(addends.length, Number(m[1]), "one addend per multiplier");
    assert.ok(addends.every((v) => v === Number(m[2])), "every addend is the factor");
    assert.equal(task.cells[0].answer, Number(m[1]) * Number(m[2]));
  }
});

// The number walls (§12.1): every wall the game shows is internally true, all
// six values are pairwise distinct (two 9s read as a trick), and following the
// canonical cell order, each brick's aid uses only values visible at that
// moment (given bricks, or cells already filled) — so the obvious path never
// needs a leap.
test("mauer: walls are true and distinct, and every blank solves from what is visible", () => {
  for (const key of ["mauer-l", "mauer-m", "mauer-s"]) {
    for (const task of drawKey(key)) {
      assert.equal(task.kind, "mauer");
      const v = task.vals;
      assert.equal(v[0], v[1] + v[2], `${key}: top row broken`);
      assert.equal(v[1], v[3] + v[4], `${key}: left brick broken`);
      assert.equal(v[2], v[4] + v[5], `${key}: right brick broken`);
      assert.equal(new Set(v).size, 6, `${key}: a wall never repeats a number [${v}]`);
      assert.equal(task.cells.length, 3, `${key}: a wall asks three bricks`);
      assert.equal(task.given.filter(Boolean).length, 3, `${key}: a wall shows three bricks`);
      const known = task.given.slice();
      for (const cell of task.cells) {
        assert.ok(!task.given[cell.pos], `${key}: cell on a given brick`);
        assert.equal(cell.answer, v[cell.pos], `${key}: cell disagrees with the wall`);
        const aid = mauerAidFor(v, known, cell.pos);
        const visible = new Set(v.filter((_, i) => known[i]));
        assert.ok(visible.has(aid.a) && visible.has(aid.b),
          `${key}: aid "${aid.text}" uses a brick not yet visible`);
        assert.equal(evaluate(aid.text), cell.answer);
        known[cell.pos] = true;
      }
      // …and even out of order, the aid still names a true relation
      for (const cell of task.cells) {
        const aid = mauerAidFor(v, task.given, cell.pos);
        assert.equal(evaluate(aid.text), cell.answer, `${key}: out-of-order aid "${aid.text}"`);
      }
    }
  }
});

// The operation grids (§12.1): cell (r,c) = rows[r] op cols[c]; the blanks and
// the given anchors partition the four cells; a hidden column header (Schwer)
// solves first, as a gap off the one visible cell in its column.
test("quad: the grid is true, anchors and blanks partition it, headers solve first", () => {
  const OP = { "+": (x, y) => x + y, "-": (x, y) => x - y, x: (x, y) => x * y };
  for (const key of ["quad-l", "quad-m", "quad-s"]) {
    for (const task of drawKey(key)) {
      assert.equal(task.kind, "quad");
      const f = OP[task.op];
      assert.ok(f, `${key}: bogus op ${task.op}`);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        assert.equal(task.grid[r][c], f(task.rows[r], task.cols[c]), `${key}: grid broken at ${r},${c}`);
      }
      const interiorCells = task.cells.filter((c) => c.pos.hdr === undefined);
      assert.equal(interiorCells.length + task.given.length, 4, `${key}: cells+given must cover the grid`);
      const seen = new Set();
      for (const p of [...interiorCells.map((c) => c.pos), ...task.given]) {
        const k = `${p.r},${p.c}`;
        assert.ok(!seen.has(k), `${key}: ${k} is both cell and given`);
        seen.add(k);
      }
      const hdrCell = task.cells.find((c) => c.pos.hdr !== undefined);
      if (task.hdr !== null) {
        assert.ok(hdrCell, `${key}: hidden header without a header cell`);
        assert.equal(task.cells[0], hdrCell, `${key}: the header must solve first`);
        assert.equal(hdrCell.answer, task.cols[task.hdr]);
        assert.equal(task.given.length, 1, `${key}: the header needs exactly one anchor`);
        assert.equal(task.given[0].c, task.hdr, `${key}: the anchor must sit in the hidden column`);
        assert.equal(evaluate(quadAidFor(task, hdrCell.pos).text), hdrCell.answer, `${key}: header aid`);
      } else {
        assert.equal(hdrCell, undefined);
      }
      // headers pairwise distinct, and so are the four interior values — a grid
      // with two identical 9-rows reads as a trick (user, first play-test)
      assert.equal(new Set([...task.rows, ...task.cols]).size, 4, `${key}: headers repeat [${task.rows} | ${task.cols}]`);
      assert.equal(new Set(task.grid.flat()).size, 4, `${key}: interior values repeat [${task.grid.flat()}]`);
      for (const cell of interiorCells) {
        assert.equal(cell.answer, task.grid[cell.pos.r][cell.pos.c]);
        assert.equal(evaluate(quadAidFor(task, cell.pos).text), cell.answer);
      }
    }
  }
});

// The difficulty parameters §12.1 promises, as behaviour over many draws.
test("difficulty bands hold: carrying, borrowing, exact division, Leicht ranges", () => {
  // Leicht ＋ stays small: within 20, or two-digit plus whole tens
  for (const q of drawKey("add-l-small")) {
    assert.ok(q.a <= 9 && q.b <= 9 && q.answer <= 18, `add-l-small out of range: "${q.text}"`);
  }
  for (const q of drawKey("add-l-tens")) {
    assert.equal(q.b % 10, 0, `add-l-tens: "${q.text}" is not plus whole tens`);
    assert.ok(q.answer <= 99, `add-l-tens past 100: "${q.text}"`);
  }
  for (const q of drawKey("sub-l-tens")) {
    assert.equal(q.b % 10, 0, `sub-l-tens: "${q.text}" is not minus whole tens`);
    assert.ok(q.answer >= 0, `sub-l-tens negative: "${q.text}"`);
  }
  for (const q of drawKey("sub-l-small")) {
    assert.ok(q.a <= 18 && q.b <= 9 && q.answer >= 1, `sub-l-small out of range: "${q.text}"`);
  }
  // Mittel actually carries / borrows where it says it does — and not where not
  for (const q of [...drawKey("add-m-1d"), ...drawKey("add-m-carry")]) {
    assert.ok((q.a % 10) + (q.b % 10) >= 10, `no carry in "${q.text}"`);
    assert.ok(q.answer <= 99, `past 100: "${q.text}"`);
  }
  for (const q of drawKey("add-m-2d")) {
    assert.ok((q.a % 10) + (q.b % 10) < 10, `add-m-2d must not carry: "${q.text}"`);
    assert.ok(q.b >= 10, `add-m-2d wants two digits: "${q.text}"`);
  }
  for (const q of [...drawKey("sub-m-1d"), ...drawKey("sub-m-borrow")]) {
    assert.ok((q.a % 10) < (q.b % 10), `no borrow in "${q.text}"`);
    assert.ok(q.answer >= 0, `negative: "${q.text}"`);
  }
  for (const q of drawKey("sub-m-2d")) {
    assert.ok((q.a % 10) >= (q.b % 10), `sub-m-2d must not borrow: "${q.text}"`);
    assert.ok(q.b >= 10, `sub-m-2d wants two digits: "${q.text}"`);
  }
  // the decomposition rows genuinely cross the ten — that is what they train
  for (const t of drawKey("add-s-zerlege")) {
    assert.ok((t.a % 10) + (t.b % 10) >= 10, `zerlege without a carry: ${t.a}+${t.b}`);
  }
  for (const t of drawKey("sub-s-zerlege")) {
    assert.ok((t.a % 10) < (t.b % 10), `zerlege without a borrow: ${t.a}−${t.b}`);
  }
  // division without remainder is always exact
  for (const key of ["div-l", "div-m"]) for (const q of drawKey(key)) {
    assert.equal(q.a % q.b, 0, `${key}: "${q.text}" has a remainder`);
    assert.equal(q.answer, q.a / q.b);
  }
  // gaps hide exactly one operand; chains carry three terms and stay in range
  for (const q of [...drawKey("add-s-gap"), ...drawKey("sub-s-gap"), ...drawKey("muldiv-s-gap")]) {
    assert.equal(q.kind, "gap");
    assert.equal((q.text.match(/\?/g) ?? []).length, 1, `gap has ${q.text}`);
  }
  for (const q of [...drawKey("add-s-chain"), ...drawKey("sub-s-chain")]) {
    assert.equal(q.kind, "chain");
    assert.ok([q.a, q.b, q.c].every(Number.isInteger), `chain missing a term: "${q.text}"`);
    const first = q.text.startsWith(`${q.a} + `) ? q.a + q.b : q.a - q.b;
    assert.ok(first >= 0 && first <= 100, `chain intermediate out of range: "${q.text}"`);
  }
});

// The division sign is injected, so the module stays i18n-free (§12.1). A ÷
// round in German must print ":" and never "÷" — in the plain divisions and in
// the remainder line alike.
test("the division sign is the caller's, defaulting to ÷", () => {
  const i = BUCKETS.findIndex((b) => b.key === "div-m");
  const colon = questionFor(i, seeded(9), ":");
  const obelus = questionFor(i, seeded(9), "÷");
  assert.ok(colon.text.includes(" : ") && !colon.text.includes("÷"));
  assert.equal(colon.text.replace(" : ", " ÷ "), obelus.text);
  assert.equal(questionFor(i, seeded(9)).text, obelus.text, "the default is ÷");
  const ri = BUCKETS.findIndex((b) => b.key === "div-s-rest");
  const rest = questionFor(ri, seeded(9), ":");
  assert.ok(rest.text.includes(" : ") && !rest.text.includes("÷"), `rest line "${rest.text}"`);
});

// --- the variant expansion the shared engine draws over -----------------------

test("bucketOf folds every variant back to its bucket, total on junk", () => {
  for (let b = 0; b < BUCKET_COUNT; b++) {
    for (let v = 0; v < VARIANTS; v++) assert.equal(bucketOf(b + BUCKET_COUNT * v), b);
  }
  for (const junk of [-1, -BUCKET_COUNT - 3, 1.9, BUCKET_COUNT * 99 + 4]) {
    const b = bucketOf(junk);
    assert.ok(Number.isInteger(b) && b >= 0 && b < BUCKET_COUNT, `bucketOf(${junk}) → ${b}`);
  }
});

test("bucketsFor: a mode is its own buckets, Mix pools the equation modes", () => {
  for (let d = 0; d < 3; d++) {
    const single = ["+", "-", "x:"].flatMap((m) => bucketsFor(m, d));
    const mix = bucketsFor("mix", d);
    assert.deepEqual([...mix].sort((a, b) => a - b), [...single].sort((a, b) => a - b),
      `diff ${d}: Mix must be exactly the equation modes pooled`);
    assert.ok(mix.length >= 4, `diff ${d}: Mix must pool at least four buckets`);
    // walls and grids stay on their own tiles — their multi-cell tasks would
    // balloon a mixed round (§12.2)
    for (const b of mix) assert.ok(!["mauer", "quad"].includes(BUCKETS[b].mode), `diff ${d}: mix drew ${BUCKETS[b].key}`);
    // an unknown mode reads as Mix, never an empty cell
    assert.deepEqual(bucketsFor("nonsense", d), mix);
    for (const m of ["+", "-", "x:", "mauer", "quad"]) {
      for (const b of bucketsFor(m, d)) assert.equal(BUCKETS[b].mode, m);
      for (const b of bucketsFor(m, d)) assert.equal(BUCKETS[b].diff, d);
    }
  }
});

test("every cell's pool outgrows the round the engine draws from it (§7.3)", () => {
  for (const m of MODES) {
    for (let d = 0; d < 3; d++) {
      const pool = poolFor(m, d);
      assert.ok(pool.length >= roundSizeFor(m, d), `${m}/${d}: pool ${pool.length} < round ${roundSizeFor(m, d)}`);
      assert.equal(new Set(pool).size, pool.length, `${m}/${d}: a variant id appears twice`);
      // every variant resolves to a bucket that belongs to this cell
      const cell = new Set(bucketsFor(m, d));
      for (const id of pool) assert.ok(cell.has(bucketOf(id)), `${m}/${d}: ${id} is foreign`);
    }
  }
});

// --- the per-bucket box fold (§7.1, §12.2) ------------------------------------

test("foldBoxes: a touched bucket climbs, a missed one resets, others rest", () => {
  const start = "2".repeat(BUCKET_COUNT);
  // buckets 0 and 1 were solved cleanly, bucket 2 was missed, the rest untouched
  const out = foldBoxes(start, [0, 1, 2], [2]);
  assert.equal(out.length, BUCKET_COUNT);
  assert.equal(out[0], "3", "a clean bucket climbs one box");
  assert.equal(out[1], "3");
  assert.equal(out[2], "0", "a missed bucket drops to zero");
  assert.equal(out[3], "2", "an untouched bucket keeps its digit");
  // the climb caps at 4
  assert.equal(foldBoxes("4".repeat(BUCKET_COUNT), [0], [])[0], "4");
  // any variant of a bucket missing taints the whole bucket for this round
  assert.equal(foldBoxes(start, [5], [5])[5], "0");
});

test("foldBoxes is total: junk strings and junk ids never throw or leak", () => {
  for (const junk of [undefined, null, "", "xyz", "9".repeat(BUCKET_COUNT + 5)]) {
    const out = foldBoxes(junk, [0], []);
    assert.equal(out.length, BUCKET_COUNT, `len from ${JSON.stringify(junk)}`);
    assert.ok([...out].every((c) => "01234".includes(c)), `digits from ${JSON.stringify(junk)}`);
  }
  // out-of-range and non-integer bucket ids are ignored, not applied
  const s = "2".repeat(BUCKET_COUNT);
  assert.equal(foldBoxes(s, [-1, BUCKET_COUNT, 1.5, BUCKET_COUNT + 99], []), s);
});

// --- stars, tempo, retry: the einmaleins rules, pinned (D11) -------------------

test("the star rules are the einmaleins rules — parity so they cannot drift", () => {
  for (let total = 0; total <= 12; total++) {
    for (let ok = 0; ok <= total; ok++) {
      assert.equal(starsFor(ok, total), emStarsFor(ok, total), `${ok}/${total}`);
    }
  }
  for (let s = 0; s <= 4; s++) {
    assert.equal(nextStarGoal(s), emNextStarGoal(s), `goal after ${s}`);
    assert.equal(starGoalNeed(s, 10), emStarGoalNeed(s, 10), `need after ${s}`);
  }
  for (const best of [undefined, null, -1, 2, 99, NaN]) {
    assert.equal(
      ownedStars({ firstTrySolved: 6, total: 10 }, best),
      emOwnedStars({ firstTrySolved: 6, total: 10 }, best),
      `best=${String(best)}`,
    );
  }
});

test("stars on a round of ten: 6 → ⭐, 8 → ⭐⭐, 10 → ⭐⭐⭐", () => {
  const want = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3];
  for (let ok = 0; ok <= 10; ok++) assert.equal(starsFor(ok, 10), want[ok], `${ok}/10`);
});

// The short rounds the walls and grids play (§12.2): the percent bands are
// pulled apart so every star has its own score — and therefore its own
// waypoint. On three tasks 80 % and 100 % are both "all three"; taken
// literally, two star groups would land on the last waypoint together.
test("stars on the short rounds spread out: one star per score, never two", () => {
  assert.deepEqual([0, 1, 2, 3].map((ok) => starsFor(ok, 3)), [0, 1, 2, 3],
    "a grid round of 3 pays at 1, 2 and 3");
  assert.deepEqual([0, 1, 2, 3, 4].map((ok) => starsFor(ok, 4)), [0, 0, 1, 2, 3],
    "a wall round of 4 pays at 2, 3 and 4");
  // …and in EVERY round any mode can play, one more first-try answer never
  // pays two stars at once (§10.5: at most one group per waypoint)
  for (const m of MODES) {
    for (let d = 0; d < 3; d++) {
      const total = roundSizeFor(m, d);
      for (let ok = 1; ok <= total; ok++) {
        assert.ok(starsFor(ok, total) - starsFor(ok - 1, total) <= 1,
          `${m}/${d}: answer ${ok} of ${total} pays two stars at once`);
      }
      assert.equal(starsFor(total, total), 3, `${m}/${d}: a perfect round pays all three`);
    }
  }
});

test("retryStep and fittedFontSize are einmaleins' verbatim — parity", () => {
  for (let answer = 1; answer <= 300; answer++) {
    for (const key of ["1", "9", "0", "⌫", "OK", "x"]) {
      assert.deepEqual(retryStep("12", key, answer), emRetry("12", key, answer), `${answer} ${key}`);
    }
  }
  // the aid must never strand a four-digit entry mid-typing
  assert.deepEqual(retryStep("123", "4", 1234), { input: "1234", state: "typing" });
  for (const [a, w] of [[76, 388], [76, 292], [30, 100]]) {
    assert.equal(fittedFontSize(a, w, 500), emFitted(a, w, 500));
  }
  assert.equal(fittedFontSize(76, 0, 0), 76);
});

test("the tempo ladder: einmaleins' faces and mechanics, rechnungen's bounds", () => {
  assert.deepEqual(TEMPO_ICONS, emTempoIcons);
  assert.deepEqual(TEMPO_KEYS, emTempoKeys);
  assert.equal(TEMPO_SLOTS, 3);
  for (const g of [[], [500], [1000, 2000], [1, 2, 3, 4], [NaN, 800, -5]]) {
    assert.equal(median(g), emMedian(g), JSON.stringify(g));
  }
  for (let stars = 0; stars <= 3; stars++) {
    for (let tier = 0; tier <= 3; tier++) {
      for (let best = 0; best <= 3; best++) {
        assert.equal(awardTempo({ stars, tier, best }), emAwardTempo({ stars, tier, best }));
      }
    }
  }
  // the bounds climb within a row and grow harder-slower across difficulty
  for (let d = 0; d < TEMPO_TIERS.length; d++) {
    const [hare, car, rocket] = TEMPO_TIERS[d];
    assert.ok(hare > car && car > rocket, `d=${d}: the ladder must climb`);
    assert.equal(tempoTier(rocket, d), 3);
    assert.equal(tempoTier(car, d), 2);
    assert.equal(tempoTier(hare, d), 1);
    assert.equal(tempoTier(hare + 1, d), 0);
    if (d > 0) for (let t = 0; t < 3; t++) {
      assert.ok(TEMPO_TIERS[d][t] > TEMPO_TIERS[d - 1][t], `d=${d}: a harder step takes longer`);
    }
  }
  for (const junk of [NaN, -1, "3000", undefined]) assert.equal(tempoTier(junk, 0), 0);
});

// --- star digit strings (§12.3) ------------------------------------------------

test("star digit strings: three slots, indexed by difficulty, junk-safe", () => {
  assert.equal(withStarDigit(undefined, 0, 3), "300");
  assert.equal(withStarDigit("", 2, 2), "002");
  assert.equal(withStarDigit("120", 1, 3), "130");
  assert.equal(starDigit("120", 0), 1);
  assert.equal(starDigit("120", 2), 0);
  for (const junk of [undefined, null, "", "x?!"]) {
    for (let d = 0; d < DIFF_SLOTS; d++) assert.equal(starDigit(junk, d), 0);
  }
  assert.equal(starDigit("9", 0), 3, "a corrupt digit caps at three stars");
});

// --- the game's worth (§8.3, §12.2) -------------------------------------------

test("maxPoints is computed from the real tiles: 6·(3·1+3·2+3·3) = 108", () => {
  assert.equal(maxPoints(), 108);
  assert.equal(maxPoints(), MODES.length * (STAR_SLOTS * 1 + STAR_SLOTS * 2 + STAR_SLOTS * 3));
  assert.equal(maxPoints(), MAX_POINTS.rechnungen, "rewards.js and logic.js must agree");
  assert.equal(trophyCount("rechnungen", MAX_POINTS.rechnungen), TROPHIES_PER_GAME,
    "mastering every mode fills the shelf");
  assert.ok(THRESHOLDS.rechnungen[0] <= 3, "a first sitting reaches the first trophy");
});

// --- cookie budget (§9.2) -----------------------------------------------------

test("a maxed rechnungen section stays a small fraction of the cookie budget", () => {
  const modeStars = Object.fromEntries(MODES.map((m) => [m, "3".repeat(DIFF_SLOTS)]));
  const maxed = {
    d: 2, m: "mix",
    box: "4".repeat(BUCKET_COUNT),
    stars: modeStars,
    tempo: modeStars,
  };
  const bytes = JSON.stringify({ rechnungen: maxed }).length;
  assert.ok(bytes < 300, `rechnungen section is ${bytes} bytes`);
  assert.ok(bytes < BUDGET / 6, "…and a small fraction of the whole budget");
});

// The mode names are looked up at runtime — `t({...}[mode])` in picker.js — so
// both i18n scans (tests/i18n.test.js) are blind to them: a missing modePlus
// would render as the literal "modePlus" and no test would notice. So they are
// named here, both directions, the way lesen names its runtime pack keys.
test("every mode has a spoken name in both languages, and the picker uses them", () => {
  const src = read("games/rechnungen/picker.js");
  for (const key of ["modePlus", "modeMinus", "modeTimesDiv", "modeMauer", "modeQuad", "modeMix"]) {
    assert.ok(strings.de[key], `de.js is missing ${key}`);
    assert.ok(strings.en[key], `en.js is missing ${key}`);
    assert.ok(src.includes(`"${key}"`), `picker.js never looks up ${key}`);
  }
  // …and no mode-name key is dead: every one the picker maps must exist
  const mapped = [...src.matchAll(/"(mode[A-Z][a-z]+)"/g)].map((m) => m[1]);
  for (const key of mapped) assert.ok(strings.de[key] && strings.en[key], `${key} is mapped but untranslated`);
  // the division sign and the tempo faces exist in both languages, none a time
  for (const lang of ["de", "en"]) {
    assert.ok(strings[lang].divSign, `${lang}.divSign is missing`);
    for (const key of ["tempo1", "tempo2", "tempo3", "tempoBest", "tileTempo"]) {
      const s = strings[lang][key];
      assert.ok(s, `${lang}.${key} is missing`);
      assert.ok(!/\d\s*(s|ms|sek|sec)/i.test(s), `${lang}.${key} names a time`);
    }
  }
});
