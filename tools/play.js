// Browser-side round driver for games/einmaleins. Loaded into the page by
// tools/shoot.mjs, which cannot import modules — so this file defines globals
// and exports nothing.
//
//   node tools/shoot.mjs http://localhost:8000/games/einmaleins/ \
//     --do 'eval @tools/play.js' \
//     --do 'eval play({ wrongAt: 1 })' \
//     --do 'until #sum-overlay'
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
    stars: $("sum-stars").textContent.trim(),
    score: $("sum-score").textContent.trim(),
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
  globalThis.play = async ({ questions = Infinity, wrongAt = [], stopAt = null } = {}) => {
    const wrong = new Set(Array.isArray(wrongAt) ? wrongAt : [wrongAt]);
    const trace = [];
    const deadline = Date.now() + 60000;
    let n = 0;

    while (!summaryUp() && n < questions && Date.now() < deadline) {
      const text = await nextQuestion();
      if (text === null) break;
      const want = solveQuestion(text);
      if (!Number.isInteger(want) || want <= 0) throw new Error(`cannot solve "${text}" → ${want}`);

      n += 1;
      const wrongNow = wrong.has(n);
      await answer(wrongNow ? want + 1 : want);
      await sleep(160);

      if (aidUp()) {
        trace.push({ q: n, text, gave: want + 1, aid: true, ...readScene() });
        // The aid has no button any more: the way out is entering the right
        // answer. On Leicht that is a tap on the correct choice; on the keypad
        // the answer completes itself at the last digit, and `answer()`'s
        // trailing OK click lands in `correct-wait`, where OK does nothing.
        await answer(want);
        await sleep(160);
      } else {
        trace.push({ q: n, text, gave: want, ...readScene() });
      }
      if (stopAt !== null && n >= stopAt) break;
    }

    if (Date.now() >= deadline) throw new Error(`gave up after ${n} questions`);
    return { answered: n, wrongGiven: [...wrong].filter((w) => w <= n), trace, scene: readScene() };
  };
})();
