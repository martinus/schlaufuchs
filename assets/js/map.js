// World map page module (§3.1): shared level chip, region star badges &
// states, the Trophy Room badge, fox placement, settings overlay, global reset.

import { initI18n, t } from "./i18n.js";
import { loadState, getRewards } from "./storage.js";
import { gameStars, regionState, starBadgeTier, trophyCount, foxInfo, GAMES, isPlayable } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { iconSVG, applyIcons } from "./graphics.js";
import { renderFoxChip, initSettingsOverlay } from "./chrome.js";

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

const SVG_NS = "http://www.w3.org/2000/svg";

// Four of the five games are stubs. Their regions are drawn under fog so the
// island never promises what the site cannot deliver (§3.1). The fog is built
// from the region's own art, so it fits a mountain as well as a lake, and it
// is `pointer-events: none` — regions are hit-tested by their art, and a fog
// blob spanning the bounding box would quietly hand back the invisible
// hotspot that was removed from this map on purpose.
function fogRegion(region) {
  if (region.querySelector(".fog")) return; // render() runs again after a reset
  const label = region.querySelector(".region-label");

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of region.children) {
    if (el === label || el.classList.contains("region-badge")) continue;
    const b = el.getBBox();
    if (b.width === 0 || b.height === 0) continue; // hidden thriving/mastered layers
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  if (!Number.isFinite(x0)) return; // nothing to fog

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "fog");
  g.setAttribute("filter", "url(#fog-blur)");

  // A veil over the whole art, then three banks for texture. The veil is what
  // makes the region read as *closed*: with banks alone the treetops and the
  // book poked through and Lesewiese looked open for business. Fog spilling
  // onto a neighbour is harmless — playable regions are painted last (§3.1),
  // so nothing can grey out the one village a child can walk into.
  const w = x1 - x0, h = y1 - y0, cx = x0 + w / 2, cy = y0 + h / 2;
  const banks = [
    [0.00, 0.00, 0.52, 0.52, 0.55], // the veil
    [-0.15, 0.02, 0.32, 0.24, 0.72],
    [0.16, -0.05, 0.30, 0.22, 0.70],
    [0.00, 0.14, 0.38, 0.20, 0.76],
  ];
  for (const [dx, dy, rx, ry, o] of banks) {
    const e = document.createElementNS(SVG_NS, "ellipse");
    e.setAttribute("cx", (cx + dx * w).toFixed(1));
    e.setAttribute("cy", (cy + dy * h).toFixed(1));
    e.setAttribute("rx", (rx * w).toFixed(1));
    e.setAttribute("ry", (ry * h).toFixed(1));
    e.setAttribute("opacity", o);
    g.appendChild(e);
  }
  region.insertBefore(g, label); // over the art, under the label and badge
}

function render() {
  const state = loadState();
  const rewards = getRewards();

  renderFoxChip(document.getElementById("foxchip"));

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

      // a region whose game does not exist yet sits under fog. The link stays:
      // its page says so in words, and a screen reader hears it before the tap.
      const locked = !isPlayable(game);
      region.classList.toggle("locked", locked);
      if (locked) {
        fogRegion(region);
        region.setAttribute("aria-label", `${t(`region_${game}`)} — ${t("lockedHint")}`);
      }
    }
  }

  // Trophy Room: total trophies collected across all games (§3.1, §8.3)
  const pr = rewards.pr ?? {};
  const totalTrophies = GAMES.reduce((a, g) => a + trophyCount(pr[g]), 0);
  const pkBadge = document.querySelector(`[data-badge="pokalraum"]`);
  if (pkBadge) {
    const pkTier = totalTrophies >= 60 ? 3 : totalTrophies >= 20 ? 2 : totalTrophies > 0 ? 1 : 0;
    renderBadge(pkBadge, "deco-trophy", totalTrophies, pkTier);
    pave("pokalraum", pkTier >= 2);
  }
  const pkRegion = document.getElementById("region-pokalraum");
  if (pkRegion) {
    pkRegion.classList.remove("thriving", "mastered");
    if (totalTrophies >= 60) pkRegion.classList.add("mastered");
    else if (totalTrophies >= 20) pkRegion.classList.add("thriving");
  }

  // the fox stands on the last-played region (§3.1)
  const at = ANCHORS[rewards.at] ? rewards.at : "einmaleins";
  const [x, y] = ANCHORS[at];
  const fox = document.getElementById("map-fox");
  fox.innerHTML = foxSVG({ pose: "happy", size: 44, stars: foxInfo().total });
  fox.setAttribute("transform", `translate(${x - 22}, ${y - 40})`);
}

// settings overlay (gear) — the only place the global reset lives
const settings = initSettingsOverlay({ resetKind: "all", onChange: render });
document.getElementById("gearbtn")?.addEventListener("click", settings.open);

render();
