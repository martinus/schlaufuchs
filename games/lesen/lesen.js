// Lesen page module (§14): wires the pure logic to the DOM, using the shared
// engines (adaptive, journey, rewards, storage, i18n, audio). Structured like
// games/einmaleins/einmaleins.js — the ids and the phases are the same on
// purpose, so the CSS and the driving conventions transfer.
//
// The content is German for now (§14.6): the child reads CONTENT.de and her
// boxes live under box.de whatever the UI language says. An English content
// set is a later milestone and slots in beside both.

import { initI18n, t } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, boxesToString, hasProgress, validResume } from "../../assets/js/adaptive.js";
import { saveRound, loadRound, clearRound } from "../../assets/js/roundstore.js";
import { recordRound, roundPoints, starValue, clampDifficulty } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { fastPress } from "../../assets/js/fastpress.js";
import { blitzFlash } from "../../assets/js/blitz.js";
import { restartAnimation } from "../../assets/js/anim.js";
import { createRoundSummary } from "../../assets/js/roundsummary.js";
import { initTopBar } from "../../assets/js/chrome.js";
import { createLeaveGuard } from "../../assets/js/leaveguard.js";
import { iconHTML } from "../../assets/js/graphics.js";
import strings from "./i18n.js";
import { CONTENT, itemCount } from "./content.js";
import { createLevelPicker, packFace } from "./picker.js";
import {
  ROUND_SIZE, DIFF_KEYS, MIXED, flashMs, poolFor, questionFor, optionsFor,
  starsFor, ownedStars, starDigit, withStarDigit,
  fittedFontSize, median, tempoTier, awardTempo,
  isBounce,
} from "./logic.js";

initI18n(strings);

const $ = (id) => document.getElementById(id);
const COUNT = itemCount("de");

// The two overlays this page owns (picker.js holds the picker's tiles and fox;
// the round state stays here). Same contract as einmaleins: the picker can be
// waved away, the summary cannot.
const picker = createLevelPicker(document.getElementById("pick-overlay"), {
  current: () => ({ diff, pack }),
  onPick(d, p) {
    diff = d;
    pack = p;
    startRound();
  },
  onDismiss() {
    if (roundOver) summary.open();
    else if (!session) startRound();
  },
});
const { summary, show: showSummary } = createRoundSummary({
  picker,
  refresh: () => bar.refresh(),
});
const NEXT_MS = 250;
// A correct reading answer is held a beat longer than a Leicht tap (§14.2): the
// scene emoji cheers and the win lingers, so the reading — the real work on
// Schwer — feels rewarded, not just ticked off. It never touches the tempo
// clock, which stops at the answer, not at the next question.
const READ_NEXT_MS = 650;

// --- persistent state ------------------------------------------------------
let saved = getGame("lesen");
let diff = clampDifficulty(saved.d);
let pack = Number.isInteger(saved.p) && saved.p >= 0 && saved.p <= MIXED ? saved.p : 0;

// --- round state -----------------------------------------------------------
// `session` is also the answer to "is there a round on the stage?" — the picker
// asks it when it is dismissed rather than chosen from.
let session = null;
let journey = null;
let question = null;
let options = null; // word questions: this question's four emoji, kept for the aid
let currentId = null;
let phase = "answer"; // answer | correct-wait | wrong-wait
// When the last accepted answer press landed (§14.2): a second press within
// GUARD_MS of it is the bounce of a double-click and is ignored, so it cannot
// answer the next question — or skip the aid — before the child has read it.
let guardArmedAt = 0;
let best = 0; // stars already won on this tile, before the round
let roundOver = false;
// The blitz (§14.2): which question the pending hide belongs to. A fast answer
// plus the 250ms transition can put the NEXT question up before an old timer
// fires — the token is what keeps a stale timer from hiding a fresh word.
let qToken = 0;
let flashTimer = 0;
// The tempo ladder's raw material (§10.6, §14.4): when the child could first
// see the current question — the reveal tap for a word, the show for a
// sentence — and how long each first-try-correct answer took. The child only
// ever meets these as a symbol, never as a number of time.
let qShownAt = 0;
let answerTimes = [];
let missedIds = new Set();

const card = document.getElementById("wordcard");

// The cover is the whole card face while a word waits (§14.2): tapping it — the
// same fast pointer path the answers use — reveals the word and starts its
// blitz. Keyboard activation reaches it as a click, because it is a <button>.
fastPress(document.getElementById("wc-cover"), reveal);

