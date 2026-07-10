// Trophy album page (§3.2): five sections, 12 slots each, earned trophies
// derive from the per-game perfect-round counters. Tapping one holds it up.

import { initI18n, t, getLang } from "./i18n.js";
import { getRewards } from "./storage.js";
import {
  GAMES, TROPHIES, THRESHOLDS, TROPHIES_PER_GAME, trophyCount, nextTrophyInfo,
} from "./rewards.js";
import { iconHTML, applyIcons } from "./graphics.js";
import { trophyCardHTML } from "./trophycard.js";
import { initTopBar } from "./chrome.js";
import { createOverlay } from "./overlay.js";
import { confetti } from "./confetti.js";
import { foxSVG } from "./fox.js";
import { sfx } from "./audio.js";

initI18n();
applyIcons(document); // the room's own symbol, once real SVGs land

// One progress line per game: how many perfect rounds until the next trophy.
function progressLine(pr, game) {
  const info = nextTrophyInfo(game, pr[game]);
  if (!info) return t("trophyAllDone");
  return info.remaining === 1 ? t("trophyNextIn1") : t("trophyNextIn", { n: info.remaining });
}

// The village is now called after its game, so its two names are one word said
// twice. Every other region still has a place name and a game name.
function sectionTitle(game) {
  const place = t(`region_${game}`);
  const game_ = t(`game_${game}`);
  return place === game_ ? place : `${place} · ${game_}`;
}

// --- the showcase (§3.2) ----------------------------------------------------
//
// A trophy on a 77px shelf slot is a receipt. Mara won her first one, tapped it,
// and nothing happened — so it stayed a receipt. Tapping it now hands it to her:
// the cup fills the screen, confetti falls, the fox jumps beside it and the
// stars around it blink. It is the one screen in this site built to be shown to
// somebody else.
const SPARKS = 7;

const showcase = createOverlay({
  className: "showcase",
  sheet: `<div class="sc-stage">
      <div class="sc-sparks" aria-hidden="true">${'<i>⭐</i>'.repeat(SPARKS)}</div>
      <div class="sc-card" id="sc-card"></div>
      <div class="sc-fox" aria-hidden="true">${foxSVG({ pose: "cheer", size: 76 })}</div>
    </div>
    <button class="primary" id="sc-close"></button>`,
  initialFocus: "#sc-close",
});
const scCard = showcase.el.querySelector("#sc-card");
const scClose = showcase.el.querySelector("#sc-close");
scClose.addEventListener("click", showcase.close);

// The card is square and fills what the screen has left over once the sheet's
// own box and the Close button are paid for. Measured here, not in CSS: the cup
// is an emoji, so its size is a font-size in px, and no CSS length can be
// derived from the width of the box it has to fit into.
//
// The width budget is the overlay's 12px margins plus the sheet's 16px padding,
// on both sides — a card sized to the viewport alone hung out over the sheet.
const SHEET_X = 2 * (12 + 16);
const SHEET_Y = 250; // top bar of the sheet, the Close button, the paddings

function showcaseSizes() {
  const card = Math.max(160, Math.min(
    window.innerWidth - SHEET_X - 8,
    window.innerHeight - SHEET_Y,
    340,
  ));
  // the art is the symbol (0.66 cups, overlapping the rim by a third) standing
  // on the cup — about 1.45 cups tall — and the name lives under it
  return { card, cup: Math.round(card * 0.52) };
}

function openShowcase(trophy) {
  const { card, cup } = showcaseSizes();
  scCard.style.setProperty("--sc-card", `${card}px`);
  scCard.innerHTML = trophyCardHTML(trophy, { size: cup, lang: getLang() });
  scClose.textContent = t("close");
  showcase.open();
  sfx.trophy();
  confetti(140);
}

// The shelves are built with innerHTML, not with [data-i18n], so nothing in
// them is re-translated by setLang(). They are rebuilt instead — which is why
// this is a function and not the body of the module (§3.4).
function render() {
  const pr = getRewards().pr ?? {};
  const lang = getLang();

  const main = document.getElementById("album");
  main.textContent = "";
  for (const game of GAMES) {
    const earned = trophyCount(game, pr[game]);
    const section = document.createElement("section");
    section.className = "album-section";
    const slots = TROPHIES[game]
      .map((s, i) => {
        // An earned trophy is a button: it opens full size, with the noise a
        // child wants to make about it.
        if (i < earned) {
          return trophyCardHTML(s, {
            size: 34, lang, cls: "slot earned", button: true,
            attrs: `data-trophy="${game}:${i}"`,
          });
        }
        // A locked slot shows the trophy as a silhouette: you can see what is
        // missing, which is the whole reason to keep collecting. The name stays
        // hidden — the shape is the tease.
        //
        // What it costs used to hide in a `title` tooltip, which a child on a
        // phone can never see and Mara read as "20×", i.e. twenty of something.
        // The next slot shows how far along she is; the ones after it show the
        // price, in the only currency this site has (§8.3).
        const need = THRESHOLDS[game][i];
        const foot = i === earned
          ? `<span class="sbar"><i style="width:${Math.min(100, (100 * (pr[game] ?? 0)) / need)}%"></i></span>`
          : `<span class="sfoot">⭐ ${need}</span>`;
        return `<div class="slot locked" aria-label="${t("trophyLocked")} — ⭐ ${need}">
          <span class="silhouette" aria-hidden="true">${iconHTML(s.icon, { size: 34 })}</span>${foot}</div>`;
      })
      .join("");
    section.innerHTML = `
      <h2>${sectionTitle(game)} — ${earned}/${TROPHIES_PER_GAME}</h2>
      <p class="album-progress">${progressLine(pr, game)}</p>
      <div class="trophies">${slots}</div>`;
    main.appendChild(section);
  }
}

// Delegated once, on the container that survives every render(): a listener per
// card would be re-added on every language switch.
document.getElementById("album")?.addEventListener("click", (e) => {
  const card = e.target.closest(".slot.earned");
  if (!card) return;
  const [game, i] = card.dataset.trophy.split(":");
  openShowcase(TROPHIES[game][Number(i)]);
});

// The room has no game of its own, so its gear offers no reset (§3.4): the
// global one lives on the map, where the fox can see what it costs.
initTopBar({ back: "./", resetKind: null, onChange: render });

render();
