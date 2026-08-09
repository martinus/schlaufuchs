// Browser-side story driver for games/drachen. Loaded into the page by
// tools/shoot.mjs, which cannot import modules — so this file defines globals
// and exports nothing. The sibling of tools/play.js and tools/play-lesen.js,
// with the same contract.
//
//   node tools/shoot.mjs http://localhost:8000/games/drachen/ \
//     --do 'eval @tools/play-drachen.js' \
//     --do 'eval playDrachen({ toEnding: 1 })' \
//     --do 'until #endname'
//
// playDrachen() escapes the level picker the game opens on and reads a story to
// an ending. Options: `toEnding` (0, 1 or 2 — steer every choice toward that
// ending, the way a child hunting the last one does), `pick` (a choice index,
// or a list of them, used instead of `toEnding`), `delayMs` (read that long
// before every choice), `stopAt` (stop after that many choices, e.g. for a
// mid-story screenshot), `stopAtEnding` (stop on the ending scene rather than
// pressing "Weiter" — the ending text and its name are the shot worth taking).
// `readDrachenScene()` and `readDrachenSummary()` are separate globals for
// `eval` steps.
//
// The steering comes from the game's own `logic.js`, imported at run time
// beside `content.js`; only the page-reading half lives here. `drachenMaps` and
// `resolveDrachen` are plain functions on `globalThis` so
// tests/play-drachen.test.js can run them in Node against every scene of every
// story. A driver that clicks the wrong thing proves nothing, quietly.

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Scene text → the story it belongs to and the node it is. Scene texts are
  // unique game-wide (tests/drachen-content.test.js pins it), which is what
  // makes reading the page enough to know where the driver stands.
  function drachenMaps(stories) {
    const byText = new Map();
    for (const story of stories) {
      for (const node of story.nodes) byText.set(node.t.trim(), { story, node });
    }
    return byText;
  }
  globalThis.drachenMaps = drachenMaps;

  function resolveDrachen(text, maps) {
    const hit = maps.get(String(text).trim());
    if (!hit) throw new Error(`not in the content: "${String(text).slice(0, 40)}…"`);
    return hit;
  }
  globalThis.resolveDrachen = resolveDrachen;

  let maps = null;
  let logic = null;
  async function ensureLoaded() {
    // Absolute URLs, so the import map does not apply: the modules load
    // unversioned, which is fine locally — loaded twice at worst. The steering
    // is the game's OWN pathToEnding, not a second copy of it: a driver that
    // walks a different graph than the page proves nothing.
    if (!maps) {
      const [content, mod] = await Promise.all([
        import(new URL("content.js", location.href).href),
        import(new URL("logic.js", location.href).href),
      ]);
      maps = drachenMaps(content.STORIES.de);
      logic = mod;
    }
    return maps;
  }

  const $ = (id) => document.getElementById(id);
  const summaryUp = () => !$("sum-overlay").hidden;
  const onEnding = () => !$("endname").hidden;

  globalThis.readDrachenScene = () => ({
    node: $("question").dataset.node ?? null,
    text: $("question").textContent.trim(),
    scene: $("scene").textContent,
    // ending = the story is over and its name is on the card; choice = she is
    // still deciding
    kind: onEnding() ? "ending" : "choice",
    endingName: onEnding() ? $("endname").querySelector(".en-n")?.textContent ?? null : null,
    fresh: onEnding() ? $("endname").classList.contains("fresh") : null,
    choices: [...document.querySelectorAll("#answers button")].map((b) => b.textContent.trim()),
    stars: document.querySelectorAll(".j-star.landed").length,
    foxAtNode: document.querySelectorAll(".j-node.done").length,
    picker: !$("pick-overlay").hidden,
  });

  globalThis.readDrachenSummary = () => ({
    // the summary shows star GROUPS (§10.1): gold slots owned, fresh ones just
    // won, ghosts still open — there is no numeric score line
    stars: document.querySelectorAll("#sum-stars .sslot.owned").length,
    fresh: document.querySelectorAll("#sum-stars .sslot.fresh").length,
    openSlots: document.querySelectorAll("#sum-stars .sslot.j-ghost").length,
    head: $("sum-endings")?.querySelector(".end-head")?.textContent ?? null,
    endings: [...document.querySelectorAll("#sum-endings .end")].map((li) => ({
      name: li.querySelector(".end-n").textContent,
      found: li.classList.contains("found"),
      fresh: li.classList.contains("fresh"),
    })),
    trophies: [...document.querySelectorAll("#sum-trophy .won")].map((w) => w.textContent.trim()),
  });

  // A new scene announces itself on the stamp the game writes for exactly this
  // purpose (drachen.js: renderScene). Text alone would do here — scene texts
  // are unique — but the stamp is what tells a re-render from a new scene.
  async function nextScene(lastStamp) {
    for (let i = 0; i < 150; i++) {
      if (summaryUp()) return null;
      const q = $("question");
      if (q.dataset.q !== lastStamp && q.textContent !== "") {
        return { text: q.textContent.trim(), stamp: q.dataset.q };
      }
      await sleep(40);
    }
    throw new Error("the scene never came");
  }

  // Read a story to an ending. Returns a trace, and throws rather than
  // returning half a story: a driver that quietly stopped early must not look
  // like one that finished.
  globalThis.playDrachen = async ({
    toEnding = 0, pick = null, delayMs = 0, stopAt = null, stopAtEnding = false,
  } = {}) => {
    const m = await ensureLoaded();
    const picks = pick === null ? null : (Array.isArray(pick) ? pick : [pick]);
    const pause = Number.isFinite(delayMs) && delayMs > 0 ? Math.round(delayMs) : 0;
    const trace = [];
    // the longest story is seven scenes; the deadline only has to outlast the
    // reading pauses
    const deadline = Date.now() + 40000 + pause * 10;
    let n = 0;
    let stamp = "";

    // The game opens on the level picker; dismissing it starts the story the
    // fox stands on — the cookie's own story.
    if (!$("pick-overlay").hidden) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(160);
    }

    // Every wait after a choice must outlive the game's own transitions, or the
    // driver re-reads the scene it just left — the SETTLE trap play.js
    // documents at length.
    const SETTLE = 350;

    while (!summaryUp() && Date.now() < deadline) {
      const s = await nextScene(stamp);
      if (s === null) break;
      stamp = s.stamp;
      const { story, node } = resolveDrachen(s.text, m);
      trace.push({ step: n, story: story.key, node: node.id, ...readDrachenScene() });

      if (Number.isInteger(node.end)) {
        if (stopAtEnding) return trace;
        // the ending's own button: one press, and the summary follows
        document.querySelector("#answers button").click();
        await sleep(SETTLE);
        break;
      }

      if (stopAt !== null && n >= stopAt) return trace;
      if (pause) await sleep(pause);

      const i = picks
        ? picks[Math.min(n, picks.length - 1)]
        : logic.pathToEnding(story, node.id, toEnding)?.[0];
      const btn = i == null ? null : document.querySelector(`#answers button[data-choice="${i}"]`);
      if (!btn) throw new Error(`no choice toward ending ${toEnding} on ${story.key}/${node.id}`);
      btn.click();
      n += 1;
      await sleep(SETTLE);
    }

    // wait out the summary's own settle timer, so a screenshot after this call
    // finds the sheet open rather than half-way there
    // `stopAtEnding` has already returned above, so reaching here without a
    // summary means the deadline expired — a run that stopped early must not
    // come back looking like one that finished.
    for (let i = 0; i < 60 && !summaryUp(); i++) await sleep(40);
    if (!summaryUp()) throw new Error("the summary never opened");
    trace.push({ step: n, summary: readDrachenSummary() });
    return trace;
  };
})();
