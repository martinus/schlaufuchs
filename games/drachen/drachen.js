// Drachengeschichten page module (§21): wires the pure logic to the DOM, using
// the shared engines (journey, rewards, storage, roundstore, i18n, audio).
// Structured like games/lesen/lesen.js — the ids and the wiring are the same on
// purpose, so the CSS and the driving conventions transfer.
//
// What is different, and deliberately so:
//   • No adaptive session. A story is a walk through a graph, not a draw from a
//     pool, so there are no Leitner boxes and no re-queue. The round mirror is
//     the list of scenes visited (validStoryResume in logic.js).
//   • No tempo ladder. Rushing a story is the opposite of reading it.
//   • Stars are ENDINGS. A tile is a story, a story has three endings, and a
//     newly found one pays a star — a known one pays nothing, exactly as
//     "stars come from progress, never from repetition" (§8.3) already says.
//   • The round ends in TWO beats. The state is written the moment the ending
//     scene appears, and the summary waits for her to press "Weiter" — the
//     shared summary would otherwise cover the ending text after 700 ms, and
//     that text is the whole point of the game.
//
// The stories are German (§14.6); the chrome is bilingual.

import { initI18n, t } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { saveRound, loadRound, clearRound } from "../../assets/js/roundstore.js";
import { recordRound, roundPoints, starValue, clampDifficulty } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { fastPress } from "../../assets/js/fastpress.js";
import { createRoundSummary } from "../../assets/js/roundsummary.js";
import { initTopBar } from "../../assets/js/chrome.js";
import { createLeaveGuard } from "../../assets/js/leaveguard.js";
import { iconHTML } from "../../assets/js/graphics.js";
import strings from "./i18n.js";
import { STORIES } from "./content.js";
import { createLevelPicker } from "./picker.js";
import {
  DIFF_KEYS, END_SLOTS, isBounce,
  storiesFor, storyAt, nodeById, startNode, isEnding, journeyNodes,
  endMask, withEndMask, foundCount, hasEnd, addEnd, validStoryResume,
} from "./logic.js";

initI18n(strings);

const $ = (id) => document.getElementById(id);
const CONTENT = STORIES.de;

// The two overlays this page owns (picker.js holds the picker's tiles and fox).
// Same contract as every other game: the picker can be waved away, the summary
// cannot.
const picker = createLevelPicker(document.getElementById("pick-overlay"), {
  current: () => ({ diff, story: storyIx }),
  onPick(d, s) {
    diff = d;
    storyIx = s;
    startStory();
  },
  onDismiss() {
    if (roundOver) summary.open();
    else if (!story) startStory();
  },
});
const { summary, show: showSummary } = createRoundSummary({
  picker,
  refresh: () => bar.refresh(),
});

// --- state -------------------------------------------------------------------
let saved = getGame("drachen");
let diff = clampDifficulty(saved.d);
let storyIx = Number.isInteger(saved.s) ? saved.s : 0;

let story = null;      // the story being read; also "is a story on the stage?"
let journey = null;
let path = [];         // node ids visited, current scene last
let node = null;       // the scene on screen
let maskBefore = 0;    // the tile's ending mask when the story started
let maskAfter = 0;     // …and after the ending was reached
let freshEnd = -1;     // the ending just found, or -1 when it was already known
let roundOver = false;
let wonTrophies = [];  // what this ending paid, held for the summary's second beat
let guardArmedAt = 0;  // double-tap bounce guard (§14.2)
let sceneStamp = 0;    // the driver's "this is a new scene" counter

// --- chrome ------------------------------------------------------------------
function updateChip() {
  $("pickchip").innerHTML =
    `<span class="ph-sym" aria-hidden="true">${iconHTML("region-drachen", { size: 20 })}</span>`
    + `<span class="ph-txt">${t(DIFF_KEYS[diff])}<span class="ph-sep" aria-hidden="true"></span>${(story ?? storyAt(diff, storyIx, CONTENT))?.title ?? ""}</span>`;
}

