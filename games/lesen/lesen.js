// Lesen page module (§14): wires the pure logic to the DOM, using the shared
// engines (adaptive, journey, rewards, storage, i18n, audio). Structured like
// games/einmaleins/einmaleins.js — the ids and the phases are the same on
// purpose, so the CSS and the driving conventions transfer.
//
// The content is German for now (§14.6): the child reads CONTENT.de and her
// boxes live under box.de whatever the UI language says. An English content
// set is a later milestone and slots in beside both.

import { initI18n, t, getLang } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, boxesToString, hasProgress } from "../../assets/js/adaptive.js";
import { recordRound, roundPoints, starValue, clampDifficulty } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { confetti } from "../../assets/js/confetti.js";
import { trophyCardHTML } from "../../assets/js/trophycard.js";
import { openShowcase } from "../../assets/js/showcase.js";
import { initTopBar } from "../../assets/js/chrome.js";
import { createLeaveGuard } from "../../assets/js/leaveguard.js";
import { iconHTML } from "../../assets/js/graphics.js";
import { overlayFrom } from "../../assets/js/overlay.js";
import strings from "./i18n.js";
import { CONTENT, itemCount } from "./content.js";
import { createLevelPicker, packName } from "./picker.js";
import {
  ROUND_SIZE, DIFF_KEYS, MIXED, flashMs, poolFor, questionFor, optionsFor,
  starsFor, nextStarGoal, starGoalNeed, ownedStars, starDigit, withStarDigit,
  fittedFontSize,
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
const summary = overlayFrom(document.getElementById("sum-overlay"), {
  dismissible: false,
  initialFocus: "#sum-ok",
});
const SUM_OK_KEYS = ["sumOk1", "sumOk2", "sumOk3", "sumOk4", "sumOk5", "sumOk6"];
const NEXT_MS = 250;

// React on pointerdown for instant response on touch devices; the later
// synthetic click is suppressed. Keyboard activation still works via click.
function fastPress(btn, fn) {
  let usedPointer = false;
  btn.addEventListener("pointerdown", () => {
    usedPointer = true;
    fn();
  });
  btn.addEventListener("click", () => {
    if (usedPointer) {
      usedPointer = false;
      return;
    }
    fn();
  });
}

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
let best = 0; // stars already won on this tile, before the round
let roundOver = false;
let wonTrophies = []; // what this round just handed over, for the showcase
// The blitz (§14.2): which question the pending hide belongs to. A fast answer
// plus the 250ms transition can put the NEXT question up before an old timer
// fires — the token is what keeps a stale timer from hiding a fresh word.
let qToken = 0;
let flashTimer = 0;

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
    + `<span class="ph-txt">${t(DIFF_KEYS[diff])} · ${packName(diff, pack)}</span>`;
}

function startRound() {
  updateChip();
  bar.refresh();
  saved = getGame("lesen");
  const boxes = boxesFromString((saved.box ?? {}).de, COUNT);
  // No hardness boost: a young reader is meant to meet her whole pack, and the
  // Leitner boxes alone decide what returns (§14.3).
  session = createSession(poolFor(diff, pack, CONTENT.de), boxes, { roundSize: ROUND_SIZE });
  best = starDigit((saved.stars ?? {})[diff], pack);
  journey = createJourney($("journey"), {
    nodes: session.items().length,
    theme: "meadow",
    stars: best,
    worth: starValue(diff), // a Schwer star says "×3" on its way to the basket
  });
  roundOver = false;
  summary.close();
  askNext();
}

