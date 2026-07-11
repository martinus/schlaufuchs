// Rechnungen page module (§12): wires the pure logic to the DOM, using the
// shared engines (adaptive, journey, rewards, storage, i18n, audio). Structured
// like games/einmaleins/einmaleins.js — the ids and the phases are the same on
// purpose, so the CSS and the driving conventions transfer. Keypad input on
// every difficulty (§12); no multiple choice.
//
// The one structural difference from einmaleins: the Leitner box persists per
// SKILL BUCKET, not per question. `startRound` seeds each variant item-id's box
// from its bucket, so the shared engine weights by mastery; `endRound` folds
// the round's per-bucket outcome back with `foldBoxes` (§12.2).

import { initI18n, t, getLang } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, hasProgress, validResume } from "../../assets/js/adaptive.js";
import { saveRound, loadRound, clearRound } from "../../assets/js/roundstore.js";
import { recordRound, roundPoints, starValue, clampDifficulty } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { confetti } from "../../assets/js/confetti.js";
import { trophyCardHTML } from "../../assets/js/trophycard.js";
import { openShowcase } from "../../assets/js/showcase.js";
import { initTopBar } from "../../assets/js/chrome.js";
import { createLeaveGuard } from "../../assets/js/leaveguard.js";
import { iconHTML } from "../../assets/js/graphics.js";
import { overlayFrom, anyOverlayOpen } from "../../assets/js/overlay.js";
import strings from "./i18n.js";
import { createLevelPicker, modeSymbol } from "./picker.js";
import {
  MODES, BUCKET_COUNT, ROUND_SIZE, DIFF_KEYS, TEMPO_ICONS, TEMPO_KEYS,
  poolFor, bucketOf, questionFor, foldBoxes,
  starsFor, nextStarGoal, starGoalNeed, ownedStars, starDigit, withStarDigit,
  fittedFontSize, retryStep, median, tempoTier, awardTempo,
} from "./logic.js";

initI18n(strings);

const $ = (id) => document.getElementById(id);

