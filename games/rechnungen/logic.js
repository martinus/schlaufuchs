// Rechnungen pure logic (§12): workbook-style arithmetic tasks over six mode
// tiles — ＋, −, ÷R (division with remainder), Rechenmauern, Rechenquadrate
// and „Mix" — across three
// difficulties, everything within the number range 100. No DOM, no storage —
// unit-tested in tests/rechnungen.test.js.
//
// The model has two levels (§12.2). The adaptive engine tracks a small fixed
// set of **skill buckets** — „addition with carrying", „number wall with a
// missing base brick", … — one Leitner digit each in the box string. A round
// does NOT ask a bucket once; it draws CONCRETE tasks, each freshly generated
// from a bucket. So the pool the shared engine (adaptive.js) sees is the cell's
// buckets EXPANDED into variant item-ids (`bucketId + BUCKET_COUNT * v`): the
// engine weights and re-queues real items, while the box that persists is per
// bucket. `bucketOf(itemId)` folds a variant back to its bucket; `questionFor`
// realises a variant into an actual task with fresh numbers every draw, so a
// re-queued miss returns as a NEW task of the same skill.
//
// THE TASK/CELL MODEL (§12.1). A task is what one journey node asks. Its
// `cells` are the numbers the child types, in order, each on the same keypad:
//
//   { kind, cells: [ { answer, aid: {op, a, b, c?, answer, text} }, … ], … }
//
// A plain equation is a task with ONE cell. A number wall has three, a
// division with remainder two — the keypad contract
// („one integer, then OK") never changes, only how often it is asked. Every
// cell carries `aid`, an old-style binary question the wrong-answer card can
// draw (number line for ±, dot grid for ×/÷): a wall brick's aid is the +/−
// relation of its neighbours, a grid cell's is rowHeader ∘ colHeader.
// Kinds and their extra layout data:
//   op|gap — `text` with exactly one "?" (one line)
//   rest     — `text` "a : b = ? R ?", one "?" per cell in cell order
//   mauer    — `vals` [top, m0, m1, b0, b1, b2] (the full wall), `given`
//              (indices shown from the start), cells in solvable order with
//              `pos` into vals
//   quad     — `op`, `rows`/`cols` headers, `grid` [2][2], `given` cell
//              positions, optional `hdr` (a hidden column header, Schwer);
//              cells with `pos` {r,c} or {hdr: idx}
//
// The star/tempo digit strings are per MODE, indexed by difficulty (§12.3) —
// transposed from einmaleins/lesen, which key stars by difficulty. The star
// *ratios*, the tempo ladder, the aid's retry and the one-line fitter are the
// einmaleins rules verbatim (a shipped game is not a shared library, D11);
// tests/rechnungen.test.js pins them against einmaleins so they cannot drift.

import { clampBox } from "../../assets/js/adaptive.js";

// The six modes, in picker order (§12.1). These strings ARE the keys of the
// cookie's `stars`/`tempo` maps (§12.3): "rest" is division with remainder
// (the one division einmaleins can never teach — everything table-shaped was
// cut so the two regions do not overlap),
// "mauer" the number walls, "quad" the operation grids. "mix" draws from the
// EQUATION buckets at the chosen difficulty — not from mauer/quad, whose
// multi-cell tasks would balloon a mixed round.
export const MODES = ["+", "-", "rest", "mauer", "quad", "mix"];
const MIX_MODES = ["+", "-", "rest"];

// How the three difficulty indices are *named*: the i18n key the child reads
// and the CSS slug that colours a picker section (same contract as einmaleins).
export const DIFF_KEYS = ["diffEasy", "diffMedium", "diffHard"];
export const DIFF_SLUGS = ["easy", "medium", "hard"];

// Tasks per round, per mode (§12.2). A wall is three answers, a grid up to
// four, a ÷R task two — so those rounds hold fewer tasks. Every round lands at
// roughly ten to sixteen keypad entries, a comparable effort per star.
export function roundSizeFor(mode) {
  if (mode === "mauer") return 4;
  if (mode === "quad") return 3;
  if (mode === "rest" || mode === "mix") return 8;
  return 10;
}

