// Browser-side round driver for games/rechnungen. Loaded into the page by
// tools/shoot.mjs, which cannot import modules — so this file defines globals
// and exports nothing. The sibling of tools/play.js and tools/play-lesen.js,
// with the same contract.
//
//   node tools/shoot.mjs http://localhost:8000/games/rechnungen/ \
//     --do 'eval @tools/play-rechnungen.js' \
//     --do 'eval playRechnung({ wrongAt: 1 })' \
//     --do 'until #sum-overlay'
//
// playRechnung() escapes the level picker the game opens on and runs until the
// round's summary is up. A task can hold several CELLS (a number wall is three
// answers, a decomposition two, §12.1); the driver answers them in order, cell
// by cell, reading each off the screen the way the child does. Options:
// `wrongAt` (task number or list — that task is answered wrongly until the aid
// is up: a multi-cell task forgives the first slip, so the driver errs twice),
// `slipAt` (task number or list — one wrong answer, then the right one: the
// forgiveness itself, the task must still end clean),
// `delayMs` (think that long before every cell — the
// sleep lands in the game's per-cell tempo clock, the knob for reaching the
// slow tempo tiers, §10.6), `stopAt` / `questions` (stop early, e.g. for a
// mid-round screenshot), `stopInAid` (stop with the aid still open),
// `stopKind` (stop the moment a task of that kind is on screen, unanswered —
// the way to screenshot one kind out of a mixed pool).
// `readRechnungScene()` and `readRechnungSummary()` are separate globals for
// `eval` steps.
//
// `resolveRechnung`, `resolveMauer` and `resolveQuad` are plain functions on
// `globalThis`: they are the only parts with real logic, and
// tests/play-rechnungen.test.js runs them in Node against every task shape
// `questionFor()` can produce. A driver that answers the wrong thing proves
// nothing, quietly.

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Read an equation the way the child does and return the number that fills
  // its NEXT "?". Handles every one-line shape §12 can print: plain binary, a
  // left-to-right ± chain, a gap where one operand is the unknown, the ×→+ link
  // ("3 × 6 = 6 + 6 + 6 = ?"), and division with remainder ("49 : 5 = ? R ?" —
  // the quotient first, then, once it shows, the remainder). The operators come
  // off the screen, so both division signs (":" German, "÷" English) and the
  // real minus "−" are accepted.
  function resolveRechnung(text) {
    const parts = String(text).split("=").map((s) => s.trim());
    if (parts.length < 2) throw new Error(`not an equation: "${text}"`);
    const [lhs] = parts;
    const rhs = parts[parts.length - 1];
    const tok = lhs.split(/\s+/);
    const apply = (x, op, y) => {
      if (op === "+") return x + y;
      if (op === "−" || op === "-") return x - y;
      if (op === "×" || op === "x" || op === "*") return x * y;
      if (op === ":" || op === "÷" || op === "/") return x / y;
      throw new Error(`unknown operator "${op}" in "${text}"`);
    };
    const evalSide = (t) => {
      let acc = Number(t[0]);
      for (let i = 1; i < t.length; i += 2) acc = apply(acc, t[i], Number(t[i + 1]));
      return acc;
    };
    // division with remainder: "a : b = ? R ?" then "a : b = q R ?"
    if (/\sR\s/.test(rhs)) {
      const [q, r] = rhs.split(/\sR\s/).map((s) => s.trim());
      const a = Number(tok[0]);
      const b = Number(tok[2]);
      if (q === "?") return Math.floor(a / b);
      if (r === "?") return a - b * Number(q);
      throw new Error(`nothing to solve in "${text}"`);
    }
    if (rhs === "?") return evalSide(tok);
    // a gap: one operand is "?", the result is on the right
    const c = Number(rhs);
    const [a, op, b] = tok;
    if (a === "?") {
      if (op === "+") return c - Number(b);
      if (op === "−" || op === "-") return c + Number(b);
      if (op === "×" || op === "x") return c / Number(b);
      return c * Number(b); // ? : b = c  →  c · b
    }
    if (op === "+") return c - Number(a);
    if (op === "−" || op === "-") return Number(a) - c;
    if (op === "×" || op === "x") return c / Number(a);
    return Number(a) / c; // a : ? = c  →  a / c
  }
  globalThis.resolveRechnung = resolveRechnung;

  // The scaffold, reconstructed from its printed HEAD ("13 + 69 = ?"): the
  // seven numbers the child enters, in reading order — a, the tens of b, the
  // first row's result, that result again, the ones of b, the final result,
  // and the final result once more up in the head.
  function resolveZerlege(headText) {
    const m = String(headText).replace(/\s+/g, "").match(/^(\d+)([+−-])(\d+)=/);
    if (!m) throw new Error(`not a zerlege head: "${headText}"`);
    const a = Number(m[1]);
    const b = Number(m[3]);
    const plus = m[2] === "+";
    const bt = b - (b % 10);
    const s1 = plus ? a + bt : a - bt;
    const ans = plus ? a + b : a - b;
    return [a, bt, s1, s1, b % 10, ans, ans];
  }
  globalThis.resolveZerlege = resolveZerlege;

  // Complete a number wall from what is visible. `vals` is
  // [top, m0, m1, b0, b1, b2] with null where a brick still shows "?"; the
  // three sum relations propagate until nothing more fills in. The game only
  // ever shows solvable walls, so a null left over means the driver misread.
  function resolveMauer(vals) {
    const v = [...vals];
    const rels = [[0, 1, 2], [1, 3, 4], [2, 4, 5]]; // s = x + y
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (const [s, x, y] of rels) {
        if (v[s] === null && v[x] !== null && v[y] !== null) { v[s] = v[x] + v[y]; changed = true; }
        else if (v[x] === null && v[s] !== null && v[y] !== null) { v[x] = v[s] - v[y]; changed = true; }
        else if (v[y] === null && v[s] !== null && v[x] !== null) { v[y] = v[s] - v[x]; changed = true; }
      }
      if (!changed) break;
    }
    return v;
  }
  globalThis.resolveMauer = resolveMauer;

  // Complete an operation grid from what is visible. A null header — a column
  // OR a row (Schwer hides one of each) — is recovered from an anchor cell
  // whose other header is known (the inverse operation); then every null cell
  // is rowHeader ∘ colHeader. Two passes: recovering one header can be what
  // unlocks the next.
  function resolveQuad({ op, rows, cols, grid }) {
    const rw = [...rows];
    const c = [...cols];
    const g = grid.map((r) => [...r]);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < c.length; j++) {
        if (c[j] !== null) continue;
        const i = g.findIndex((row, ii) => row[j] !== null && rw[ii] !== null);
        if (i >= 0) c[j] = resolveRechnung(`${rw[i]} ${op} ? = ${g[i][j]}`);
      }
      for (let i = 0; i < rw.length; i++) {
        if (rw[i] !== null) continue;
        const j = g[i].findIndex((v, jj) => v !== null && c[jj] !== null);
        if (j >= 0) rw[i] = resolveRechnung(`? ${op} ${c[j]} = ${g[i][j]}`);
      }
    }
    if (c.includes(null) || rw.includes(null)) throw new Error("a header has no anchor");
    for (let i = 0; i < g.length; i++) {
      for (let j = 0; j < c.length; j++) {
        if (g[i][j] === null) g[i][j] = resolveRechnung(`${rw[i]} ${op} ${c[j]} = ?`);
      }
    }
    return { rows: rw, cols: c, grid: g };
  }
  globalThis.resolveQuad = resolveQuad;

  const $ = (id) => document.getElementById(id);
  const summaryUp = () => !$("sum-overlay").hidden;
  const aidUp = () => !$("feedback").hidden;

  globalThis.readRechnungScene = () => ({
    stars: document.querySelectorAll(".j-star.landed").length,
    aria: $("journey")?.getAttribute("aria-label") ?? null,
    // every finished task is a waypoint (§10.5): green for clean, red for missed
    foxAtNode: document.querySelectorAll(".j-node.done, .j-node.missed").length,
    missedNodes: document.querySelectorAll(".j-node.missed").length,
    pathNodes: document.querySelectorAll(".j-node").length,
  });

  globalThis.readRechnungSummary = () => ({
    stars: $("sum-stars").textContent.trim(),
    score: $("sum-score").textContent.trim(),
    goal: $("sum-goal").hidden ? null : $("sum-goal").textContent.trim(),
    tempo: $("sum-tempo").hidden ? null : $("sum-tempo").textContent.trim(),
    trophies: [...document.querySelectorAll("#sum-trophy .won")].map((w) => w.textContent.trim()),
  });

  // A "?"-or-number brick/cell face, read as the solver wants it.
  const faceOf = (el) => {
    const s = el.textContent.trim();
    return s === "?" ? null : Number(s);
  };

  // Solve the active cell off the screen, by kind. This is what the child does:
  // read what is visible, work out the one number the orange slot wants.
  function solveActive() {
    const q = $("question");
    const active = q.querySelector(".cell.active");
    if (!active) throw new Error("no active cell to solve");
    const kind = q.dataset.kind;
    if (kind === "mauer") {
      const vals = [...q.querySelectorAll("[data-pos]")]
        .sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos))
        .map(faceOf);
      const full = resolveMauer(vals);
      return full[Number(active.dataset.pos)];
    }
    if (kind === "quad") {
      const op = q.querySelector(".qcorner").textContent.trim();
      const rows = [...q.querySelectorAll("[data-row]")].map(faceOf);
      const cols = [...q.querySelectorAll("[data-hdr]")].map(faceOf);
      const grid = [[null, null], [null, null]];
      for (const el of q.querySelectorAll("[data-rc]")) {
        const [r, c] = el.dataset.rc.split(",").map(Number);
        grid[r][c] = faceOf(el);
      }
      const full = resolveQuad({ op, rows, cols, grid });
      if (active.dataset.hdr !== undefined) return full.cols[Number(active.dataset.hdr)];
      if (active.dataset.row !== undefined) return full.rows[Number(active.dataset.row)];
      const [r, c] = active.dataset.rc.split(",").map(Number);
      return full.grid[r][c];
    }
    if (kind === "zerlege") {
      // the head names the whole scheme; the active cell picks its slot
      const head = q.querySelector(".zhead").textContent;
      return resolveZerlege(head)[Number(active.dataset.cell)];
    }
    // one-line kinds: the equation as printed
    return resolveRechnung(q.textContent.trim());
  }

  // A new cell announces itself on the stamps the game writes for exactly this
  // purpose (rechnungen.js: renderQuestion) — `data-q` counts tasks, `data-cell`
  // the cell within one. Text alone cannot be trusted, because a re-queued
  // skill asks a fresh task that may read the same. A wall/grid waits with NO
  // active cell (`data-cell` −1) until a blank is picked — the driver picks the
  // first open "?" the way a child taps one.
  async function nextCell(lastQ, lastCell) {
    for (let i = 0; i < 150; i++) {
      if (summaryUp()) return null;
      const q = $("question");
      const active = q.hidden ? null : q.querySelector(".cell.active");
      if (active && (q.dataset.q !== lastQ || q.dataset.cell !== lastCell)
        && active.textContent.trim() === "?") {
        return { stamp: q.dataset.q, cell: q.dataset.cell, kind: q.dataset.kind, text: q.textContent.trim() };
      }
      if (!active && !q.hidden && !aidUp() && q.dataset.cell === "-1") {
        const open = [...q.querySelectorAll(".cell")].find((c) => c.textContent.trim() === "?");
        if (open) open.click();
      }
      await sleep(40);
    }
    throw new Error("the next cell never came");
  }

  const keypadKey = (label) =>
    [...document.querySelectorAll("#answers button")].find((b) => b.textContent.trim() === label);

  async function answer(value) {
    for (const ch of String(value)) {
      const k = keypadKey(ch);
      if (!k) throw new Error(`no keypad key "${ch}"`);
      k.click();
      await sleep(15);
    }
    keypadKey("OK").click();
  }

  // Play a round. `wrongAt` is a task number (1-based) or a list; that task's
  // first cell gets the right answer plus one, which is never right. Returns a
  // trace, and throws rather than returning a half-played round.
  globalThis.playRechnung = async ({
    questions = Infinity, wrongAt = [], slipAt = [], stopAt = null, delayMs = 0, stopInAid = false,
    stopKind = null,
  } = {}) => {
    const wrong = new Set(Array.isArray(wrongAt) ? wrongAt : [wrongAt]);
    const slips = new Set(Array.isArray(slipAt) ? slipAt : [slipAt]);
    const pause = Number.isFinite(delayMs) && delayMs > 0 ? Math.round(delayMs) : 0;
    const trace = [];
    // a round is at most ~40 cells (walls and grids × requeues + margin)
    const deadline = Date.now() + 90000 + pause * 40;
    let n = 0;
    let stamp = "";
    let cellNo = "";
    let firstOfTask = false; // `wrongAt` misses a task's FIRST answered cell

    // The game opens on the level picker; dismissing it starts a round on the
    // tile the fox stands on — the cookie's own level.
    if (!$("pick-overlay").hidden) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(160);
    }

    // Every wait after an answer must outlive the game's post-correct
    // transition (NEXT_MS = 250ms), or the driver re-reads the same cell.
    const SETTLE = 350;

    while (!summaryUp() && Date.now() < deadline) {
      const st = await nextCell(stamp, cellNo);
      if (st === null) break;
      if (st.stamp !== stamp) {
        // a new task
        if (n + 1 > questions) break;
        n += 1;
        stamp = st.stamp;
        firstOfTask = true;
      }
      cellNo = st.cell;
      // `stopKind: "zerlege"` stops with that task freshly on screen, unanswered
      // — the way to screenshot one kind out of a mixed pool.
      if (stopKind && st.kind === stopKind && firstOfTask) break;
      const want = solveActive();
      if (!Number.isInteger(want) || want < 0) throw new Error(`cannot solve cell ${cellNo} of "${st.text}" → ${want}`);

      if (pause) await sleep(pause); // "think" — counted by the per-cell tempo clock
      const missNow = wrong.has(n) && firstOfTask;
      const slipNow = slips.has(n) && firstOfTask;
      firstOfTask = false;

      if (missNow || slipNow) {
        await answer(want + 1);
        await sleep(SETTLE);
        if (!aidUp()) {
          // the first wrong answer of a multi-cell task is forgiven (§12.2):
          // the cell shakes and waits again — no aid, no penalty
          trace.push({ q: n, cell: Number(cellNo), kind: st.kind, slip: true, ...readRechnungScene() });
          if (missNow) {
            // `wrongAt` wants the real miss: the SECOND wrong drives the aid
            await answer(want + 1);
            await sleep(SETTLE);
          }
        }
      } else {
        await answer(want);
        await sleep(SETTLE);
      }

      if (aidUp()) {
        trace.push({ q: n, cell: Number(cellNo), kind: st.kind, gave: want + 1, aid: true, ...readRechnungScene() });
        if (stopInAid && stopAt !== null && n >= stopAt) break;
        // The way out of the aid is entering the right answer.
        await answer(want);
        await sleep(SETTLE);
      } else if (missNow || slipNow) {
        // forgiven — now the right answer, the way the child rethinks
        await answer(want);
        await sleep(SETTLE);
        trace.push({ q: n, cell: Number(cellNo), kind: st.kind, gave: want, ...readRechnungScene() });
      } else {
        trace.push({ q: n, cell: Number(cellNo), kind: st.kind, gave: want, ...readRechnungScene() });
      }
      // stop only once the task is over (its last cell answered): the game has
      // either moved to the next task's first cell or opened the summary.
      if (stopAt !== null && n >= stopAt && $("question").dataset.q !== stamp) break;
      if (stopAt !== null && n >= stopAt && summaryUp()) break;
    }

    if (Date.now() >= deadline) throw new Error(`gave up after ${n} tasks`);
    return { answered: n, wrongGiven: [...wrong].filter((w) => w <= n), trace, scene: readRechnungScene() };
  };
})();
