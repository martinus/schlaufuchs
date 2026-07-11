// Einmaleins page module (§10): wires the pure logic to the DOM, using the
// shared engines (adaptive, journey, rewards, storage, i18n, audio).

import { initI18n, t, getLang } from "../../assets/js/i18n.js";
import { getGame, setGame } from "../../assets/js/storage.js";
import { createSession, boxesFromString, boxesToString, hasProgress, validResume } from "../../assets/js/adaptive.js";
import { saveRound, loadRound, clearRound } from "../../assets/js/roundstore.js";
import { recordRound, roundPoints, starValue, clampDifficulty, addPractice } from "../../assets/js/rewards.js";
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
import { createLevelPicker, tableName } from "./picker.js";
import {
  POOL_COUNT, ROUND_SIZE, tablesFor, DIFF_KEYS, TEMPO_ICONS, TEMPO_KEYS, poolFor,
  questionFor, choicesFor, hardnessBoost,
  starsFor, nextStarGoal, starGoalNeed, ownedStars, starDigit, withStarDigit, fittedFontSize, retryStep,
  median, tempoTier, awardTempo, foldRecall,
} from "./logic.js";

initI18n(strings);

const $ = (id) => document.getElementById(id);

// The two overlays this page owns (picker.js holds the picker's tiles and fox;
// the round state stays here). The picker can be waved away — the summary
// cannot: closing it would leave a finished round with nothing to press (§3.3).
//
// The picker is also where the game begins and where every round ends, so
// waving it away must never leave the child looking at an empty stage: with no
// round behind it, dismissing it starts the level the fox is standing on.
const picker = createLevelPicker(document.getElementById("pick-overlay"), {
  current: () => ({ diff, table }),
  // Runs BEFORE the picker closes — the round clears `roundOver` and fills
  // `session`, which is exactly what onDismiss reads.
  onPick(d, tbl) {
    diff = d;
    table = tbl;
    startRound();
  },
  onDismiss() {
    if (roundOver) summary.open();
    else if (!session) startRound();
  },
});
// The summary leads with the trophy it just handed out, and that trophy is a
// link to the album — so the button, not the link, must have the focus.
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
let saved = getGame("einmaleins");
let diff = clampDifficulty(saved.d);
let table = Number.isInteger(saved.t) && saved.t >= 0 && saved.t <= 10 ? saved.t : 2;

// Each difficulty offers its own tiles (§10.2); a saved table the current
// difficulty does not offer (Schwer lost its 1er and 10er) falls back to 2.
function coerceTable() {
  if (!tablesFor(diff).includes(table)) table = 2;
}

// --- round state -----------------------------------------------------------
// `session` is also the answer to "is there a round on the stage?" — the picker
// asks it when it is dismissed rather than chosen from.
let session = null;
let journey = null;
let question = null;
let currentId = null;
let input = "";
let buffer = ""; // digits typed during the short post-correct transition
let retry = ""; // the answer the child re-enters after getting it wrong
let choices = []; // Leicht: this question's four options, so the aid can reuse them
let phase = "answer"; // answer | correct-wait | wrong-wait
let best = 0; // stars already won on this tile, before the round
let roundOver = false;
let wonTrophies = []; // what this round just handed over, for the showcase
// Only ever flows into the parents' view (§20). The child is never shown it.
let t0 = 0;
// The tempo ladder's raw material (§10.6): when the current question appeared,
// and how long each first-try-correct answer took. The child only ever meets
// these as a symbol — never as a number of time.
let qShownAt = 0;
let answerTimes = [];
let missedIds = new Set();
let recallObs = {}; // {id: tier} per first-try answer, for the parents' grid (§20)

// The round's title carries the village's own symbol, so the child can see
// which place on the map she is standing in without reading its name (§3.1).
// The symbol is decorative; `.ph-txt` is the button's accessible name.
function updateChip() {
  $("pickchip").innerHTML =
    `<span class="ph-sym" aria-hidden="true">${iconHTML("region-einmaleins", { size: 20 })}</span>`
    + `<span class="ph-txt">${t(DIFF_KEYS[diff])} · ${tableName(table)}</span>`;
}