// The round's title carries the meadow's own symbol, so the child can see
// which place on the map she is standing in without reading its name (§3.1).
function updateChip() {
  $("pickchip").innerHTML =
    `<span class="ph-sym" aria-hidden="true">${iconHTML("region-lesen", { size: 20 })}</span>`
    + `<span class="ph-txt">${t(DIFF_KEYS[diff])}<span class="ph-sep" aria-hidden="true"></span>${packFace(diff, pack)}</span>`;
}

// `resume` is a round mirror from roundstore.js (§10.7); without one the
// start is fresh and any stale mirror is dropped — a chosen tile outranks an
// interrupted round on another.
function startRound(resume = null) {
  updateChip();
  bar.refresh();
  saved = getGame("lesen");
  const boxes = boxesFromString((saved.box ?? {}).de, COUNT);
  const pool = poolFor(diff, pack, CONTENT.de);
  const snap = resume && validResume(resume.s, pool) ? resume : null;
  if (!snap) clearRound("lesen");
  // No hardness boost: a young reader is meant to meet her whole pack, and the
  // Leitner boxes alone decide what returns (§14.3).
  session = createSession(pool, boxes, { roundSize: ROUND_SIZE, resume: snap?.s });
  best = starDigit((saved.stars ?? {})[diff], pack);
  journey = createJourney($("journey"), {
    nodes: session.items().length,
    theme: "meadow",
    stars: best,
    worth: starValue(diff), // a Schwer star says "×3" on its way to the basket
  });
  roundOver = false;
  answerTimes = snap?.times ?? [];
  missedIds = new Set(snap?.missed);
  // walk the fox back to where the interruption found her (§10.7)
  for (let i = session.progress().solved; i > 0; i--) journey.advance();
  summary.close();
  askNext();
}

function askNext() {
  const id = session.next();
  if (id === null) return endRound();
  currentId = id;
  question = questionFor(id, CONTENT.de);
  options = question.kind === "word" || question.kind === "read" ? optionsFor(id, CONTENT.de) : null;
  qToken++;
  $("feedback").hidden = true;
  card.hidden = false;
  card.classList.toggle("read", question.kind === "read");
  card.classList.toggle("sent", question.kind === "sent");
  card.classList.remove("wc-hidden");
  renderQuestion();
  renderAnswers();
  renderStatus();
  // A word waits behind a cover until the child taps it (§14.2): the blitz must
  // not start before she has looked, or a word she never saw counts as a miss.
  // A Mittel sentence or a Schwer passage never flashes — nothing is taken away
  // — so it shows at once, its answers live immediately, its clock starts here.
  if (question.kind === "word") {
    phase = "ready";
    card.classList.add("covered");
    setAnswersEnabled(false);
  } else {
    phase = "answer";
    card.classList.remove("covered");
    setAnswersEnabled(true);
    qShownAt = Date.now();
  }
}

// Every answer button on or off in one place: while a word waits behind the
// cover, tapping an emoji would be a guess at a word not yet seen, so the
// buttons are inert until the reveal.
function setAnswersEnabled(on) {
  for (const b of $("answers").querySelectorAll("button")) b.disabled = !on;
}

// The child tapped the cover: show the word and start its blitz — and its
// tempo clock (§14.4) — from this moment (§14.2). The time behind the cover is
// hers for free: she starts the blitz and the clock, never the page. Idempotent
// and word-only — a second tap, or a tap on a sentence card, does nothing.
function reveal() {
  if (phase !== "ready") return;
  phase = "answer";
  card.classList.remove("covered");
  setAnswersEnabled(true);
  armFlash();
  qShownAt = Date.now();
}

// The blitz (§14.2): the word hides after its Leitner box's flash time — the
// better it sits, the shorter the look. The timer is JS, the fade is a CSS
// *transition*: under prefers-reduced-motion the site kills transitions, so
// the hide degrades to instant and the mechanic survives. A CSS animation
// would never hide the word at all. Answering during the flash is allowed —
// that IS the fluent path. Sentences never flash (flashMs returns null).
function armFlash() {
  clearTimeout(flashTimer);
  const ms = question.kind === "word" ? flashMs(session.boxes()[currentId], diff) : null;
  if (ms === null) return;
  const token = qToken;
  flashTimer = setTimeout(() => {
    if (token === qToken && phase === "answer") card.classList.add("wc-hidden");
  }, ms);
}