function askNext() {
  const id = session.next();
  if (id === null) return endRound();
  currentId = id;
  question = questionFor(id, CONTENT.de);
  options = question.kind === "word" ? optionsFor(id, CONTENT.de) : null;
  qToken++;
  $("feedback").hidden = true;
  card.hidden = false;
  card.classList.toggle("sent", question.kind === "sent");
  card.classList.remove("wc-hidden");
  renderQuestion();
  renderAnswers();
  renderStatus();
  // A word waits behind a cover until the child taps it (§14.2): the blitz must
  // not start before she has looked, or a word she never saw counts as a miss.
  // A sentence never flashes — nothing is taken away — so it shows at once, and
  // its verdicts are live immediately.
  if (question.kind === "word") {
    phase = "ready";
    card.classList.add("covered");
    setAnswersEnabled(false);
  } else {
    phase = "answer";
    card.classList.remove("covered");
    setAnswersEnabled(true);
  }
}

// Every answer button on or off in one place: while a word waits behind the
// cover, tapping an emoji would be a guess at a word not yet seen, so the
// buttons are inert until the reveal.
function setAnswersEnabled(on) {
  for (const b of $("answers").querySelectorAll("button")) b.disabled = !on;
}

// The child tapped the cover: show the word and start its blitz from this
// moment (§14.2). Idempotent and word-only — a second tap, or a tap on a
// sentence card, does nothing.
function reveal() {
  if (phase !== "ready") return;
  phase = "answer";
  card.classList.remove("covered");
  setAnswersEnabled(true);
  armFlash();
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
  // the driver watches this stamp to know a new question is up (play-lesen.js)
  $("question").dataset.q = String(qToken);
  fitQuestion();
}

// the wish size is viewport-relative, so a rotation needs a re-fit; the display
// face may also arrive after the first paint and change the measured width
window.addEventListener("resize", () => question && fitQuestion());
document.fonts?.ready.then(() => question && fitQuestion());

// Answers: four big emoji for a word (§14.1), two verdicts for a sentence.
// Built once per question and left alone — the aid re-uses the SAME buttons,
// so nothing moves under the finger that is already going for one.
function renderAnswers() {
  const box = $("answers");
  box.innerHTML = "";
  if (question.kind === "word") {
    const mc = document.createElement("div");
    mc.className = "mc mc-emoji";
    for (const opt of options) {
      const b = document.createElement("button");
      b.textContent = opt;
      fastPress(b, () => answerPress(opt, b));
      mc.appendChild(b);
    }
    box.appendChild(mc);
  } else {
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
  }
}

// One press handler for both kinds and both phases: a first answer submits,
// a press inside the aid is the retry — only the right one lets the round on.
function answerPress(value, btn) {
  if (roundOver) return;
  if (phase === "answer") return submit(value, btn);
  if (phase !== "wrong-wait") return;
  if (value === question.answer) {
    btn.classList.add("flash-ok");
    continueRound();
  } else {
    rejectRetry(btn);
  }
}

function submit(value, btn) {
  clearTimeout(flashTimer);
  const correct = value === question.answer;
  btn.classList.add(correct ? "flash-ok" : "flash-err");
  session.answer(currentId, correct);
  if (correct) {
    phase = "correct-wait";
    // the word comes back for the short pause — the child sees what she just
    // read standing next to the emoji she chose
    card.classList.remove("wc-hidden");
    sfx.correct();
    journey.advance();
    renderStatus(); // a banked star flies into the basket the moment it is won
    setTimeout(askNext, NEXT_MS);
  } else {
    phase = "wrong-wait";
    sfx.wrong();
    journey.stumble();
    // The aid needs the room; the whole scene hides while it is up.
    showFeedback(value);
  }
}

// Wrong answer (§8.1, §14.2): what she tapped, retracted — and the word back,
// persistently, no blitz. The way out is the right answer, given on the same
// buttons: for a word the right emoji, for a sentence the right verdict. No
// "Verstanden" button, no timer, exactly the einmaleins aid contract.
function showFeedback(wrong) {
  const fb = $("feedback");
  if (question.kind === "word") {
    fb.innerHTML = `<span class="eq eq-wrong"><s>${wrong}</s></span>
      <span class="eq"><b class="ans">${question.text}</b></span>`;
  } else {
    const verdict = question.answer
      ? `😊 ${t("lesenIsTrue")}`
      : `😜 ${t("lesenIsFalse")}`;
    fb.innerHTML = `<span class="fb-sent">${question.text}</span>
      <span class="eq"><b class="ans">${verdict}</b></span>`;
  }
  card.hidden = true;
  fb.hidden = false;
}

