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
        const art = left > 0 ? "<i>⭐</i>".repeat(left) : '<b class="tdone">✓</b>';
        // The tempo symbol the tile has earned (§10.6), a badge in the corner.
        // Tier 0 draws nothing at all — an empty corner, never a snail.
        const badge = tempo > 0
          ? `<span class="ttempo" aria-hidden="true">${iconHTML(TEMPO_ICONS[tempo], { size: 18 })}</span>`
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
  }

  return overlay;
}