// The scene says it all: the basket holds what you own, the sky what is left.
function renderStatus() {
  const owned = ownedStars(session.progress(), best);
  journey.setStars(owned);
  $("journey").setAttribute("aria-label", t("starsOwned", { n: owned }));
}

// The word never wraps: "Geburtstags-kuchen" is two reads, and the blitz pays
// for one. When the CSS size would overflow, shrink this one word to fit.
// Sentences wrap instead (the CSS says so) and skip the fitting.
function fitQuestion() {
  const el = $("question");
  el.style.fontSize = "";
  if (question?.kind !== "word") return;
  const size = parseFloat(getComputedStyle(el).fontSize);
  const fitted = fittedFontSize(size, el.clientWidth, el.scrollWidth);
  if (fitted !== size) el.style.fontSize = `${fitted}px`;
}

function renderQuestion() {
  $("question").textContent = question.text;
  // Schwer runs the passage and its question together as ONE flowing block, so
  // the question is the last sentence of the text and not a line of its own
  // (§14.2). The passage keeps a trailing space so the two inline elements read
  // with a gap between them; the other kinds hide the passage. The question
  // stays its own element (the driver's stamp and the answer key live on it).
  const passage = $("passage");
  passage.hidden = question.kind !== "read";
  passage.textContent = question.kind === "read" ? `${question.passage} ` : "";
  // The picture-book anchor (§14.2): a scene emoji floated beside the passage,
  // so a Schwer screen is as inviting as the emoji of Leicht instead of a wall
  // of grey text. Kept OUT of #question/#passage on purpose — the round driver
  // reads their text to find the answer, and the scene must never join it.
  const scene = $("scene");
  scene.hidden = question.kind !== "read" || !question.scene;
  scene.textContent = question.kind === "read" ? (question.scene ?? "") : "";
  scene.classList.remove("cheer");
  // the driver watches this stamp to know a new question is up (play-lesen.js)
  $("question").dataset.q = String(qToken);
  fitQuestion();
}

// the wish size is viewport-relative, so a rotation needs a re-fit; the display
// face may also arrive after the first paint and change the measured width
window.addEventListener("resize", () => question && fitQuestion());
document.fonts?.ready.then(() => question && fitQuestion());

// Answers: four big emoji for a word (§14.1), two verdicts for a Mittel sentence
// (§14.1), four wrapping text answers for a Schwer passage (§14.2). Built once
// per question and left alone — the aid re-uses the SAME buttons, so nothing
// moves under the finger already going for one. The word and reading kinds
// submit the chosen option itself; the sentence submits its boolean verdict.
function renderAnswers() {
  const box = $("answers");
  box.innerHTML = "";
  if (question.kind === "sent") {
    const v = document.createElement("div");
    v.className = "verdict";
    for (const [val, key, cls, sym] of [[true, "lesenTrue", "v-yes", "✓"], [false, "lesenFalse", "v-no", "✗"]]) {
      const b = document.createElement("button");
      b.className = cls;
      b.innerHTML = `<span class="v-sym" aria-hidden="true">${sym}</span>${t(key)}`;
      fastPress(b, () => answerPress(val, b));
      v.appendChild(b);
    }
    box.appendChild(v);
    return;
  }
  const mc = document.createElement("div");
  mc.className = question.kind === "word" ? "mc mc-emoji" : "mc mc-read";
  for (const opt of options) {
    const b = document.createElement("button");
    b.textContent = opt;
    fastPress(b, () => answerPress(opt, b));
    mc.appendChild(b);
  }
  box.appendChild(mc);
}

// One press handler for both kinds and both phases: a first answer submits,
// a press inside the aid is the retry — only the right one lets the round on.
function answerPress(value, btn) {
  if (roundOver) return;
  // Swallow the second tap of a double-click (§14.2): too soon after the last
  // press to be a read, so it is a bounce, not a choice. Measured against the
  // previous press — never the question's age — so a deliberate fast answer
  // still lands the instant she is ready.
  const now = Date.now();
  if (isBounce(now, guardArmedAt)) return;
  guardArmedAt = now;
  if (phase === "answer") return submit(value, btn);
  if (phase !== "wrong-wait") return;
  if (value === question.answer) {
    btn.classList.add("flash-ok", "ans-hop");
    continueRound();
  } else if (question.kind === "read") {
    // Schwer never reveals the answer (§14.2): a wrong tile is struck out and
    // retired, the passage stays on screen, and she reads again and picks among
    // the rest until she finds it. Word/Mittel keep the re-teaching aid retry.
    retireWrong(btn);
  } else {
    rejectRetry(btn);
  }
}

