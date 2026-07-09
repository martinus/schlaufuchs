// Einmaleins page module (§10): wires the pure logic to the DOM, using the
// shared engines (adaptive, journey, rewards, storage, i18n, audio).

import { initI18n, t, getLang } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, boxesToString } from "../../assets/js/adaptive.js";
import { recordRound, levelInfo } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { confetti } from "../../assets/js/confetti.js";
import { iconHTML, applyIcons } from "../../assets/js/graphics.js";
import { renderLevelChip, initSettingsOverlay } from "../../assets/js/chrome.js";
import strings from "./i18n.js";
import {
  POOL_COUNT, EASY_TABLES, poolFor, questionFor, choicesFor,
  starsFor, starDigit, withStarDigit, fittedFontSize,
} from "./logic.js";

initI18n(strings);
applyIcons(document); // upgrade back-link / gear icons if SVGs exist

const $ = (id) => document.getElementById(id);
const DIFF_KEYS = ["diffEasy", "diffMedium", "diffHard"];
const FEEDBACK_MS = 2000;
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
let saved = getGame("einmaleins");
let diff = [0, 1, 2].includes(saved.d) ? saved.d : 0;
let table = Number.isInteger(saved.t) && saved.t >= 0 && saved.t <= 10 ? saved.t : 2;

function coerceTable() {
  if (diff === 0 && table !== 0 && !EASY_TABLES.includes(table)) table = 2;
}

// --- round state -----------------------------------------------------------
let session = null;
let journey = null;
let question = null;
let currentId = null;
let input = "";
let buffer = ""; // digits typed during the short post-correct transition
let phase = "answer"; // answer | correct-wait | wrong-wait
let roundOver = false;
let hot = 0;
let t0 = 0;

function tbl2short(tbl) {
  return tbl === 0 ? t("emMixed") : t("emTableShort", { t: tbl });
}

function updateChip() {
  $("pickchip").textContent = `${t(DIFF_KEYS[diff])} · ${tbl2short(table)}`;
}

function startRound() {
  coerceTable();
  updateChip();
  renderLevelChip($("levelchip"));
  saved = getGame("einmaleins");
  const boxes = boxesFromString(saved.box, POOL_COUNT);
  session = createSession(poolFor(table, diff), boxes, { roundSize: 10 });
  journey = createJourney($("journey"), {
    nodes: session.items().length,
    theme: "village",
    level: levelInfo().level,
  });
  hot = 0;
  buffer = "";
  roundOver = false;
  t0 = Date.now();
  $("hotstreak").textContent = "";
  $("sum-overlay").hidden = true;
  buildKeypad();
  askNext();
}

function askNext() {
  const id = session.next();
  if (id === null) return endRound();
  currentId = id;
  question = questionFor(id, diff);
  input = buffer.slice(0, 3);
  buffer = "";
  phase = "answer";
  $("feedback").hidden = true;
  $("question").hidden = false;
  renderQuestion();
  if (diff === 0) renderChoices();
}

// The question never wraps: a two-line equation reads as two thoughts. When the
// CSS size would overflow, shrink this one question until it fits on one line.
function fitQuestion() {
  const el = $("question");
  el.style.fontSize = "";
  const size = parseFloat(getComputedStyle(el).fontSize);
  const fitted = fittedFontSize(size, el.clientWidth, el.scrollWidth);
  if (fitted !== size) el.style.fontSize = `${fitted}px`;
}

function renderQuestion() {
  const shown = input === "" ? "?" : input;
  $("question").innerHTML = question.text.replace(
    "?",
    `<span class="gap">${shown}</span>`
  );
  fitQuestion();
}

// the wish size is viewport-relative, so a rotation needs a re-fit; the display
// face may also arrive after the first paint and change the measured width
window.addEventListener("resize", () => question && fitQuestion());
document.fonts?.ready.then(() => question && fitQuestion());

// Multiple choice (Leicht): rebuilt per question.
function renderChoices() {
  const box = $("answers");
  box.innerHTML = "";
  const mc = document.createElement("div");
  mc.className = "mc";
  for (const opt of choicesFor(question)) {
    const b = document.createElement("button");
    b.textContent = opt;
    fastPress(b, () => {
      if (phase !== "answer") return;
      submit(opt, b);
    });
    mc.appendChild(b);
  }
  box.appendChild(mc);
}

// Keypad (Mittel/Schwer): built ONCE per round and kept in the DOM, so no
// tap can land on a node that is being replaced mid-press.
function buildKeypad() {
  const box = $("answers");
  box.innerHTML = "";
  if (diff === 0) return; // Leicht renders choices per question
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
  if (phase === "wrong-wait") return; // feedback is being shown
  if (phase === "correct-wait") {
    // fast typists: digits pressed during the transition carry over
    if (/^[0-9]$/.test(k)) buffer = (buffer + k).slice(0, 3);
    return;
  }
  sfx.click();
  if (k === "⌫") input = input.slice(0, -1);
  else if (k === "OK") {
    if (input !== "") submit(Number(input));
    return;
  } else if (input.length < 3) input += k;
  renderQuestion();
}

document.addEventListener("keydown", (e) => {
  if (diff === 0 || !$("sum-overlay").hidden) return;
  if (/^[0-9]$/.test(e.key)) keyPress(e.key);
  else if (e.key === "Backspace") keyPress("⌫");
  else if (e.key === "Enter") keyPress("OK");
});

