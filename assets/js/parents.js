// The parents' view (§20). A picture of what the child knows, not of how much
// they played: every commercial kids' app shows streaks and stars, because
// engagement is all they have. This site has the knowledge, so it shows that.
//
// Read-only. Nothing here writes state, nothing here leaves the device, and no
// number on this page is ever shown to the child (the round's duration least of
// all — see §10.3). Resetting progress is not here: it is a per-game reset in
// the settings gear (§3.4), so this page is only ever information.

import { initI18n, t } from "./i18n.js";
import { getGame, getRewards } from "./storage.js";
import { boxesFromString } from "./adaptive.js";
import { totalPoints, totalTrophies } from "./rewards.js";
import { iconHTML } from "./graphics.js";
import { initTopBar } from "./chrome.js";
import { cellState, cellCounts, recallDigit, weakFacts, practiceSummary, minutesOf, secondsPerRound, sightTally, weakSightIds, groupState } from "./parentstats.js";
import { POOL_COUNT, pairIndex, pairOf } from "../../games/einmaleins/logic.js";
import { poolFor as lesenPoolFor, itemAt as lesenItemAt, MIXED as LESEN_MIXED } from "../../games/lesen/logic.js";
import { CONTENT as LESEN_CONTENT, itemCount as lesenItemCount } from "../../games/lesen/content.js";
import { MODES as RECH_MODES, bucketsFor as rechBucketsFor, BUCKET_COUNT as RECH_BUCKETS } from "../../games/rechnungen/logic.js";

initI18n();
initTopBar({ back: "./", title: "parentsTitle" });

const $ = (id) => document.getElementById(id);
const DIFFS = ["diffEasy", "diffMedium", "diffHard"];

const saved = getGame("einmaleins");
const boxes = boxesFromString(saved.box, POOL_COUNT);
const practice = practiceSummary(saved);
const rewards = getRewards();

// Lesen keeps its boxes per language (§14.5); only German content exists. The
// three difficulty tiers are three distinct reading skills (§14.1), so they are
// reported apart: Blitzwörter (single words, `{w}`), Blödsinn-Sätze (a whole
// sentence to judge) and Lesetexte (a passage to understand). They interleave
// in one box string; each tier's ids come from its own difficulty.
const lesenDe = LESEN_CONTENT.de;
const lesenBoxes = boxesFromString((getGame("lesen").box ?? {}).de, lesenItemCount("de"));
const lesenWordIds = lesenPoolFor(0, LESEN_MIXED, lesenDe);
const lesenSentIds = lesenPoolFor(1, LESEN_MIXED, lesenDe);
const lesenTextIds = lesenPoolFor(2, LESEN_MIXED, lesenDe);

// Rechnungen's box is one Leitner digit per skill bucket (§12.2); the buckets
// that feed each picker cell (a mode at a difficulty) fold into one state.
const rechBoxes = boxesFromString(getGame("rechnungen").box, RECH_BUCKETS);
const rechAllBoxes = Array.from({ length: RECH_BUCKETS }, (_, i) => rechBoxes[i]);
// The five tiles that own skill buckets; "mix" draws from the others, so it has
// none of its own and never gets a row.
const RECH_TILES = RECH_MODES.filter((m) => m !== "mix");
const RECH_LABEL = {
  "+": t("parentsModePlus"),
  "-": t("parentsModeMinus"),
  rest: t("parentsModeRest"),
  mauer: t("parentsModeMauer"),
  quad: t("parentsModeQuad"),
};

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

// One line per reading tier — how the tier is spread across the three states a
// parent can act on (§20). "solid" folds in the top box: a word held at the
// shortest flash, or a sentence/passage answered right, both read as "sitzt".
function tierLine(head, ids) {
  const s = sightTally(lesenBoxes, ids);
  const tally = t("parentsTierLine", { solid: s.solid + s.fast, weak: s.weak, open: s.open });
  return `<p class="tierline"><b>${head}</b> — ${tally}</p>`;
}

// The reading report is the three tiers, each a tally line — no wall of chips.
// The one actionable list is the Blitzwörter that still slip: those a parent can
// sit and read with the child, the reading game's "here you help most". The
// higher tiers are comprehension, not a fixed set to drill, so they stay a line.
function renderLesen() {
  const weak = weakSightIds(lesenBoxes, lesenWordIds);
  const chips = weak.map((id) => {
    const { item } = lesenItemAt(id, lesenDe);
    return `<span class="wchip"><i class="h-weak"></i>${item.w}</span>`;
  });
  const wordsHelp = chips.length
    ? `<p class="muted">${t("parentsLesenWordsHelp")}</p><p class="wchips">${chips.join("")}</p>`
    : "";
  $("p-lesen").innerHTML =
    tierLine(t("parentsLesenWordsH"), lesenWordIds) + wordsHelp +
    tierLine(t("parentsLesenSentsH"), lesenSentIds) +
    tierLine(t("parentsLesenTextsH"), lesenTextIds);
}