// --- a story -----------------------------------------------------------------
// `resume` is a round mirror from roundstore.js (§10.7); without one the start
// is fresh and any stale mirror is dropped — a chosen story outranks an
// interrupted one.
function startStory(resume = null) {
  saved = getGame("drachen");
  story = storyAt(diff, storyIx, CONTENT);
  // storyAt is total, so a corrupt index lands on story zero rather than a blank
  // page; the index has to follow, or the stars would be written to the wrong
  // tile.
  storyIx = storiesFor(diff, CONTENT).indexOf(story);
  updateChip();
  bar.refresh();

  const snap = resume && validStoryResume(resume, story) ? resume : null;
  if (!snap) clearRound("drachen");
  path = snap ? [...snap.path] : [startNode(story).id];

  maskBefore = endMask((saved.e ?? {})[diff], storyIx);
  maskAfter = maskBefore;
  freshEnd = -1;
  roundOver = false;

  journey = createJourney($("journey"), {
    nodes: journeyNodes(story),
    theme: "cave",
    stars: foundCount(maskBefore),
    worth: starValue(diff),
  });
  // walk the fox back to where she stood: one step per choice already made
  for (let i = 1; i < path.length; i++) journey.advance();

  summary.close();
  renderScene(nodeById(story, path[path.length - 1]));
}

function renderScene(next) {
  node = next;
  sceneStamp += 1;

  $("scene").textContent = node.e ?? "";
  const q = $("question");
  q.textContent = node.t;
  q.dataset.q = String(sceneStamp);
  q.dataset.node = node.id;

  if (isEnding(node)) renderEnding();
  else renderChoices();
}

// The choices, as full-width reading tiles under the thumb. `.mc-read` is the
// same one-column shape lesen's comprehension answers wear — a choice is a
// sentence, and a sentence needs a line, not a square.
function renderChoices() {
  $("endname").hidden = true;
  const box = document.createElement("div");
  box.className = "mc mc-read";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", t("drachenChoose"));
  (node.c ?? []).forEach((choice, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = choice.a;
    b.dataset.choice = String(i);
    fastPress(b, () => choose(i));
    box.appendChild(b);
  });
  $("answers").replaceChildren(box);
}

function choose(index) {
  if (roundOver || !node || isEnding(node)) return;
  const now = Date.now();
  if (isBounce(now, guardArmedAt)) return;
  guardArmedAt = now;

  const choice = (node.c ?? [])[index];
  const next = choice && nodeById(story, choice.to);
  if (!next) return;

  sfx.click();
  journey.advance();
  path.push(next.id);

  if (isEnding(next)) {
    // The state is written the moment the ending is on screen (below), so the
    // mirror is dropped there, not here.
    renderScene(next);
    return;
  }
  saveRound("drachen", { d: diff, s: storyIx, path: [...path] });
  renderScene(next);
}

// --- the ending: beat one ----------------------------------------------------
// Persist FIRST, then let her read. Because the store is already written,
// `inRound()` is false from here on: she may walk away in the middle of an
// ending and keeps the star she just earned.
function renderEnding() {
  const known = hasEnd(maskBefore, node.end);
  freshEnd = known ? -1 : node.end;
  maskAfter = addEnd(maskBefore, node.end);

  const masks = { ...(saved.e ?? {}) };
  masks[diff] = withEndMask(masks[diff], storyIx, maskAfter);
  setGame("drachen", { d: diff, s: storyIx, e: masks });
  // the ending is in the store now; its mirror has nothing left to protect
  clearRound("drachen");

  const oldStars = foundCount(maskBefore);
  const stars = foundCount(maskAfter);
  // stars come from progress, never from repetition (§8.3): a known ending pays
  // nothing, however often she walks back to it
  const points = roundPoints({ oldStars, newStars: stars, difficulty: diff });
  wonTrophies = recordRound("drachen", { points }).newTrophies;

  roundOver = true;
  // the group flies into the basket while she is still reading the ending
  journey.setStars(stars);
  if (!known) sfx.correct();

  const en = $("endname");
  en.hidden = false;
  // no emoji here: the ending's own picture is floated into the scene right
  // above, and a second copy of it two lines down reads as a stutter
  en.innerHTML = `<span class="en-n">${node.name}</span>`
    + `<span class="en-tag">${known ? t("drachenKnownEnding") : t("drachenNewEnding")}</span>`;
  en.classList.toggle("fresh", !known);

  paintEndings();

  const b = document.createElement("button");
  b.type = "button";
  b.className = "primary";
  b.id = "story-next";
  b.textContent = t("drachenNext");
  fastPress(b, finishStory);
  $("answers").replaceChildren(b);
}