// `resume` is a round mirror from roundstore.js (§10.7); without one the
// start is fresh and any stale mirror is dropped — a chosen tile outranks an
// interrupted round on another.
function startRound(resume = null) {
  coerceTable();
  updateChip();
  bar.refresh();
  saved = getGame("einmaleins");
  const boxes = boxesFromString(saved.box, POOL_COUNT);
  const pool = poolFor(table, diff);
  const snap = resume && validResume(resume.s, pool) ? resume : null;
  if (!snap) clearRound("einmaleins");
  session = createSession(pool, boxes, {
    roundSize: ROUND_SIZE[diff],
    // hard facts (7×8) come up more often than trivial ones (2×2), on top of
    // what the Leitner boxes already say (§10.2)
    boost: (id) => hardnessBoost(id, diff),
    resume: snap?.s,
  });
  // the basket opens with the stars this tile has already earned, so a mastered
  // tile shows a full basket and a grey sky (§10.5)
  best = starDigit((saved.stars ?? {})[diff], table);
  journey = createJourney($("journey"), {
    nodes: session.items().length,
    theme: "village",
    stars: best,
    worth: starValue(diff), // a Schwer star says "×3" on its way to the basket
  });
  buffer = "";
  roundOver = false;
  t0 = Date.now() - (snap?.elapsed ?? 0);
  answerTimes = snap?.times ?? [];
  missedIds = new Set(snap?.missed);
  recallObs = snap?.rc ?? {};
  // walk the fox back to where the interruption found her (§10.7)
  for (let i = session.progress().solved; i > 0; i--) journey.advance();
  summary.close();
  buildKeypad();
  askNext();
}

