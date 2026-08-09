// The authoring rules for games/drachen/content.js, machine-checked (§21).
// Everything in here is a rule a human would otherwise have to hold in their
// head across nine stories and 135 scenes — the shape that makes the round's
// path drawable, the reachability that keeps a child from locking herself out
// of the ending she is hunting, and the reading ladder that is also the layout
// guarantee (a scene that does not fit 360×640 pushes its own choices off the
// screen, and this site does not scroll).
//
// The rules a machine CANNOT check — funny not frightening, two lovely endings
// and one mishap, endings tellable apart by name, choices that are actions —
// live in the header of content.js, where the next author will read them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { STORIES } from "../games/drachen/content.js";
import {
  STORY_TILES, END_SLOTS, storiesFor, layersOf, isEnding, startNode,
  endingsReachable, pathToEnding, nodeById,
} from "../games/drachen/logic.js";

const CONTENT = STORIES.de;

// Per difficulty. The character caps are the layout guarantee AND the reading
// ladder: on the 360×640 baseline the story card has room for roughly this much
// prose above two or three choice tiles and the round's scene.
const DEPTH = [7, 9, 11];
const TEXT = [200, 260, 320];
// An ending scene has room a choice scene does not: the path steps back to 13vh
// there (§21.3) and there is one button under it instead of three tiles. It is
// also the payoff, and cutting the payoff to fit a choice screen's budget is the
// wrong trade. Measured against the longest ending at 360×640.
const END_TEXT = [260, 300, 340];
const SENT = [85, 120, 150];
const WORD = [14, 17, 20];

// German quotes swallow the full stop: „…berg.“ ends on the closing quote.
const sentences = (t) => t.split(/(?<=[.!?][“”]?)\s+/).filter(Boolean);
const words = (t) => t.split(/[^A-Za-zÄÖÜäöüß]+/).filter(Boolean);
const len = (s) => [...s].length;

const every = (fn) => {
  for (const story of CONTENT) for (const node of story.nodes) fn(story, node);
};

// --- shape -------------------------------------------------------------------

test("three stories per difficulty, and the tile count never moves", () => {
  assert.equal(CONTENT.length, STORY_TILES * DEPTH.length);
  for (const d of [0, 1, 2]) {
    assert.equal(storiesFor(d, CONTENT).length, STORY_TILES,
      `difficulty ${d}: MAX_POINTS.drachen is computed from this count and must not move (§21)`);
  }
});

test("keys and titles are unique, and a title fits a picker tile", () => {
  const keys = CONTENT.map((s) => s.key);
  const titles = CONTENT.map((s) => s.title);
  assert.equal(new Set(keys).size, keys.length, "duplicate story key");
  assert.equal(new Set(titles).size, titles.length, "duplicate story title");
  for (const s of CONTENT) {
    assert.match(s.key, /^[a-z][a-zA-Z]*$/, `${s.key}: keys are lowerCamel`);
    // the picker tile is a third of a phone wide and wraps the title to at most
    // three short lines under the story's emoji
    assert.ok(len(s.title) > 0 && len(s.title) <= 24, `${s.title}: ${len(s.title)} chars, max 24`);
    assert.ok(!/^[\x00-\x7f]$/.test(s.e), `${s.key}: the tile face must be a picture`);
  }
});

test("a story is as deep as its difficulty says, and holds exactly three endings", () => {
  for (const story of CONTENT) {
    assert.equal(story.depth, DEPTH[story.diff], `${story.key}: depth`);
    const ends = story.nodes.filter(isEnding);
    assert.equal(ends.length, END_SLOTS, `${story.key}: ${ends.length} endings`);
    assert.deepEqual(ends.map((e) => e.end).sort(), [0, 1, 2], `${story.key}: ending indices`);
    for (const e of ends) assert.equal(e.c, undefined, `${story.key}/${e.id}: an ending offers no choice`);
  }
});

test("node ids are unique, the first node is the start, and no node is orphaned", () => {
  for (const story of CONTENT) {
    const ids = story.nodes.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, `${story.key}: duplicate node id`);
    assert.ok(!isEnding(startNode(story)), `${story.key}: the first node cannot be an ending`);
    const layers = layersOf(story);
    assert.equal(layers.size, story.nodes.length,
      `${story.key}: unreachable nodes ${ids.filter((i) => !layers.has(i))}`);
  }
});

test("every path from the start to an ending has exactly `depth` scenes", () => {
  for (const story of CONTENT) {
    const layers = layersOf(story);
    for (const node of story.nodes) {
      for (const c of node.c ?? []) {
        assert.ok(nodeById(story, c.to), `${story.key}/${node.id}: dangling choice → ${c.to}`);
        assert.equal(layers.get(c.to), layers.get(node.id) + 1,
          `${story.key}/${node.id} → ${c.to}: a choice must step exactly one layer forward`);
      }
      if (isEnding(node)) {
        assert.equal(layers.get(node.id), story.depth - 1,
          `${story.key}/${node.id}: an ending sits on the last layer, or the fox misses the basket`);
      }
    }
  }
});

test("every scene offers two or three real choices", () => {
  every((story, node) => {
    if (isEnding(node)) return;
    const cs = node.c ?? [];
    assert.ok(cs.length >= 2 && cs.length <= 3, `${story.key}/${node.id}: ${cs.length} choices`);
    assert.equal(new Set(cs.map((c) => c.to)).size, cs.length,
      `${story.key}/${node.id}: two choices leading to the same scene are not a choice`);
  });
});