// The three stars a tile can hold, and the three difficulty slots a mode's
// star/tempo string carries (§12.3). Both happen to be three.
export const STAR_SLOTS = 3;
export const DIFF_SLOTS = 3;

// How many concrete variants one bucket expands into for a round. The smallest
// cell holds a single bucket, so this is also the guaranteed pool size — it
// must clear every round size, or a round would come up short. A larger cell
// (Mix, or any multi-bucket cell) draws its round weighted from a deeper pool.
export const VARIANTS = 12;

// --- the display faces --------------------------------------------------------
// The operators as the child's schoolbook writes them: a real minus sign and a
// real times sign, never the ASCII "-"/"x". Division is the caller's to pass —
// German schools write ":", English "÷" — so this module stays i18n-free, like
// einmaleins' `divSign`.
const SIGN = { "+": "+", "-": "−", x: "×" };
const sign = (op, divSign) => (op === ":" ? divSign : SIGN[op]);

// --- generation helpers -------------------------------------------------------
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Wrap an old-style binary question into a one-cell task: the question is its
// own cell's aid.
const lineTask = (q) => ({ ...q, cells: [{ answer: q.answer, aid: q }] });

// A plain binary question "a op b = ?" with a known answer.
const bin = (op, a, b, answer, divSign) =>
  lineTask({ kind: "op", op, a, b, answer, text: `${a} ${sign(op, divSign)} ${b} = ?` });

// A gap question: one operand hidden, the result shown. `hideLeft` hides the
// first operand ("? op b = c"), otherwise the second ("a op ? = c"). The answer
// is the hidden operand — a single number, so the keypad and the aid's retry
// (retryStep) answer it exactly like any other cell.
function gap(op, a, b, result, hideLeft, divSign) {
  const s = sign(op, divSign);
  return lineTask(hideLeft
    ? { kind: "gap", op, a, b, answer: a, text: `? ${s} ${b} = ${result}` }
    : { kind: "gap", op, a, b, answer: b, text: `${a} ${s} ? = ${result}` });
}

// Division with remainder (§12.1 Schwer): two cells on one line, quotient then
// remainder — the second answer slot the old one-number contract could not
// carry. The remainder slot is ALWAYS asked, and it is sometimes genuinely
// zero — "no remainder" is an answer the child gives, not a case the format
// hides (user request from the first play-test). Each cell's aid shows the
// line with the OTHER slot already true, and the ÷ dot grid draws `quotient`
// full rows plus the leftover.
function restTask(rng, divisor, quotient, divSign) {
  const rest = ri(rng, 0, divisor - 1);
  const a = divisor * quotient + rest;
  const head = `${a} ${sign(":", divSign)} ${divisor} = `;
  return {
    kind: "rest", op: ":", a, b: divisor,
    text: `${head}? R ?`,
    cells: [
      { answer: quotient, aid: { op: ":", a, b: divisor, answer: quotient, text: `${head}? R ${rest}` } },
      { answer: rest, aid: { op: ":", a, b: divisor, answer: rest, text: `${head}${quotient} R ?` } },
    ],
  };
}

// --- Rechenmauern (§12.1) -------------------------------------------------------
// A three-row number wall: positions [top, m0, m1, b0, b1, b2], where
// m0 = b0 + b1, m1 = b1 + b2, top = m0 + m1. The generator builds the FULL wall
// from a random base, then blanks cells per difficulty pattern. The child picks
// which blank to fill herself (§12.1) — the blanks are still listed in an order
// where each next cell is one +/− step from the given bricks, so the driver and
// a child who follows the obvious path agree. All six values are pairwise
// DISTINCT (a wall with two 9s reads as a trick). (The workbook's hardest
// variant — assemble a wall from loose numbers — is consciously skipped: it is
// not a keypad answer. §12.1.)
const MAUER_REL = {
  // pos → [how to compute it once these two positions are known]: a first.
  1: [{ op: "+", of: [3, 4] }, { op: "-", of: [0, 2] }],
  2: [{ op: "+", of: [4, 5] }, { op: "-", of: [0, 1] }],
  0: [{ op: "+", of: [1, 2] }],
  3: [{ op: "-", of: [1, 4] }],
  4: [{ op: "-", of: [1, 3] }, { op: "-", of: [2, 5] }],
  5: [{ op: "-", of: [2, 4] }],
};

