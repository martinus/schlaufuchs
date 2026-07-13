// The level picker every game shares (§10.2, §3.3): one scrollable list of
// every level the game has, with the fox standing on the one being played.
// This module owns the tiles, the fox on them, and the rule that a level
// opens only once the fox has arrived on it — the rule the island keeps for
// its regions (§3.1).
//
// It lived as a ~90%-verbatim copy in each game's picker.js; the copies are
// adapters now. What stays per game is what a tile IS: `tilesFor(d)` returns
// one difficulty's tiles — einmaleins' tables, lesen's packs, rechnungen's
// modes — each as `{ id, face, name, left, tempo }`, read fresh from the
// cookie on every open. `id` is opaque here: it only round-trips through
// `current()`/`onPick`, so a number (a table) and a string (a mode) both work.
//
// The picker used to be two controls: three difficulty buttons on top, and one
// grid of tiles that changed underneath them. A child had to understand that
// the first row rewrote the second, and that "×2 ⭐" on a button she had not
// pressed was a promise about stars she could not see.
//
// It is now one list of every level. The difficulty is where a tile sits, what
// colour it has, and — the whole point — **how many stars it still has to
// give**: three on a fresh Leicht tile, six on Mittel, nine on Schwer. Nobody
// has to be told that hard work pays more; the tile is three times as full.
// A tile with nothing left to give shows a tick.

import { overlayFrom } from "./overlay.js";
import { createLevelFox } from "./levelfox.js";
import { iconHTML } from "./graphics.js";
import { t } from "./i18n.js";
import { DIFF_KEYS, DIFF_SLUGS, TEMPO_ICONS, TEMPO_KEYS } from "./roundrules.js";
import { starCluster } from "./journey.js";
import { prefersReducedMotion } from "./motion.js";

// Where the round-groups sit inside a tile, as a percentage of the star box — the
// same shallow arc the round scene's sky hangs on (`SKY` in journey.js): the
// three spread across with the MIDDLE one lifted, so the tile is a little map of
// the Wegbild she is about to walk. Fewer groups keep the spacing, centred.
const GROUP_ANCHORS = {
  1: [[50, 52]],
  2: [[32, 52], [68, 52]],
  3: [[18, 60], [50, 38], [82, 60]],
};

// The stars a tile still owes, drawn as the UNITS they are actually won in and in
// the very SHAPE the round scene draws them (§10.2, §10.4). One round pays a whole
// GROUP at once — a single on Leicht, a pair on Mittel, a mini-pyramid of three on
// Schwer — and never one star out of a group; drawing six loose stars on a Mittel
// tile hid that. So each group is a `starCluster` — the exact constellation the
// Wegbild's sky and the summary use — and a fresh tile is always THREE of them
// (three rounds to master), the group growing with difficulty, not their number.
// Each star carries its cluster offset (`--dx/--dy`) and size (`--sz`) in Wegbild
// units; the CSS scales them to the tile. `left` is the point total, so there are
// `left / worth` groups.
export function starGroupsHTML(left, difficulty) {
  const worth = difficulty + 1;
  const cluster = starCluster(worth);
  const rounds = left / worth;
  const anchors = GROUP_ANCHORS[rounds] ?? GROUP_ANCHORS[3];
  return anchors.map(([ax, ay]) => groupHTML(cluster, ax, ay)).join("");
}

function groupHTML(cluster, ax, ay, extraCls = "", extraAttrs = "") {
  const stars = cluster
    .map(({ dx, dy, size }) => `<i style="--dx:${dx};--dy:${dy};--sz:${size}">⭐</i>`)
    .join("");
  const cls = extraCls ? `sgroup ${extraCls}` : "sgroup";
  return `<span class="${cls}" style="left:${ax}%;top:${ay}%"${extraAttrs}>${stars}</span>`;
}

