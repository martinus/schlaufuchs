// Browser-side round driver for games/einmaleins. Loaded into the page by
// tools/shoot.mjs, which cannot import modules — so this file defines globals
// and exports nothing.
//
//   node tools/shoot.mjs http://localhost:8000/games/einmaleins/ \
//     --do 'eval @tools/play.js' \
//     --do 'eval play({ wrongAt: 1 })' \
//     --do 'until #sum-overlay'
//
// play() escapes the level picker the game opens on and runs until the round's
// summary is up. Options: `wrongAt` (question number or list — answered
// wrongly first), `delayMs` (think that long before every answer, inside the
// game's tempo clock — the knob for reaching the slow tempo tiers, §10.6),
// `stopAt` / `questions` (stop early, e.g. for a mid-round screenshot).
// `readScene()` and `readSummary()` are separate globals for `eval` steps.
//
// It exists because this round has now been driven from scratch in four
// separate sessions, each time thrown away with the scratchpad. Every
// verification of the scene, the basket, the aid card and the summary starts
// here.
//
// `solveQuestion` is deliberately a plain function on `globalThis`: it is the
// only part with real logic, and tests/play.test.js runs it in Node against
// every question shape `questionFor()` can produce. A driver that silently
// answers the wrong thing proves nothing.

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // "a × b = ?" | "? × b = c" | "a × ? = c" | "c ÷ b = ?"  →  the missing number
  // The division sign depends on the language: ":" in German, "÷" in English.
  const DIV = [":", "÷"];
  function solveQuestion(text) {
    const [lhs, rhs] = String(text).split("=").map((s) => s.trim());
    if (rhs === undefined) throw new Error(`not an equation: "${text}"`);
    if (rhs === "?") {
      const [a, op, b] = lhs.split(/\s+/);
      if (op !== "×" && !DIV.includes(op)) throw new Error(`unknown operator in "${text}"`);
      return DIV.includes(op) ? Number(a) / Number(b) : Number(a) * Number(b);
    }
    const [a, , b] = lhs.split(/\s+/);
    return a === "?" ? Number(rhs) / Number(b) : Number(rhs) / Number(a);
  }
  globalThis.solveQuestion = solveQuestion;

  const $ = (id) => document.getElementById(id);
  const summaryUp = () => !$("sum-overlay").hidden;
  const aidUp = () => !$("feedback").hidden;

  // Read the round's scene: what is in the basket, what still hangs in the sky.
  globalThis.readScene = () => ({
    basket: [...document.querySelectorAll(".j-star")].map((s) => s.classList.contains("landed")),
    stars: document.querySelectorAll(".j-star.landed").length,
    aria: $("journey")?.getAttribute("aria-label") ?? null,
    foxAtNode: [...document.querySelectorAll(".j-node.done")].length,
  });

  globalThis.readSummary = () => ({
    // the summary shows star GROUPS now (§10.1): gold slots owned, fresh ones
    // just won, ghosts still open — there is no numeric score line any more
    stars: document.querySelectorAll("#sum-stars .sslot.owned").length,
    fresh: document.querySelectorAll("#sum-stars .sslot.fresh").length,
    openSlots: document.querySelectorAll("#sum-stars .sslot.j-ghost").length,
    goal: $("sum-goal").hidden ? null : $("sum-goal").textContent.trim(),
    trophies: [...document.querySelectorAll("#sum-trophy .won")].map((w) => w.textContent.trim()),
  });

  // The gap span holds the digits typed so far, so a question is only ready to
  // read once it is back to "?". Otherwise the driver solves its own last answer.
  async function nextQuestion() {
    for (let i = 0; i < 120; i++) {
      if (summaryUp()) return null;
      const q = $("question");
      if (!q.hidden && q.textContent.includes("?")) return q.textContent.trim();
      await sleep(40);
    }
    throw new Error("the question never came back");
  }

  const keypadKey = (label) =>
    [...document.querySelectorAll("#answers button")].find((b) => b.textContent.trim() === label);

  async function answer(value) {
    if (keypadKey("OK")) {
      for (const ch of String(value)) {
        const k = keypadKey(ch);
        if (!k) throw new Error(`no keypad key "${ch}"`);
        k.click();
        await sleep(15);
      }
      keypadKey("OK").click();
      return;
    }
    // Leicht: multiple choice
    const btns = [...document.querySelectorAll("#answers button")];
    const pick = btns.find((b) => Number(b.textContent) === value);
    if (!pick) throw new Error(`no choice button for ${value}`);
    pick.click();
  }

  // Play a round. `wrongAt` is a question number (1-based) or a list of them;
  // a wrong answer is the right one plus one, which is never right.
  //
  // Returns a trace, and throws rather than returning a half-played round:
  // a driver that quietly stopped early must not look like one that finished.
  // `delayMs` paces the driver: it thinks that long over every question before
  // answering, which lands in the game's measured answer time — the knob that
  // makes the tempo ladder's slow tiers (§10.6) reachable in a driven round.
  // The deadline grows with it, or a deliberately slow round would look hung.
  globalThis.play = async ({ questions = Infinity, wrongAt = [], stopAt = null, delayMs = 0 } = {}) => {
    const wrong = new Set(Array.isArray(wrongAt) ? wrongAt : [wrongAt]);
    const pause = Number.isFinite(delayMs) && delayMs > 0 ? Math.round(delayMs) : 0;
    const trace = [];
    // a round is at most ~25 answers (12 drawn + requeues + phantom margin)
    const deadline = Date.now() + 60000 + pause * 25;
    let n = 0;

    // The game opens on the level picker (§10.1), and no question exists while
    // it is up. Dismissing it starts a round on the tile the fox stands on —
    // the cookie's own level — so leave it the way a child in a hurry does.
    if (!$("pick-overlay").hidden) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(160);
    }

    // Every wait after an answer must outlive the game's post-correct
    // transition (NEXT_MS = 250ms). On Leicht the gap keeps showing "?" while
    // that transition runs, so a shorter sleep re-read the SAME question,
    // "answered" it into the correct-wait phase — where clicks are swallowed —
    // and logged every question twice. A wrongAt landing on such a phantom
    // read was swallowed with it, and the round it meant to disturb ran clean.
    const SETTLE = 350;

    while (!summaryUp() && n < questions && Date.now() < deadline) {
      const text = await nextQuestion();
      if (text === null) break;
      const want = solveQuestion(text);
      if (!Number.isInteger(want) || want <= 0) throw new Error(`cannot solve "${text}" → ${want}`);

      n += 1;
      const wrongNow = wrong.has(n);
      if (pause) await sleep(pause); // "think" — counted by the tempo clock
      await answer(wrongNow ? want + 1 : want);
      await sleep(SETTLE);

      if (aidUp()) {
        trace.push({ q: n, text, gave: want + 1, aid: true, ...readScene() });
        // The aid has no button any more: the way out is entering the right
        // answer. On Leicht that is a tap on the correct choice; on the keypad
        // the answer completes itself at the last digit, and `answer()`'s
        // trailing OK click lands in `correct-wait`, where OK does nothing.
        await answer(want);
        await sleep(SETTLE);
      } else {
        trace.push({ q: n, text, gave: want, ...readScene() });
      }
      if (stopAt !== null && n >= stopAt) break;
    }

    if (Date.now() >= deadline) throw new Error(`gave up after ${n} questions`);
    return { answered: n, wrongGiven: [...wrong].filter((w) => w <= n), trace, scene: readScene() };
  };
})();
