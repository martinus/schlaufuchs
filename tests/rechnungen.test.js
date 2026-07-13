// Rechnungen pure logic (§12): the skill buckets and their generators, the
// task/cell model (walls, grids, scaffolds, remainders), the variant-expansion
// the shared engine draws over, the per-bucket box fold, and the star/tempo
// digit strings.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODES, DIFF_KEYS, DIFF_SLUGS, STAR_SLOTS, DIFF_SLOTS, VARIANTS, roundSizeFor,
  BUCKETS, BUCKET_COUNT, bucketOf, bucketsFor, poolFor, questionFor, foldBoxes,
  mauerAidFor, quadAidFor,
  starsFor, starDigit, withStarDigit, retryStep, maxPoints,
  TEMPO_TIERS, tempoTier,
} from "../games/rechnungen/logic.js";
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
  assert.deepEqual(MODES, ["+", "-", "rest", "mauer", "quad", "mix"]);
  assert.equal(DIFF_KEYS.length, 3);
  assert.equal(DIFF_SLUGS.length, 3);
  assert.equal(STAR_SLOTS, 3);
  assert.equal(DIFF_SLOTS, 3);
});

// Round sizes per mode (§12.2): a wall is three answers, a grid up to four, a
// ÷R task two — those rounds hold fewer tasks, so every round is a comparable
// effort.
test("roundSizeFor: equations 10, rest and mix 8, walls 4, grids 3", () => {
  for (const d of [0, 1, 2]) {
    assert.equal(roundSizeFor("+", d), 10);
    assert.equal(roundSizeFor("-", d), 10);
    assert.equal(roundSizeFor("rest", d), 8, "two cells per rest task");
    assert.equal(roundSizeFor("mix", d), 8);
    assert.equal(roundSizeFor("mauer", d), 4);
    assert.equal(roundSizeFor("quad", d), 3);
  }
});

test("every bucket is placed in a real cell, and the keys are unique", () => {
  const modes = ["+", "-", "rest", "mauer", "quad"]; // never "mix" — mix has no buckets of its own
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
    if (["mauer", "quad"].some((k) => b.key.includes(k))) continue;
    for (const task of drawKey(b.key, 500)) {
      assert.ok(typeof task.text === "string", `${b.key}: no text`);
      assert.equal((task.text.match(/\?/g) ?? []).length, task.cells.length,
        `${b.key}: "${task.text}" vs ${task.cells.length} cells`);
    }
  }
});

// Ergänzen (§12.1 Schwer): complete to the next full ten or to 100 (and, for
// −, down to the full ten or away from 100) — the technique behind every
// tens-crossing. Mechanically a gap, so nothing new for the UI. (The seven-cell
// decomposition scaffold that used to live here was cut on the ninth
// play-test: on a keypad it was mostly transcription; the strategy survives in
// the ± aid card.)
test("fill: Ergänzen always targets a full ten or the hundred", () => {
  for (const task of drawKey("add-s-fill")) {
    assert.equal(task.kind, "gap");
    const m = task.text.match(/^(\d+) \+ \? = (\d+)$/);
    assert.ok(m, `add-s-fill text "${task.text}"`);
    const [, a, target] = m.map(Number);
    assert.ok(target === 100 || (target % 10 === 0 && target - a < 10),
      `${task.text}: the target must be the NEXT full ten, or 100`);
    assert.ok(task.answer >= 1 && a + task.answer === target);
  }
  for (const task of drawKey("sub-s-fill")) {
    assert.equal(task.kind, "gap");
    const m = task.text.match(/^(\d+) − \? = (\d+)$/);
    assert.ok(m, `sub-s-fill text "${task.text}"`);
    const [, a, target] = m.map(Number);
    assert.ok((a === 100 && target >= 1) || (target % 10 === 0 && a - target < 10),
      `${task.text}: down to the full ten, or away from 100`);
    assert.ok(task.answer >= 1 && a - task.answer === target);
  }
  // no scaffold may return
  assert.ok(!BUCKETS.some((b) => b.key.includes("zerlege")), "the scaffold stays retired");
});

