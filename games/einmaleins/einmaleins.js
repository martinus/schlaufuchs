// Einmaleins page module (§10): wires the pure logic to the DOM, using the
// shared engines (adaptive, journey, rewards, storage, i18n, audio).

import { initI18n, t, getLang } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, boxesToString } from "../../assets/js/adaptive.js";
import { recordRound, roundPoints, starValue, addPractice } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { confetti } from "../../assets/js/confetti.js";
import { iconHTML } from "../../assets/js/graphics.js";
import { trophyCardHTML } from "../../assets/js/trophycard.js";
import { initTopBar } from "../../assets/js/chrome.js";
import { overlayFrom, anyOverlayOpen } from "../../assets/js/overlay.js";
import strings from "./i18n.js";
import {
  POOL_COUNT, EASY_TABLES, poolFor, questionFor, choicesFor,
  starsFor, nextStarGoal, ownedStars, starDigit, withStarDigit, fittedFontSize,
} from "./logic.js";

initI18n(strings);

const $ = (id) => document.getElementById(id);

// The two overlays this page owns. The picker can be waved away — the summary
// cannot: closing it would leave a finished round with nothing to press (§3.3).
const picker = overlayFrom(document.getElementById("pick-overlay"), {
  onOpen: renderPicker,
  onClose() {
    if (roundOver) summary.open();
  },
});
const summary = overlayFrom(document.getElementById("sum-overlay"), { dismissible: false });
const DIFF_KEYS = ["diffEasy", "diffMedium", "diffHard"];
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
let best = 0; // stars already won on this tile, before the round
let roundOver = false;
// Only ever flows into the parents' view (§20). The child is never shown it.
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
  bar.refresh();
  saved = getGame("einmaleins");
  const boxes = boxesFromString(saved.box, POOL_COUNT);
  session = createSession(poolFor(table, diff), boxes, { roundSize: 10 });
  // the basket opens with the stars this tile has already earned, so a mastered
  // tile shows a full basket and a grey sky (§10.5)
  best = starDigit((saved.stars ?? {})[diff], table);
  journey = createJourney($("journey"), {
    nodes: session.items().length,
    theme: "village",
    stars: best,
  });
  buffer = "";
  roundOver = false;
  t0 = Date.now();
  summary.close();
  buildKeypad();
  askNext();
}

function askNext() {
  const id = session.next();
  if (id === null) return endRound();
  currentId = id;
  question = questionFor(id, diff, Math.random, t("divSign"));
  input = buffer.slice(0, 3);
  buffer = "";
  phase = "answer";
  $("feedback").hidden = true;
  $("question").hidden = false;
  renderQuestion();
  renderStatus();
  if (diff === 0) renderChoices();
}

