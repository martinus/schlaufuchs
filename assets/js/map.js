// World map page module (§3.1): shared level chip, region star badges &
// states, the Trophy Room badge, fox placement, settings overlay, global reset.

import { initI18n, t } from "./i18n.js";
import { loadState, getRewards } from "./storage.js";
import { gameStars, regionState, starBadgeTier, stickerCount, levelInfo, GAMES } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { iconHTML, iconSVG, applyIcons } from "./graphics.js";
import { renderLevelChip, initSettingsOverlay } from "./chrome.js";

// Fox anchor per region (map coordinates, §3.1).
const ANCHORS = {
  einmaleins: [180, 372],
  rechnungen: [282, 196],
  tippen: [300, 266],
  vokabeln: [88, 198],
  lesen: [88, 480],
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

// A region's road, its dashed centre line, and (for the village, which has no
// road) its square all share one `paved` state. Missing ids are simply skipped.
function pave(game, on) {
  for (const id of [`road-${game}`, `roadline-${game}`, `plaza-${game}`]) {
    document.getElementById(id)?.classList.toggle("paved", on);
  }
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
      // the island remembers: a mastered region's road turns to cobblestone
      pave(game, rs === "mastered");
    }
  }

  // Trophy Room: total stickers collected across all games (§3.1, §8.3)
  const pr = rewards.pr ?? {};
  const totalStickers = GAMES.reduce((a, g) => a + stickerCount(pr[g]), 0);
  const pkBadge = document.querySelector(`[data-badge="pokalraum"]`);
  if (pkBadge) {
    const pkTier = totalStickers >= 60 ? 3 : totalStickers >= 20 ? 2 : totalStickers > 0 ? 1 : 0;
    renderBadge(pkBadge, "deco-trophy", totalStickers, pkTier);
    pave("pokalraum", pkTier >= 2);
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

// settings overlay (gear) — the only place the global reset lives
const settings = initSettingsOverlay({ resetKind: "all", onChange: render });
document.getElementById("gearbtn")?.addEventListener("click", settings.open);

render();