function submit(value, mcButton) {
  const correct = value === question.answer;
  if (mcButton) mcButton.classList.add(correct ? "flash-ok" : "flash-err");
  session.answer(currentId, correct);
  if (correct) {
    phase = "correct-wait";
    sfx.correct();
    journey.advance();
    hot++;
    $("hotstreak").textContent = hot >= 3 ? t("hotStreak", { n: hot }) : "";
    if (input !== "") {
      input = String(value);
      renderQuestion();
    }
    setTimeout(askNext, NEXT_MS);
  } else {
    phase = "wrong-wait";
    sfx.wrong();
    journey.stumble();
    hot = 0;
    $("hotstreak").textContent = t("tryAgainSoon");
    showFeedback();
    setTimeout(askNext, FEEDBACK_MS);
  }
}

// Wrong answer: the question is replaced by the full equation plus a
// dot-grid visual aid (§10.1), so the screen never grows past the viewport.
function showFeedback() {
  const { kind, t: a, f: b } = question;
  const eq = kind === "div" ? `${a * b} ÷ ${b} = ${a}` : `${a} × ${b} = ${a * b}`;
  const fb = $("feedback");
  fb.innerHTML = `<span class="eq">${eq}</span>
    <div class="dotgrid" style="grid-template-columns: repeat(${b}, 8px)">
      ${"<i></i>".repeat(a * b)}
    </div>`;
  $("question").hidden = true;
  fb.hidden = false;
}

function endRound() {
  roundOver = true;
  const seconds = Math.round((Date.now() - t0) / 1000);
  const { firstTryOk, total } = session.progress();
  const stars = starsFor(firstTryOk, total, seconds);

  // persist boxes + best stars (§10.4)
  const full = boxesFromString(saved.box, POOL_COUNT);
  Object.assign(full, session.boxes());
  const starsObj = { ...(saved.stars ?? {}) };
  const old = starDigit(starsObj[diff], table);
  const improved = stars > old;
  if (improved) starsObj[diff] = withStarDigit(starsObj[diff], table, stars);
  setGame("einmaleins", { d: diff, t: table, box: boxesToString(full, POOL_COUNT), stars: starsObj });

  // mastering a table = its third star, awarded once (§8.3)
  const res = recordRound("einmaleins", {
    perfect: firstTryOk === total,
    difficulty: diff,
    masteredNew: stars === 3 && old < 3,
  });

  journey.finish();
  setTimeout(() => {
    $("sum-stars").textContent = stars > 0 ? "⭐".repeat(stars) : "🦊";
    $("sum-score").textContent = t("roundStat", { ok: firstTryOk, total, s: seconds });
    $("sum-best").hidden = !improved;
    $("sum-best").textContent = t("newBest");
    const st = $("sum-sticker");
    if (res.newStickers.length > 0) {
      const s = res.newStickers[0];
      // the sticker speaks for itself: the picture, then its name
      st.innerHTML = `<span class="se-emoji">${iconHTML(s.icon, { size: 44 })}</span>${s[getLang()]}`;
      st.hidden = false;
      sfx.sticker();
    } else {
      st.hidden = true;
    }
    $("sum-again").textContent = t("again");
    showSummary();
    if (improved || stars === 3 || res.newStickers.length > 0) confetti();
  }, 700);
}

function showSummary() {
  $("sum-overlay").hidden = false;
  $("sum-again").focus();
}

$("sum-again").addEventListener("click", startRound);
$("sum-pick").addEventListener("click", () => {
  $("sum-overlay").hidden = true;
  openPicker();
});

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
function renderPicker() {
  const segEl = $("pick-diff");
  segEl.innerHTML = "";
  DIFF_KEYS.forEach((key, i) => {
    const b = document.createElement("button");
    b.textContent = t(key);
    b.setAttribute("aria-pressed", String(i === diff));
    b.addEventListener("click", () => {
      diff = i;
      renderPicker();
    });
    segEl.appendChild(b);
  });

  const grid = $("pick-tables");
  grid.innerHTML = "";
  const starStr = (getGame("einmaleins").stars ?? {})[diff];
  for (const tbl of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0]) {
    const b = document.createElement("button");
    const s = starDigit(starStr, tbl);
    b.innerHTML = `<span>${tbl2short(tbl)}</span><span class="tstars">${s > 0 ? "⭐".repeat(s) : "·"}</span>`;
    b.disabled = diff === 0 && tbl !== 0 && !EASY_TABLES.includes(tbl);
    b.addEventListener("click", () => {
      table = tbl;
      $("pick-overlay").hidden = true;
      startRound();
    });
    grid.appendChild(b);
  }
}

function openPicker() {
  renderPicker();
  $("pick-overlay").hidden = false;
}

$("pickchip").addEventListener("click", openPicker);

// --- settings overlay (shared chrome §3.3) ----------------------------------
const settings = initSettingsOverlay({
  resetKind: "game",
  game: "einmaleins",
  onChange() {
    renderLevelChip($("levelchip"));
    updateChip();
    if (!roundOver) renderQuestion();
  },
  onClose() {
    if (roundOver) showSummary();
  },
});
$("gearbtn").addEventListener("click", settings.open);

// closing the picker after the round ended returns to the summary
$("pick-overlay").addEventListener("click", (e) => {
  if (e.target !== $("pick-overlay")) return;
  $("pick-overlay").hidden = true;
  if (roundOver) showSummary();
});

// Instant resume (§3.4): straight into a round, no menu.
startRound();
