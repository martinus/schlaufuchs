// Rechnungen page module (§12): wires the pure logic to the DOM, using the
// shared engines (adaptive, journey, rewards, storage, i18n, audio). Structured
// like games/einmaleins/einmaleins.js — the ids and the phases are the same on
// purpose, so the CSS and the driving conventions transfer. Keypad input on
// every difficulty (§12); no multiple choice.
//
// Two structural differences from einmaleins. First, the Leitner box persists
// per SKILL BUCKET, not per question: `startRound` seeds each variant item-id's
// box from its bucket, so the shared engine weights by mastery; `endRound`
// folds the round's per-bucket outcome back with `foldBoxes` (§12.2). Second,
// a task can hold several CELLS (§12.1) — a number wall is three answers, a
// decomposition two — typed one after another on the one keypad. One task is
// one journey node and one engine item: the fox advances when the LAST cell
// lands, stumbles on any wrong one, and the engine hears about the task once —
// `answer(id, false)` at the first miss, `answer(id, true)` on a clean finish.

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
  MODES, BUCKET_COUNT, DIFF_KEYS, TEMPO_ICONS, TEMPO_KEYS,
  roundSizeFor, poolFor, bucketOf, questionFor, foldBoxes,
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

// The operator faces, for markup this module builds itself (the strategy rows,
// the wall bricks' relations, the grid's corner). logic.js prints the same
// faces into the task texts; division is the i18n divSign, as everywhere.
const OPFACE = { "+": "+", "-": "−", x: "×" };
const opFace = (op) => (op === ":" ? t("divSign") : OPFACE[op]);

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
let task = null; // the concrete task realised from the current bucket
let cellIndex = 0; // which of the task's cells the child is answering
let taskMissed = false; // a wrong cell already told the engine about this task
let currentId = null;
let input = "";
let buffer = ""; // digits typed during the short post-correct transition
let retry = ""; // the answer the child re-enters after getting it wrong
let phase = "answer"; // answer | correct-wait | wrong-wait
let best = 0; // stars already won on this tile, before the round
let roundOver = false;
let wonTrophies = [];
let qCounter = 0; // the stamp the driver watches for a new task
// The tempo ladder's raw material (§10.6): when the current cell appeared, and
// how long each first-try-correct answer took — the clock runs per CELL.
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
// interrupted round on another. The mirror is written at task boundaries, so a
// resumed round re-asks the interrupted task with fresh numbers — same skill.
function startRound(resume = null) {
  updateChip();
  bar.refresh();
  saved = getGame("rechnungen");
  const bucketBoxes = boxesFromString(saved.box, BUCKET_COUNT);
  const pool = poolFor(mode, diff);
  // Seed every variant's box from its bucket, so the engine weights weak skills
  // up exactly as the Leitner boxes say — the variants only exist to give a
  // round more items than a small cell could otherwise offer.
  const seeded = {};
  for (const id of pool) seeded[id] = bucketBoxes[bucketOf(id)];
  const snap = resume && validResume(resume.s, pool) ? resume : null;
  if (!snap) clearRound("rechnungen");
  session = createSession(pool, seeded, { roundSize: roundSizeFor(mode), resume: snap?.s });
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
  // A fresh concrete task for this bucket. A re-queued miss therefore returns
  // as the SAME skill with NEW numbers (§12.2) — which is the point.
  task = questionFor(id, Math.random, t("divSign"));
  cellIndex = 0;
  taskMissed = false;
  qCounter++;
  startCell();
}

// One cell of the task: the child's next number. The tempo clock (§10.6) and
// the driver's cell stamp restart here — a wall brick and a plain sum are each
// one timed step.
function startCell() {
  input = buffer.slice(0, 4);
  buffer = "";
  retry = "";
  phase = "answer";
  $("feedback").hidden = true;
  $("question").hidden = false;
  renderQuestion();
  renderStatus();
  qShownAt = Date.now();
}

function nextCell() {
  cellIndex++;
  startCell();
}

function renderStatus() {
  const owned = ownedStars(session.progress(), best);
  journey.setStars(owned);
  $("journey").setAttribute("aria-label", t("starsOwned", { n: owned }));
}