// The star groups for a tile mid-replay of a round it just won (§10.1): the tile
// as it stood BEFORE the round (`from` stars), with the groups it just earned
// tagged `.won-depart` so the CSS can fly them off, and the groups still to win
// carrying the anchor a settled tile would put them at (`data-to-*`), so they can
// glide there as the won ones leave. A round wins whole groups off the top, so the
// first `newGroups` are kept and the rest depart; when `to` reaches 3 the tile is
// mastered and every group flies off, leaving the tick behind.
export function winFlightHTML(from, to, difficulty) {
  const worth = difficulty + 1;
  const cluster = starCluster(worth);
  const newGroups = 3 - to;
  const oldAnchors = GROUP_ANCHORS[3 - from] ?? GROUP_ANCHORS[3];
  const newAnchors = GROUP_ANCHORS[newGroups] ?? [];
  return oldAnchors
    .map(([ax, ay], i) => {
      if (i < newGroups) {
        const [nx, ny] = newAnchors[i];
        return groupHTML(cluster, ax, ay, "", ` data-to-left="${nx}%" data-to-top="${ny}%"`);
      }
      return groupHTML(cluster, ax, ay, "won-depart");
    })
    .join("");
}

// Wrap the picker overlay that sits in the page markup.
//   current()        — the { diff, id } being played, for the ring and the fox
//   onPick(d, id)    — a level was chosen; runs BEFORE the overlay closes, so
//                      the round exists by the time onDismiss can be asked
//   onDismiss()      — waved away without choosing; the game decides what a
//                      childless stage should do (start a round, or reopen the
//                      summary behind it)
//   tilesFor(d)      — one difficulty's tiles, in tile order, fresh from the
//                      cookie: { id, face (markup on the tile), name (the
//                      spoken name), left (stars still to give), tempo (tier) }
export function createLevelPicker(el, { current, onPick, onDismiss, tilesFor }) {
  const list = el.querySelector("#pick-levels");
  let levelFox = null; // rebuilt with the tiles on every open
  // A round just paid stars; the next time the picker opens, the tile it was won
  // on replays the win. { from, to } are the tile's mastered stars before/after —
  // it belongs to whatever tile is `current()` then (the one just played, §10.1).
  let pendingWin = null;

  const overlay = overlayFrom(el, {
    onOpen: render,
    // The list is long enough to scroll. Open it on the level she is playing,
    // not on the first tile of the first difficulty — focusing it scrolls it
    // into view, so she sees where she is before she chooses where to go.
    initialFocus: "[aria-current='true']",
    onClose() {
      if (levelFox?.walking) return; // the walk opens the level it is walking to
      onDismiss();
    },
  });

  // The round summary tells the picker a round paid off, so the played tile can
  // fly the won groups off when it reopens (§10.1). Only an actual gain animates.
  overlay.flagWin = (from, to) => {
    if (to > from) pendingWin = { from, to };
  };

  // How long the fly-off runs; must outlast the CSS transitions below so the tile
  // is restored to its settled markup only once they have played.
  const FLIGHT_MS = 560;

  // Play the win back on `tile`: the groups earned this round lift off and shrink
  // away — the fall the round scene's sky makes into the basket — while the groups
  // still to win glide to where a settled tile sits them. Ends by restoring the
  // tile's own settled markup, so nothing about the resting state depends on this.
  function flyWin(tile, restingArt, { from, to }, d) {
    const box = tile.querySelector(".tstars");
    const settledMastered = tile.classList.contains("mastered");
    box.innerHTML = winFlightHTML(from, to, d);
    tile.classList.remove("mastered"); // full colour while the groups fly
    void box.offsetWidth; // commit the starting layout before the transitions
    requestAnimationFrame(() => {
      for (const g of box.querySelectorAll(".won-depart")) g.classList.add("gone");
      for (const g of box.querySelectorAll(".sgroup[data-to-left]")) {
        g.style.left = g.dataset.toLeft;
        g.style.top = g.dataset.toTop;
      }
    });
    setTimeout(() => {
      box.innerHTML = restingArt;
      if (settledMastered) tile.classList.add("mastered");
    }, FLIGHT_MS);
  }

  // Open the level `id` stands for. Called when the fox has arrived on it, so
  // a round never starts under a fox that is still in the air. The order is the
  // whole contract: `onPick` starts the round, and only then does the overlay
  // close — closed first, onClose would reopen the summary of the round she
  // just walked away from, or start a second round on top of this one.
  function openLevel(d, id) {
    onPick(d, id);
    overlay.close();
  }

  // A tile she tapped. The fox walks there first — that walk is the answer to
  // the tap, and the level it opens is where the fox came to rest.
  function chooseLevel(d, id, tile) {
    if (levelFox?.walking) return;
    const cur = current();
    if (d === cur.diff && id === cur.id) return openLevel(d, id); // already standing there
    // The list scrolls, and a fox walking to a tile below the fold walks off
    // the screen. Bring the destination into view; the fox's coordinates are
    // the list's own, so the scroll moves it with the tiles.
    tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
    levelFox.walkTo(tile, () => openLevel(d, id));
  }

  function render() {
    list.innerHTML = "";
    const cur = current();
    let currentTile = null;
    let currentArt = ""; // the played tile's settled star markup, to restore after a win flies

    DIFF_KEYS.forEach((key, d) => {
      // A heading, not a control: pressing a difficulty is choosing a tile in it.
      const head = document.createElement("h3");
      head.className = `lvl-head lvl-${DIFF_SLUGS[d]}`;
      head.textContent = t(key);
      list.appendChild(head);

      const grid = document.createElement("div");
      grid.className = `tilegrid lvl-${DIFF_SLUGS[d]}`;
      for (const { id, face, name, left, tempo } of tilesFor(d)) {
        const b = document.createElement("button");
        if (left === 0) b.classList.add("mastered");
        if (d === cur.diff && id === cur.id) {
          b.classList.add("current");
          b.setAttribute("aria-current", "true");
          currentTile = b;
        }
        const art = left > 0 ? starGroupsHTML(left, d) : '<b class="tdone">✓</b>';
        if (b === currentTile) currentArt = art; // remember it for the win replay
        // The tempo symbol the tile has earned (§10.6), a badge in the corner.
        // Tier 0 draws nothing at all — an empty corner, never a snail.
        const badge = tempo > 0
          ? `<span class="ttempo" aria-hidden="true">${iconHTML(TEMPO_ICONS[tempo], { size: 26 })}</span>`
          : "";
        b.innerHTML = `<span class="tstars" aria-hidden="true">${art}</span>`
          + badge + `<span class="tname">${face}</span>`;
        // The fox on the current tile is decorative markup; a screen reader is
        // told where it stands in words.
        const here = b === currentTile ? ` · ${t("tileHere")}` : "";
        const pace = tempo > 0 ? ` · ${t("tileTempo", { name: t(TEMPO_KEYS[tempo]) })}` : "";
        b.setAttribute(
          "aria-label",
          `${t(key)} · ${name}${here} — ${left > 0 ? t("tileStarsLeft", { n: left }) : t("tileMastered")}${pace}`,
        );
        b.addEventListener("click", () => chooseLevel(d, id, b));
        grid.appendChild(b);
      }
      list.appendChild(grid);
    });

    // The fox is drawn last, over the tiles, and is placed after they are laid
    // out — `tileAnchor` reads offsets, and the overlay is already shown by the
    // time onOpen runs, so the numbers are real.
    levelFox = createLevelFox(list);
    if (currentTile) levelFox.jumpTo(currentTile);

    // A round just paid off? Play it back on the tile it was won on — but only
    // when motion is welcome; under prefers-reduced-motion the tile just opens in
    // its settled state (the group is present, not animated). Consumed either way.
    if (pendingWin && currentTile && !prefersReducedMotion()) {
      flyWin(currentTile, currentArt, pendingWin, cur.diff);
    }
    pendingWin = null;
  }

  return overlay;
}
