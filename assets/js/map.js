// World map page module (§3.1): shared fox chip, region star badges & states,
// the Trophy Room's trophy count, the fox and its walk, settings, global reset.

import { initI18n, t } from "./i18n.js";
import { loadState, getRewards, setRewards } from "./storage.js";
import { gameStarsOf, regionState, starBadgeTier, totalTrophies, TOTAL_TROPHIES, GAMES, isPlayable } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { iconSVG, applyIcons } from "./graphics.js";
import { initTopBar } from "./chrome.js";
import { ANCHORS } from "./mapwalk.js";
import { prefersReducedMotion, runWalk } from "./motion.js";

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

// Four of the five games are stubs. Their regions are drawn under clouds so the
// island never promises what the site cannot deliver (§3.1). The cover is built
// from the region's own art, so it fits a mountain as well as a lake, and it
// is `pointer-events: none` — the tap belongs to the region's own `.hit` rect,
// which is bounded; a cloud bank is not, and it would grey out its neighbours.
//
// The cover used to be four gaussian-blurred ellipses. Blur has no edge, and a
// shape with no edge does not read as a *thing*: the mountain under it looked
// like washed-out art, a rendering mistake, not like weather that will lift.
// These are drawn cumulus clouds — a body and three bumps each — and only the
// veil underneath keeps the old blur, because its one job is to have no edge.
// One cloud: a body and three bumps, drawn twice. The rim pass sits under the
// puff pass, a little larger, so the cloud has a single outer edge — a stroke
// on each opaque puff would draw its seams *inside* the cloud instead.
function cloudAt(g, x, y, s) {
  const puffs = [
    [0, 0.12, 1.0, 0.45],       // the body
    [-0.62, -0.1, 0.42, 0.42],  // west bump
    [-0.05, -0.32, 0.55, 0.55], // the crown
    [0.58, -0.06, 0.38, 0.38],  // east bump
  ];
  const cloud = document.createElementNS(SVG_NS, "g");
  cloud.setAttribute("class", "cloud");
  for (const cls of ["cloud-rim", "cloud-puff"]) {
    const grow = cls === "cloud-rim" ? 1.5 : 0;
    for (const [dx, dy, rx, ry] of puffs) {
      const e = document.createElementNS(SVG_NS, "ellipse");
      e.setAttribute("class", cls);
      e.setAttribute("cx", (x + dx * s).toFixed(1));
      e.setAttribute("cy", (y + dy * s).toFixed(1));
      e.setAttribute("rx", (rx * s + grow).toFixed(1));
      e.setAttribute("ry", (ry * s + grow).toFixed(1));
      cloud.appendChild(e);
    }
  }
  g.appendChild(cloud);
}

function fogRegion(region) {
  if (region.querySelector(".fog")) return; // render() runs again after a reset
  const label = region.querySelector(".region-label");

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of region.children) {
    // The hit rect is deliberately larger than the art. Fogging its bbox would
    // blow the fog out over the label, the badge and the region next door.
    if (el === label || el.classList.contains("region-badge") || el.classList.contains("hit")) continue;
    const b = el.getBBox();
    if (b.width === 0 || b.height === 0) continue; // hidden thriving/mastered layers
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  if (!Number.isFinite(x0)) return; // nothing to fog

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "fog");

  // A veil over the whole art, then three clouds. The veil is what makes the
  // region read as *closed*: with clouds alone the treetops and the book poked
  // through and Lesewiese looked open for business. Cover spilling onto a
  // neighbour is harmless — playable regions are painted last (§3.1), so
  // nothing can grey out the one village a child can walk into.
  const w = x1 - x0, h = y1 - y0, cx = x0 + w / 2, cy = y0 + h / 2;
  const veil = document.createElementNS(SVG_NS, "ellipse");
  veil.setAttribute("class", "fog-veil");
  veil.setAttribute("filter", "url(#fog-blur)");
  veil.setAttribute("cx", cx.toFixed(1));
  veil.setAttribute("cy", cy.toFixed(1));
  veil.setAttribute("rx", (0.48 * w).toFixed(1));
  veil.setAttribute("ry", (0.48 * h).toFixed(1));
  g.appendChild(veil);

  // Staggered like the old banks: high-left, high-right, low-centre. Sized by
  // the art's width alone so a tall region gets round clouds, not stretched ones.
  const clouds = [
    [-0.17, -0.16, 0.26],
    [0.20, -0.02, 0.22],
    [-0.02, 0.22, 0.25],
  ];
  for (const [dx, dy, s] of clouds) {
    cloudAt(g, cx + dx * w, cy + dy * h, Math.max(16, s * w));
  }
  region.insertBefore(g, label); // over the art, under the label and badge
}