// The ending strip on the summary sheet: which endings this story has given up
// so far, and how many are still hidden. Deliberately without stars — the big
// slots above already say "how many"; this row says "WHICH, and one is still
// out there". It is what makes a child play the same story again.
function paintEndings() {
  const found = foundCount(maskAfter);
  const left = END_SLOTS - found;
  const head = left === 0
    ? t("drachenAll")
    : `${t("drachenFound", { n: found, total: END_SLOTS })} · `
      + (left === 1 ? t("drachenLeft1") : t("drachenLeft", { n: left }));

  const rows = story.nodes.filter(isEnding).sort((a, b) => a.end - b.end).map((end) => {
    if (!hasEnd(maskAfter, end.end)) {
      return `<li class="end hidden"><span class="end-e" aria-hidden="true">❔</span>`
        + `<span class="end-n">${t("drachenHidden")}</span></li>`;
    }
    const fresh = end.end === freshEnd ? " fresh" : "";
    return `<li class="end found${fresh}"><span class="end-e" aria-hidden="true">${end.e}</span>`
      + `<span class="end-n">${end.name}</span></li>`;
  });

  $("sum-endings").innerHTML = `<p class="end-head">${head}</p><ul class="end-list">${rows.join("")}</ul>`;
}

// --- the ending: beat two ----------------------------------------------------
function finishStory() {
  if (!roundOver) return;
  const now = Date.now();
  if (isBounce(now, guardArmedAt)) return;
  guardArmedAt = now;

  journey.finish();
  const oldStars = foundCount(maskBefore);
  const stars = foundCount(maskAfter);
  // no tempo ladder in the cave (§21): the shared summary skips both the tempo
  // line and the record line, and this sheet does not even carry them
  showSummary({
    old: oldStars,
    stars,
    improved: stars > oldStars,
    diff,
    tier: 0,
    tempoImproved: false,
    trophies: wonTrophies,
  });
}

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
$("pickchip").addEventListener("click", picker.open);

// --- leaving a story that is not saved yet (§10.7) ---------------------------
// Only a story she has actually decided something in is worth a dialog: on the
// first scene nothing is at stake, and on an ending scene the star is already
// banked. A confirmed leave drops the mirror — "Zur Karte" means it.
const guard = createLeaveGuard({
  mapUrl: new URL("../../", import.meta.url).href,
  inRound: () => story !== null && !roundOver && path.length > 1,
  onGo: () => clearRound("drachen"),
});

// --- the shared top bar (§3.3) ----------------------------------------------
const bar = initTopBar({
  back: "../../",
  help: "drachen",
  onLeave: guard.guardLink,
  onChange() {
    updateChip();
    // The story is content and does not translate; only the chrome around it
    // does — the ending strip and the "Weiter" button carry UI strings.
    if (roundOver && node) {
      const tag = $("endname").querySelector(".en-tag");
      if (tag) tag.textContent = freshEnd === -1 ? t("drachenKnownEnding") : t("drachenNewEnding");
      const next = $("story-next");
      if (next) next.textContent = t("drachenNext");
      paintEndings();
    } else if (story) {
      $("answers").querySelector(".mc")?.setAttribute("aria-label", t("drachenChoose"));
    }
  },
  onClose() {
    if (roundOver) summary.open();
  },
});

// The game opens on its map of stories, with the fox standing on the tile she
// left (§3.4) — unless a story was interrupted mid-read (§10.7): then the game
// rehydrates it, same story, same scene, the fox where she stood, with no
// picker and no dialog. A stale or foreign mirror falls back to the picker.
const interrupted = loadRound("drachen");
const canResume = interrupted
  && [0, 1, 2].includes(interrupted.d)
  && Number.isInteger(interrupted.s)
  && validStoryResume(interrupted, storyAt(interrupted.d, interrupted.s, CONTENT));
if (canResume) {
  diff = interrupted.d;
  storyIx = interrupted.s;
  startStory(interrupted);
} else {
  clearRound("drachen"); // whatever it was, it cannot be resumed
  updateChip();
  picker.open();
}