const mauerVals = ([b0, b1, b2]) => [b0 + 2 * b1 + b2, b0 + b1, b1 + b2, b0, b1, b2];

// Roll a base whose full wall holds six pairwise-distinct values.
function mauerBase(rng, lo, hi, midHi) {
  for (;;) {
    const base = [ri(rng, lo, hi), ri(rng, lo, midHi), ri(rng, lo, hi)];
    if (new Set(mauerVals(base)).size === 6) return base;
  }
}

// The aid for ONE brick, from what is visible right now (`known` is a boolean
// per position: given bricks plus the cells already filled). The child picks
// her own order, so the relation is chosen at miss time — preferring one whose
// operands she can see; when she jumped ahead of the path, the true values
// stand in (the aid names the right answer anyway).
export function mauerAidFor(vals, known, pos) {
  const rels = MAUER_REL[pos] ?? [];
  const rel = rels.find((r) => r.of.every((p) => known[p])) ?? rels[0];
  const [x, y] = rel.of.map((p) => vals[p]);
  return { kind: "op", op: rel.op, a: x, b: y, answer: vals[pos], text: `${x} ${SIGN[rel.op]} ${y} = ?` };
}

function mauerTask(rng, base, blanks) {
  const vals = mauerVals(base);
  const given = vals.map((_, i) => !blanks.includes(i));
  const cells = blanks.map((pos) => ({ pos, answer: vals[pos] }));
  return { kind: "mauer", vals, given, cells };
}

// --- Rechenquadrate (§12.1) -----------------------------------------------------
// A 2×2 operation grid with row and column headers: cell (r,c) = rows[r] op
// cols[c]. The workbook's 6×4 monster does not fit 360px next to a keypad —
// two by two keeps every number readable. `given` marks pre-filled anchor
// cells; `hdr`, when set, is a hidden COLUMN header (Schwer): it solves as a
// gap ("62 + ? = 73") off the anchor in its column. The four headers are
// pairwise distinct and so are the four interior values (two 9-rows read as a
// trick) — `quadNums` rolls until they are.
const quadVal = (op, x, y) => (op === "+" ? x + y : op === "-" ? x - y : x * y);

// Roll two rows and two cols (via `draw`) until headers and interiors are
// each pairwise distinct.
function quadNums(op, drawRow, drawCol) {
  for (;;) {
    const rows = [drawRow(), drawRow()];
    const cols = [drawCol(), drawCol()];
    const inner = [0, 1].flatMap((r) => [0, 1].map((c) => quadVal(op, rows[r], cols[c])));
    if (new Set([...rows, ...cols]).size === 4 && new Set(inner).size === 4) return { rows, cols };
  }
}

// The aid for one grid slot. An interior cell is its row ∘ column — printed
// with the true header even while that header is still hidden (the child
// jumped ahead; the aid names the right answer anyway). A hidden header
// itself solves as a gap off the anchor cell in its column (or row).
export function quadAidFor(task, pos) {
  const { op, rows, cols, grid } = task;
  if (pos.hdr !== undefined) {
    const from = task.given.find((g) => g.c === pos.hdr && g.r !== task.hdrRow) ?? { r: 0 };
    return {
      kind: "gap", op, a: rows[from.r], b: cols[pos.hdr], answer: cols[pos.hdr],
      text: `${rows[from.r]} ${SIGN[op]} ? = ${grid[from.r][pos.hdr]}`,
    };
  }
  if (pos.hdrRow !== undefined) {
    const from = task.given.find((g) => g.r === pos.hdrRow && g.c !== task.hdr) ?? { c: 0 };
    return {
      kind: "gap", op, a: rows[pos.hdrRow], b: cols[from.c], answer: rows[pos.hdrRow],
      text: `? ${SIGN[op]} ${cols[from.c]} = ${grid[pos.hdrRow][from.c]}`,
    };
  }
  return {
    kind: "op", op, a: rows[pos.r], b: cols[pos.c], answer: grid[pos.r][pos.c],
    text: `${rows[pos.r]} ${SIGN[op]} ${cols[pos.c]} = ?`,
  };
}