// The scene says it all: the basket holds what you own, the sky what is left.
// `ownedStars` is monotone, so the basket only ever fills (§10.5).
function renderStatus() {
  const owned = ownedStars(session.progress(), best);
  journey.setStars(owned);
  $("journey").setAttribute("aria-label", t("starsOwned", { n: owned }));
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

// Tapping a keypad button focuses it. Enter would then, on top of the keyPress
// below, fire the browser's default "activate the focused button" click, which
// re-enters that digit. During the post-correct transition it lands in `buffer`
// and reappears prefilled in the next question. Handling a key means owning it.
document.addEventListener("keydown", (e) => {
  // Any open overlay owns the keyboard. This used to ask only whether the
  // summary was up, so with the settings sheet or the picker open, digits went
  // into the question behind it and Enter submitted the answer.
  if (anyOverlayOpen()) return;
  // While the aid is up, Enter means "I have looked at it" on every difficulty.
  if (phase === "wrong-wait") {
    if (e.key === "Enter") {
      continueRound();
      e.preventDefault();
    }
    return;
  }
  if (diff === 0) return;
  if (/^[0-9]$/.test(e.key)) keyPress(e.key);
  else if (e.key === "Backspace") keyPress("⌫");
  else if (e.key === "Enter") keyPress("OK");
  else return;
  e.preventDefault();
});

function submit(value, mcButton) {
  const correct = value === question.answer;
  if (mcButton) mcButton.classList.add(correct ? "flash-ok" : "flash-err");
  session.answer(currentId, correct);
  if (correct) {
    phase = "correct-wait";
    sfx.correct();
    journey.advance();
    renderStatus(); // a banked star flies into the basket the moment it is won
    if (input !== "") {
      input = String(value);
      renderQuestion();
    }
    setTimeout(askNext, NEXT_MS);
  } else {
    phase = "wrong-wait";
    sfx.wrong();
    journey.stumble();
    // The aid needs the room; the whole scene hides while it is up.
    showFeedback();
  }
}

// Wrong answer: the question is replaced by the full equation plus a
// dot-grid visual aid (§10.1), so the screen never grows past the viewport.
// It stays until the child asks for the next question — a timer would take the
// right answer away exactly from the child who needs longest to read it.
function showFeedback() {
  const { t: a, f: b } = question;
  // The equation the child was just shown, with the gap filled — never rebuilt
  // from `t`/`f`, which would print a division sign this language does not use.
  const eq = question.text.replace("?", question.answer);
  const fb = $("feedback");
  fb.innerHTML = `<span class="eq">${eq}</span>
    <div class="dotgrid" style="grid-template-columns: repeat(${b}, auto)">
      ${"<i></i>".repeat(a * b)}
    </div>
    <button class="primary" id="fb-next"></button>`;
  $("fb-next").textContent = t("gotIt");
  fastPress($("fb-next"), continueRound);
  $("question").hidden = true;
  fb.hidden = false;
  // We run from the answer button's pointerdown, but the browser focuses that
  // button on the *later* mouseup — focusing here would be silently undone.
  setTimeout(() => phase === "wrong-wait" && $("fb-next")?.focus(), 0);
}

function continueRound() {
  if (phase !== "wrong-wait") return;
  sfx.click();
  askNext();
}

function endRound() {
  roundOver = true;
  const { firstTryOk, total } = session.progress();
  const stars = starsFor(firstTryOk, total);

  // persist boxes + best stars (§10.4), and the round's duration for the
  // parents' view (§20) — it is written, never rendered.
  const full = boxesFromString(saved.box, POOL_COUNT);
  Object.assign(full, session.boxes());
  const starsObj = { ...(saved.stars ?? {}) };
  const old = starDigit(starsObj[diff], table);
  const improved = stars > old;
  if (improved) starsObj[diff] = withStarDigit(starsObj[diff], table, stars);
  const practice = addPractice(saved, diff, (Date.now() - t0) / 1000);
  setGame("einmaleins", {
    d: diff, t: table, box: boxesToString(full, POOL_COUNT), stars: starsObj, ...practice,
  });

  // points come from progress, never from repetition (§8.3)
  const points = roundPoints({ oldStars: old, newStars: stars, difficulty: diff });
  const res = recordRound("einmaleins", { points });

  journey.finish();
  setTimeout(() => {
    $("sum-stars").textContent = stars > 0 ? "⭐".repeat(stars) : "🦊";
    // the points you just earned, next to the numbers that earned them
    $("sum-score").innerHTML = t("roundStat", { ok: firstTryOk, total })
      + (points > 0 ? ` <span class="gain">+${points}</span>` : "");
    // what the next star costs — the rule is invisible otherwise (§10.3)
    const goal = nextStarGoal(stars);
    $("sum-goal").hidden = goal === null;
    if (goal) $("sum-goal").textContent = t(goal);
    $("sum-best").hidden = !improved;
    $("sum-best").textContent = t("newBest");
    // One round can cross several thresholds at once — a first Schwer round to
    // three stars is worth 18 points and passes 2, 9 and 18. Showing only the
    // first would quietly swallow two prizes (§8.3).
    const st = $("sum-trophy");
    const won = res.newTrophies;
    st.hidden = won.length === 0;
    if (won.length > 0) {
      // The very same card the album shelf shows, so the child can find it
      // again: the cup, her emoji in it, its name.
      const size = won.length > 1 ? 34 : 44;
      st.innerHTML = won
        .map((s) => trophyCardHTML(s, { size, lang: getLang(), cls: "won" }))
        .join("");
      sfx.trophy();
    }
    $("sum-again").textContent = t("again");
    // The stars just changed. The chip was rendered at startRound() and nobody
    // told it, so a child read "⭐ 0" in the top bar while three stars lit up
    // beneath it — until they walked back to the map.
    bar.refresh();
    summary.open();
    if (improved || stars === 3 || res.newTrophies.length > 0) confetti();
  }, 700);
}

$("sum-again").addEventListener("click", startRound);
$("sum-pick").addEventListener("click", () => {
  summary.close();
  picker.open();
});

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
function renderPicker() {
  const segEl = $("pick-diff");
  segEl.innerHTML = "";
  DIFF_KEYS.forEach((key, i) => {
    const b = document.createElement("button");
    // The stars are always three. What Mittel and Schwer buy is a star worth
    // twice or three times as much, and that is what the label says (§10.2).
    const v = starValue(i);
    b.innerHTML = `${t(key)}<span class="dmul">${v > 1 ? `×${v}&nbsp;` : ""}⭐</span>`;
    b.setAttribute("aria-label", v > 1 ? t("diffWorth", { d: t(key), n: v }) : t(key));
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
    // Leicht only teaches four tables (§10.2); the rest are not offered here.
    const locked = diff === 0 && tbl !== 0 && !EASY_TABLES.includes(tbl);
    b.disabled = locked;

    // Every tile shows its three stars, gold for taken and grey for still to be
    // won — the same language the sky speaks above the round (§10.5). The number
    // of points is not on the tile: what a star is worth is a property of the
    // difficulty, and the difficulty says so itself (§10.2).
    if (locked) {
      b.classList.add("locked");
      b.innerHTML = `<span>${tbl2short(tbl)}</span>
        <span class="tstars">${iconHTML("ui-lock", { size: 13 })}</span>`;
    } else {
      if (s === 3) b.classList.add("mastered");
      const stars = [0, 1, 2].map((k) => `<i class="${k < s ? "on" : "off"}">⭐</i>`).join("");
      b.innerHTML = `<span>${tbl2short(tbl)}</span>
        <span class="tstars">${stars}</span>`;
    }
    b.addEventListener("click", () => {
      table = tbl;
      // the new round is the answer to the picker; it must not reopen the
      // summary of the old one behind it
      roundOver = false;
      picker.close();
      startRound();
    });
    grid.appendChild(b);
  }
}

$("pickchip").addEventListener("click", picker.open);

// --- the shared top bar (§3.3) ----------------------------------------------
// Its gear resets this game only; the global reset lives on the map.
const bar = initTopBar({
  back: "../../",
  resetKind: "game",
  game: "einmaleins",
  onChange() {
    updateChip();
    if (!roundOver) renderQuestion();
  },
  onClose() {
    if (roundOver) summary.open();
  },
});

// Instant resume (§3.4): straight into a round, no menu.
startRound();
