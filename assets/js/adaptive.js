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

// Whether a snapshot (from `session.snapshot()`) can stand in for a fresh
// draw over this pool (§10.7). Total on purpose: a snapshot from another
// level, a truncated one, or plain junk must be *ignored*, never obeyed — the
// failure mode of trusting it is a round full of questions the pool does not
// hold.
export function validResume(s, pool) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  if (![s.pending, s.roundItems, s.solved, s.missed].every(Array.isArray)) return false;
  if (s.roundItems.length === 0) return false;
  if (!Number.isInteger(s.cursor) || s.cursor < 0 || s.cursor > s.pending.length) return false;
  const inPool = new Set(pool);
  return [...s.pending, ...s.roundItems, ...s.solved, ...s.missed].every((id) => inPool.has(id));
}

// createSession(pool, boxes, opts) per §7.5.
//  - pool: array of item ids
//  - boxes: {id: 0..4}
//  - opts: {roundSize=10, requeueMin=2, requeueMax=4, rng=Math.random,
//           boost: (id) => 1, resume: snapshot}
// `boost` multiplies into the Leitner weight when the round is drawn (§7.2):
// a game can make intrinsically hard items come up more often without touching
// the box mechanics. It never affects re-queueing or box movement.
// `resume` restores a round from `snapshot()` instead of drawing one — used
// by the round mirror (§10.7); anything that fails `validResume` draws fresh.
// The round ends only when every drawn item has been answered correctly
// (§7.3), so next() returns null only after full success.
export function createSession(pool, boxes, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const reqMin = opts.requeueMin ?? 2;
  const reqMax = opts.requeueMax ?? 4;
  const boost = opts.boost ?? (() => 1);
  const res = validResume(opts.resume, pool) ? opts.resume : null;

  const box = {};
  for (const id of pool) box[id] = clampBox(boxes[id]);
  if (res) {
    // the snapshot's boxes carry this round's moves (a miss already dropped
    // its item to 0); clamp each digit as if it had come from the cookie
    for (const [k, v] of Object.entries(res.box ?? {})) {
      if (k in box) box[k] = clampBox(v);
    }
  }

  const pending = res
    ? [...res.pending]
    : weightedSample(pool, (id) => WEIGHTS[box[id]] * boost(id), Math.min(opts.roundSize ?? 10, pool.length), rng);
  const roundItems = res ? [...res.roundItems] : [...pending];
  // progress() measures against the items actually drawn — on a resume that
  // is the interrupted round's size, whatever today's options say
  const roundSize = roundItems.length;
  let cursor = res ? res.cursor : 0;
  const solved = new Set(res?.solved);
  const missed = new Set(res?.missed);

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
      // `firstTryOk` is the best score still *reachable*: it drops on a miss.
      // `firstTrySolved` is what has actually been banked — it only ever grows,
      // which is what the in-round star basket must show. A basket driven by
      // firstTryOk would empty itself on the first mistake (§10.5).
      let firstTrySolved = 0;
      for (const id of solved) if (!missed.has(id)) firstTrySolved++;
      return { solved: solved.size, total: roundSize, firstTryOk: roundSize - missed.size, firstTrySolved };
    },
    boxes() {
      return { ...box };
    },
    items() {
      return [...roundItems];
    },
    // Everything a later createSession needs to stand the round back up
    // (§10.7). Plain JSON-safe values — the mirror stringifies it.
    snapshot() {
      return {
        pending: [...pending],
        cursor,
        box: { ...box },
        solved: [...solved],
        missed: [...missed],
        roundItems: [...roundItems],
      };
    },
  };
}

// Has this round been touched? An answer of either kind counts: a solve grows
// `solved`, and a first wrong answer drops `firstTryOk` below `total` without
// growing `solved` (the miss is re-queued, not solved). The leave guard
// (§10.7) asks this before it asks the child — a round nobody has answered
// has nothing to lose, so leaving it deserves no dialog.
export function hasProgress(progress) {
  const { solved = 0, firstTryOk = 0, total = 0 } = progress ?? {};
  return solved > 0 || firstTryOk < total;
}