function fitQuestion() {
  const el = $("question");
  el.style.fontSize = "";
  if (!el.classList.contains("qline")) return; // multi-line kinds size via CSS
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

// --- rendering a task ---------------------------------------------------------
// Every fillable slot is a `.cell` span with its index in `data-cell`; the one
// being answered wears `.active` and echoes the typed digits. Cells before it
// keep their answers; cells after it wait as "?". The driver reads exactly
// this (tools/play-rechnungen.js).

// How many cells already show their answer. During the short post-correct
// transition the just-landed cell counts, so the child sees it filled.
const solvedCells = () => cellIndex + (phase === "correct-wait" ? 1 : 0);

function cellFace(i) {
  if (i < solvedCells()) return String(task.cells[i].answer);
  if (i === cellIndex && phase === "answer" && input !== "") return input;
  return "?";
}

function cellSpan(i, cls = "gap") {
  const active = i === cellIndex && phase === "answer";
  const done = i < solvedCells();
  return `<span class="${cls} cell${active ? " active" : ""}${done ? " done" : ""}" data-cell="${i}">${cellFace(i)}</span>`;
}

// The one-line kinds (op, gap, chain, mulplus, rest): the task's text carries
// one "?" per cell, in cell order — interleave.
function lineHTML() {
  const parts = task.text.split("?");
  let html = eqHTML(parts[0]);
  task.cells.forEach((_, i) => {
    html += cellSpan(i) + eqHTML(parts[i + 1]);
  });
  return html;
}

// The decomposition scaffold (§12.1): the head sum, then the two strategy rows.
// The second row's first operand IS the first cell's answer, so it hides until
// that cell lands — and the head's "?" fills only when the whole task is done.
function zerlegeHTML() {
  const [c0, c1] = task.cells;
  const sg = opFace(task.op);
  const done = solvedCells() === task.cells.length;
  const s1 = solvedCells() >= 1 ? c1.aid.a : "?";
  return `<div class="zerlege">
    <div class="zhead">${task.a} ${sg} ${task.b} = <span class="zauto">${done ? task.answer : "?"}</span></div>
    <div class="zrow" data-eqrow>${c0.aid.a} ${sg} ${c0.aid.b} = ${cellSpan(0)}</div>
    <div class="zrow" data-eqrow><span class="zauto">${s1}</span> ${sg} ${c1.aid.b} = ${cellSpan(1)}</div>
  </div>`;
}

// The number wall (§12.1): three rows of bricks, top = the sum of the two
// below. Given bricks are plain; the blanks are cells in solvable order.
function mauerHTML() {
  const cellAt = {};
  task.cells.forEach((c, i) => { cellAt[c.pos] = i; });
  const brick = (pos) => (task.given[pos]
    ? `<span class="mcell" data-pos="${pos}">${task.vals[pos]}</span>`
    : cellSpan(cellAt[pos], "mcell").replace('data-cell', `data-pos="${pos}" data-cell`));
  return `<div class="mauer">
    <div class="mrow">${brick(0)}</div>
    <div class="mrow">${brick(1)}${brick(2)}</div>
    <div class="mrow">${brick(3)}${brick(4)}${brick(5)}</div>
  </div>`;
}

// The operation grid (§12.1): headers on the top row and left column, the op in
// the corner; cell (r,c) = row ∘ col. A hidden column header (Schwer) is itself
// a cell — it solves as a gap off the one interior value shown in its column.
function quadHTML() {
  const cellAt = {}; // "r,c" or "h<idx>" → cell index
  task.cells.forEach((c, i) => {
    cellAt[c.pos.hdr !== undefined ? `h${c.pos.hdr}` : `${c.pos.r},${c.pos.c}`] = i;
  });
  const head = (idx) => (cellAt[`h${idx}`] !== undefined
    ? cellSpan(cellAt[`h${idx}`], "qhead").replace('data-cell', `data-hdr="${idx}" data-cell`)
    : `<span class="qhead" data-hdr="${idx}">${task.cols[idx]}</span>`);
  const body = (r, c) => (cellAt[`${r},${c}`] !== undefined
    ? cellSpan(cellAt[`${r},${c}`], "qcell").replace('data-cell', `data-rc="${r},${c}" data-cell`)
    : `<span class="qcell qgiven" data-rc="${r},${c}">${task.grid[r][c]}</span>`);
  return `<div class="rquad">
    <span class="qcorner">${opFace(task.op)}</span>${head(0)}${head(1)}
    <span class="qhead qrowh" data-row="0">${task.rows[0]}</span>${body(0, 0)}${body(0, 1)}
    <span class="qhead qrowh" data-row="1">${task.rows[1]}</span>${body(1, 0)}${body(1, 1)}
  </div>`;
}

function renderQuestion() {
  const q = $("question");
  const multi = { zerlege: zerlegeHTML, mauer: mauerHTML, quad: quadHTML }[task.kind];
  q.className = multi ? `question qmulti q-${task.kind}` : "question qline";
  q.innerHTML = multi ? multi() : lineHTML();
  // the driver watches these stamps to know a new task / cell is up
  q.dataset.q = String(qCounter);
  q.dataset.kind = task.kind;
  q.dataset.cell = String(cellIndex);
  fitQuestion();
}

window.addEventListener("resize", () => task && fitQuestion());
document.fonts?.ready.then(() => task && fitQuestion());

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
    const step = retryStep(retry, k, task.cells[cellIndex].answer);
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

// Mirror the round after every answer the ENGINE heard about (§10.7) — task
// boundaries, so a resumed round re-asks the interrupted task afresh.
function mirrorRound() {
  saveRound("rechnungen", {
    d: diff, m: mode, s: session.snapshot(),
    times: answerTimes, missed: [...missedIds],
    touched: [...touchedBuckets], missedB: [...missedBuckets],
  });
}

function submit(value) {
  const cell = task.cells[cellIndex];
  const correct = value === cell.answer;
  const bkt = bucketOf(currentId);
  const last = cellIndex === task.cells.length - 1;
  touchedBuckets.add(bkt);
  if (correct) {
    // Only a first try feeds the tempo ladder (§10.6): a task ever missed this
    // round contributes nothing. One cell at rocket speed earns its ⚡ now.
    if (!taskMissed && !missedIds.has(currentId)) {
      const took = Date.now() - qShownAt;
      answerTimes.push(took);
      if (tempoTier(took, diff) === 3) blitzFlash();
    }
    phase = "correct-wait";
    sfx.correct();
    if (input !== "") {
      input = String(value);
      renderQuestion();
    }
    if (!last) {
      setTimeout(nextCell, NEXT_MS);
      return;
    }
    // the task is done: the engine hears about it once — now, if no cell missed
    if (!taskMissed) {
      session.answer(currentId, true);
      journey.advance();
      renderStatus();
      mirrorRound();
    }
    setTimeout(askNext, NEXT_MS);
  } else {
    // The engine hears only the FIRST miss (the task is already re-queued);
    // the child still finishes the remaining cells, aid in hand.
    if (!taskMissed) {
      taskMissed = true;
      missedIds.add(currentId);
      missedBuckets.add(bkt);
      session.answer(currentId, false);
      mirrorRound();
    }
    phase = "wrong-wait";
    retry = "";
    sfx.wrong();
    journey.stumble();
    showFeedback(value);
  }
}

// The dot grid (§12.1: „dot grid for ×/÷"): the count as rows of the divisor's
// or the multiplicand's width, so the child sees the groups — and a remainder
// as the short last row. Skipped when the count would be a wall.
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

// The workbook's own teaching device, lent to the aid (§12.1): a plain ± miss
// against a two-digit second operand also shows the tens-first decomposition —
// the same two rows the Zerlegen tasks train. Only for a plain sum (a gap or a
// chain decomposes differently, and the Zerlegen tasks ARE the rows already).
function zerlegeHintHTML(q) {
  if (q.kind !== "op" || (q.op !== "+" && q.op !== "-") || q.b < 10 || q.b % 10 === 0) return "";
  const bt = Math.floor(q.b / 10) * 10;
  const s1 = q.op === "+" ? q.a + bt : q.a - bt;
  const sg = opFace(q.op);
  return `<div class="zhint">${q.a} ${sg} ${bt} = ${s1}<br>${s1} ${sg} ${q.b % 10} = ${q.answer}</div>`;
}

// Wrong answer (§8.1): the child's own answer, struck through in red; the true
// equation under it in green; a one-line visual aid (number line for ±, dot
// grid for ×/÷). The equation is the CELL's — a wall brick shows the +/− step
// of its neighbours, a grid cell its row ∘ col. It stays until she enters the
// right answer herself — no timer, no "Verstanden".
function showFeedback(wrong) {
  const aid = task.cells[cellIndex].aid;
  const wrongEq = eqHTML(aid.text).replace("?", wrong);
  const rightEq = eqHTML(aid.text).replace("?", `<b class="ans">${aid.answer}</b>`);
  const visual = aid.op === "x" || aid.op === ":"
    ? dotGridHTML(aid)
    : numberLineHTML(aid) + (diff > 0 ? zerlegeHintHTML(aid) : "");
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

// The only way out of the aid: the right answer, entered. The task carries on
// with its next cell — a wall is always finished, even after a stumble.
function continueRound() {
  if (phase !== "wrong-wait") return;
  phase = "correct-wait";
  sfx.correct();
  const last = cellIndex === task.cells.length - 1;
  setTimeout(last ? askNext : nextCell, NEXT_MS);
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

  // The tempo ladder (§10.6): the round's median cell time as a tier, gated by
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
    if (!roundOver && task) renderQuestion();
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
