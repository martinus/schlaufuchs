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
//   • The round ends in TWO beats. `awardEnding` banks the star and PAINTS the
//     summary the moment the ending scene appears; `finishStory` only reveals
//     the sheet, when she taps "Weiter". The shared summary's own 700 ms timer
//     would otherwise cover the ending text, and that text is the whole point
//     of the game. Painting early is not an optimisation: it is what keeps the
//     top bar honest and the sheet from ever being opened blank (§21.3).
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
  storiesFor, clampStoryIndex, nodeById, startNode, isEnding, journeyNodes,
  endMask, withEndMask, foundCount, hasEnd, addEnd, validStoryResume,
} from "./logic.js";

initI18n(strings);

const $ = (id) => document.getElementById(id);
const CONTENT = STORIES.de;

// The two overlays this page owns (picker.js holds the picker's tiles and fox).
// Same contract as every other game: the picker can be waved away, the summary
// cannot.
const picker = createLevelPicker(document.getElementById("pick-overlay"), {
  current: () => ({ diff, id: storyIx }),
  onPick(d, s) {
    diff = d;
    storyIx = s;
    startStory();
  },
  onDismiss() {
    // Only once the sheet has actually been revealed — on an ending scene she
    // is still reading, and a summary popping over it is not what waving the
    // picker away meant.
    if (summaryShown) summary.open();
    else if (!story) startStory();
  },
});
const { summary, paint: paintSummary, reveal: revealSummary } = createRoundSummary({
  picker,
  refresh: () => bar.refresh(),
});

// --- state -------------------------------------------------------------------
let diff = clampDifficulty(getGame("drachen").d);
let storyIx = 0;

let story = null;      // the story being read; also "is a story on the stage?"
let journey = null;
let path = [];         // node ids visited, current scene last
let node = null;       // the scene on screen — always the last id in `path`
let maskBefore = 0;    // the tile's ending mask when the story started
let roundOver = false; // the ending is on screen and its star is in the store
let summaryShown = false; // …and she has tapped past it, so the sheet exists
let wonTrophies = [];  // what this ending paid, held for the summary
let guardArmedAt = 0;  // double-tap bounce guard (§14.2)

// Everything else about the ending is DERIVED from those two, so there is no
// second copy to keep in step across the two beats and a language switch.
const endingFresh = () => roundOver && !hasEnd(maskBefore, node.end);
const maskNow = () => (roundOver ? addEnd(maskBefore, node.end) : maskBefore);

// --- chrome ------------------------------------------------------------------
function updateChip() {
  const title = storiesFor(diff, CONTENT)[storyIx]?.title ?? "";
  $("pickchip").innerHTML =
    `<span class="ph-sym" aria-hidden="true">${iconHTML("region-drachen", { size: 20 })}</span>`
    + `<span class="ph-txt">${t(DIFF_KEYS[diff])}<span class="ph-sep" aria-hidden="true"></span>${title}</span>`;
}

// --- a story -----------------------------------------------------------------
// `resume` is a round mirror from roundstore.js (§10.7); without one the start
// is fresh and any stale mirror is dropped — a chosen story outranks an
// interrupted one.
function startStory(resume = null) {
  const saved = getGame("drachen");
  // Clamp once and index from the clamp: a corrupt index lands on story zero
  // rather than a blank page, and the index has to follow it, or the stars
  // would be written to the wrong tile.
  storyIx = clampStoryIndex(diff, storyIx, CONTENT);
  story = storiesFor(diff, CONTENT)[storyIx] ?? null;
  updateChip();
  bar.refresh();

  const snap = resume && validStoryResume(resume, story) ? resume : null;
  if (!snap) clearRound("drachen");
  path = snap ? [...snap.path] : [startNode(story).id];

  maskBefore = endMask((saved.e ?? {})[diff], storyIx);
  roundOver = false;
  summaryShown = false;

  journey = createJourney($("journey"), {
    nodes: journeyNodes(story),
    theme: "cave",
    stars: foundCount(maskBefore),
    worth: starValue(diff),
  });
  // walk the fox back to where she stood: one step per choice already made
  for (let i = 1; i < path.length; i++) journey.advance();

  summary.close();
  renderScene();
}

// Draw whatever scene `path` ends on. Pure paint — safe to run again on a
// language switch, which is exactly what makes that handler a one-liner.
function renderScene() {
  node = nodeById(story, path[path.length - 1]);
  const ending = isEnding(node);

  $("scene").textContent = node.e ?? "";
  const q = $("question");
  q.textContent = node.t;
  // The driver's "this is a new scene" stamp. `path.length` says it without a
  // counter to maintain — and, unlike a counter, it does NOT change when the
  // same scene is redrawn in another language.
  q.dataset.q = String(path.length);
  q.dataset.node = node.id;

  $("endname").hidden = !ending;
  // On the ending scene the path has nothing left to say — the fox is in the
  // basket — so it yields its room to the ending text and the ending's name.
  // Without this the name is pushed out of the stage on the longest endings.
  $("wordcard").classList.toggle("ended", ending);

  if (ending) paintEnding();
  else renderChoices();
}