// A grid of the five skill tiles × three levels: each cell the folded state of
// that cell's buckets (§20). Below it, the tiles that slip, named — the same
// "here you help most" the times table shows, but a parent acts on a kind of
// sum, not a single fact (a re-queued miss returns as a fresh task, §12.2).
function renderRechnen() {
  let grid = '<div class="skillgrid" role="img" aria-label="' + t("parentsRechnenHint") + '">';
  grid += '<span class="sg-h"></span>';
  for (let d = 0; d < 3; d++) grid += `<span class="sg-h">${t(DIFFS[d])}</span>`;
  const weakTiles = [];
  for (const mode of RECH_TILES) {
    grid += `<span class="sg-mode">${RECH_LABEL[mode]}</span>`;
    for (let d = 0; d < 3; d++) {
      const state = groupState(rechBucketsFor(mode, d).map((i) => rechBoxes[i]));
      const name = `${RECH_LABEL[mode]} · ${t(DIFFS[d])}`;
      grid += `<span class="sg-c h-${state}" title="${name}"></span>`;
      if (state === "weak") weakTiles.push(name);
    }
  }
  grid += "</div>";
  const legend = `<p class="legend">
    <span><i class="h-weak"></i> ${t("parentsLegendWeak")}</span>
    <span><i class="h-open"></i> ${t("parentsLegendOpen")}</span>
    <span><i class="h-solid"></i> ${t("parentsLegendSolid")}</span>
  </p>`;
  const help = weakTiles.length
    ? `<h2>${t("parentsHelpH")}</h2><p>${t("parentsRechnenHelpBody")}</p>
       <ul class="factlist">${weakTiles.map((n) => `<li class="fact">${n}</li>`).join("")}</ul>`
    : `<p class="muted">${t("parentsHelpNone")}</p>`;
  $("p-rechnen").innerHTML = grid + legend + help;
}

// A clickable index — but only when there is more than one section to jump
// between, or it is a table of contents for a single item.
function renderToc(sections) {
  if (sections.length < 2) {
    $("p-toc").hidden = true;
    return;
  }
  $("p-toc").hidden = false;
  $("p-toc").innerHTML = `<p class="ptoc-h">${t("parentsTocH")}</p>` +
    sections.map((s) => `<a href="#${s.id}">${t(s.key)}</a>`).join("");
}

function render() {
  // "played" means any item has left box 2, or any round was banked — box 2 is
  // what an untouched item reads as (§7.1), so `open` is the honest test.
  const emPlayed = practice.totalRounds > 0 || cellCounts(boxes, saved.rc, POOL_COUNT).open < POOL_COUNT;
  const lesenPlayed =
    sightTally(lesenBoxes, [...lesenWordIds, ...lesenSentIds, ...lesenTextIds]).open < lesenItemCount("de");
  // rechnungen has no practice clock; a bucket that has left box 2 is the proof
  // it was played — the same "open is untouched" test the other two games use.
  const rechnenPlayed = groupState(rechAllBoxes) !== "open";
  const played = emPlayed || lesenPlayed || rechnenPlayed;
  $("p-empty").hidden = played;
  $("p-body").hidden = !played;
  renderChips();
  if (!played) return;
  // each game's block stands only once that game has something to say
  $("p-em-sec").hidden = !emPlayed;
  $("p-lesen-sec").hidden = !lesenPlayed;
  $("p-rechnen-sec").hidden = !rechnenPlayed;
  const toc = [];
  if (emPlayed) toc.push({ id: "p-em-sec", key: "region_einmaleins" });
  if (lesenPlayed) toc.push({ id: "p-lesen-sec", key: "region_lesen" });
  if (rechnenPlayed) toc.push({ id: "p-rechnen-sec", key: "region_rechnungen" });
  renderToc(toc);
  if (emPlayed) {
    renderTime();
    renderHeat();
    renderHelp();
  }
  if (lesenPlayed) renderLesen();
  if (rechnenPlayed) renderRechnen();
}

render();
