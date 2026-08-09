// Drachengeschichten pure logic (§21): the ending-mask codec, the graph walks,
// the round mirror, the economy — plus the source guards for the wiring no unit
// test can see (the two-beat ending, the persist-before-summary order).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  END_SLOTS, STORY_TILES,
  endMask, withEndMask, hasEnd, addEnd, foundCount,
  storiesFor, storyAt, clampStoryIndex, nodeById, startNode, isEnding, journeyNodes,
  layersOf, endingsReachable, pathToEnding, validStoryResume, maxPoints,
} from "../games/drachen/logic.js";
import { STORIES } from "../games/drachen/content.js";
import { storyFace } from "../games/drachen/picker.js";
import { MAX_POINTS, tilePointsLeft, roundPoints } from "../assets/js/rewards.js";
import { encodeState, BUDGET } from "../assets/js/storage.js";
import { STAR_SLOTS } from "../assets/js/roundrules.js";
import { read } from "./pages.js";

const game = read("games/drachen/drachen.js");
const html = read("games/drachen/index.html");
const CONTENT = STORIES.de;

// --- the ending mask ---------------------------------------------------------

// THE regression this codec exists for. roundrules.js' starDigit clamps to 3 —
// a star count can never exceed STAR_SLOTS — and would read a full mask of 7
// back as 3, silently forgetting two endings. drachen owns both halves so the
// range stays 0..7.
test("a full mask survives the round trip — it is not clamped to a star count", () => {
  for (let mask = 0; mask <= 7; mask++) {
    const s = withEndMask("000", 1, mask);
    assert.equal(endMask(s, 1), mask, `mask ${mask} did not survive`);
  }
  assert.equal(endMask("777", 0), 7);
  assert.equal(endMask(withEndMask(withEndMask("", 0, 7), 2, 5), 2), 5);
});

test("the mask codec is total: junk in, zero out", () => {
  for (const s of [undefined, null, "", "x", "ab", "8", "-1", "9"]) {
    assert.equal(endMask(s, 0), 0, `junk ${JSON.stringify(s)} decoded to something`);
  }
  assert.equal(endMask("70", 5), 0, "past the end of the string");
  assert.equal(withEndMask(undefined, 2, 3), "003", "a missing string is padded, not thrown at");
  assert.equal(withEndMask("7", 0, 1).length, STORY_TILES, "a short string grows to the tile count");
});

test("an ending slot IS a star slot — the game's whole premise, structurally", () => {
  assert.equal(END_SLOTS, STAR_SLOTS);
});

test("bits are endings, and popcount is stars", () => {
  assert.equal(foundCount(0), 0);
  assert.equal(foundCount(7), 3);
  assert.deepEqual([0, 1, 2].map((e) => hasEnd(5, e)), [true, false, true]);
  assert.equal(addEnd(0, 1), 2);
  assert.equal(addEnd(5, 1), 7);
  assert.equal(addEnd(7, 2), 7, "finding a known ending changes nothing");
  assert.equal(foundCount(addEnd(3, 0)), 2, "…and pays no star either");
});

// The whole economy of the game in one assertion: a tile's stars ARE its found
// endings, so the picker's "stars still to give" is "endings still hidden" with
// no special case anywhere.
test("a newly found ending pays exactly one star, a known one pays nothing", () => {
  for (const d of [0, 1, 2]) {
    const before = 1; // one ending known
    const after = foundCount(addEnd(1, 2));
    assert.equal(roundPoints({ oldStars: before, newStars: after, difficulty: d }), d + 1);
    assert.equal(roundPoints({ oldStars: before, newStars: before, difficulty: d }), 0);
    // and the picker draws the endings still hidden, in the groups they pay in
    assert.equal(tilePointsLeft(before, d) / (d + 1), END_SLOTS - before);
  }
});

// --- story addressing --------------------------------------------------------

test("every difficulty offers exactly STORY_TILES stories, in content order", () => {
  for (const d of [0, 1, 2]) {
    const list = storiesFor(d, CONTENT);
    assert.equal(list.length, STORY_TILES, `difficulty ${d}`);
    assert.deepEqual(list.map((s) => s.diff), [d, d, d]);
  }
});

