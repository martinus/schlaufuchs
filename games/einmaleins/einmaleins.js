// Einmaleins page module (§10): wires the pure logic to the DOM, using the
// shared engines (adaptive, journey, rewards, storage, i18n, audio).

import { initI18n, t, getLang } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, boxesToString } from "../../assets/js/adaptive.js";
import { recordRound, levelInfo, roundPoints, tilePointsLeft } from "../../assets/js/rewards.js";
import { createJourney } from "../../assets/js/journey.js";
import { sfx } from "../../assets/js/audio.js";
import { confetti } from "../../assets/js/confetti.js";
import { iconHTML, applyIcons } from "../../assets/js/graphics.js";
import { renderLevelChip, initSettingsOverlay } from "../../assets/js/chrome.js";
import strings from "./i18n.js";
import {
  POOL_COUNT, EASY_TABLES, poolFor, questionFor, choicesFor,
  starsFor, nextStarGoal, basketState, starDigit, withStarDigit, fittedFontSize,
} from "./logic.js";

initI18n(strings);
applyIcons(document); // upgrade back-link / gear icons if SVGs exist

const $ = (id) => document.getElementById(id);
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
let roundOver = false;
let hot = 0;

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
  renderStatus();
  if (diff === 0) renderChoices();
}

// The basket of stars and the line beside it (§10.5). The basket shows what is
// banked, so it only fills; the line shows the running streak if there is one,
// and otherwise what the next reachable star costs. Never a loss, never a
// promise that cannot be kept.
function renderStatus() {
  const { stars, needed, goalStars } = basketState(session.progress());
  $("basket").innerHTML = iconHTML("ui-basket", { size: 18 })
    + `<span class="bstars">${"⭐".repeat(stars)}</span>`;
  $("basket").setAttribute("aria-label", t("basketHave", { n: stars }));

  // The streak shrinks to a flame and a number: the goal is the thing the child
  // asked for, and a celebratory sentence would push it off the row.
  const streak = $("hotstreak");
  streak.innerHTML = hot >= 3 ? `${iconHTML("ui-flame", { size: 13 })}${hot}` : "";
  streak.setAttribute("aria-label", hot >= 3 ? t("hotStreak", { n: hot }) : "");

  $("goalline").textContent = goalStars > 0
    ? t("basketGoal", { n: needed, stars: "⭐".repeat(goalStars) })
    : "";
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
  if (!$("sum-overlay").hidden) return;
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
    hot++;
    renderStatus(); // the basket gains its star the moment it is banked
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
    // The aid needs the room; the whole status row is hidden while it is up.
    showFeedback();
  }
}

// Wrong answer: the question is replaced by the full equation plus a
// dot-grid visual aid (§10.1), so the screen never grows past the viewport.
// It stays until the child asks for the next question — a timer would take the
// right answer away exactly from the child who needs longest to read it.
function showFeedback() {
  const { kind, t: a, f: b } = question;
  const eq = kind === "div" ? `${a * b} ÷ ${b} = ${a}` : `${a} × ${b} = ${a * b}`;
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

  // persist boxes + best stars (§10.4)
  const full = boxesFromString(saved.box, POOL_COUNT);
  Object.assign(full, session.boxes());
  const starsObj = { ...(saved.stars ?? {}) };
  const old = starDigit(starsObj[diff], table);
  const improved = stars > old;
  if (improved) starsObj[diff] = withStarDigit(starsObj[diff], table, stars);
  setGame("einmaleins", { d: diff, t: table, box: boxesToString(full, POOL_COUNT), stars: starsObj });

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
      // the trophy speaks for itself: the picture, then its name
      const size = won.length > 1 ? 34 : 44;
      st.innerHTML = won
        .map((s) => `<span class="won"><span class="se-emoji">${iconHTML(s.icon, { size })}</span>${s[getLang()]}</span>`)
        .join("");
      sfx.trophy();
    }
    $("sum-again").textContent = t("again");
    showSummary();
    if (improved || stars === 3 || res.newTrophies.length > 0) confetti();
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
    // Leicht only teaches four tables (§10.2); the rest are not offered here.
    const locked = diff === 0 && tbl !== 0 && !EASY_TABLES.includes(tbl);
    b.disabled = locked;

    // Every tile states what it is still worth. A child never reads a rule —
    // they see that an untouched Schwer tile pays 18 and a mastered one pays
    // nothing, and they go where the points are (§10.2). Three distinct looks:
    // locked (nothing to get, cannot play), mastered (nothing to get, may
    // replay), open (this many points are waiting).
    const left = tilePointsLeft(s, diff);
    if (locked) {
      b.classList.add("locked");
      b.innerHTML = `<span>${tbl2short(tbl)}</span>
        <span class="tstars">${iconHTML("ui-lock", { size: 13 })}</span>
        <span class="tpoints"></span>`;
    } else {
      if (left === 0) b.classList.add("mastered");
      b.innerHTML = `<span>${tbl2short(tbl)}</span>
        <span class="tstars">${s > 0 ? "⭐".repeat(s) : "·"}</span>
        <span class="tpoints">${left > 0 ? `+${left}` : "✓"}</span>`;
    }
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