// The child tapped something that cannot become the answer.
function rejectRetry(el) {
  sfx.wrong();
  el.classList.remove("stumbling");
  void el.offsetWidth; // restart the animation on a second wrong try
  el.classList.add("stumbling");
}

// The only way out of the aid: the right answer, given.
function continueRound() {
  if (phase !== "wrong-wait") return;
  phase = "correct-wait";
  sfx.correct();
  setTimeout(askNext, NEXT_MS);
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

  setGame("lesen", {
    d: diff,
    p: pack,
    box: { ...(saved.box ?? {}), de: boxesToString(full, COUNT) },
    stars: starsObj,
  });

  // points come from progress, never from repetition (§8.3)
  const points = roundPoints({ oldStars: old, newStars: stars, difficulty: diff });
  const res = recordRound("lesen", { points });

  journey.finish();
  setTimeout(() => {
    $("sum-stars").textContent = stars > 0 ? "⭐".repeat(stars) : "🦊";
    $("sum-score").innerHTML = t("roundStat", { ok: firstTryOk, total })
      + (points > 0 ? ` <span class="gain">+${points} ⭐</span>` : "");
    const goal = nextStarGoal(stars);
    $("sum-goal").hidden = goal === null;
    if (goal) $("sum-goal").textContent = t(goal, { n: starGoalNeed(stars, total), total });
    $("sum-best").hidden = !improved;
    $("sum-best").textContent = t("newBest");
    // One round can cross several thresholds at once (§8.3) — the summary
    // holds every trophy it paid, each one the same card the album shows.
    const st = $("sum-trophy");
    const won = res.newTrophies;
    wonTrophies = won;
    st.hidden = won.length === 0;
    if (won.length > 0) {
      const size = [82, 68, 48][won.length - 1] ?? 48;
      const lang = getLang();
      st.innerHTML = won
        .map((s, i) => trophyCardHTML(s, {
          size, lang, cls: "won", button: true, attrs: `data-won="${i}"`,
        }))
        .join("");
      sfx.trophy();
    }
    $("sum-ok").textContent = t(SUM_OK_KEYS[Math.floor(Math.random() * SUM_OK_KEYS.length)]);
    bar.refresh(); // the top bar's counters just changed with the cookie
    summary.open();
    if (improved || stars === 3 || res.newTrophies.length > 0) confetti();
  }, 700);
}

// The one button in the summary opens the level picker, with the fox still
// standing on the tile she just played (§10.1).
$("sum-ok").addEventListener("click", picker.open);

// A trophy she just won, held up without leaving the round (§8.3).
$("sum-trophy").addEventListener("click", (e) => {
  const cardEl = e.target.closest(".won");
  if (cardEl) openShowcase(wonTrophies[Number(cardEl.dataset.won)]);
});

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
$("pickchip").addEventListener("click", picker.open);

// --- leaving a round that is not saved yet (§10.7) ---------------------------
// Only a round with an answer in it is worth a dialog (see einmaleins.js).
const guard = createLeaveGuard({
  mapUrl: new URL("../../", import.meta.url).href,
  inRound: () => session !== null && !roundOver && hasProgress(session.progress()),
});

// --- the shared top bar (§3.3) ----------------------------------------------
const bar = initTopBar({
  back: "../../",
  onLeave: guard.guardLink,
  onChange() {
    updateChip();
    // The verdict buttons speak the UI language; the words do not. Rebuilt
    // only between answers — inside the aid the buttons hold the child's
    // struck answer, and that state outranks a translation.
    if (!roundOver && session && phase === "answer") renderAnswers();
  },
  onClose() {
    if (roundOver) summary.open();
  },
});

// The game opens on its map of levels, with the fox standing on the tile she
// left (§3.4).
updateChip();
picker.open();