// The choices, as full-width reading tiles under the thumb. `.mc-read` is the
// same one-column shape lesen's comprehension answers wear — a choice is a
// sentence, and a sentence needs a line, not a square.
function renderChoices() {
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

  // An ending is banked instead of mirrored: the store holds it from here on,
  // so the mirror has nothing left to protect.
  if (isEnding(next)) awardEnding(next);
  else saveRound("drachen", { d: diff, s: storyIx, path: [...path] });

  renderScene();
}

// --- the ending: beat one, the part that happens exactly once ----------------
// Persist FIRST, then let her read. Because the store is already written,
// `inRound()` is false from here on: she may walk away in the middle of an
// ending and keeps the star she just earned.
function awardEnding(end) {
  const mask = addEnd(maskBefore, end.end);
  const masks = { ...(getGame("drachen").e ?? {}) };
  masks[diff] = withEndMask(masks[diff], storyIx, mask);
  setGame("drachen", { d: diff, s: storyIx, e: masks });
  clearRound("drachen");

  const oldStars = foundCount(maskBefore);
  const stars = foundCount(mask);
  // stars come from progress, never from repetition (§8.3): a known ending pays
  // nothing, however often she walks back to it
  const points = roundPoints({ oldStars, newStars: stars, difficulty: diff });
  wonTrophies = recordRound("drachen", { points }).newTrophies;

  roundOver = true;
  // the group flies into the basket while she is still reading the ending
  journey.setStars(stars);
  if (stars > oldStars) sfx.correct();

  // Paint the sheet NOW, though it is not shown until she taps on: the top bar
  // must stop reading ⭐ 0 the moment the star is in the store, and a sheet that
  // can be opened from the gear or the picker must never be opened blank.
  paintSummary({
    old: oldStars,
    stars,
    improved: stars > oldStars,
    diff,
    trophies: wonTrophies,
  });
}

// --- the ending: the part that may be drawn again ----------------------------
function paintEnding() {
  const fresh = endingFresh();
  const en = $("endname");
  // no emoji here: the ending's own picture is floated into the scene right
  // above, and a second copy of it two lines down reads as a stutter
  en.innerHTML = `<span class="en-n">${node.name}</span>`
    + `<span class="en-tag">${fresh ? t("drachenNewEnding") : t("drachenKnownEnding")}</span>`;
  en.classList.toggle("fresh", fresh);

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
  const mask = maskNow();
  const found = foundCount(mask);
  const left = END_SLOTS - found;
  const head = left === 0
    ? t("drachenAll")
    : `${t("drachenFound", { n: found, total: END_SLOTS })} · `
      + (left === 1 ? t("drachenLeft1") : t("drachenLeft", { n: left }));

  const rows = story.nodes.filter(isEnding).sort((a, b) => a.end - b.end).map((end) => {
    if (!hasEnd(mask, end.end)) {
      return `<li class="end hidden"><span class="end-e" aria-hidden="true">❔</span>`
        + `<span class="end-n">${t("drachenHidden")}</span></li>`;
    }
    const fresh = end.end === node.end && endingFresh() ? " fresh" : "";
    return `<li class="end found${fresh}"><span class="end-e" aria-hidden="true">${end.e}</span>`
      + `<span class="end-n">${end.name}</span></li>`;
  });

  $("sum-endings").innerHTML = `<p class="end-head">${head}</p><ul class="end-list">${rows.join("")}</ul>`;
}

// --- the ending: beat two ----------------------------------------------------
function finishStory() {
  if (!roundOver || summaryShown) return;
  if (isBounce(Date.now(), guardArmedAt)) return;

  journey.finish();
  summaryShown = true;
  revealSummary();
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
    // The story itself is content and does not translate; the chrome around it
    // does — the choices' spoken label, the ending's tag, the strip, the button.
    // Redrawing the scene is all of them at once, and it cannot pay a star
    // twice: the paying half lives in awardEnding.
    if (story) renderScene();
  },
  onClose() {
    if (summaryShown) summary.open();
  },
});

// The game opens on its map of stories, with the fox standing on the tile she
// left (§3.4) — unless a story was interrupted mid-read (§10.7): then the game
// rehydrates it, same story, same scene, the fox where she stood, with no
// picker and no dialog. A stale or foreign mirror falls back to the picker.
const saved = getGame("drachen");
storyIx = clampStoryIndex(diff, saved.s, CONTENT);
const interrupted = loadRound("drachen");
const canResume = interrupted
  && [0, 1, 2].includes(interrupted.d)
  && Number.isInteger(interrupted.s)
  && validStoryResume(interrupted, storiesFor(interrupted.d, CONTENT)[interrupted.s]);
if (canResume) {
  diff = interrupted.d;
  storyIx = interrupted.s;
  startStory(interrupted);
} else {
  clearRound("drachen"); // whatever it was, it cannot be resumed
  updateChip();
  picker.open();
}