// A region's name, on a plate, so it reads as a button. Mara tapped the fog and
// the empty grass and never once tried a house: nothing on this map said "press
// me". The plate is measured from the label on every render, because switching
// language makes "Times tables" out of "Einmaleins" and a plate cut to the old
// name would sit under half of the new one.
function ensurePlate(region) {
  const label = region.querySelector(".region-label");
  let plate = region.querySelector(".label-plate");
  if (!plate) {
    plate = document.createElementNS(SVG_NS, "rect");
    plate.setAttribute("class", "label-plate");
    plate.setAttribute("rx", "9");
    region.insertBefore(plate, label);
  }
  const b = label.getBBox();
  plate.setAttribute("x", (b.x - 7).toFixed(1));
  plate.setAttribute("y", (b.y - 4).toFixed(1));
  plate.setAttribute("width", (b.width + 14).toFixed(1));
  plate.setAttribute("height", (b.height + 8).toFixed(1));
}

// A fogged region is not a door. It used to be one: the tap navigated to a stub
// page that explained, in a sentence, that the game does not exist yet — and
// Mara, who reads almost nothing, was simply gone from the map. Now the fog
// wiggles and says "Bald!", and she is still standing where she was.
//
// The bubble is removed by a timer, never by `animationend`: under
// `prefers-reduced-motion` no animation ever starts, so no event ever fires and
// the bubble would stay on the map forever.
const BUBBLE_MS = 1300;
let bubbleTimer = 0;

function soonBubble(region) {
  const svg = region.ownerSVGElement;
  clearTimeout(bubbleTimer);
  svg.querySelector(".soon-bubble")?.remove();
  for (const f of svg.querySelectorAll(".fog.wiggle")) f.classList.remove("wiggle");

  const b = region.querySelector(".region-label").getBBox();
  const cx = b.x + b.width / 2;
  const top = b.y - 30;
  const text = t("soonBubble");
  const w = Math.max(48, text.length * 10 + 18);

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "soon-bubble");
  g.innerHTML = `<rect x="${(cx - w / 2).toFixed(1)}" y="${top}" width="${w}" height="26" rx="13"/>
    <text x="${cx.toFixed(1)}" y="${top + 18}" text-anchor="middle">${text}</text>`;
  // after #map-fox, so a region painted later cannot cover it
  svg.appendChild(g);

  const fog = region.querySelector(".fog");
  fog?.classList.add("wiggle");
  bubbleTimer = setTimeout(() => {
    g.remove();
    fog?.classList.remove("wiggle");
  }, BUBBLE_MS);
}

// --- the fox and its walk (§3.1) --------------------------------------------

// Which anchor the fox is standing on right now. `render()` seeds it from the
// cookie; the walk moves it. Kept here rather than re-read from storage, because
// a walk that starts from anywhere but the fox's actual feet is a teleport.
let foxAt = "einmaleins";
let walking = false;

function placeFox([x, y]) {
  document.getElementById("map-fox")
    ?.setAttribute("transform", `translate(${(x - 22).toFixed(1)}, ${(y - 40).toFixed(1)})`);
}

// A region opens only once the fox is standing in front of it. The map remembers
// where she went, so the fox is there again when she comes back (§3.1).
//
// `prefers-reduced-motion` skips the walk and opens at once — the fox still ends
// up at the new region, because `at` is written either way (§15).
function travelTo(region) {
  if (walking) return;
  const game = region.dataset.game;
  const to = ANCHORS[game];
  // These are SVG anchors, and `region.href` on one is an SVGAnimatedString —
  // assigning it to location.href navigated to "/[object%20SVGAnimatedString]".
  // The attribute is relative to this document, which is also what a subpath
  // deploy needs (§ never emit an absolute /assets path).
  const href = region.getAttribute("href");
  setRewards({ at: game });
  if (!to || prefersReducedMotion() || game === foxAt) {
    location.href = href;
    return;
  }
  // Nothing else may start a walk while one runs: two rAF loops would fight
  // over the same transform, and the second `location.href` would cancel the
  // first navigation half-done.
  walking = true;
  runWalk(ANCHORS[foxAt] ?? ANCHORS.einmaleins, to, placeFox, () => {
    foxAt = game;
    location.href = href;
  });
}

