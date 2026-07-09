// The parents' view (§20). A picture of what the child knows, not of how much
// they played: every commercial kids' app shows streaks and stars, because
// engagement is all they have. This site has the knowledge, so it shows that.
//
// Read-only. Nothing here writes state, nothing here leaves the device, and no
// number on this page is ever shown to the child (the round's duration least of
// all — see §10.3).

import { initI18n, t } from "./i18n.js";
import { getGame, getRewards } from "./storage.js";
import { boxesFromString } from "./adaptive.js";
import { totalPoints, totalTrophies } from "./rewards.js";
import { iconHTML } from "./graphics.js";
import { initTopBar } from "./chrome.js";
import { heatOf, weakFacts, heatCounts, practiceSummary, minutesOf, secondsPerRound } from "./parentstats.js";
import { POOL_COUNT, pairIndex, pairOf } from "../../games/einmaleins/logic.js";

initI18n();
initTopBar({ back: "./", title: "parentsTitle" });

const $ = (id) => document.getElementById(id);
const DIFFS = ["diffEasy", "diffMedium", "diffHard"];

const saved = getGame("einmaleins");
const boxes = boxesFromString(saved.box, POOL_COUNT);
const practice = practiceSummary(saved);
const rewards = getRewards();

function renderChips() {
  const trophies = totalTrophies(rewards.pr);
  const streak = Array.isArray(rewards.streak) ? rewards.streak[1] : 0;
  $("p-chips").innerHTML = [
    `<span class="pchip">${iconHTML("ui-star", { size: 16 })} ${totalPoints(rewards.pr)}</span>`,
    `<span class="pchip">${iconHTML("deco-trophy", { size: 16 })} ${trophies}</span>`,
    streak >= 2 ? `<span class="pchip">${iconHTML("ui-flame", { size: 16 })} ${streak}</span>` : "",
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
// like the times table a parent learned at school.
function renderHeat() {
  let html = '<div class="heat" role="img" aria-label="' + t("parentsHeatH") + '">';
  html += '<span class="hh"></span>';
  for (let f = 1; f <= 10; f++) html += `<span class="hh">${f}</span>`;
  for (let tbl = 1; tbl <= 10; tbl++) {
    html += `<span class="hh">${tbl}</span>`;
    for (let f = 1; f <= 10; f++) {
      const box = boxes[pairIndex(tbl, f)];
      html += `<span class="hc h-${heatOf(box)}" title="${tbl} × ${f} = ${tbl * f}"></span>`;
    }
  }
  html += "</div>";

  const tally = heatCounts(boxes, POOL_COUNT);
  html += `<p class="legend">
    <span><i class="h-weak"></i> ${t("parentsLegendWeak")} (${tally.weak})</span>
    <span><i class="h-open"></i> ${t("parentsLegendOpen")} (${tally.open})</span>
    <span><i class="h-solid"></i> ${t("parentsLegendSolid")} (${tally.solid})</span>
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

function render() {
  const played = practice.totalRounds > 0 || heatCounts(boxes, POOL_COUNT).open < POOL_COUNT;
  $("p-empty").hidden = played;
  $("p-body").hidden = !played;
  renderChips();
  if (!played) return;
  renderTime();
  renderHeat();
  renderHelp();
}

render();