// `hideCol`/`hideRow` hide a header; its `from` names the anchor cell that
// reveals it (the anchor's OTHER coordinate — a row for a column header). The
// header cells come first in `cells`, each one one gap away from its anchor.
function quadTask(op, rows, cols, { given = [], hideCol = null, hideRow = null } = {}) {
  const grid = [[quadVal(op, rows[0], cols[0]), quadVal(op, rows[0], cols[1])],
    [quadVal(op, rows[1], cols[0]), quadVal(op, rows[1], cols[1])]];
  const cells = [];
  if (hideCol) {
    cells.push({ pos: { hdr: hideCol.idx }, answer: cols[hideCol.idx] });
    given = [...given, { r: hideCol.from, c: hideCol.idx }];
  }
  if (hideRow) {
    cells.push({ pos: { hdrRow: hideRow.idx }, answer: rows[hideRow.idx] });
    given = [...given, { r: hideRow.idx, c: hideRow.from }];
  }
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      if (given.some((g) => g.r === r && g.c === c)) continue;
      cells.push({ pos: { r, c }, answer: grid[r][c] });
    }
  }
  return {
    kind: "quad", op, rows, cols, grid, given, cells,
    hdr: hideCol ? hideCol.idx : null, hdrRow: hideRow ? hideRow.idx : null,
  };
}

