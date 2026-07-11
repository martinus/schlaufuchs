// The parents' view (§20). A picture of what the child knows, not of how much
// they played: every commercial kids' app shows streaks and stars, because
// engagement is all they have. This site has the knowledge, so it shows that.
//
// Almost read-only: nothing here leaves the device, and no number on this page
// is ever shown to the child (the round's duration least of all — see §10.3).
// The one thing it writes is a deliberate adult action: resetting one game's
// progress (§20). The child's gear still resets the whole site and nothing less
// (§3.4) — per-game reset is named and adult, so it lives only here.

import { initI18n, t } from "./i18n.js";
import { getGame, getRewards, loadState, resetGame, hasGameData } from "./storage.js";
import { boxesFromString } from "./adaptive.js";
import { GAMES, totalPoints, totalTrophies } from "./rewards.js";
import { iconHTML } from "./graphics.js";
import { initTopBar } from "./chrome.js";
import { cellState, cellCounts, recallDigit, weakFacts, practiceSummary, minutesOf, secondsPerRound, sightState, sightTally } from "./parentstats.js";
import { POOL_COUNT, pairIndex, pairOf } from "../../games/einmaleins/logic.js";
import { poolFor as lesenPoolFor, itemAt as lesenItemAt, MIXED as LESEN_MIXED } from "../../games/lesen/logic.js";
import { CONTENT as LESEN_CONTENT, itemCount as lesenItemCount } from "../../games/lesen/content.js";

initI18n();
initTopBar({ back: "./", title: "parentsTitle" });

const $ = (id) => document.getElementById(id);
const DIFFS = ["diffEasy", "diffMedium", "diffHard"];

const saved = getGame("einmaleins");
const boxes = boxesFromString(saved.box, POOL_COUNT);
const practice = practiceSummary(saved);
const rewards = getRewards();

// Lesen keeps its boxes per language (§14.5); only German content exists.
const lesenDe = LESEN_CONTENT.de;
const lesenBoxes = boxesFromString((getGame("lesen").box ?? {}).de, lesenItemCount("de"));
const lesenWordIds = [
  ...lesenPoolFor(0, LESEN_MIXED, lesenDe),
  ...lesenPoolFor(1, LESEN_MIXED, lesenDe),
];
const lesenSentIds = lesenPoolFor(2, LESEN_MIXED, lesenDe);

// The two numbers the child's own top bar shows, and nothing else. A third chip
// used to count a daily streak behind a 🔥 — the streak left this page first
// (a symbol that exists on one page only is a symbol nobody learns) and then
// the site (§8.5): a year of tracking, and nothing ever rendered it.
function renderChips() {
  $("p-chips").innerHTML = [
    `<span class="pchip">${iconHTML("ui-star", { size: 16 })} ${totalPoints(rewards.pr)}</span>`,
    `<span class="pchip">${iconHTML("deco-trophy", { size: 16 })} ${totalTrophies(rewards.pr)}</span>`,
  ].join("");
}

function renderTime() {
  const rows = practice.perDiff.map((d, i) => {
    const pace = secondsPerRound(d.seconds, d.rounds);
    return `<tr>
      <th scope="row">${t(DIFFS[i])}</th>
      <td>${d.rounds}</td>
      <td>${d.seconds > 0 ? t("parentsMinutes", { m: minutesOf(d.seconds) }) : "—"}</td>
      <td>${pace === null ? t("parentsNoPace") : t("parentsPace", { s: pace })}</td>
    </tr>`;
  });
  const pace = secondsPerRound(practice.totalSeconds, practice.totalRounds);
  $("p-time").innerHTML = `<table class="ptable">
    <thead><tr><th></th><th>${t("parentsColRounds")}</th><th>${t("parentsColTime")}</th><th>${t("parentsColPace")}</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
    <tfoot><tr>
      <th scope="row">${t("parentsTotal")}</th>
      <td>${practice.totalRounds}</td>
      <td>${practice.totalSeconds > 0 ? t("parentsMinutes", { m: minutesOf(practice.totalSeconds) }) : "—"}</td>
      <td>${pace === null ? t("parentsNoPace") : t("parentsPace", { s: pace })}</td>
    </tr></tfoot>
  </table>`;
  $("p-pace-note").textContent = pace === null ? "" : t("parentsPace1", { s: pace });
}

// 10×10, rows are tables and columns are factors, so the grid reads exactly
// like the times table a parent learned at school. The box paints accuracy;
// the recall tracker (§20, written by the game per first-try answer) darkens
// a solid cell to "auswendig" when the answers have repeatedly come at rocket
// speed — the split between knowing a fact and computing it, which no box
// digit can see.
function renderHeat() {
  const rc = saved.rc;
  let html = '<div class="heat" role="img" aria-label="' + t("parentsHeatH") + '">';
  html += '<span class="hh"></span>';
  for (let f = 1; f <= 10; f++) html += `<span class="hh">${f}</span>`;
  for (let tbl = 1; tbl <= 10; tbl++) {
    html += `<span class="hh">${tbl}</span>`;
    for (let f = 1; f <= 10; f++) {
      const id = pairIndex(tbl, f);
      const state = cellState(boxes[id], recallDigit(rc, id));
      html += `<span class="hc h-${state}" title="${tbl} × ${f} = ${tbl * f}"></span>`;
    }
  }
  html += "</div>";

  const tally = cellCounts(boxes, rc, POOL_COUNT);
  html += `<p class="legend">
    <span><i class="h-weak"></i> ${t("parentsLegendWeak")} (${tally.weak})</span>
    <span><i class="h-open"></i> ${t("parentsLegendOpen")} (${tally.open})</span>
    <span><i class="h-solid"></i> ${t("parentsLegendSolid")} (${tally.solid})</span>
    <span><i class="h-fast"></i> ${t("parentsLegendFast")} (${tally.fast})</span>
  </p>`;
  $("p-heat").innerHTML = html;
}

