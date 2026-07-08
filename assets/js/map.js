// World map page module (§3.1): header chips, region badges & states,
// fox placement, sound/language toggles, global reset.

import { initI18n, t, getLang, setLang } from "./i18n.js";
import { loadState, getRewards, getSettings, setSettings, resetAll } from "./storage.js";
import { gameStars, regionState, levelInfo, GAMES } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { sfx } from "./audio.js";

// Fox anchor per region (map coordinates, §3.1).
const ANCHORS = {
  einmaleins: [180, 330],
  rechnungen: [300, 178],
  tippen: [285, 228],
  vokabeln: [78, 178],
  lesen: [78, 432],
};

initI18n();

function render() {
  const state = loadState();

  // fox level chip
  const info = levelInfo();
  document.getElementById("levelchip").innerHTML = `
    ${foxSVG({ pose: "neutral", size: 40, level: info.level })}
    <span>
      <span class="lbl">${t("foxLevel", { lvl: info.level })}</span>
      <span class="bar"><i style="width:${Math.round(info.frac * 100)}%"></i></span>
    </span>`;

  // daily streak chip
  const streak = getRewards().streak;
  const streakEl = document.getElementById("streakchip");
  if (Array.isArray(streak) && streak[1] >= 2) {
    streakEl.hidden = false;
    streakEl.textContent = `🔥 ${streak[1]}`;
    streakEl.setAttribute("title", t("streakDays", { n: streak[1] }));
  } else {
    streakEl.hidden = true;
  }

  // region star badges and visual states
  for (const game of GAMES) {
    const badge = document.querySelector(`[data-stars="${game}"]`);
    if (badge) badge.textContent = `⭐ ${gameStars(state, game)}`;
    const region = document.getElementById(`region-${game}`);
    if (region) {
      region.classList.remove("thriving", "mastered");
      const rs = regionState(state, game);
      if (rs !== "base") region.classList.add(rs);
    }
  }

  // the fox stands on the last-played region (§3.1)
  const at = ANCHORS[getRewards().at] ? getRewards().at : "einmaleins";
  const [x, y] = ANCHORS[at];
  const fox = document.getElementById("map-fox");
  fox.innerHTML = foxSVG({ pose: "happy", size: 44, level: info.level });
  fox.setAttribute("transform", `translate(${x - 22}, ${y - 40})`);

  // toggles
  document.getElementById("soundbtn").textContent = getSettings().sound !== false ? "🔊" : "🔇";
  document.getElementById("langbtn").textContent = getLang() === "de" ? "EN" : "DE";
}

document.getElementById("soundbtn").addEventListener("click", () => {
  setSettings({ sound: getSettings().sound === false });
  sfx.click();
  render();
});

document.getElementById("langbtn").addEventListener("click", () => {
  setLang(getLang() === "de" ? "en" : "de");
  render();
});

const overlay = document.getElementById("reset-overlay");
document.getElementById("resetbtn").addEventListener("click", () => (overlay.hidden = false));
document.getElementById("reset-cancel").addEventListener("click", () => (overlay.hidden = true));
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.hidden = true;
});
document.getElementById("reset-confirm").addEventListener("click", () => {
  resetAll();
  location.reload();
});

render();
