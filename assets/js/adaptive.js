// Shared adaptive practice engine (§7): Leitner-light boxes 0–4 per item,
// weighted selection, in-round re-queue of mistakes. Pure module — no DOM,
// no storage. The caller persists boxes via storage.js.

export const WEIGHTS = { 0: 8, 1: 4, 2: 2, 3: 1, 4: 0.5 };

export function clampBox(v) {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? n : 2; // unknown → box 2 (§7.1)
}

// Box digit-string codecs (§9.2): one char per item in canonical order,
// missing/short strings padded with 2.
export function boxesFromString(str, count) {
  const out = {};
  for (let i = 0; i < count; i++) out[i] = clampBox((str ?? "")[i]);
  return out;
}

export function boxesToString(boxes, count) {
  let s = "";
  for (let i = 0; i < count; i++) s += boxes[i] ?? 2;
  return s;
}

// Weighted sample without replacement: k draws, weight by current box.
function weightedSample(pool, weightOf, k, rng) {
  const items = [...pool];
  const out = [];
  while (out.length < k && items.length > 0) {
    let total = 0;
    const ws = items.map((id) => {
      const w = weightOf(id);
      total += w;
      return w;
    });
    let r = rng() * total;
    let i = 0;
    while (i < ws.length - 1 && r >= ws[i]) {
      r -= ws[i];
      i++;
    }
    out.push(items.splice(i, 1)[0]);
  }
  return out;
}

// createSession(pool, boxes, opts) per §7.5.
//  - pool: array of item ids
//  - boxes: {id: 0..4}
//  - opts: {roundSize=10, requeueMin=2, requeueMax=4, rng=Math.random}
// The round ends only when every drawn item has been answered correctly
// (§7.3), so next() returns null only after full success.
export function createSession(pool, boxes, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const roundSize = Math.min(opts.roundSize ?? 10, pool.length);
  const reqMin = opts.requeueMin ?? 2;
  const reqMax = opts.requeueMax ?? 4;

  const box = {};
  for (const id of pool) box[id] = clampBox(boxes[id]);

  const pending = weightedSample(pool, (id) => WEIGHTS[box[id]], roundSize, rng);
  const roundItems = [...pending];
  let cursor = 0;
  const solved = new Set();
  const missed = new Set();

  return {
    next() {
      return cursor < pending.length ? pending[cursor] : null;
    },
    answer(id, correct) {
      if (pending[cursor] !== id) throw new Error("answer() does not match next()");
      if (correct) {
        box[id] = Math.min(box[id] + 1, 4);
        solved.add(id);
        cursor++;
      } else {
        box[id] = 0;
        missed.add(id);
        // Re-queue 2–4 questions later in the same round (§7.1).
        pending.splice(cursor, 1);
        const offset = reqMin + Math.floor(rng() * (reqMax - reqMin + 1));
        pending.splice(Math.min(cursor + offset, pending.length), 0, id);
      }
    },
    progress() {
      return { solved: solved.size, total: roundSize, firstTryOk: roundSize - missed.size };
    },
    boxes() {
      return { ...box };
    },
    items() {
      return [...roundItems];
    },
  };
}