function renderHelp() {
  const weak = weakFacts(boxes, POOL_COUNT);
  if (weak.length === 0) {
    $("p-help-body").textContent = t("parentsHelpNone");
    $("p-help-list").innerHTML = "";
    return;
  }
  $("p-help-body").textContent = t("parentsHelpBody");
  // twelve is already more homework than an evening holds
  $("p-help-list").innerHTML = weak.slice(0, 12).map(({ id }) => {
    const [tbl, f] = pairOf(id);
    return `<li class="fact">${tbl} × ${f} = <b>${tbl * f}</b></li>`;
  }).join("");
}

// Every word from the reading game as a small card, its state as the same
// colour square the legend wears (§20): which words she reads at a glance,
// which she still spells through — the one thing the Leitner boxes know that
// no score shows. Sentences get a tally line, not a wall: a parent acts on
// words, and forty sentences of chip would bury them.
function renderLesen() {
  const words = lesenWordIds.map((id) => {
    const { item } = lesenItemAt(id, lesenDe);
    return `<span class="wchip"><i class="h-${sightState(lesenBoxes[id])}"></i>${item.w}</span>`;
  });
  const tally = sightTally(lesenBoxes, lesenWordIds);
  const legend = `<p class="legend">
    <span><i class="h-weak"></i> ${t("parentsLegendWeak")} (${tally.weak})</span>
    <span><i class="h-open"></i> ${t("parentsLegendOpen")} (${tally.open})</span>
    <span><i class="h-solid"></i> ${t("parentsLegendSolid")} (${tally.solid})</span>
    <span><i class="h-fast"></i> ${t("parentsLesenFast")} (${tally.fast})</span>
  </p>`;
  // a sentence is comprehension, not sight speed, so box 4 counts as "sitzt"
  const s = sightTally(lesenBoxes, lesenSentIds);
  const sentLine = `<p class="muted">${t("parentsLesenSents", {
    solid: s.solid + s.fast, weak: s.weak, open: s.open,
  })}</p>`;
  $("p-lesen").innerHTML = `<p class="wchips">${words.join("")}</p>${legend}${sentLine}`;
}

// One reset button per game the cookie actually holds something for — real
// progress or a stale dev-cookie entry alike (§20). Named games, adult surface:
// the one place a per-game reset can exist without becoming the child's
// "which game am I in?" question (§3.4). The section hides itself when there is
// nothing to reset.
function renderReset() {
  const state = loadState();
  const games = GAMES.filter((g) => hasGameData(state, g));
  $("p-reset-sec").hidden = games.length === 0;
  $("p-reset").innerHTML = games
    .map((g) => `<div class="resetrow">
      <span>${t(`game_${g}`)}</span>
      <button class="resetbtn" type="button" data-reset="${g}">${t("parentsResetBtn")}</button>
    </div>`)
    .join("");
}

// Two-step confirm, like the site-wide reset (§3.4): the first tap arms the row
// and names the stakes, a second within a few seconds does it. Arming one row
// disarms the others, so two half-pressed buttons can never both fire.
let armTimer = null;
function disarmAll() {
  clearTimeout(armTimer);
  for (const b of $("p-reset").querySelectorAll("[data-reset]")) {
    delete b.dataset.armed;
    b.classList.remove("armed");
    b.textContent = t("parentsResetBtn");
  }
}
$("p-reset").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-reset]");
  if (!btn) return;
  if (btn.dataset.armed !== "1") {
    disarmAll();
    btn.dataset.armed = "1";
    btn.classList.add("armed");
    btn.textContent = t("parentsResetConfirm");
    armTimer = setTimeout(disarmAll, 4000);
    return;
  }
  resetGame(btn.dataset.reset);
  location.reload(); // module-level reads are stale after the write; start fresh
});

function render() {
  // "played" means any item has left box 2, or any round was banked — box 2 is
  // what an untouched item reads as (§7.1), so `open` is the honest test.
  const emPlayed = practice.totalRounds > 0 || cellCounts(boxes, saved.rc, POOL_COUNT).open < POOL_COUNT;
  const lesenPlayed =
    sightTally(lesenBoxes, [...lesenWordIds, ...lesenSentIds]).open < lesenItemCount("de");
  const played = emPlayed || lesenPlayed;
  $("p-empty").hidden = played;
  $("p-body").hidden = !played;
  renderChips();
  renderReset(); // independent of "played": a stale cookie must still be clearable
  if (!played) return;
  // each game's block stands only once that game has something to say
  $("p-em-sec").hidden = !emPlayed;
  $("p-lesen-sec").hidden = !lesenPlayed;
  if (emPlayed) {
    renderTime();
    renderHeat();
    renderHelp();
  }
  if (lesenPlayed) renderLesen();
}

render();