// --- the skill buckets (§12.2) ------------------------------------------------
// The canonical, APPEND-ONLY list: a bucket's index is its slot in the box
// digit string, so a new bucket joins at the END and no child's saved box
// shifts under it. (The list was rewritten wholesale for the workbook redesign
// — legal exactly once, because the game had never shipped.) Each
// `gen(rng, divSign)` realises the bucket into a fresh concrete task. Every
// number a task shows or asks stays within 100 (§12.1) — Schwer gets hard
// through FORMAT, not through digits.
export const BUCKETS = [
  // ＋ Leicht: within 20, and two-digit plus whole tens (27 + 60)
  { key: "add-l-small", mode: "+", diff: 0, gen: (r, d) => { const a = ri(r, 2, 9), b = ri(r, 2, 9); return bin("+", a, b, a + b, d); } },
  { key: "add-l-tens", mode: "+", diff: 0, gen: (r, d) => { const at = ri(r, 1, 8), a = at * 10 + ri(r, 1, 9), b = ri(r, 1, 9 - at) * 10; return bin("+", a, b, a + b, d); } },
  // ＋ Mittel: crossing the ten — one-digit with carry, two-digit with and without
  { key: "add-m-1d", mode: "+", diff: 1, gen: (r, d) => { const b = ri(r, 2, 9), u = ri(r, 10 - b, 9), a = ri(r, 1, 8) * 10 + u; return bin("+", a, b, a + b, d); } },
  { key: "add-m-2d", mode: "+", diff: 1, gen: (r, d) => { const au = ri(r, 1, 8), bu = ri(r, 1, 9 - au), at = ri(r, 1, 7), bt = ri(r, 1, 8 - at); return bin("+", at * 10 + au, bt * 10 + bu, (at + bt) * 10 + au + bu, d); } },
  { key: "add-m-carry", mode: "+", diff: 1, gen: (r, d) => { const au = ri(r, 1, 9), bu = ri(r, 10 - au, 9), at = ri(r, 1, 4), bt = ri(r, 1, 8 - at); const a = at * 10 + au, b = bt * 10 + bu; return bin("+", a, b, a + b, d); } },
  // ＋ Schwer: gaps, and Ergänzen — complete to the next full ten or to 100,
  // the second-grade technique behind every tens-crossing. (The seven-cell
  // decomposition scaffold was cut on the ninth play-test: on a keypad it was
  // mostly transcription; the strategy lives on in the ± aid card. Mixed
  // chains fell earlier — too hard, and a ＋ chain carries a − anyway.)
  { key: "add-s-gap", mode: "+", diff: 2, gen: (r, d) => { const a = ri(r, 15, 60), b = ri(r, 15, 95 - a); return gap("+", a, b, a + b, r() < 0.5, d); } },
  { key: "add-s-fill", mode: "+", diff: 2, gen: (r, d) => {
    if (r() < 0.5) { const a = ri(r, 2, 9) * 10 + ri(r, 1, 9); return gap("+", a, 10 - (a % 10), a + 10 - (a % 10), false, d); } // 64 + ? = 70
    const a = ri(r, 11, 89); return gap("+", a, 100 - a, 100, false, d); // 37 + ? = 100
  } },

  // − Leicht: minus whole tens (75 − 10), and within 20
  { key: "sub-l-tens", mode: "-", diff: 0, gen: (r, d) => { const at = ri(r, 2, 9), a = at * 10 + ri(r, 0, 9), b = ri(r, 1, at - 1) * 10; return bin("-", a, b, a - b, d); } },
  { key: "sub-l-small", mode: "-", diff: 0, gen: (r, d) => { const a = ri(r, 6, 18), b = ri(r, 2, Math.min(9, a - 1)); return bin("-", a, b, a - b, d); } },
  // − Mittel: borrowing — one-digit, and two-digit with and without
  { key: "sub-m-1d", mode: "-", diff: 1, gen: (r, d) => { const b = ri(r, 2, 9), u = ri(r, 0, b - 1), a = ri(r, 1, 9) * 10 + u; return bin("-", a, b, a - b, d); } },
  { key: "sub-m-2d", mode: "-", diff: 1, gen: (r, d) => { const au = ri(r, 1, 9), bu = ri(r, 0, au), at = ri(r, 2, 9), bt = ri(r, 1, at - 1); return bin("-", at * 10 + au, bt * 10 + bu, (at - bt) * 10 + au - bu, d); } },
  { key: "sub-m-borrow", mode: "-", diff: 1, gen: (r, d) => { const au = ri(r, 0, 8), bu = ri(r, au + 1, 9), at = ri(r, 2, 9), bt = ri(r, 1, at - 1); const a = at * 10 + au, b = bt * 10 + bu; return bin("-", a, b, a - b, d); } },
  // − Schwer: gaps, and Ergänzen downward — to the full ten, or away from 100
  { key: "sub-s-gap", mode: "-", diff: 2, gen: (r, d) => { const a = ri(r, 30, 99), b = ri(r, 10, a); return gap("-", a, b, a - b, r() < 0.5, d); } },
  { key: "sub-s-fill", mode: "-", diff: 2, gen: (r, d) => {
    if (r() < 0.5) { const a = ri(r, 2, 9) * 10 + ri(r, 1, 9); return gap("-", a, a % 10, a - (a % 10), false, d); } // 73 − ? = 70
    const b = ri(r, 11, 89); return gap("-", 100, b, 100 - b, false, d); // 100 − ? = 63
  } },

  // ÷R — division with remainder, the one division einmaleins can NEVER teach.
  // (The tile used to hold ×, exact ÷ and table gaps: the einmaleins drill in
  // a different coat, cut on Martin's seventh play-test — each region teaches
  // its own thing. The remainder is sometimes genuinely 0: "R 0" is an answer
  // the child gives, not a case the format hides.)
  // Leicht: tiny divisors, the concept (7 : 2 = 3 R 1)
  { key: "rest-l", mode: "rest", diff: 0, gen: (r, d) => restTask(r, ri(r, 2, 5), ri(r, 2, 9), d) },
  // Mittel: full divisors, table-sized quotients
  { key: "rest-m", mode: "rest", diff: 1, gen: (r, d) => restTask(r, ri(r, 3, 9), ri(r, 4, 10), d) },
  // Schwer: TWO-DIGIT quotients (74 : 6 = 12 R 2) — beyond the tables
  { key: "rest-s", mode: "rest", diff: 2, gen: (r, d) => {
    const b = ri(r, 3, 8);
    const q = ri(r, 11, Math.min(19, Math.floor((99 - (b - 1)) / b)));
    return restTask(r, b, q, d);
  } },

  // 🧱 Mauern: Leicht climbs (base given, pure +); Mittel descends a flank
  // (top + one side given, pure −); Schwer mixes both directions.
  { key: "mauer-l", mode: "mauer", diff: 0, gen: (r) => mauerTask(r, mauerBase(r, 1, 9, 9), [1, 2, 0]) },
  { key: "mauer-m", mode: "mauer", diff: 1, gen: (r) =>
    mauerTask(r, mauerBase(r, 5, 20, 25), pick(r, [[4, 2, 5], [4, 1, 3]])) }, // given: top + left or right flank
  { key: "mauer-s", mode: "mauer", diff: 2, gen: (r) =>
    mauerTask(r, mauerBase(r, 8, 24, 25), pick(r, [[1, 2, 5], [2, 1, 3], [0, 3, 5]])) }, // mixed +/− directions

  // ⊞ Quadrate: Leicht a small + grid (all four); Mittel the workbook's − grid
  // with a HIDDEN column header and its anchor cell (a given cell with all
  // headers visible would teach nothing — the anchor must buy the header);
  // Schwer a ± grid with a hidden ROW header AND a hidden COLUMN header, each
  // bought from its own anchor. (A × grid was dropped: the times tables are
  // einmaleins' whole game — the same drill in a different coat.)
  { key: "quad-l", mode: "quad", diff: 0, gen: (r) => {
    const { rows, cols } = quadNums("+", () => ri(r, 2, 10), () => ri(r, 2, 10));
    return quadTask("+", rows, cols);
  } },
  { key: "quad-m", mode: "quad", diff: 1, gen: (r) => {
    const { rows, cols } = quadNums("-", () => ri(r, 40, 95), () => ri(r, 11, 35));
    return quadTask("-", rows, cols, { hideCol: { idx: ri(r, 0, 1), from: ri(r, 0, 1) } });
  } },
  { key: "quad-s", mode: "quad", diff: 2, gen: (r) => {
    const op = r() < 0.5 ? "+" : "-";
    const { rows, cols } = op === "+"
      ? quadNums("+", () => ri(r, 20, 60), () => ri(r, 10, 39))
      : quadNums("-", () => ri(r, 40, 95), () => ri(r, 11, 35));
    const hc = ri(r, 0, 1);
    const hr = ri(r, 0, 1);
    // each anchor sits on the VISIBLE counterpart axis, or nothing reveals it
    return quadTask(op, rows, cols, {
      hideCol: { idx: hc, from: 1 - hr },
      hideRow: { idx: hr, from: 1 - hc },
    });
  } },
];