test("a corrupt story index lands on story zero, never on a blank page", () => {
  const first = storiesFor(1, CONTENT)[0];
  for (const ix of [undefined, null, -1, 3, 99, "1", 1.5, NaN]) {
    assert.equal(clampStoryIndex(1, ix, CONTENT), 0, `index ${JSON.stringify(ix)}`);
    assert.equal(storyAt(1, ix, CONTENT), first, `index ${JSON.stringify(ix)}`);
  }
  assert.equal(clampStoryIndex(2, 2, CONTENT), 2);
  assert.equal(storyAt(2, 2, CONTENT), storiesFor(2, CONTENT)[2]);
  // the game clamps the INDEX because it writes a star to that slot; a story
  // picked without its index would bank the ending on the wrong tile
  assert.match(game, /storyIx = clampStoryIndex\(/, "the page must clamp the slot it writes to");
});

// The scene walks one waypoint per CHOICE, not per scene: she starts on the
// first scene, so a five-scene story is four steps and the fox lands in the
// basket exactly as the ending appears.
test("the round's path is one step shorter than the story is deep", () => {
  for (const s of CONTENT) assert.equal(journeyNodes(s), s.depth - 1);
  assert.equal(journeyNodes(undefined), 1, "no story is still a drawable path");
});

// --- graph walks -------------------------------------------------------------

test("layersOf reaches every node, and every edge steps exactly one layer", () => {
  for (const story of CONTENT) {
    const layers = layersOf(story);
    assert.equal(layers.size, story.nodes.length, `${story.key}: orphaned nodes`);
    assert.equal(layers.get(startNode(story).id), 0);
    for (const node of story.nodes) {
      for (const c of node.c ?? []) {
        assert.equal(layers.get(c.to), layers.get(node.id) + 1, `${story.key}/${node.id}→${c.to}`);
      }
    }
  }
  assert.equal(layersOf(CONTENT[0]).get("nope"), undefined);
});

test("pathToEnding finds a path to every ending, and following it lands there", () => {
  for (const story of CONTENT) {
    for (const end of [0, 1, 2]) {
      const path = pathToEnding(story, startNode(story).id, end);
      assert.ok(path, `${story.key}: ending ${end} is unreachable`);
      let node = startNode(story);
      for (const i of path) node = nodeById(story, node.c[i].to);
      assert.ok(isEnding(node) && node.end === end, `${story.key}: path to ${end} ended on ${node.id}`);
      assert.equal(path.length, story.depth - 1, `${story.key}: ${path.length} choices to ${end}`);
    }
  }
  assert.equal(pathToEnding(CONTENT[0], "nope", 0), null);
});

test("endingsReachable is what the no-lock-out rule is written in", () => {
  const story = CONTENT[0];
  for (const node of story.nodes.filter(isEnding)) {
    assert.deepEqual([...endingsReachable(story, node.id)], [node.end]);
  }
  assert.equal(endingsReachable(story, "nope").size, 0);
  assert.equal(endingsReachable(story, startNode(story).id).size, 3);
});

// --- the round mirror (§10.7) ------------------------------------------------

test("validStoryResume accepts a real half-read story", () => {
  const story = CONTENT[0];
  const start = startNode(story).id;
  assert.ok(validStoryResume({ path: [start] }, story));
  assert.ok(validStoryResume({ path: [start, story.nodes[0].c[1].to] }, story));
});

test("validStoryResume is total — junk, a broken edge or a finished story all fail", () => {
  const story = CONTENT[0];
  const start = startNode(story).id;
  const firstEnd = story.nodes.find(isEnding).id;
  const cases = [
    [undefined, "nothing"],
    [{}, "no path"],
    [{ path: [] }, "an empty path"],
    [{ path: [start, 7] }, "a non-string id"],
    [{ path: ["a1"] }, "a path that does not start at the start"],
    [{ path: [start, "nope"] }, "an id that is not in the story"],
    [{ path: [start, story.nodes[3].id] }, "an edge the start does not have"],
    [{ path: [start, firstEnd] }, "a story that already ended"],
  ];
  for (const [snap, why] of cases) assert.equal(validStoryResume(snap, story), false, why);
  assert.equal(validStoryResume({ path: [start] }, null), false, "no story at all");
});

// Every story wears the same skeleton of node ids (content.js), so a path alone
// cannot say WHICH story it walked — the mirror's own `d`/`s` are what pin that,
// and the boot must check them before it trusts the path against a story.
test("the mirror's difficulty and story are checked before its path is", () => {
  const boot = game.slice(game.indexOf('const interrupted = loadRound("drachen")'));
  assert.match(boot, /\[0, 1, 2\]\.includes\(interrupted\.d\)/, "a foreign difficulty is not resumable");
  assert.match(boot, /Number\.isInteger\(interrupted\.s\)/, "…nor a foreign story index");
  assert.match(boot, /validStoryResume\(interrupted, storiesFor\(interrupted\.d, CONTENT\)\[interrupted\.s\]\)/,
    "and the path is validated against THAT story, not the one last played");
  assert.match(boot, /clearRound\("drachen"\)/, "an unusable mirror is dropped, not carried around");
});

// --- the economy -------------------------------------------------------------

test("the cave's worth is computed from its real stories (§8.3)", () => {
  assert.equal(maxPoints(CONTENT), MAX_POINTS.drachen);
  assert.equal(maxPoints(CONTENT), STORY_TILES * END_SLOTS * (1 + 2 + 3));
  assert.equal(maxPoints([]), 0);
});

test("the stored state stays tiny, even with every ending found (§9.2)", () => {
  const maxed = { d: 2, s: STORY_TILES - 1, e: { 0: "777", 1: "777", 2: "777" } };
  const bytes = encodeState({ drachen: maxed }).length;
  assert.ok(bytes < 90, `a maxed drachen section is ${bytes} bytes`);
  assert.ok(bytes < BUDGET / 20, "…a rounding error against the whole budget");
});

// A picker tile is a third of a phone wide and has to name a whole story, so the
// emoji carries the recognition and the title only confirms it — two spans with
// two sizes. The CSS is the other half of that: without these class names the
// title renders at the tile's 1.2rem and pushes the star groups off it.
test("a tile's face is the story's picture over its title", () => {
  const story = CONTENT[0];
  const face = storyFace(story);
  assert.ok(face.includes(story.e) && face.includes(story.title));
  assert.match(face, /class="story-e"[^>]*aria-hidden="true"/, "the picture is decorative; the name is spoken");
  assert.match(face, /class="story-t"/);
  const css = read("assets/css/schlaufuchs.css");
  for (const cls of ["story-e", "story-t"]) {
    assert.match(css, new RegExp(`\\.tilegrid \\.${cls}`), `.${cls} has no rule — the tile would blow up`);
  }
});

// --- source guards -----------------------------------------------------------

// The summary sheet holds exactly ONE button (§3.4/§10.1) — and, unlike every
// other game's, it holds neither the record line nor the tempo line: there is
// no tempo ladder in the cave, and "Neuer Rekord!" says nothing about finding a
// story's next ending. tests/scene.test.js pins that the shared summary copes.
test("the summary sheet has one button, no tempo line and an ending strip", () => {
  const sheet = html.slice(html.indexOf('id="sum-overlay"'), html.indexOf("</body>"));
  assert.equal(sheet.match(/<button/g)?.length, 1, "the summary must offer exactly one way on");
  assert.ok(sheet.includes('id="sum-endings"'), "the ending strip is the game's motivation loop");
  assert.ok(!sheet.includes('id="sum-tempo"'), "there is no tempo ladder in the cave");
  assert.ok(!sheet.includes('id="sum-best"'), "a new ending is not a new record");
});

// The round ends in TWO beats, and the order is what makes the leave guard safe:
// the store is written while the ending is still on screen, so `inRound()` is
// already false and walking away mid-ending costs her nothing.
//
// The beat that PAYS is separate from the beat that DRAWS, and that split is
// load-bearing three times over: the summary is painted (so the top bar stops
// reading ⭐ 0 and the sheet can never be opened blank) the moment the star is
// banked; the drawing half can run again on a language switch without paying
// twice; and the sheet itself is only revealed when she taps on.
test("the ending is paid once, drawn as often as needed, and revealed on a tap", () => {
  const award = game.slice(game.indexOf("function awardEnding"), game.indexOf("function paintEnding("));
  const set = award.indexOf('setGame("drachen"');
  const clear = award.indexOf('clearRound("drachen")');
  const record = award.indexOf('recordRound("drachen"');
  assert.ok(set > -1 && clear > set, "the mirror is dropped only once the store holds the ending");
  assert.ok(record > set, "the trophies are recorded after the ending is written");
  assert.ok(award.includes("roundOver = true"), "…and the round is over from here");
  assert.match(award, /paintSummary\(\{/, "the sheet must be painted the moment the star is banked");
  assert.ok(!award.includes("revealSummary("), "…but not shown: she is still reading the ending");

  // the paying half runs from `choose` only — never from a re-render
  const render = game.slice(game.indexOf("function renderScene"), game.indexOf("function renderChoices"));
  assert.ok(!render.includes("awardEnding("), "a redraw must not pay a second time");
  assert.match(render, /paintEnding\(\)/, "a redraw draws the ending again");

  const finish = game.slice(game.indexOf("function finishStory"));
  assert.match(finish, /revealSummary\(\)/, "the 'Weiter' button is what shows the summary");
  // …and every other way the sheet can come back asks whether it was ever shown
  assert.ok(!/if \(roundOver\) summary\.open\(\)/.test(game),
    "reopening on `roundOver` shows an unpainted sheet on the ending scene");
  assert.equal(game.match(/if \(summaryShown\) summary\.open\(\)/g)?.length, 2,
    "the picker's dismiss and the gear's close both gate on the sheet having been shown");
});

// The ending scene has to hold the ending's TEXT and its NAME at the reading
// size, and on the longest ending that does not fit beside a full-size path
// scene: the name is pushed out of the stage, which clips it, and the name is
// the collectible. So the path steps back on the ending beat — and steps
// forward again on the next story.
test("the path yields its room on the ending scene", () => {
  const render = game.slice(game.indexOf("function renderScene"), game.indexOf("function renderChoices"));
  assert.match(render, /classList\.toggle\("ended", ending\)/,
    "one toggle, so the mark goes on at an ending and off at every other scene");
  const css = read("assets/css/schlaufuchs.css");
  assert.match(css, /\.stage:has\(#wordcard\.ended\) \.journey/,
    "the mark has no rule — the ending name would be clipped again");
  // …and the two rules must not merely tie on specificity, with source order
  // deciding. Reordering the blocks would silently clip the name again.
  assert.match(css, /\.stage:has\(#wordcard\.story:not\(\.ended\)\) \.journey/,
    "the story and ending heights must be mutually exclusive, not order-dependent");
});

test("every choice is mirrored, and every way out of a story drops the mirror", () => {
  const choose = game.slice(game.indexOf("function choose("), game.indexOf("// --- the ending: beat one"));
  assert.match(choose, /saveRound\("drachen", \{ d: diff, s: storyIx, path: \[\.\.\.path\] \}\)/,
    "a scene she walked into must survive a reload");
  assert.match(choose, /isBounce\(now, guardArmedAt\)/, "a double-tap must not pick the next scene's choice");
  // the moments the mirror is dropped (§10.7): a finished story, a fresh pick
  // from the picker, a confirmed "Zur Karte", and a boot that cannot resume
  assert.match(game.slice(game.indexOf("function awardEnding")), /clearRound\("drachen"\)/);
  assert.match(game.slice(game.indexOf("function startStory")), /if \(!snap\) clearRound\("drachen"\)/);
  assert.match(game, /onGo: \(\) => clearRound\("drachen"\)/);
  assert.match(game, /inRound: \(\) => story !== null && !roundOver && path\.length > 1/,
    "a story with no decision in it yet has nothing to lose");
});