// The two overlays this page owns (picker.js holds the picker's tiles and fox;
// the round state stays here). Same contract as einmaleins: the picker can be
// waved away, the summary cannot.
const picker = createLevelPicker(document.getElementById("pick-overlay"), {
  current: () => ({ diff, mode }),
  onPick(d, m) {
    diff = d;
    mode = m;
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
let saved = getGame("rechnungen");
let diff = clampDifficulty(saved.d);
let mode = MODES.includes(saved.m) ? saved.m : "+";

// --- round state -----------------------------------------------------------
let session = null;
let journey = null;
let question = null; // the concrete question realised from the current bucket
let currentId = null;
let input = "";
let buffer = ""; // digits typed during the short post-correct transition
let retry = ""; // the answer the child re-enters after getting it wrong
let phase = "answer"; // answer | correct-wait | wrong-wait
let best = 0; // stars already won on this tile, before the round
let roundOver = false;
let wonTrophies = [];
let qCounter = 0; // the stamp the driver watches for a new question
// The tempo ladder's raw material (§10.6): when the current question appeared,
// and how long each first-try-correct answer took.
let qShownAt = 0;
let answerTimes = [];
let missedIds = new Set(); // item ids missed this round — they cannot feed tempo
// The per-bucket box fold (§12.2): every bucket touched, and every one that was
// ever missed this round (a miss drops the bucket to box 0).
let touchedBuckets = new Set();
let missedBuckets = new Set();

// The round's title carries the mountain's own symbol, so the child can see
// which place on the map she is standing in without reading its name (§3.1).
function updateChip() {
  $("pickchip").innerHTML =
    `<span class="ph-sym" aria-hidden="true">${iconHTML("region-rechnungen", { size: 20 })}</span>`
    + `<span class="ph-txt">${t(DIFF_KEYS[diff])} · ${modeSymbol(mode)}</span>`;
}

// `resume` is a round mirror from roundstore.js (§10.7); without one the start
// is fresh and any stale mirror is dropped — a chosen tile outranks an
// interrupted round on another.
function startRound(resume = null) {
  updateChip();
  bar.refresh();
  saved = getGame("rechnungen");
  const bucketBoxes = boxesFromString(saved.box, BUCKET_COUNT);
  const pool = poolFor(mode, diff);
  // Seed every variant's box from its bucket, so the engine weights weak skills
  // up exactly as the Leitner boxes say — the variants only exist to give a
  // round of ten more items than a two-bucket cell could otherwise offer.
  const seeded = {};
  for (const id of pool) seeded[id] = bucketBoxes[bucketOf(id)];
  const snap = resume && validResume(resume.s, pool) ? resume : null;
  if (!snap) clearRound("rechnungen");
  session = createSession(pool, seeded, { roundSize: ROUND_SIZE, resume: snap?.s });
  best = starDigit((saved.stars ?? {})[mode], diff);
  journey = createJourney($("journey"), {
    nodes: session.items().length,
    theme: "mountain", // the fox climbs; the summit is the basket (§12)
    stars: best,
    worth: starValue(diff), // a Schwer star says "×3" on its way to the basket
  });
  buffer = "";
  roundOver = false;
  answerTimes = snap?.times ?? [];
  missedIds = new Set(snap?.missed);
  touchedBuckets = new Set(snap?.touched);
  missedBuckets = new Set(snap?.missedB);
  for (let i = session.progress().solved; i > 0; i--) journey.advance();
  summary.close();
  buildKeypad();
  askNext();
}

function askNext() {
  const id = session.next();
  if (id === null) return endRound();
  currentId = id;
  // A fresh concrete question for this bucket. A re-queued miss therefore
  // returns as the SAME skill with NEW numbers (§12.2) — which is the point.
  question = questionFor(id, Math.random, t("divSign"));
  input = buffer.slice(0, 4);
  buffer = "";
  retry = "";
  phase = "answer";
  qCounter++;
  $("feedback").hidden = true;
  $("question").hidden = false;
  renderQuestion();
  renderStatus();
  qShownAt = Date.now(); // the tempo clock starts when the question is up (§10.6)
}

function renderStatus() {
  const owned = ownedStars(session.progress(), best);
  journey.setStars(owned);
  $("journey").setAttribute("aria-label", t("starsOwned", { n: owned }));
}

function fitQuestion() {
  const el = $("question");
  el.style.fontSize = "";
  const size = parseFloat(getComputedStyle(el).fontSize);
  const fitted = fittedFontSize(size, el.clientWidth, el.scrollWidth);
  if (fitted !== size) el.style.fontSize = `${fitted}px`;
}

// German writes division as a colon, and a colon sits on the baseline: lifted
// to the optical middle it reads as an operator. "÷" is already centred, so the
// wrap is a no-op in English. (The minus "−" and times "×" already sit centred.)
function eqHTML(text) {
  return text.replaceAll(":", '<span class="divsign">:</span>');
}

function renderQuestion() {
  const shown = input === "" ? "?" : input;
  $("question").innerHTML = eqHTML(question.text).replace(
    "?",
    `<span class="gap">${shown}</span>`,
  );
  // the driver watches this stamp to know a new question is up (play-rechnungen.js)
  $("question").dataset.q = String(qCounter);
  fitQuestion();
}

window.addEventListener("resize", () => question && fitQuestion());
document.fonts?.ready.then(() => question && fitQuestion());

// Keypad (every difficulty): built ONCE per round and kept in the DOM, so no
// tap can land on a node that is being replaced mid-press.
function buildKeypad() {
  const box = $("answers");
  box.innerHTML = "";
  const kp = document.createElement("div");
  kp.className = "keypad";
  for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]) {
    const b = document.createElement("button");
    b.textContent = k;
    if (k === "OK") b.classList.add("kp-ok");
    if (k === "⌫") b.classList.add("kp-del");
    fastPress(b, () => keyPress(k));
    kp.appendChild(b);
  }
  box.appendChild(kp);
}

function keyPress(k) {
  if (roundOver) return;
  if (phase === "wrong-wait") {
    const step = retryStep(retry, k, question.answer);
    if (step.state === "reject") return rejectRetry();
    retry = step.input;
    renderRetry();
    if (step.state === "done") continueRound();
    else sfx.click();
    return;
  }
  if (phase === "correct-wait") {
    if (/^[0-9]$/.test(k)) buffer = (buffer + k).slice(0, 4);
    return;
  }
  sfx.click();
  if (k === "⌫") input = input.slice(0, -1);
  else if (k === "OK") {
    if (input !== "") submit(Number(input));
    return;
  } else if (input.length < 4) input += k;
  renderQuestion();
}

// Tapping a keypad button focuses it. Enter would then also fire the browser's
// default click on the focused button, re-entering that digit — so this owns
// every key it handles (see einmaleins for the long version).
document.addEventListener("keydown", (e) => {
  if (anyOverlayOpen()) return;
  if (/^[0-9]$/.test(e.key)) keyPress(e.key);
  else if (e.key === "Backspace") keyPress("⌫");
  else if (e.key === "Enter") keyPress("OK");
  else return;
  e.preventDefault();
});

// The ⚡ moment (§10.6): one answer at rocket speed, marked the instant it
// lands. Appended to the stage, not the question — renderQuestion rewrites the
// question's innerHTML in this same tick and would eat it. The flight is a
// transition, so reduced motion degrades to "briefly there" (§10.5).
function blitzFlash() {
  const b = document.createElement("span");
  b.className = "blitz";
  b.setAttribute("aria-hidden", "true");
  b.textContent = "⚡";
  $("question").parentElement.appendChild(b);
  requestAnimationFrame(() => b.classList.add("gone"));
  setTimeout(() => b.remove(), 800);
  sfx.blitz();
}

function submit(value) {
  const correct = value === question.answer;
  const bkt = bucketOf(currentId);
  session.answer(currentId, correct);
  touchedBuckets.add(bkt);
  if (correct) {
    // Only a first try feeds the tempo ladder (§10.6): an item ever missed this
    // round contributes nothing. One answer at rocket speed earns its ⚡ now.
    if (!missedIds.has(currentId)) {
      const took = Date.now() - qShownAt;
      answerTimes.push(took);
      if (tempoTier(took, diff) === 3) blitzFlash();
    }
    phase = "correct-wait";
    sfx.correct();
    journey.advance();
    renderStatus();
    if (input !== "") {
      input = String(value);
      renderQuestion();
    }
    setTimeout(askNext, NEXT_MS);
  } else {
    missedIds.add(currentId);
    missedBuckets.add(bkt);
    phase = "wrong-wait";
    retry = "";
    sfx.wrong();
    journey.stumble();
    showFeedback(value);
  }
  // Mirror the round after every recorded answer (§10.7).
  saveRound("rechnungen", {
    d: diff, m: mode, s: session.snapshot(),
    times: answerTimes, missed: [...missedIds],
    touched: [...touchedBuckets], missedB: [...missedBuckets],
  });
}

// The dot grid (§12.1: „dot grid for ×"): the product as rows of the divisor's
// or the multiplicand's width, so the child sees the groups. Skipped when the
// count would be a wall — a three-digit dividend is a number line's job, not a
// grid's.
function dotGridHTML(q) {
  const cols = q.b;
  const count = q.op === ":" ? q.a : q.a * q.b; // ÷: the dividend, in divisor columns
  if (!(cols > 0) || count > 60) return "";
  return `<div class="dotgrid" style="grid-template-columns: repeat(${cols}, auto)">${"<i></i>".repeat(count)}</div>`;
}

// The number line (§12.1: „number line for ±"): a track from 0 to the largest
// number in the equation, with a marker where the answer sits. Self-contained
// inline styles, so the aid needs no stylesheet of its own.
function numberLineHTML(q) {
  const nums = [q.a, q.b, q.c, q.answer].filter(Number.isInteger);
  const max = Math.max(...nums, 1);
  const cx = (4 + (Math.max(0, q.answer) / max) * 92).toFixed(1);
  return `<div class="numline" style="width:100%;max-width:280px;margin:0.35rem auto 0">
    <svg viewBox="0 0 100 12" preserveAspectRatio="none" width="100%" height="16" aria-hidden="true">
      <line x1="4" y1="6" x2="96" y2="6" stroke="#c9b79c" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="${cx}" cy="6" r="3.6" fill="#e8720c"/>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#6b6257">
      <span>0</span><span>${max}</span>
    </div>
  </div>`;
}

// Wrong answer (§8.1): the child's own answer, struck through in red; the true
// equation under it in green; a one-line visual aid (number line for ±, dot grid
// for ×/÷). It stays until she enters the right answer herself — no timer, no
// "Verstanden".
function showFeedback(wrong) {
  const wrongEq = eqHTML(question.text).replace("?", wrong);
  const rightEq = eqHTML(question.text).replace("?", `<b class="ans">${question.answer}</b>`);
  const visual = question.op === "x" || question.op === ":" ? dotGridHTML(question) : numberLineHTML(question);
  const fb = $("feedback");
  fb.innerHTML = `<span class="eq eq-wrong"><s>${wrongEq}</s></span>
    <span class="eq">${rightEq}</span>
    ${visual}
    <span class="gap" id="retry-gap">?</span>`;
  $("question").hidden = true;
  fb.hidden = false;
}

function renderRetry() {
  const gap = $("retry-gap");
  if (gap) gap.textContent = retry === "" ? "?" : retry;
}

function rejectRetry() {
  retry = "";
  renderRetry();
  sfx.wrong();
  const shake = $("retry-gap");
  if (!shake) return;
  shake.classList.remove("stumbling");
  void shake.offsetWidth; // restart the animation on a second wrong try
  shake.classList.add("stumbling");
}

// The only way out of the aid: the right answer, entered.
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

  // persist the per-bucket boxes and the best stars (§12.2, §12.3)
  const box = foldBoxes(saved.box, [...touchedBuckets], [...missedBuckets], BUCKET_COUNT);
  const starsObj = { ...(saved.stars ?? {}) };
  const old = starDigit(starsObj[mode], diff);
  const improved = stars > old;
  if (improved) starsObj[mode] = withStarDigit(starsObj[mode], diff, stars);

  // The tempo ladder (§10.6): the round's median answer time as a tier, gated by
  // two stars and stored only upward — the same digit strings the stars use,
  // per mode. Computed here, painted below only as a symbol.
  const tier = tempoTier(median(answerTimes), diff);
  const tempoObj = { ...(saved.tempo ?? {}) };
  const oldTempo = starDigit(tempoObj[mode], diff);
  const newTempo = awardTempo({ stars, tier, best: oldTempo });
  const tempoImproved = newTempo > oldTempo;
  if (tempoImproved) tempoObj[mode] = withStarDigit(tempoObj[mode], diff, newTempo);

  setGame("rechnungen", { d: diff, m: mode, box, stars: starsObj, tempo: tempoObj });
  // the round is in the cookie now; its mirror has nothing left to protect
  clearRound("rechnungen");

  // points come from progress, never from repetition (§8.3)
  const points = roundPoints({ oldStars: old, newStars: stars, difficulty: diff });
  const res = recordRound("rechnungen", { points });

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
    const paid = stars >= 2 && tier > 0;
    $("sum-tempo").hidden = !paid;
    if (paid) {
      $("sum-tempo").innerHTML =
        `${iconHTML(TEMPO_ICONS[tier], { size: 22 })} ${t(TEMPO_KEYS[tier])}`
        + (tempoImproved ? ` · <b>${t("tempoBest")}</b>` : "");
    }
    // One round can cross several thresholds at once (§8.3) — the summary holds
    // every trophy it paid, each one the same card the album shows.
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
    if (improved || tempoImproved || stars === 3 || res.newTrophies.length > 0) confetti();
  }, 700);
}