// --- the skeleton ------------------------------------------------------------
// Every story wears the SAME graph, and that is not a coincidence — it is the
// thing that makes a branching story readable at all. The scenes of a layer are
// three columns (mutig / behutsam / schlau); a scene's first choice stays in its
// column and its second steps one column onward, so the ending she reaches is
// simply the column she finishes in. Rewire it by hand and two paths start
// arriving in a scene that only follows from one of them — the exact defect the
// first draft of this content had everywhere.
test("every story wears the same skeleton: stay in the column, or step one on", () => {
  for (const story of CONTENT) {
    const layers = layersOf(story);
    const byLayer = [];
    for (const node of story.nodes) (byLayer[layers.get(node.id)] ??= []).push(node);

    assert.equal(byLayer.length, story.depth, `${story.key}: ${byLayer.length} layers`);
    assert.deepEqual(byLayer.map((l) => l.length), [1, 2, ...Array(story.depth - 3).fill(3), END_SLOTS],
      `${story.key}: layer sizes`);

    for (let k = 0; k < byLayer.length - 1; k++) {
      const next = byLayer[k + 1];
      byLayer[k].forEach((node, i) => {
        const want = [next[i % next.length].id, next[(i + 1) % next.length].id];
        assert.deepEqual((node.c ?? []).map((c) => c.to), want,
          `${story.key}/${node.id}: choice 1 must stay in its column, choice 2 step one onward`);
      });
    }
  }
});

// --- no lock-out -------------------------------------------------------------
// The rule that makes replaying worth it AND fair: early choices change which
// scenes she reads, never which endings she can still reach.
test("no early choice can put an ending out of reach", () => {
  for (const story of CONTENT) {
    const layers = layersOf(story);
    for (const node of story.nodes) {
      if (isEnding(node)) continue;
      const layer = layers.get(node.id);
      const reach = endingsReachable(story, node.id);
      if (layer <= story.depth - 3) {
        assert.equal(reach.size, END_SLOTS,
          `${story.key}/${node.id} (layer ${layer}): only reaches ${[...reach]} — a child hunting the others is stuck`);
      } else {
        assert.ok(reach.size >= 2,
          `${story.key}/${node.id}: the last choice must still be a choice between two endings`);
      }
    }
    for (const end of [0, 1, 2]) {
      assert.ok(pathToEnding(story, startNode(story).id, end), `${story.key}: ending ${end} unreachable`);
    }
  }
});

// --- the reading ladder, which is also the layout ----------------------------

test("a scene fits its difficulty's reading level and the phone it is read on", () => {
  every((story, node) => {
    const where = `${story.key}/${node.id}`;
    const d = story.diff;
    assert.ok(node.t?.length > 0, `${where}: empty scene`);
    assert.match(node.t, /[.!?][“”]?$/, `${where}: a scene ends on a full sentence`);
    const cap = isEnding(node) ? END_TEXT[d] : TEXT[d];
    assert.ok(len(node.t) <= cap, `${where}: ${len(node.t)} chars, max ${cap}`);
    for (const s of sentences(node.t)) {
      assert.ok(len(s) <= SENT[d], `${where}: sentence of ${len(s)} chars, max ${SENT[d]} — "${s}"`);
    }
    for (const w of words(node.t)) {
      assert.ok(w.length <= WORD[d], `${where}: "${w}" is ${w.length} letters, max ${WORD[d]}`);
    }
  });
});

// The driver reads the page and looks the scene up by its text
// (tools/play-drachen.js), so a repeated scene would make it answer for the
// wrong node — and a child would notice the repetition long before a test did.
test("no two scenes in the whole game share their text", () => {
  const seen = new Map();
  every((story, node) => {
    const key = node.t.trim();
    assert.ok(!seen.has(key), `${story.key}/${node.id} repeats ${seen.get(key)}`);
    seen.set(key, `${story.key}/${node.id}`);
  });
});

test("every scene carries a picture, and every ending a name", () => {
  for (const story of CONTENT) {
    const names = [];
    const emoji = [];
    for (const node of story.nodes) {
      const where = `${story.key}/${node.id}`;
      assert.ok(node.e?.length > 0, `${where}: every scene is a picture-book page`);
      assert.ok(!/^[\x00-\x7f]+$/.test(node.e), `${where}: the scene anchor must be a picture`);
      if (!isEnding(node)) continue;
      assert.ok(len(node.name ?? "") > 0 && len(node.name) <= 34,
        `${where}: an ending's name is what she collects, and it fits the strip`);
      names.push(node.name);
      emoji.push(node.e);
    }
    assert.equal(new Set(names).size, END_SLOTS, `${story.key}: two endings share a name`);
    assert.equal(new Set(emoji).size, END_SLOTS, `${story.key}: two endings share a picture`);
  }
});

test("a choice is a short action, and no two in one scene read alike", () => {
  every((story, node) => {
    const seen = new Set();
    for (const c of node.c ?? []) {
      const where = `${story.key}/${node.id}: "${c.a}"`;
      assert.ok(len(c.a ?? "") > 0, `${story.key}/${node.id}: empty choice`);
      assert.ok(len(c.a) <= 48, `${where} is ${len(c.a)} chars, max 48`);
      assert.ok(!/[.]$/.test(c.a), `${where} ends on a full stop — a choice is a label, not a sentence`);
      assert.ok(!seen.has(c.a), `${where} appears twice in one scene`);
      seen.add(c.a);
    }
  });
});