// Division with remainder (§12.1) — the whole ÷R tile, the one division
// einmaleins can never teach. Two cells on one line — quotient, then
// remainder. The remainder slot is ALWAYS asked, and it is sometimes genuinely
// zero: "no remainder" is an answer the child gives (R 0), not a case the
// format hides.
test("rest: dividend = divisor · quotient + remainder, 0 ≤ remainder < divisor", () => {
  for (const key of ["rest-l", "rest-m", "rest-s"]) {
    let zeros = 0;
    let nonzeros = 0;
    for (const task of drawKey(key)) {
      assert.equal(task.kind, "rest");
      assert.equal(task.cells.length, 2);
      const [q, r] = task.cells.map((c) => c.answer);
      assert.equal(task.b * q + r, task.a, `${key}: ${task.a} : ${task.b} ≠ ${q} R ${r}`);
      assert.ok(r >= 0 && r < task.b, `${key}: remainder ${r} out of 0–${task.b - 1}`);
      assert.equal(Math.floor(task.a / task.b), q, `${key}: the quotient is not the floor`);
      assert.equal((task.text.match(/\?/g) ?? []).length, 2);
      assert.ok(/\sR\s/.test(task.text), `${key}: no R in "${task.text}"`);
      if (key === "rest-l") assert.ok(task.b <= 5 && q <= 9, `${key}: past the concept tier: "${task.text}"`);
      if (key === "rest-s") assert.ok(q >= 11, `${key}: Schwer must go beyond the tables: "${task.text}"`);
      if (r === 0) zeros++;
      else nonzeros++;
    }
    assert.ok(zeros > 0, `${key}: a zero remainder must occur — the child answers R 0 herself`);
    assert.ok(nonzeros > zeros, `${key}: …but real remainders must dominate`);
  }
});

