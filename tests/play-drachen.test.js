// tools/play-drachen.js is a browser script, so it cannot be imported. Its real
// logic — the scene-text index and the resolver that reads a scene off the page
// — sits on `globalThis`, and this test runs it in Node against every scene of
// every story. A driver that clicks the wrong thing proves nothing, quietly
// (see tests/play.test.js).
//
// The steering is NOT tested here, because the driver no longer owns one: it
// imports the game's own `pathToEnding` at run time, which tests/drachen.test.js
// already proves lands on the ending it was asked for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { STORIES } from "../games/drachen/content.js";

const src = readFileSync(fileURLToPath(new URL("../tools/play-drachen.js", import.meta.url)), "utf8");

// Loading it must not touch the DOM: it defines functions and returns.
const sandbox = { document: undefined, window: undefined };
new Function("globalThis", `with (this) { ${src} }`).call(sandbox, sandbox);
const { resolveDrachen, drachenMaps } = sandbox;

test("play-drachen.js loads without a DOM and exposes its resolver", () => {
  assert.equal(typeof resolveDrachen, "function");
  assert.equal(typeof drachenMaps, "function");
  assert.equal(typeof sandbox.playDrachen, "function");
  assert.equal(typeof sandbox.readDrachenScene, "function");
  // …and it steers with the game's own logic rather than a second copy of it
  assert.match(src, /import\(new URL\("logic\.js", location\.href\)\.href\)/);
  assert.match(src, /logic\.pathToEnding\(/);
});

test("the driver resolves every scene the game can show", () => {
  const maps = drachenMaps(STORIES.de);
  for (const story of STORIES.de) {
    for (const node of story.nodes) {
      // the page hands it trimmed text and nothing else — exactly what
      // #question holds
      const res = resolveDrachen(` ${node.t} `, maps);
      assert.equal(res.story.key, story.key, `${story.key}/${node.id}`);
      assert.equal(res.node.id, node.id, `${story.key}/${node.id}`);
    }
  }
});

test("the resolver throws on text that is not in the content", () => {
  const maps = drachenMaps(STORIES.de);
  assert.throws(() => resolveDrachen("Ein Satz aus einer anderen Geschichte.", maps), /not in the content/);
});