export const BUCKET_COUNT = BUCKETS.length;

// The bucket a variant item-id stands for. Total: junk folds to bucket 0 rather
// than throwing, so a corrupt cookie can never open an empty round.
export function bucketOf(itemId) {
  const b = Math.trunc(itemId) % BUCKET_COUNT;
  return b < 0 ? b + BUCKET_COUNT : b;
}

// The buckets a cell offers. "mix" is the difficulty's equation modes pooled
// (＋ − ×÷ — walls and grids stay on their own tiles); any other mode is its
// own buckets. An unknown mode reads as "mix", never an empty cell.
export function bucketsFor(mode, diff) {
  const known = MODES.includes(mode) && mode !== "mix";
  const out = [];
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const b = BUCKETS[i];
    if (b.diff !== diff) continue;
    if (known ? b.mode === mode : MIX_MODES.includes(b.mode)) out.push(i);
  }
  return out;
}

// The round's pool: the cell's buckets expanded into `VARIANTS` variant ids
// each, so the shared engine has more items than a round to weight and rest.
export function poolFor(mode, diff) {
  const buckets = bucketsFor(mode, diff);
  const pool = [];
  for (let v = 0; v < VARIANTS; v++) for (const b of buckets) pool.push(b + BUCKET_COUNT * v);
  return pool;
}

