// Browser-side round driver for games/lesen. Loaded into the page by
// tools/shoot.mjs, which cannot import modules — so this file defines globals
// and exports nothing. The sibling of tools/play.js, with the same contract.
//
//   node tools/shoot.mjs http://localhost:8000/games/lesen/ \
//     --do 'eval @tools/play-lesen.js' \
//     --do 'eval playLesen({ wrongAt: 1 })' \
//     --do 'until #sum-overlay'
//
// playLesen() escapes the level picker the game opens on and runs until the
// round's summary is up. Options: `wrongAt` (question number or list —
// answered wrongly first), `delayMs` (think that long before every answer —
// the sleep sits AFTER the reveal tap, so it counts on the game's tempo clock
// (§14.4): this is how the slow tempo tiers are reached in a driven round and
// the knob for calibrating lesen's `TEMPO_TIERS`), `stopAt` / `questions`
// (stop early, e.g. for a mid-round screenshot), `stopInAid` (stop with the
// aid still open — for screenshotting it), `waitHidden` (answer a word only
// after the blitz has hidden it — the reduced-motion proof, §14.2; the wait
// counts on the tempo clock too, which is right: answering after the hide IS
// slow). `readLesenScene()` and `readLesenSummary()` are separate globals for
// `eval` steps.
//
// `resolveLesen` and `lesenMaps` are plain functions on `globalThis`: they are
// the only part with real logic, and tests/play-lesen.test.js runs them in
// Node against every question shape `questionFor()` can produce. A driver
// that answers the wrong thing proves nothing.

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The answer key, straight from the content: a Leicht word answers with its
  // emoji; a Mittel Stimmt/Quatsch sentence with its verdict (true for the `ok`
  // face, false for the `no` face — either can be shown per encounter); a Schwer
  // passage's question with the correct answer (the first of its four, before
  // optionsFor shuffles them).
  function lesenMaps(content) {
    const words = {};
    const sents = {};
    const reads = {};
    for (const pack of content.packs) {
      for (const it of pack.items) {
        if (it.w !== undefined) words[it.w] = it.e;
        else if (it.ok !== undefined) { sents[it.ok] = true; sents[it.no] = false; }
        else if (it.text !== undefined) reads[it.q] = it.a[0];
      }
    }
    return { words, sents, reads };
  }
  globalThis.lesenMaps = lesenMaps;

  function resolveLesen(text, maps) {
    const q = String(text).trim();
    if (q in maps.words) return { kind: "word", answer: maps.words[q] };
    if (q in maps.sents) return { kind: "sent", answer: maps.sents[q] };
    if (q in maps.reads) return { kind: "read", answer: maps.reads[q] };
    throw new Error(`not in the content: "${q}"`);
  }
  globalThis.resolveLesen = resolveLesen;

  let maps = null;
  async function ensureMaps() {
    // Absolute URL, so the import map does not apply: the module loads
    // unversioned, which is fine locally — it is data, loaded twice at worst.
    maps ??= lesenMaps((await import(new URL("content.js", location.href).href)).CONTENT.de);
    return maps;
  }

  const $ = (id) => document.getElementById(id);
  const summaryUp = () => !$("sum-overlay").hidden;
  const aidUp = () => !$("feedback").hidden;
  const card = () => $("wordcard");
  const hidden = () => card().classList.contains("wc-hidden");
  const covered = () => card().classList.contains("covered");

  globalThis.readLesenScene = () => ({
    // ready = a word waits behind the "ready" cover, not yet revealed (§14.2);
    // away = the aid owns the stage; hidden = the blitz took the word
    card: card().hidden ? "away" : covered() ? "ready" : hidden() ? "hidden" : "faceUp",
    kind: card().classList.contains("read") ? "read"
      : card().classList.contains("sent") ? "sent" : "word",
    stars: document.querySelectorAll(".j-star.landed").length,
    aria: $("journey")?.getAttribute("aria-label") ?? null,
    foxAtNode: [...document.querySelectorAll(".j-node.done")].length,
  });

  globalThis.readLesenSummary = () => ({
    // the summary shows star GROUPS now (§10.1): gold slots owned, fresh ones
    // just won, ghosts still open — there is no numeric score line any more
    stars: document.querySelectorAll("#sum-stars .sslot.owned").length,
    fresh: document.querySelectorAll("#sum-stars .sslot.fresh").length,
    openSlots: document.querySelectorAll("#sum-stars .sslot.j-ghost").length,
    goal: $("sum-goal").hidden ? null : $("sum-goal").textContent.trim(),
    trophies: [...document.querySelectorAll("#sum-trophy .won")].map((w) => w.textContent.trim()),
  });

  // A new question announces itself on the stamp the game writes for exactly
  // this purpose (lesen.js: renderQuestion) — text alone cannot be trusted,
  // because a re-queued item asks the same text twice in one round.
  async function nextQuestion(lastStamp) {
    for (let i = 0; i < 150; i++) {
      if (summaryUp()) return null;
      const q = $("question");
      if (!card().hidden && q.dataset.q !== lastStamp && q.textContent !== "") {
        return { text: q.textContent.trim(), stamp: q.dataset.q };
      }
      await sleep(40);
    }
    throw new Error("the question never came");
  }

  const buttons = () => [...document.querySelectorAll("#answers button")];

  function buttonFor(want) {
    return buttons().find((b) => b.textContent.trim() === want);
  }

  // A Stimmt/Quatsch verdict is a boolean, not a label: the true verdict is the
  // .v-yes button, the false one .v-no (§14.1). The button to click for a given
  // verdict, and for any kind: a word/passage clicks the option by its text.
  const verdictButton = (val) => document.querySelector(val ? ".verdict .v-yes" : ".verdict .v-no");
  const answerButton = (res, val) => (res.kind === "sent" ? verdictButton(val) : buttonFor(val));

  // Something that is never the answer. For a word or a passage: any other of the
  // four choices on screen. For a sentence: the opposite verdict.
  function wrongFor(res) {
    if (res.kind === "sent") return !res.answer;
    const b = buttons().find((btn) => btn.textContent.trim() !== res.answer);
    if (!b) throw new Error("four options and no wrong one?");
    return b.textContent.trim();
  }

  // Play a round. Returns a trace, and throws rather than returning a
  // half-played round: a driver that quietly stopped early must not look like
  // one that finished.
  globalThis.playLesen = async ({
    questions = Infinity, wrongAt = [], stopAt = null, delayMs = 0, waitHidden = false,
    stopInAid = false,
  } = {}) => {
    const m = await ensureMaps();
    const wrong = new Set(Array.isArray(wrongAt) ? wrongAt : [wrongAt]);
    const pause = Number.isFinite(delayMs) && delayMs > 0 ? Math.round(delayMs) : 0;
    const trace = [];
    // a round is at most ~15 answers (6 drawn + requeues), plus the flash waits
    const deadline = Date.now() + 60000 + pause * 15;
    let n = 0;
    let stamp = "";

    // The game opens on the level picker; dismissing it starts a round on the
    // tile the fox stands on — the cookie's own level.
    if (!$("pick-overlay").hidden) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(160);
    }

    // Every wait after an answer must outlive the game's post-correct
    // transition (NEXT_MS = 250ms), or the driver re-reads the same question —
    // the SETTLE trap play.js documents at length.
    const SETTLE = 350;

    while (!summaryUp() && n < questions && Date.now() < deadline) {
      const q = await nextQuestion(stamp);
      if (q === null) break;
      stamp = q.stamp;
      const res = resolveLesen(q.text, m);
      n += 1;

      // A word now waits behind the "ready" cover (§14.2): tap to reveal it —
      // and to make the answer buttons live — before the blitz, exactly as the
      // child does. A reading passage never covers.
      if (res.kind === "word" && covered()) {
        $("wc-cover").click();
        for (let i = 0; i < 50 && covered(); i++) await sleep(20);
        if (covered()) throw new Error("the word never revealed");
      }

      if (waitHidden && res.kind === "word") {
        // the reduced-motion proof: the blitz must still take the word away
        for (let i = 0; i < 200 && !hidden(); i++) await sleep(40);
        if (!hidden()) throw new Error("the word never hid");
      }
      if (pause) await sleep(pause);

      const wrongNow = wrong.has(n);
      const give = wrongNow ? wrongFor(res) : res.answer;
      const btn = answerButton(res, give);
      if (!btn) throw new Error(`no button for ${String(give)}`);
      btn.click();
      await sleep(SETTLE);

      if (aidUp()) {
        trace.push({ q: n, text: q.text, kind: res.kind, gave: give, aid: true, ...readLesenScene() });
        if (stopInAid && stopAt !== null && n >= stopAt) break;
        // The way out of the aid is the right answer, on the same buttons.
        answerButton(res, res.answer).click();
        await sleep(SETTLE);
      } else if (wrongNow && res.kind === "read") {
        // Schwer never opens the aid (§14.2): a wrong reading tile is retired in
        // place and the passage stays up, so the way on is to pick the right
        // answer on the same four buttons — exactly as the child does.
        trace.push({ q: n, text: q.text, kind: res.kind, gave: give, retry: true, ...readLesenScene() });
        answerButton(res, res.answer).click();
        await sleep(SETTLE);
      } else {
        trace.push({ q: n, text: q.text, kind: res.kind, gave: give, ...readLesenScene() });
      }
      if (stopAt !== null && n >= stopAt) break;
    }

    if (Date.now() >= deadline) throw new Error(`gave up after ${n} questions`);
    return { answered: n, wrongGiven: [...wrong].filter((w) => w <= n), trace, scene: readLesenScene() };
  };
})();
