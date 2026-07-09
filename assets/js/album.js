// Trophy album page (§3.2): five sections, 12 slots each, earned trophies
// derive from the per-game perfect-round counters.

import { initI18n, t, getLang } from "./i18n.js";
import { getRewards } from "./storage.js";
import {
  GAMES, TROPHIES, THRESHOLDS, TOTAL_TROPHIES, TROPHIES_PER_GAME, trophyCount, nextTrophyInfo,
} from "./rewards.js";
import { iconHTML } from "./graphics.js";
import { initTopBar } from "./chrome.js";

initI18n();

// One progress line per game: how many perfect rounds until the next trophy.
function progressLine(pr, game) {
  const info = nextTrophyInfo(game, pr[game]);
  if (!info) return t("trophyAllDone");
  return info.remaining === 1 ? t("trophyNextIn1") : t("trophyNextIn", { n: info.remaining });
}

// The shelves are built with innerHTML, not with [data-i18n], so nothing in
// them is re-translated by setLang(). They are rebuilt instead — which is why
// this is a function and not the body of the module (§3.4).
function render() {
  const pr = getRewards().pr ?? {};
  const lang = getLang();
  let total = 0;

  const main = document.getElementById("album");
  main.textContent = "";
  for (const game of GAMES) {
    const earned = trophyCount(game, pr[game]);
    total += earned;
    const section = document.createElement("section");
    section.className = "album-section";
    const slots = TROPHIES[game]
      .map((s, i) => {
        if (i < earned) {
          return `<div class="slot">${iconHTML(s.icon, { size: 34 })}<span class="sname">${s[lang]}</span></div>`;
        }
        // A locked slot shows the trophy as a silhouette: you can see what is
        // missing, which is the whole reason to keep collecting. The name stays
        // hidden — the shape is the tease.
        return `<div class="slot locked" title="${THRESHOLDS[game][i]}×" aria-label="${t("trophyLocked")}">
          <span class="silhouette" aria-hidden="true">${iconHTML(s.icon, { size: 34 })}</span></div>`;
      })
      .join("");
    section.innerHTML = `
      <h2>${t(`region_${game}`)} · ${t(`game_${game}`)} — ${earned}/${TROPHIES_PER_GAME}</h2>
      <p class="album-progress">${progressLine(pr, game)}</p>
      <div class="trophies">${slots}</div>`;
    main.appendChild(section);
  }

  const totalEl = document.getElementById("totalcount");
  if (totalEl) totalEl.textContent = t("trophyCount", { n: total, total: TOTAL_TROPHIES });
}

// The room has no game of its own, so its gear offers no reset (§3.4): the
// global one lives on the map, where the fox can see what it costs.
initTopBar({ back: "./", resetKind: null, onChange: render });

render();