// Realise a variant item-id into a concrete task with fresh numbers. Pure
// under a seeded rng, so the driver and the tests can replay it.
export function questionFor(itemId, rng = Math.random, divSign = "÷") {
  return BUCKETS[bucketOf(itemId)].gen(rng, divSign);
}

// --- the per-bucket box fold (§7, §12.2) --------------------------------------
// The round's answers, folded back onto the bucket box string. A bucket TOUCHED
// this round climbs one Leitner box on a clean round and drops to 0 if any of
// its variants was missed — the standard Leitner move (§7.1), applied once per
// bucket. Untouched buckets keep their digit. Total and sanitising: whatever
// comes in, what goes back to the cookie is `count` digits of 0–4.
export function foldBoxes(boxStr, touched = [], missed = [], count = BUCKET_COUNT) {
  const s = String(boxStr ?? "").padEnd(count, "2").slice(0, count).split("").map((c) => clampBox(c));
  const missedSet = new Set(missed);
  for (const bi of new Set(touched)) {
    if (!Number.isInteger(bi) || bi < 0 || bi >= count) continue;
    s[bi] = missedSet.has(bi) ? 0 : Math.min(s[bi] + 1, 4);
  }
  return s.join("");
}

// --- stars (§10.3, §12.2) -----------------------------------------------------
// The einmaleins ratios exactly (≥60 % ⭐, ≥80 % ⭐⭐, 100 % ⭐⭐⭐ first-try).
// Duplicated, not imported — pinned against einmaleins by tests/rechnungen.test.js.
export function starNeeds(total) {
  // The three scores that pay the stars: the percent bands (≥60 % ⭐, ≥80 % ⭐⭐,
  // 100 % ⭐⭐⭐), pulled apart when a short round would drop two stars on the
  // same answer — 80 % and 100 % of three tasks are both "all three". Every
  // star group then lands on its own waypoint (§10.3, §10.5): a three-task
  // round pays at 1, 2 and 3, a four-task round at 2, 3 and 4.
  if (!(total > 0)) return null;
  const t3 = total;
  const t2 = Math.max(1, Math.min(Math.ceil(0.8 * total), t3 - 1));
  const t1 = Math.max(1, Math.min(Math.ceil(0.6 * total), t2 - 1));
  return [t1, t2, t3];
}

export function starsFor(firstTryOk, total) {
  const needs = starNeeds(total);
  if (!needs) return 0;
  return needs.filter((n) => firstTryOk >= n).length;
}

export function nextStarGoal(stars) {
  return ["starGoal1", "starGoal2", "starGoal3"][stars] ?? null;
}

export function starGoalNeed(stars, total) {
  const needs = starNeeds(total);
  return needs && needs[stars] !== undefined ? needs[stars] : null;
}

// The stars you own on this tile if the round stopped now — the round scene's
// basket (§10.5). Monotone in both terms, so a star can never leave.
export function ownedStars({ firstTrySolved = 0, total = 0 } = {}, best = 0) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, STAR_SLOTS) : 0;
  const earned = total > 0 ? starsFor(firstTrySolved, total) : 0;
  return Math.max(held, earned);
}

