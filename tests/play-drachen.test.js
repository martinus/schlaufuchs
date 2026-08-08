// tools/play-drachen.js is a browser script, so it cannot be imported. Its real
// logic — the scene-text index, the resolver that reads a scene off the page,
// and the steering that picks the choice still leading to a wanted ending —
// sits on `globalThis`, and this test runs it in Node against every node of
// every story. A driver that clicks the wrong thing proves nothing, quietly
// (see tests/play.test.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { STORIES } from "../games/drachen/content.js";
import { isEnding, pathToEnding, startNode, nodeById } from "../games/drachen/logic.js";

const src = readFileSync(fileURLToPath(new URL("../tools/play-drachen.js", import.meta.url)), "utf8");

// Loading it must not touch the DOM: it defines functions and returns.
const sandbox = { document: undefined, window: undefined };
new Function("globalThis", `with (this) { ${src} }`).call(sandbox, sandbox);
const { resolveDrachen, drachenMaps, chooseFor } = sandbox;

test("play-drachen.js loads without a DOM and exposes its resolver", () => {
  assert.equal(typeof resolveDrachen, "function");
  assert.equal(typeof drachenMaps, "function");
  assert.equal(typeof chooseFor, "function");
  assert.equal(typeof sandbox.playDrachen, "function");
  assert.equal(typeof sandbox.chooseAll, "function");
  assert.equal(typeof sandbox.readDrachenScene, "function");
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

// The steering is the whole point of the driver: `--do 'eval chooseAll(2)'`
// must actually arrive at ending 2, from every story, every time. Walking it
// step by step here is the only way to know that before a browser run.
test("steering to an ending arrives at that ending, from every story", () => {
  for (const story of STORIES.de) {
    for (const end of [0, 1, 2]) {
      let node = startNode(story);
      const walked = [node.id];
      for (let step = 0; step < story.depth; step++) {
        const i = chooseFor(node, story, end);
        if (i === null) break;
        node = nodeById(story, node.c[i].to);
        walked.push(node.id);
      }
      assert.ok(isEnding(node), `${story.key}→${end}: stopped on ${node.id}`);
      assert.equal(node.end, end, `${story.key}: steering to ${end} landed on ${node.end}`);
      assert.equal(walked.length, story.depth, `${story.key}→${end}: ${walked.length} scenes`);
    }
  }
});

// The driver re-derives the first step of pathToEnding rather than importing
// it (a browser script cannot import the game's modules), so the two must not
// drift apart.
test("the driver's steering agrees with logic.js' pathToEnding", () => {
  for (const story of STORIES.de) {
    for (const node of story.nodes) {
      for (const end of [0, 1, 2]) {
        // An ending is where the walk stops, whichever ending was wanted.
        if (isEnding(node)) {
          assert.equal(chooseFor(node, story, end), null, `${story.key}/${node.id}→${end}`);
          continue;
        }
        const path = pathToEnding(story, node.id, end);
        if (path === null) {
          assert.throws(() => chooseFor(node, story, end), /unreachable/,
            `${story.key}/${node.id}→${end}`);
          continue;
        }
        assert.equal(chooseFor(node, story, end), path[0] ?? null,
          `${story.key}/${node.id}→${end}`);
      }
    }
  }
});
