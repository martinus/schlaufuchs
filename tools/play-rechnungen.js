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
// round's summary is up. Options: `wrongAt` (question number or list — answered
// wrongly first), `delayMs` (think that long before every answer — the sleep
// lands in the game's measured answer time, the knob for reaching the slow
// tempo tiers, §10.6), `stopAt` / `questions` (stop early, e.g. for a mid-round
// screenshot), `stopInAid` (stop with the aid still open). `readRechnungScene()`
// and `readRechnungSummary()` are separate globals for `eval` steps.
//
// `resolveRechnung` is a plain function on `globalThis`: it is the only part
// with real logic, and tests/play-rechnungen.test.js runs it in Node against
// every question shape `questionFor()` can produce. A driver that answers the
// wrong thing proves nothing, quietly.

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Read an equation the way the child does and return the number that fills its
  // "?". Handles all shapes §12 can print: plain binary, a left-to-right ± chain,
  // and a gap where one operand is the unknown. The operators come off the
  // screen, so both division signs (":" German, "÷" English) and the real minus
  // "−" are accepted.
  function resolveRechnung(text) {
    const [lhs, rhs] = String(text).split("=").map((s) => s.trim());
    if (rhs === undefined) throw new Error(`not an equation: "${text}"`);
    const tok = lhs.split(/\s+/);
    const apply = (x, op, y) => {
      if (op === "+") return x + y;
      if (op === "−" || op === "-") return x - y;
      if (op === "×" || op === "x" || op === "*") return x * y;
      if (op === ":" || op === "÷" || op === "/") return x / y;
      throw new Error(`unknown operator "${op}" in "${text}"`);
    };
    if (rhs === "?") {
      let acc = Number(tok[0]);
      for (let i = 1; i < tok.length; i += 2) acc = apply(acc, tok[i], Number(tok[i + 1]));
      return acc;
    }
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

  const $ = (id) => document.getElementById(id);
  const summaryUp = () => !$("sum-overlay").hidden;
  const aidUp = () => !$("feedback").hidden;

  globalThis.readRechnungScene = () => ({
    stars: document.querySelectorAll(".j-star.landed").length,
    aria: $("journey")?.getAttribute("aria-label") ?? null,
    foxAtNode: [...document.querySelectorAll(".j-node.done")].length,
  });

  globalThis.readRechnungSummary = () => ({
    stars: $("sum-stars").textContent.trim(),
    score: $("sum-score").textContent.trim(),
    goal: $("sum-goal").hidden ? null : $("sum-goal").textContent.trim(),
    tempo: $("sum-tempo").hidden ? null : $("sum-tempo").textContent.trim(),
    trophies: [...document.querySelectorAll("#sum-trophy .won")].map((w) => w.textContent.trim()),
  });

  // A new question announces itself on the stamp the game writes for exactly
  // this purpose (rechnungen.js: renderQuestion) — text alone cannot be trusted,
  // because a re-queued skill asks a fresh question that may read the same.
  async function nextQuestion(lastStamp) {
    for (let i = 0; i < 150; i++) {
      if (summaryUp()) return null;
      const q = $("question");
      if (!q.hidden && q.dataset.q !== lastStamp && q.textContent.includes("?")) {
        return { text: q.textContent.trim(), stamp: q.dataset.q };
      }
      await sleep(40);
    }
    throw new Error("the question never came");
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

  // Play a round. `wrongAt` is a question number (1-based) or a list; a wrong
  // answer is the right one plus one, which is never right. Returns a trace, and
  // throws rather than returning a half-played round.
  globalThis.playRechnung = async ({
    questions = Infinity, wrongAt = [], stopAt = null, delayMs = 0, stopInAid = false,
  } = {}) => {
    const wrong = new Set(Array.isArray(wrongAt) ? wrongAt : [wrongAt]);
    const pause = Number.isFinite(delayMs) && delayMs > 0 ? Math.round(delayMs) : 0;
    const trace = [];
    // a round is at most ~25 answers (10 drawn + requeues + phantom margin)
    const deadline = Date.now() + 60000 + pause * 25;
    let n = 0;
    let stamp = "";

    // The game opens on the level picker; dismissing it starts a round on the
    // tile the fox stands on — the cookie's own level.
    if (!$("pick-overlay").hidden) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(160);
    }

    // Every wait after an answer must outlive the game's post-correct
    // transition (NEXT_MS = 250ms), or the driver re-reads the same question.
    const SETTLE = 350;

    while (!summaryUp() && n < questions && Date.now() < deadline) {
      const q = await nextQuestion(stamp);
      if (q === null) break;
      stamp = q.stamp;
      const want = resolveRechnung(q.text);
      if (!Number.isInteger(want) || want < 0) throw new Error(`cannot solve "${q.text}" → ${want}`);
      n += 1;

      if (pause) await sleep(pause); // "think" — counted by the tempo clock
      const wrongNow = wrong.has(n);
      await answer(wrongNow ? want + 1 : want);
      await sleep(SETTLE);

      if (aidUp()) {
        trace.push({ q: n, text: q.text, gave: want + 1, aid: true, ...readRechnungScene() });
        if (stopInAid && stopAt !== null && n >= stopAt) break;
        // The way out of the aid is entering the right answer.
        await answer(want);
        await sleep(SETTLE);
      } else {
        trace.push({ q: n, text: q.text, gave: want, ...readRechnungScene() });
      }
      if (stopAt !== null && n >= stopAt) break;
    }

    if (Date.now() >= deadline) throw new Error(`gave up after ${n} questions`);
    return { answered: n, wrongGiven: [...wrong].filter((w) => w <= n), trace, scene: readRechnungScene() };
  };
})();