// The ⚡ (blitz.js) is appended to the stage, not the word card — the card
// flips and hides (transforms and overflow that would clip or re-anchor the
// flight), while `.stage .blitz` positions against the stage.
function submit(value, btn) {
  clearTimeout(flashTimer);
  const correct = value === question.answer;
  // The lively tap moment (§14.2): the right tile hops with a ✓, the wrong one
  // shakes. Decorative — the green/red flash says correct/wrong on its own.
  btn.classList.add(correct ? "flash-ok" : "flash-err", correct ? "ans-hop" : "ans-shake");
  session.answer(currentId, correct);
  if (correct) {
    // Only a first try feeds the tempo ladder (§10.6, §14.4): an item that was
    // ever missed this round contributes nothing, so speed can never buy back
    // what a wrong answer cost. One answer at rocket speed earns its ⚡ now.
    if (!missedIds.has(currentId)) {
      const took = Date.now() - qShownAt;
      answerTimes.push(took);
      if (tempoTier(took, diff) === 3) blitzFlash(document.querySelector(".stage"));
    }
    phase = "correct-wait";
    // the word comes back for the short pause — the child sees what she just
    // read standing next to the emoji she chose
    card.classList.remove("wc-hidden");
    sfx.correct();
    journey.advance();
    renderStatus(); // a banked star flies into the basket the moment it is won
    // A reading answer earns a warm beat (§14.2): the scene emoji cheers (a
    // keyframe pop, decorative only — reduced motion stills it and nothing
    // depends on it running, §10.5) and the win is held a touch longer than a
    // Leicht tap.
    const celebrate = question.kind === "read";
    if (celebrate) $("scene").classList.add("cheer");
    setTimeout(askNext, celebrate ? READ_NEXT_MS : NEXT_MS);
  } else {
    missedIds.add(currentId);
    phase = "wrong-wait";
    sfx.wrong();
    journey.stumble();
    // Schwer never reveals the answer (§14.2): keep the passage on screen and
    // just retire the wrong tile (its flash-err + ans-shake are already on it),
    // so she reads again and picks until it is right. Word and Mittel still open
    // the re-teaching aid — a blitzed word or a verdict she may not have grasped.
    if (question.kind === "read") btn.disabled = true;
    else showFeedback(value);
  }
  // Mirror the round after every recorded answer (§10.7): an interruption from
  // here on resumes instead of costing the round.
  saveRound("lesen", {
    d: diff, p: pack, s: session.snapshot(),
    times: answerTimes, missed: [...missedIds],
  });
}

// Wrong answer (§8.1, §14.2): what she tapped, retracted, and the right one
// given — the way out is choosing it on the same buttons. For a word: the right
// emoji. For a Mittel sentence: the sentence and the verdict it should have got.
// Schwer does NOT come here — it never reveals its answer (§14.2), she simply
// picks again. No "Verstanden" button, no timer — the einmaleins aid contract.
function showFeedback(wrong) {
  const fb = $("feedback");
  if (question.kind === "word") {
    fb.innerHTML = `<span class="eq eq-wrong"><s>${wrong}</s></span>
      <span class="eq"><b class="ans">${question.text}</b></span>`;
  } else {
    const verdict = question.answer ? `😊 ${t("lesenIsTrue")}` : `😜 ${t("lesenIsFalse")}`;
    fb.innerHTML = `<span class="fb-sent">${question.text}</span>
      <span class="eq"><b class="ans">${verdict}</b></span>`;
  }
  card.hidden = true;
  fb.hidden = false;
}

// A retired Schwer answer (§14.2): struck out red, shaken, and disabled, so she
// cannot tap it again and picks from what is left. The answer is never revealed.
function retireWrong(btn) {
  sfx.wrong();
  btn.classList.add("flash-err", "ans-shake");
  btn.disabled = true;
}

// The child tapped something that cannot become the answer (the word/Mittel aid).
function rejectRetry(el) {
  sfx.wrong();
  restartAnimation(el, "stumbling");
}