// The back-forward cache freezes this page instead of reloading it. A tap sends
// the fox walking and then navigates (travelTo), which sets `walking = true` and
// counts on the reload to clear it — but a walk-then-navigate leaves the map in
// bfcache with that flag stuck true. Come back with the Android gesture or the
// browser's back button and the restored page never ran a fresh load, so every
// tap dies on `if (walking) return`: the label goes orange on :hover and nothing
// else happens. `pageshow` with `persisted` is the one signal that a bfcache
// restore happened; clear the flag, and re-render because the stars and trophy
// count may have changed in the game she just left (§3.1).
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return; // a fresh load already ran render() with walking=false
  walking = false;
  render();
});

// Registered once, on the map itself: `render()` runs again on every settings
// change, and a listener added there would fire twice, then three times.
document.querySelector(".worldmap")?.addEventListener("click", (e) => {
  const region = e.target.closest?.("a.region");
  if (!region) return;
  // "open in a new tab" is still the browser's to answer, and there is no fox
  // to walk in the tab it opens.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  if (region.classList.contains("locked")) soonBubble(region);
  else travelTo(region);
});

function render() {
  const state = loadState();
  // one cookie parse for the whole map, not one per section
  const rewards = getRewards(state);

  // region star badges and visual states
  for (const game of GAMES) {
    const locked = !isPlayable(game);
    const badge = document.querySelector(`[data-badge="${game}"]`);
    // A locked region's game cannot pay a star, so "⭐ 0" under its name is a
    // promise the clouds just took back. The group stays for the day it ships.
    if (badge) {
      if (locked) badge.replaceChildren();
      else renderBadge(badge, "ui-star", gameStarsOf(rewards.pr, game), starBadgeTier(rewards.pr, game));
    }
    const region = document.getElementById(`region-${game}`);
    if (region) {
      region.classList.remove("thriving", "mastered");
      const rs = regionState(rewards.pr, game);
      if (rs !== "base") region.classList.add(rs);
      // the island remembers: a mastered region's road turns to cobblestone
      pave(game, rs === "mastered");

      // A region whose game does not exist yet sits under clouds and does not
      // open: the href stays for the deep link, the click is cancelled (above).
      region.classList.toggle("locked", locked);
      if (locked) {
        fogRegion(region);
        region.setAttribute("aria-label", `${t(`region_${game}`)} — ${t("lockedHint")}`);
        region.setAttribute("aria-disabled", "true");
      } else {
        ensurePlate(region);
      }
    }
  }

  // Trophy Room: total trophies collected across all games (§3.1, §8.3).
  // The count used to hang under the house on a badge of its own, where it read
  // as one more label. It is now written above the trophy on the facade — the
  // number belongs to the cup it counts.
  const trophies = totalTrophies(rewards.pr);
  const pkCount = document.getElementById("pokal-count");
  if (pkCount) pkCount.textContent = trophies;
  pave("pokalraum", trophies >= 20);

  const pkRegion = document.getElementById("region-pokalraum");
  if (pkRegion) {
    pkRegion.classList.remove("thriving", "mastered");
    if (trophies >= 60) pkRegion.classList.add("mastered");
    else if (trophies >= 20) pkRegion.classList.add("thriving");
    // the number on the wall is decorative; the link says what it means
    pkRegion.setAttribute("aria-label",
      `${t("region_pokalraum")} — ${t("trophyCount", { n: trophies, total: TOTAL_TROPHIES })}`);
    ensurePlate(pkRegion);
  }

  // the fox stands where the child last went (§3.1)
  foxAt = ANCHORS[rewards.at] ? rewards.at : "einmaleins";
  const fox = document.getElementById("map-fox");
  if (fox) fox.innerHTML = foxSVG({ pose: "happy", size: 44 });
  placeFox(ANCHORS[foxAt]);
}

// The map wears the shared bar with a flat map button — you are already here.
// Its gear opens the one settings sheet every page shares (§3.4). initTopBar
// repaints the fox chip itself on every settings change; `render` only has to
// redraw the island.
initTopBar({ back: null, onChange: render });

render();