function askNext() {
  const id = session.next();
  if (id === null) return endRound();
  currentId = id;
  question = questionFor(id, diff, Math.random, t("divSign"), table);
  input = buffer.slice(0, 3);
  buffer = "";
  retry = "";
  phase = "answer";
  $("feedback").hidden = true;
  $("question").hidden = false;
  renderQuestion();
  renderStatus();
  qShownAt = Date.now(); // the tempo clock starts when the question is up (§10.6)
  if (diff === 0) {
    // drawn once per question: the aid re-renders the SAME four options, and a
    // reshuffle between the answer and the retry would move them under the
    // finger that is already going for one
    choices = choicesFor(question);
    renderChoices();
  }
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

// German writes division as a colon, and a colon sits on the baseline: between
// two big numbers "12 : 3" reads as a label and its value, not as a division.
// Lifted to the optical middle it reads as an operator. "÷" is already centred
// and never appears here as a colon, so the wrap is a no-op in English.
function eqHTML(text) {
  return text.replaceAll(":", '<span class="divsign">:</span>');
}

function renderQuestion() {
  const shown = input === "" ? "?" : input;
  $("question").innerHTML = eqHTML(question.text).replace(
    "?",
    `<span class="gap">${shown}</span>`
  );
  fitQuestion();
}

// the wish size is viewport-relative, so a rotation needs a re-fit; the display
// face may also arrive after the first paint and change the measured width
window.addEventListener("resize", () => question && fitQuestion());
document.fonts?.ready.then(() => question && fitQuestion());

// Multiple choice (Leicht): rebuilt per question, and again by the aid — where
// the same four options come back and only the right one lets the round go on.
function renderChoices() {
  const box = $("answers");
  box.innerHTML = "";
  const mc = document.createElement("div");
  mc.className = "mc";
  for (const opt of choices) {
    const b = document.createElement("button");
    b.textContent = opt;
    fastPress(b, () => {
      if (phase === "answer") {
        submit(opt, b);
      } else if (phase === "wrong-wait") {
        if (opt === question.answer) {
          b.classList.add("flash-ok");
          continueRound();
        } else {
          rejectRetry(b);
        }
      }
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
  if (phase === "wrong-wait") {
    if (diff === 0) return; // Leicht re-answers by tapping a choice, not typing
    const step = retryStep(retry, k, question.answer);
    if (step.state === "reject") return rejectRetry();
    retry = step.input;
    renderRetry();
    if (step.state === "done") continueRound();
    else sfx.click();
    return;
  }
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
  // The aid is answered with the keypad too, so its keys go the same way:
  // keyPress() dispatches on the phase.
  if (diff === 0) return;
  if (/^[0-9]$/.test(e.key)) keyPress(e.key);
  else if (e.key === "Backspace") keyPress("⌫");
  else if (e.key === "Enter") keyPress("OK");
  else return;
  e.preventDefault();
});

// The ⚡ moment (§10.6): one answer at rocket speed, marked the instant it
// lands. Appended to the stage, not the question — renderQuestion rewrites the
// question's innerHTML in this same tick and would eat it. Decorative only; a
// slow answer sees nothing, because there is no negative moment. The flight is
// a transition, so reduced motion degrades to "briefly there", never a
// keyframe hanging mid-air (§10.5).
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

function submit(value, mcButton) {
  const correct = value === question.answer;
  if (mcButton) mcButton.classList.add(correct ? "flash-ok" : "flash-err");
  session.answer(currentId, correct);
  if (correct) {
    // Only a first try feeds the tempo ladder (§10.6): an item that was ever
    // missed this round contributes nothing, so speed can never buy back what
    // a wrong answer cost. One answer at rocket speed earns its ⚡ right now.
    if (!missedIds.has(currentId)) {
      const took = Date.now() - qShownAt;
      answerTimes.push(took);
      // a slow first try is an observation too: the parents' recall tracker
      // must see counting, not just recall (§20)
      recallObs[currentId] = tempoTier(took, diff);
      if (tempoTier(took, diff) === 3) blitzFlash();
    }
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
    missedIds.add(currentId);
    phase = "wrong-wait";
    retry = "";
    sfx.wrong();
    journey.stumble();
    // The aid needs the room; the whole scene hides while it is up.
    showFeedback(value);
  }
  // Mirror the round after every recorded answer (§10.7): an interruption from
  // here on resumes instead of costing the round.
  saveRound("einmaleins", {
    d: diff, t: table, s: session.snapshot(),
    times: answerTimes, missed: [...missedIds], rc: recallObs,
    elapsed: Date.now() - t0,
  });
}

// Wrong answer (§8.1): the child's own answer, struck through in red; the true
// equation under it in green; a dot grid that shows why. It stays until she
// enters the right answer herself — Mara pressed "Verstanden" without ever
// registering that she had erred, and a timer would take the answer away from
// exactly the child who needs longest to read it.
function showFeedback(wrong) {
  const { t: a, f: b } = question;
  // Both lines are built from the question that was asked, never rebuilt from
  // `t`/`f`, which would print a division sign this language does not use.
  const wrongEq = eqHTML(question.text).replace("?", wrong);
  const rightEq = eqHTML(question.text).replace("?", `<b class="ans">${question.answer}</b>`);
  const fb = $("feedback");
  fb.innerHTML = `<span class="eq eq-wrong"><s>${wrongEq}</s></span>
    <span class="eq">${rightEq}</span>
    <div class="dotgrid" style="grid-template-columns: repeat(${b}, auto)">
      ${"<i></i>".repeat(a * b)}
    </div>
    ${diff === 0 ? "" : `<span class="gap" id="retry-gap">?</span>`}`;
  $("question").hidden = true;
  fb.hidden = false;
  if (diff === 0) renderChoices(); // the same four options, in retry mode
}

function renderRetry() {
  const gap = $("retry-gap");
  if (gap) gap.textContent = retry === "" ? "?" : retry;
}

// The child typed (or tapped) something that cannot become the answer.
function rejectRetry(el) {
  retry = "";
  renderRetry();
  sfx.wrong();
  const shake = el ?? $("retry-gap");
  if (!shake) return;
  shake.classList.remove("stumbling");
  void shake.offsetWidth; // restart the animation on a second wrong try
  shake.classList.add("stumbling");
}

// The only way out of the aid, on every difficulty: the right answer, entered.
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

  // persist boxes + best stars (§10.4), and the round's duration for the
  // parents' view (§20) — it is written, never rendered.
  const full = boxesFromString(saved.box, POOL_COUNT);
  Object.assign(full, session.boxes());
  const starsObj = { ...(saved.stars ?? {}) };
  const old = starDigit(starsObj[diff], table);
  const improved = stars > old;
  if (improved) starsObj[diff] = withStarDigit(starsObj[diff], table, stars);

  // The tempo ladder (§10.6): the round's median answer time as a tier, gated
  // by two stars and stored only upward — the same digit strings the stars
  // use, one per difficulty. Computed here, painted below only as a symbol.
  const tier = tempoTier(median(answerTimes), diff);
  const tempoObj = { ...(saved.tempo ?? {}) };
  const oldTempo = starDigit(tempoObj[diff], table);
  const newTempo = awardTempo({ stars, tier, best: oldTempo });
  const tempoImproved = newTempo > oldTempo;
  if (tempoImproved) tempoObj[diff] = withStarDigit(tempoObj[diff], table, newTempo);

  const practice = addPractice(saved, diff, (Date.now() - t0) / 1000);
  setGame("einmaleins", {
    d: diff, t: table, box: boxesToString(full, POOL_COUNT), stars: starsObj,
    tempo: tempoObj, rc: foldRecall(saved.rc, recallObs), ...practice,
  });
  // the round is in the cookie now; its mirror has nothing left to protect
  clearRound("einmaleins");

  // points come from progress, never from repetition (§8.3)
  const points = roundPoints({ oldStars: old, newStars: stars, difficulty: diff });
  const res = recordRound("einmaleins", { points });

  journey.finish();
  setTimeout(() => {
    $("sum-stars").textContent = stars > 0 ? "⭐".repeat(stars) : "🦊";
    // the stars you just earned, next to the numbers that earned them
    $("sum-score").innerHTML = t("roundStat", { ok: firstTryOk, total })
      + (points > 0 ? ` <span class="gain">+${points} ⭐</span>` : "");
    // what the next star costs — the rule is invisible otherwise (§10.3), and
    // the count is computed from THIS round's length: "8 von 10" on a Schwer
    // round of 12 would name a goal the round does not have
    const goal = nextStarGoal(stars);
    $("sum-goal").hidden = goal === null;
    if (goal) $("sum-goal").textContent = t(goal, { n: starGoalNeed(stars, total), total });
    $("sum-best").hidden = !improved;
    $("sum-best").textContent = t("newBest");
    // The finish line's verdict, as a symbol and its name — never a number of
    // time (§10.6). A round that awarded no tier shows nothing: below the
    // hare there is no snail, only an empty line that never appears.
    const paid = stars >= 2 && tier > 0;
    $("sum-tempo").hidden = !paid;
    if (paid) {
      $("sum-tempo").innerHTML =
        `${iconHTML(TEMPO_ICONS[tier], { size: 22 })} ${t(TEMPO_KEYS[tier])}`
        + (tempoImproved ? ` · <b>${t("tempoBest")}</b>` : "");
    }
    // One round can cross several thresholds at once — a first Schwer round to
    // three stars is worth 18 points and passes 2, 9 and 18. Showing only the
    // first would quietly swallow two prizes (§8.3).
    const st = $("sum-trophy");
    const won = res.newTrophies;
    wonTrophies = won;
    st.hidden = won.length === 0;
    if (won.length > 0) {
      // The very same card the album shelf shows, so the child can find it
      // again: the cup, her emoji on it, its name. Mara tapped the trophy she
      // had won and nothing happened.
      //
      // It was then a link to the Pokalraum, which celebrated by taking her out
      // of the round she had just finished and dropping her in a room full of
      // empty slots. It is a button now, and it holds the trophy up right here
      // (`showcase.js`, the same one the room uses).
      //
      // The cup fills its card. At 44px in a 167px card it was a token adrift in
      // a white square — the one thing the round handed over, drawn small. The
      // three widths are in the CSS (`.summary .trophy-earn .won`).
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
    // The stars just changed. The chip was rendered at startRound() and nobody
    // told it, so a child read "⭐ 0" in the top bar while three stars lit up
    // beneath it — until they walked back to the map.
    bar.refresh();
    summary.open();
    if (improved || stars === 3 || res.newTrophies.length > 0 || tempoImproved) confetti();
  }, 700);
}

// The one button in the summary opens the level picker, with the fox still
// standing on the level she just played: pressing that tile plays it again, and
// every other level is one tap away instead of two. The map lives in the top
// bar, reachable while the summary is up, which is where Mara reached for it.
$("sum-ok").addEventListener("click", picker.open);

// A trophy she just won, held up the way the Pokalraum holds it up — without
// sending her to the Pokalraum. Delegated once: `endRound` rewrites this row's
// innerHTML on every round that pays.
$("sum-trophy").addEventListener("click", (e) => {
  const card = e.target.closest(".won");
  if (card) openShowcase(wonTrophies[Number(card.dataset.won)]);
});

// --- picker overlay (§3.3: chip → pick = 2 taps) ----------------------------
// The tiles, the fox on them, and the walk-then-open rule live in picker.js.
$("pickchip").addEventListener("click", picker.open);

// --- leaving a round that is not saved yet (§10.7) ---------------------------
// A round lives in memory until `endRound()` writes it, but it is only worth a
// dialog once an answer was given: the picker (no session), the summary (round
// over, cookie written) and a round the child has merely looked at all have
// nothing to lose, and are left without a question.
// A CONFIRMED leave also drops the round's mirror — "Zur Karte" on the sheet
// means it; every other way off the page is an accident to resume from.
const guard = createLeaveGuard({
  mapUrl: new URL("../../", import.meta.url).href,
  inRound: () => session !== null && !roundOver && hasProgress(session.progress()),
  onGo: () => clearRound("einmaleins"),
});

// --- the shared top bar (§3.3) ----------------------------------------------
// Its gear opens the one settings sheet, the same one the map and the Pokalraum
// open (§3.4).
const bar = initTopBar({
  back: "../../",
  // The map button is one tap from the keypad, and Mara found it mid-round.
  onLeave: guard.guardLink,
  onChange() {
    updateChip();
    if (!roundOver) renderQuestion();
  },
  onClose() {
    if (roundOver) summary.open();
  },
});

// The game opens on its map of levels, with the fox standing on the one she
// left (§3.4). It is one tap from a round — the tile the fox is on — and the
// same tap from any other level, which is what the two taps used to buy. A
// child who came here to play the ×7 row can see that she is about to play the
// ×7 row before she is in it.
//
// Unless a round was interrupted mid-play (§10.7): then the game rehydrates it
// — same level, same question queue, the fox where she stood — with no picker
// and no dialog. The mirror is only trusted after `validResume` inside
// startRound; a stale or foreign one falls back to the picker.
coerceTable(); // an invalid saved tile has no `.current`, and the fox no ground
const interrupted = loadRound("einmaleins");
const canResume = interrupted
  && [0, 1, 2].includes(interrupted.d)
  && Number.isInteger(interrupted.t)
  && validResume(interrupted.s, poolFor(interrupted.t, interrupted.d));
if (canResume) {
  diff = interrupted.d;
  table = interrupted.t;
  startRound(interrupted);
} else {
  clearRound("einmaleins"); // whatever it was, it cannot be resumed
  updateChip();
  picker.open();
}
