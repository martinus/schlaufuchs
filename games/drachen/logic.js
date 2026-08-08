// Drachengeschichten pure logic (§21): story addressing, the ending mask codec,
// the graph walks a story's shape is checked with. No DOM, no storage —
// unit-tested in tests/drachen.test.js.
//
// A story is a LAYERED DAG: every path from the start node to an ending has the
// same number of scenes (`depth`), so the round's scene gets a fixed path length
// and the fox reaches the basket exactly as the ending appears. Choices go from
// layer k to layer k+1, never sideways and never back.
//
// A tile is one story, and a story has exactly THREE endings — which is what
// makes the whole game fit the site's economy without a line of special
// pleading: STAR_SLOTS is 3, so "stars on this tile" IS "endings you have
// found", and the level picker's three star groups are literally the endings
// still hidden from her.

import {
  DIFF_KEYS, STAR_SLOTS,
} from "../../assets/js/roundrules.js";

// The round rules every game shares live in roundrules.js; this module keeps
// only drachen's own data and graph arithmetic. There is no tempo ladder here
// (§21): rushing a story is the opposite of reading it.
export {
  DIFF_KEYS, DIFF_SLUGS, STAR_SLOTS, GUARD_MS, isBounce,
} from "../../assets/js/roundrules.js";

// Endings per story, and stories per difficulty. BOTH are frozen (§21):
// END_SLOTS is the width of the bit mask, STORY_TILES the length of the digit
// string — and STORY_TILES is also the denominator of MAX_POINTS.drachen, which
// is what regionState/starBadgeTier/pave() measure a child's progress against.
// Growing it later would demote a child who had already mastered the cave.
export const END_SLOTS = 3;
export const STORY_TILES = 3;

// --- the ending mask (§21 stored state) --------------------------------------
// One decimal digit 0..7 per story: bit e is set when ending e has been found.
// Stars are DERIVED from it (`foundCount`), so nothing else is stored.
//
// This codec is drachen's own on purpose. roundrules.js has starDigit/
// withStarDigit for exactly this shape, but `starDigit` clamps to 3 (a star
// count can never exceed STAR_SLOTS) — it would read a full mask of 7 back as
// 3, silently forgetting two endings. Reading and writing therefore stay
// together here, where the range is 0..7.
export function endMask(maskString, index) {
  const d = Number.parseInt((maskString ?? "")[index], 10);
  return Number.isInteger(d) && d >= 0 && d <= 7 ? d : 0;
}

export function withEndMask(maskString, index, mask, slots = STORY_TILES) {
  const s = (maskString ?? "").padEnd(slots, "0").split("");
  s[index] = String(mask & 7);
  return s.join("");
}

export const hasEnd = (mask, end) => (mask & (1 << end)) !== 0;
export const addEnd = (mask, end) => (mask | (1 << end)) & 7;
export const foundCount = (mask) => (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);

// --- story addressing --------------------------------------------------------
// The stories of one difficulty, in content order. `content` is the flat list
// (STORIES.de); a story's position WITHIN its difficulty is its slot in that
// difficulty's mask string, which is why content.js is append-only.
export function storiesFor(difficulty, content) {
  return (content ?? []).filter((s) => s.diff === difficulty);
}

// Junk in, story zero out — a corrupt store must never leave a child on a blank
// page (§9.2).
export function storyAt(difficulty, index, content) {
  const list = storiesFor(difficulty, content);
  return list[Number.isInteger(index) && index >= 0 && index < list.length ? index : 0] ?? null;
}

export const isEnding = (node) => Number.isInteger(node?.end);
export const nodeById = (story, id) => story?.nodes?.find((n) => n.id === id) ?? null;
export const startNode = (story) => story?.nodes?.[0] ?? null;

// The round's scene has one waypoint per CHOICE, not per scene: she starts on
// the first scene and the fox steps as she decides, so it reaches the basket on
// the step that opens the ending.
export const journeyNodes = (story) => Math.max((story?.depth ?? 1) - 1, 1);

// --- graph walks -------------------------------------------------------------
// Layer of every node, by breadth-first walk from the start. Every edge goes
// from layer k to layer k+1, so a node's layer is well defined — and a node
// that turns up at two different depths is exactly what the content test is
// there to catch, so this reports the FIRST depth reached and the test compares
// it against every path.
export function layersOf(story) {
  const layer = new Map();
  const start = startNode(story);
  if (!start) return layer;
  layer.set(start.id, 0);
  let front = [start];
  while (front.length > 0) {
    const next = [];
    for (const node of front) {
      for (const choice of node.c ?? []) {
        if (layer.has(choice.to)) continue;
        const target = nodeById(story, choice.to);
        if (!target) continue;
        layer.set(target.id, layer.get(node.id) + 1);
        next.push(target);
      }
    }
    front = next;
  }
  return layer;
}

export const layerOf = (story, id) => layersOf(story).get(id) ?? null;

// Which endings can still be reached from `id`. This is the function the
// no-lock-out rule is written in: a child hunting the last ending must never be
// able to make an early choice that quietly puts it out of reach.
export function endingsReachable(story, id) {
  const found = new Set();
  const seen = new Set();
  const walk = (nodeId) => {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = nodeById(story, nodeId);
    if (!node) return;
    if (isEnding(node)) { found.add(node.end); return; }
    for (const choice of node.c ?? []) walk(choice.to);
  };
  walk(id);
  return found;
}

// The choice indices that lead from `fromId` to ending `end`, or null when it
// cannot be reached. Two consumers, one implementation: tools/play-drachen.js
// sweeps a story to a chosen ending with it, and tests/drachen-content.test.js
// proves every ending is reachable with it.
export function pathToEnding(story, fromId, end) {
  const node = nodeById(story, fromId);
  if (!node) return null;
  if (isEnding(node)) return node.end === end ? [] : null;
  const choices = node.c ?? [];
  for (let i = 0; i < choices.length; i++) {
    const rest = pathToEnding(story, choices[i].to, end);
    if (rest) return [i, ...rest];
  }
  return null;
}

// --- the round mirror (§10.7) ------------------------------------------------
// drachen runs no adaptive session, so it cannot use adaptive.js' validResume.
// The mirror is the list of node ids visited, current scene last; this says
// whether it still describes a real, unfinished walk through THIS story. Total:
// junk in, false out.
export function validStoryResume(snapshot, story) {
  if (!story || !Array.isArray(snapshot?.path) || snapshot.path.length === 0) return false;
  const path = snapshot.path;
  if (!path.every((id) => typeof id === "string")) return false;
  if (path[0] !== startNode(story)?.id) return false;
  for (let i = 0; i < path.length; i++) {
    const node = nodeById(story, path[i]);
    if (!node) return false;
    // An ending may only ever be the last node — and not even then: the moment
    // one is reached the round is written and the mirror dropped, so a mirror
    // that ends on one is stale.
    if (isEnding(node)) return false;
    if (i + 1 < path.length && !(node.c ?? []).some((choice) => choice.to === path[i + 1])) return false;
  }
  return true;
}

// --- the economy (§8.3) ------------------------------------------------------
// What the cave is worth if every ending of every story is found: three stories
// per difficulty, three endings each, a star worth its difficulty.
// tests/rewards.test.js holds this and MAX_POINTS.drachen together.
export function maxPoints(content) {
  let total = 0;
  for (let d = 0; d < DIFF_KEYS.length; d++) {
    total += storiesFor(d, content).length * STAR_SLOTS * (d + 1);
  }
  return total;
}
