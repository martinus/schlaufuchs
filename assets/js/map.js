// World map page module (§3.1): shared level chip, region star badges &
// states, the Trophy Room badge, fox placement, settings overlay, global reset.

import { initI18n, t } from "./i18n.js";
import { loadState, getRewards, resetAll } from "./storage.js";
import { gameStars, regionState, starBadgeTier, stickerCount, levelInfo, GAMES } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { iconHTML, iconSVG, applyIcons } from "./graphics.js";
import { renderLevelChip, initSettingsOverlay } from "./chrome.js";

// Fox anchor per region (map coordinates, §3.1).
const ANCHORS = {
  einmaleins: [180, 330],
  rechnungen: [300, 178],
  tippen: [285, 228],
  vokabeln: [78, 178],
  lesen: [78, 432],
};

initI18n();
applyIcons(document); // upgrade static [data-icon] decorations if SVGs exist

// A region star badge: small icon + count, styled by tier (gold / glow).
function renderBadge(badgeEl, iconName, count, tier) {
  badgeEl.innerHTML = iconSVG(iconName, { x: -8, y: 0, size: 12 })
    + `<text class="region-stars" x="2" y="0" text-anchor="start">${count}</text>`;
  badgeEl.classList.remove("badge-t1", "badge-t2", "badge-t3");
  if (tier) badgeEl.classList.add(`badge-t${tier}`);
}

function render() {
  const state = loadState();
  const rewards = getRewards();

  renderLevelChip(document.getElementById("levelchip"));

  // daily streak chip
  const streak = rewards.streak;
  const streakEl = document.getElementById("streakchip");
  if (Array.isArray(streak) && streak[1] >= 2) {
    streakEl.hidden = false;
    streakEl.innerHTML = `${iconHTML("ui-flame", { size: 18 })} ${streak[1]}`;
    streakEl.setAttribute("title", t("streakDays", { n: streak[1] }));
  } else {
    streakEl.hidden = true;
  }

  // region star badges and visual states
  for (const game of GAMES) {
    const badge = document.querySelector(`[data-badge="${game}"]`);
    if (badge) renderBadge(badge, "ui-star", gameStars(state, game), starBadgeTier(state, game));
    const region = document.getElementById(`region-${game}`);
    if (region) {
      region.classList.remove("thriving", "mastered");
      const rs = regionState(state, game);
      if (rs !== "base") region.classList.add(rs);
    }
  }

  // Trophy Room: total stickers collected across all games (§3.1, §8.3)
  const pr = rewards.pr ?? {};
  const totalStickers = GAMES.reduce((a, g) => a + stickerCount(pr[g]), 0);
  const pkBadge = document.querySelector(`[data-badge="pokalraum"]`);
  if (pkBadge) {
    const pkTier = totalStickers >= 60 ? 3 : totalStickers >= 20 ? 2 : totalStickers > 0 ? 1 : 0;
    renderBadge(pkBadge, "deco-trophy", totalStickers, pkTier);
  }
  const pkRegion = document.getElementById("region-pokalraum");
  if (pkRegion) {
    pkRegion.classList.remove("thriving", "mastered");
    if (totalStickers >= 60) pkRegion.classList.add("mastered");
    else if (totalStickers >= 20) pkRegion.classList.add("thriving");
  }

  // the fox stands on the last-played region (§3.1)
  const at = ANCHORS[rewards.at] ? rewards.at : "einmaleins";
  const [x, y] = ANCHORS[at];
  const fox = document.getElementById("map-fox");
  fox.innerHTML = foxSVG({ pose: "happy", size: 44, level: levelInfo().level });
  fox.setAttribute("transform", `translate(${x - 22}, ${y - 40})`);
}

// settings overlay (gear) — global reset lives here as well as in the footer
const settings = initSettingsOverlay({ resetKind: "all", onChange: render });
document.getElementById("gearbtn").addEventListener("click", settings.open);

// footer "delete all progress" with its own confirm sheet (unchanged)
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
