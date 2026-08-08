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
// `chooseAll(end)` is the short form of `playDrachen({ toEnding: end })`, and
// `readDrachenScene()` / `readDrachenSummary()` are separate globals for `eval`
// steps.
//
// `drachenMaps`, `resolveDrachen` and `chooseFor` are plain functions on
// `globalThis`: they are the only part with real logic, and
// tests/play-drachen.test.js runs them in Node against every node of every
// story. A driver that clicks the wrong thing proves nothing, quietly.

(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Scene text → the story it belongs to and the node it is. Scene texts are
  // unique game-wide (tests/drachen-content.test.js pins it), which is what
  // makes reading the page enough to know where the driver stands.
  function drachenMaps(stories) {
    const byText = new Map();
    const byKey = new Map();
    for (const story of stories) {
      byKey.set(story.key, story);
      for (const node of story.nodes) byText.set(node.t.trim(), { storyKey: story.key, nodeId: node.id });
    }
    return { byText, byKey };
  }
  globalThis.drachenMaps = drachenMaps;

  function resolveDrachen(text, maps) {
    const hit = maps.byText.get(String(text).trim());
    if (!hit) throw new Error(`not in the content: "${String(text).slice(0, 40)}…"`);
    const story = maps.byKey.get(hit.storyKey);
    return { story, node: story.nodes.find((n) => n.id === hit.nodeId) };
  }
  globalThis.resolveDrachen = resolveDrachen;

  // Which choice still leads to `end` from this node — the first step of
  // logic.js' pathToEnding, re-derived here because the driver may not import
  // the game's modules. Returns null on an ending node, throws when the ending
  // is out of reach (which the content test proves can never happen before the
  // last choice).
  function chooseFor(node, story, end) {
    if (Number.isInteger(node.end)) return null;
    const reaches = (id, seen = new Set()) => {
      if (seen.has(id)) return false;
      seen.add(id);
      const n = story.nodes.find((x) => x.id === id);
      if (!n) return false;
      if (Number.isInteger(n.end)) return n.end === end;
      return (n.c ?? []).some((c) => reaches(c.to, seen));
    };
    const i = (node.c ?? []).findIndex((c) => reaches(c.to));
    if (i === -1) throw new Error(`ending ${end} is unreachable from ${story.key}/${node.id}`);
    return i;
  }
  globalThis.chooseFor = chooseFor;

  let maps = null;
  async function ensureMaps() {
    // Absolute URL, so the import map does not apply: the module loads
    // unversioned, which is fine locally — it is data, loaded twice at worst.
    maps ??= drachenMaps((await import(new URL("content.js", location.href).href)).STORIES.de);
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
    const m = await ensureMaps();
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

      const i = picks ? picks[Math.min(n, picks.length - 1)] : chooseFor(node, story, toEnding);
      const btn = document.querySelector(`#answers button[data-choice="${i}"]`);
      if (!btn) throw new Error(`no choice ${i} on ${story.key}/${node.id}`);
      btn.click();
      n += 1;
      await sleep(SETTLE);
    }

    // wait out the summary's own settle timer, so a screenshot after this call
    // finds the sheet open rather than half-way there
    for (let i = 0; i < 60 && !summaryUp(); i++) await sleep(40);
    if (!summaryUp() && !stopAtEnding) throw new Error("the summary never opened");
    trace.push({ step: n, summary: readDrachenSummary() });
    return trace;
  };

  globalThis.chooseAll = (end) => playDrachen({ toEnding: end });
})();