// --- star digit strings (§12.3) -----------------------------------------------
// One digit per DIFFICULTY in a 3-char string, held per mode. Junk in, zero out.
export function starDigit(starString, diff) {
  const d = Number.parseInt((starString ?? "")[diff], 10);
  return Number.isInteger(d) ? Math.min(d, 3) : 0;
}

export function withStarDigit(starString, diff, value) {
  const s = (starString ?? "").padEnd(DIFF_SLOTS, "0").split("");
  s[diff] = String(value);
  return s.join("");
}

// The one-line kinds must always stay on one line (§10.1). Same fitter as
// einmaleins, duplicated and pinned by the parity test.
export function fittedFontSize(size, avail, width) {
  if (!(size > 0) || !(avail > 0) || !(width > 0) || width <= avail) return size;
  return Math.floor((size * avail) / width);
}

// After a wrong answer the child re-enters the right answer (§8.1): the aid is
// answered the way the cell was — digits, then OK. The einmaleins contract
// verbatim, pinned by parity.
export function retryStep(input, key, answer) {
  const want = String(answer);
  const cur = String(input ?? "");
  if (key === "⌫") return { input: cur.slice(0, -1), state: "typing" };
  if (key === "OK") {
    if (cur === "") return { input: cur, state: "typing" };
    return cur === want ? { input: cur, state: "done" } : { input: "", state: "reject" };
  }
  if (!/^[0-9]$/.test(key)) return { input: cur, state: "typing" };
  return { input: cur.length < 4 ? cur + key : cur, state: "typing" };
}

// --- the tempo ladder (§10.6) -------------------------------------------------
// The same purely additive collectible einmaleins pays: 🐇 → 🚗 → 🚀, only ever
// upward. Faces and mechanics are einmaleins' (pinned by parity); only the
// bounds differ. The clock runs PER CELL (§12.2) — a wall brick and a plain sum
// are each one thinking step — so the bounds describe one step, not one task.
export const TEMPO_SLOTS = 3;

// Upper bounds (ms) on the round's median cell time, per difficulty:
// [hare, car, rocket]. Leicht sits above einmaleins' keypad Leicht; Mittel adds
// carrying/borrowing; Schwer's single step is a decomposition row or a
// remainder, so it sits later still. Loosened after the first play-test: the
// original rocket bounds (3/5/7 s including the typing) made the ⚡ nearly
// unreachable even for an adult. Deliberately plain named numbers — retune
// after a real child.
export const TEMPO_TIERS = [
  [9000, 6500, 4500], // Leicht
  [13000, 9000, 6500], // Mittel
  [17000, 12500, 9000], // Schwer
];

export const TEMPO_ICONS = [null, "tempo-hare", "tempo-car", "tempo-rocket"];
export const TEMPO_KEYS = [null, "tempo1", "tempo2", "tempo3"];

export function median(values) {
  const v = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function tempoTier(ms, difficulty) {
  const limits = TEMPO_TIERS[difficulty];
  if (!limits || !Number.isFinite(ms) || ms < 0) return 0;
  if (ms <= limits[2]) return 3;
  if (ms <= limits[1]) return 2;
  return ms <= limits[0] ? 1 : 0;
}

export function awardTempo({ stars = 0, tier = 0, best = 0 } = {}) {
  const held = Number.isInteger(best) && best > 0 ? Math.min(best, TEMPO_SLOTS) : 0;
  const won = Number.isInteger(tier) && tier > 0 ? Math.min(tier, TEMPO_SLOTS) : 0;
  return stars >= 2 ? Math.max(held, won) : held;
}

// --- the game's worth (§8.3, §12.2) -------------------------------------------
// Everything the game can pay, computed from its real tiles: six modes × three
// difficulties, each tile three stars, a star worth difficulty + 1. This is
// what MAX_POINTS.rechnungen must equal — tests/rewards.test.js holds them
// together. 6·(3·1 + 3·2 + 3·3) = 108.
export function maxPoints() {
  let total = 0;
  for (let d = 0; d < DIFF_SLOTS; d++) total += MODES.length * STAR_SLOTS * (d + 1);
  return total;
}
