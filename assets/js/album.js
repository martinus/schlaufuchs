// Sticker album page (§3.2): five sections, 12 slots each, earned stickers
// derive from the per-game perfect-round counters.

import { initI18n, t, getLang } from "./i18n.js";
import { getRewards } from "./storage.js";
import { GAMES, STICKERS, THRESHOLDS, stickerCount, nextStickerInfo } from "./rewards.js";
import { iconHTML, applyIcons } from "./graphics.js";

initI18n();
applyIcons(document);

const pr = getRewards().pr ?? {};
const lang = getLang();
let total = 0;

// One progress line per game: how many perfect rounds until the next sticker.
function progressLine(game) {
  const info = nextStickerInfo(pr[game]);
  if (!info) return t("stickerAllDone");
  return info.remaining === 1 ? t("stickerNextIn1") : t("stickerNextIn", { n: info.remaining });
}

const main = document.getElementById("album");
for (const game of GAMES) {
  const earned = stickerCount(pr[game]);
  total += earned;
  const section = document.createElement("section");
  section.className = "album-section";
  const slots = STICKERS[game]
    .map((s, i) => {
      if (i < earned) {
        return `<div class="slot">${iconHTML(s.icon, { size: 34 })}<span class="sname">${s[lang]}</span></div>`;
      }
      // A locked slot shows the sticker as a silhouette: you can see what is
      // missing, which is the whole reason to keep collecting. The name stays
      // hidden — the shape is the tease.
      return `<div class="slot locked" title="${THRESHOLDS[i]}×" aria-label="${t("stickerLocked")}">
        <span class="silhouette" aria-hidden="true">${iconHTML(s.icon, { size: 34 })}</span></div>`;
    })
    .join("");
  section.innerHTML = `
    <h2>${t(`region_${game}`)} · ${t(`game_${game}`)} — ${earned}/12</h2>
    <p class="album-progress">${progressLine(game)}</p>
    <div class="stickers">${slots}</div>`;
  main.appendChild(section);
}

document.getElementById("totalcount").textContent = t("stickerCount", { n: total, total: 60 });
