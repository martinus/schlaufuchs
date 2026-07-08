// Sticker album page (§3.2): five sections, 12 slots each, earned stickers
// derive from the per-game perfect-round counters.

import { initI18n, t, getLang } from "./i18n.js";
import { getRewards } from "./storage.js";
import { GAMES, STICKERS, THRESHOLDS, stickerCount } from "./rewards.js";

initI18n();

const pr = getRewards().pr ?? {};
const lang = getLang();
let total = 0;

const main = document.getElementById("album");
for (const game of GAMES) {
  const earned = stickerCount(pr[game]);
  total += earned;
  const section = document.createElement("section");
  section.className = "album-section";
  const slots = STICKERS[game]
    .map((s, i) => {
      if (i < earned) {
        return `<div class="slot"><span>${s.e}</span><span class="sname">${s[lang]}</span></div>`;
      }
      return `<div class="slot locked" title="${THRESHOLDS[i]}×"><span>?</span></div>`;
    })
    .join("");
  section.innerHTML = `
    <h2>${t(`region_${game}`)} · ${t(`game_${game}`)} — ${earned}/12</h2>
    <div class="stickers">${slots}</div>`;
  main.appendChild(section);
}

document.getElementById("totalcount").textContent = t("stickerCount", { n: total, total: 60 });