// The only way out of the aid: the right answer, given. The missed word still
// ends here — so the fox still takes her step, onto a red waypoint, and the
// path grows by the re-queued ask (§10.5).
function continueRound() {
  if (phase !== "wrong-wait") return;
  phase = "correct-wait";
  sfx.correct();
  // The missed word still ends here — the fox takes her step onto a red
  // waypoint, and the path grows by the re-queued ask (§10.5).
  journey.advanceMissed();
  renderStatus();
  // Finding the right answer after a miss earns the same warm beat as a first-try
  // read (§14.2): on Schwer the passage is still on screen, so the scene emoji
  // cheers and the win lingers a touch. Word/Mittel came via the aid (no scene).
  const celebrate = question.kind === "read";
  if (celebrate) $("scene").classList.add("cheer");
  setTimeout(askNext, celebrate ? READ_NEXT_MS : NEXT_MS);
}

function endRound() {
  roundOver = true;
  const { firstTryOk, total } = session.progress();
  const stars = starsFor(firstTryOk, total);

  // persist boxes + best stars (§14.5); boxes live under their language
  const full = boxesFromString((saved.box ?? {}).de, COUNT);
  Object.assign(full, session.boxes());
  const starsObj = { ...(saved.stars ?? {}) };
  const old = starDigit(starsObj[diff], pack);
  const improved = stars > old;
  if (improved) starsObj[diff] = withStarDigit(starsObj[diff], pack, stars);

  // The tempo ladder (§10.6, §14.4): the round's median answer time as a tier,
  // gated by two stars and stored only upward — the same digit strings the
  // stars use, one per difficulty. Computed here, painted below as a symbol.
  const tier = tempoTier(median(answerTimes), diff);
  const tempoObj = { ...(saved.tempo ?? {}) };
  const oldTempo = starDigit(tempoObj[diff], pack);
  const newTempo = awardTempo({ stars, tier, best: oldTempo });
  const tempoImproved = newTempo > oldTempo;
  if (tempoImproved) tempoObj[diff] = withStarDigit(tempoObj[diff], pack, newTempo);

  setGame("lesen", {
    d: diff,
    p: pack,
    box: { ...(saved.box ?? {}), de: boxesToString(full, COUNT) },
    stars: starsObj,
    tempo: tempoObj,
  });
  // the round is in the store now; its mirror has nothing left to protect
  clearRound("lesen");

  // points come from progress, never from repetition (§8.3)
  const points = roundPoints({ oldStars: old, newStars: stars, difficulty: diff });
  const res = recordRound("lesen", { points });

  journey.finish();
  showSummary({ old, stars, improved, diff, tier, tempoImproved, trophies: res.newTrophies });
}

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
$("pickchip").addEventListener("click", picker.open);

// --- leaving a round that is not saved yet (§10.7) ---------------------------
// Only a round with an answer in it is worth a dialog (see einmaleins.js).
// A confirmed leave also drops the round's mirror — "Zur Karte" on the sheet
// means it; every other way off the page is an accident to resume from.
const guard = createLeaveGuard({
  mapUrl: new URL("../../", import.meta.url).href,
  inRound: () => session !== null && !roundOver && hasProgress(session.progress()),
  onGo: () => clearRound("lesen"),
});

// --- the shared top bar (§3.3) ----------------------------------------------
const bar = initTopBar({
  back: "../../",
  help: "lesen",
  onLeave: guard.guardLink,
  onChange() {
    updateChip();
    // Word and passage answers are content (emoji, or the passage's own answers)
    // and do not translate — but a Mittel sentence's verdict buttons say
    // "Stimmt!/Quatsch!" in the UI language, so they are rebuilt on a switch.
    // Only between answers: inside the aid the buttons hold her struck verdict,
    // and that state outranks a translation (the chip above is already redone).
    if (!roundOver && session && phase === "answer" && question?.kind === "sent") renderAnswers();
  },
  onClose() {
    if (roundOver) summary.open();
  },
});

// The game opens on its map of levels, with the fox standing on the tile she
// left (§3.4) — unless a round was interrupted mid-play (§10.7): then the game
// rehydrates it, same tile, same queue, the fox where she stood, with no
// picker and no dialog. A stale or foreign mirror falls back to the picker.
const interrupted = loadRound("lesen");
const canResume = interrupted
  && [0, 1, 2].includes(interrupted.d)
  && Number.isInteger(interrupted.p)
  && validResume(interrupted.s, poolFor(interrupted.d, interrupted.p, CONTENT.de));
if (canResume) {
  diff = interrupted.d;
  pack = interrupted.p;
  startRound(interrupted);
} else {
  clearRound("lesen"); // whatever it was, it cannot be resumed
  updateChip();
  picker.open();
}