// The one button in the summary opens the level picker, with the fox still
// standing on the tile she just played (§10.1).
$("sum-ok").addEventListener("click", picker.open);

// A trophy she just won, held up without leaving the round (§8.3).
$("sum-trophy").addEventListener("click", (e) => {
  const card = e.target.closest(".won");
  if (card) openShowcase(wonTrophies[Number(card.dataset.won)]);
});

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
$("pickchip").addEventListener("click", picker.open);

// --- leaving a round that is not saved yet (§10.7) ---------------------------
const guard = createLeaveGuard({
  mapUrl: new URL("../../", import.meta.url).href,
  inRound: () => session !== null && !roundOver && hasProgress(session.progress()),
  onGo: () => clearRound("rechnungen"),
});

// --- the shared top bar (§3.3) ----------------------------------------------
const bar = initTopBar({
  back: "../../",
  onLeave: guard.guardLink,
  onChange() {
    updateChip();
    if (!roundOver && question) renderQuestion();
  },
  onClose() {
    if (roundOver) summary.open();
  },
});

// The game opens on its map of levels, with the fox standing on the tile she
// left (§3.4) — unless a round was interrupted mid-play (§10.7): then the game
// rehydrates it, same tile, same queue, the fox where she stood, with no picker
// and no dialog. A stale or foreign mirror falls back to the picker.
const interrupted = loadRound("rechnungen");
const canResume = interrupted
  && [0, 1, 2].includes(interrupted.d)
  && MODES.includes(interrupted.m)
  && validResume(interrupted.s, poolFor(interrupted.m, interrupted.d));
if (canResume) {
  diff = interrupted.d;
  mode = interrupted.m;
  startRound(interrupted);
} else {
  clearRound("rechnungen"); // whatever it was, it cannot be resumed
  updateChip();
  picker.open();
}