// The regions must not overlap (user, eighth play-test): the times tables and
// exact division are einmaleins' whole game, so NOTHING on the Rechenberg may
// print a bare × question or a division without its R slot. What survives of
// the old ×÷ tile is exactly what einmaleins can never ask: remainders.
test("no einmaleins in disguise: no × tasks, no division without a remainder slot", () => {
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const rng = seeded(i * 11 + 7);
    for (let k = 0; k < 400; k++) {
      const task = questionFor(i, rng, ":");
      const texts = [task.text, ...(task.cells ?? []).map((c) => c.aid?.text)].filter(Boolean);
      for (const t of texts) {
        assert.ok(!t.includes("×"), `${BUCKETS[i].key}: prints a times question "${t}"`);
        if (t.includes(":")) assert.ok(/\sR\s/.test(t), `${BUCKETS[i].key}: bare division "${t}"`);
      }
      assert.ok(task.op !== "x", `${BUCKETS[i].key}: op ×`);
    }
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
// the given anchors partition the four cells; hidden headers (a column on
// Mittel, a row AND a column on Schwer) solve first, each as a gap off the
// anchor in its column or row. NEVER a × grid — the times tables are
// einmaleins' whole game, and the same drill in a different coat teaches
// nothing new (user, fifth play-test).
test("quad: the grid is true, anchors and blanks partition it, headers solve first", () => {
  const OP = { "+": (x, y) => x + y, "-": (x, y) => x - y };
  for (const key of ["quad-l", "quad-m", "quad-s"]) {
    for (const task of drawKey(key)) {
      assert.equal(task.kind, "quad");
      const f = OP[task.op];
      assert.ok(f, `${key}: bogus op ${task.op} — a quad is ±, never ×`);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        assert.equal(task.grid[r][c], f(task.rows[r], task.cols[c]), `${key}: grid broken at ${r},${c}`);
        assert.ok(task.grid[r][c] >= 0, `${key}: negative cell at ${r},${c}`);
      }
      const headerCells = task.cells.filter((c) => c.pos.hdr !== undefined || c.pos.hdrRow !== undefined);
      const interiorCells = task.cells.filter((c) => c.pos.r !== undefined);
      assert.equal(headerCells.length + interiorCells.length, task.cells.length);
      assert.equal(interiorCells.length + task.given.length, 4, `${key}: cells+given must cover the grid`);
      const seen = new Set();
      for (const p of [...interiorCells.map((c) => c.pos), ...task.given]) {
        const k = `${p.r},${p.c}`;
        assert.ok(!seen.has(k), `${key}: ${k} is both cell and given`);
        seen.add(k);
      }
      // the hidden headers come first in the cells, and each one's anchor sits
      // on the VISIBLE counterpart axis, so it is genuinely one gap away
      assert.deepEqual(task.cells.slice(0, headerCells.length), headerCells,
        `${key}: the headers must solve first`);
      if (task.hdr !== null) {
        const cell = headerCells.find((c) => c.pos.hdr === task.hdr);
        assert.ok(cell, `${key}: hidden column without a header cell`);
        assert.equal(cell.answer, task.cols[task.hdr]);
        assert.ok(task.given.some((g) => g.c === task.hdr && g.r !== task.hdrRow),
          `${key}: the column anchor must sit in a visible row`);
      }
      if (task.hdrRow !== null) {
        const cell = headerCells.find((c) => c.pos.hdrRow === task.hdrRow);
        assert.ok(cell, `${key}: hidden row without a header cell`);
        assert.equal(cell.answer, task.rows[task.hdrRow]);
        assert.ok(task.given.some((g) => g.r === task.hdrRow && g.c !== task.hdr),
          `${key}: the row anchor must sit in a visible column`);
      }
      assert.equal(task.given.length, headerCells.length, `${key}: one anchor per hidden header`);
      // headers pairwise distinct, and so are the four interior values — a grid
      // with two identical 9-rows reads as a trick (user, first play-test)
      assert.equal(new Set([...task.rows, ...task.cols]).size, 4, `${key}: headers repeat [${task.rows} | ${task.cols}]`);
      assert.equal(new Set(task.grid.flat()).size, 4, `${key}: interior values repeat [${task.grid.flat()}]`);
      for (const cell of task.cells) {
        assert.equal(evaluate(quadAidFor(task, cell.pos).text), cell.answer, `${key}: aid for ${JSON.stringify(cell.pos)}`);
      }
    }
    // the difficulty ladder: Leicht shows everything, Mittel hides a column,
    // Schwer hides a row AND a column
    const t = drawKey(key, 50);
    if (key === "quad-l") assert.ok(t.every((x) => x.hdr === null && x.hdrRow === null));
    if (key === "quad-m") assert.ok(t.every((x) => x.hdr !== null && x.hdrRow === null));
    if (key === "quad-s") {
      assert.ok(t.every((x) => x.hdr !== null && x.hdrRow !== null));
      assert.ok(t.some((x) => x.op === "+") && t.some((x) => x.op === "-"), "Schwer mixes + and −");
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
  // gaps hide exactly one operand
  for (const q of [...drawKey("add-s-gap"), ...drawKey("sub-s-gap")]) {
    assert.equal(q.kind, "gap");
    assert.equal((q.text.match(/\?/g) ?? []).length, 1, `gap has ${q.text}`);
  }
  // mixed-operator chains are GONE (user, sixth play-test): too hard, and a ＋
  // chain carried a −, so the two tiles asked practically the same questions
  assert.ok(!BUCKETS.some((b) => b.key.includes("chain")), "no chain bucket may return");
});

// The division sign is injected, so the module stays i18n-free (§12.1). A ÷
// round in German must print ":" and never "÷" — in the plain divisions and in
// the remainder line alike.
test("the division sign is the caller's, defaulting to ÷", () => {
  const i = BUCKETS.findIndex((b) => b.key === "rest-m");
  const colon = questionFor(i, seeded(9), ":");
  const obelus = questionFor(i, seeded(9), "÷");
  assert.ok(colon.text.includes(" : ") && !colon.text.includes("÷"), `"${colon.text}"`);
  assert.equal(colon.text.replace(" : ", " ÷ "), obelus.text);
  assert.equal(questionFor(i, seeded(9)).text, obelus.text, "the default is ÷");
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
    const single = ["+", "-", "rest"].flatMap((m) => bucketsFor(m, d));
    const mix = bucketsFor("mix", d);
    assert.deepEqual([...mix].sort((a, b) => a - b), [...single].sort((a, b) => a - b),
      `diff ${d}: Mix must be exactly the equation modes pooled`);
    assert.ok(mix.length >= 4, `diff ${d}: Mix must pool at least four buckets`);
    // walls and grids stay on their own tiles — their multi-cell tasks would
    // balloon a mixed round (§12.2)
    for (const b of mix) assert.ok(!["mauer", "quad"].includes(BUCKETS[b].mode), `diff ${d}: mix drew ${BUCKETS[b].key}`);
    // an unknown mode reads as Mix, never an empty cell
    assert.deepEqual(bucketsFor("nonsense", d), mix);
    for (const m of ["+", "-", "rest", "mauer", "quad"]) {
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

// --- stars, tempo, retry: the shared round rules (assets/js/roundrules.js) ----
// Exercised in depth by tests/einmaleins.test.js; here only rechnungen's own
// data — round sizes, TEMPO_TIERS, the four-digit retry — is tested.

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

test("retryStep: room for a wall's four-digit top brick — one more than einmaleins", () => {
  // the aid must never strand a four-digit entry mid-typing…
  assert.deepEqual(retryStep("123", "4", 1234), { input: "1234", state: "typing" });
  // …and the cap still holds at four
  assert.deepEqual(retryStep("1234", "5", 12345), { input: "1234", state: "typing" });
});

test("the tempo ladder: rechnungen's bounds", () => {
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

// A task with many cells forgives its FIRST wrong answer (§12.2): a wall or a
// seven-cell scaffold is a lot of typing, and one slip must not sink the whole
// waypoint. This is DOM-side behaviour (rechnungen.js), so what can be pinned
// here is that the gate exists and is shaped right: multi-cell only, once per
// task, and never once the task already missed — a silently deleted gate would
// otherwise fail no test at all.
test("a multi-cell task forgives its first slip — the gate is in the page module", () => {
  const src = read("games/rechnungen/rechnungen.js");
  assert.match(src, /task\.cells\.length > 1 && !slipUsed && !taskMissed/,
    "the forgiveness gate must be multi-cell only, once, and before a real miss");
  assert.match(src, /slipUsed = true;/, "the slip must be spent");
  assert.match(src, /slipUsed = false;/, "…and handed back with every new task");
});

// The mode names are looked up at runtime — `t({...}[mode])` in picker.js — so
// both i18n scans (tests/i18n.test.js) are blind to them: a missing modePlus
// would render as the literal "modePlus" and no test would notice. So they are
// named here, both directions, the way lesen names its runtime pack keys.
test("every mode has a spoken name in both languages, and the picker uses them", () => {
  const src = read("games/rechnungen/picker.js");
  for (const key of ["modePlus", "modeMinus", "modeRest", "modeMauer", "modeQuad", "modeMix"]) {
    assert.ok(strings.de[key], `de.js is missing ${key}`);
    assert.ok(strings.en[key], `en.js is missing ${key}`);
    assert.ok(src.includes(`"${key}"`), `picker.js never looks up ${key}`);
  }
  // …and no mode-name key is dead: every one the picker maps must exist
  const mapped = [...src.matchAll(/"(mode[A-Z][a-z]+)"/g)].map((m) => m[1]);
  for (const key of mapped) assert.ok(strings.de[key] && strings.en[key], `${key} is mapped but untranslated`);
  // divSign and the tempo faces live in the SHARED dictionaries now
  // (tests/i18n.test.js holds "both languages, never a time").
});
