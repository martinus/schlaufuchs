// The level picker (§10.2, §3.3): one scrollable list of every level the game
// has, with the fox standing on the one being played. The game module wires the
// round; this module owns the tiles, the fox on them, and the rule that a level
// opens only once the fox has arrived on it — the rule the island keeps for its
// regions (§3.1).
//
// The picker used to be two controls: three difficulty buttons on top, and one
// grid of tables that changed underneath them. A child had to understand that
// the first row rewrote the second, and that "×2 ⭐" on a button she had not
// pressed was a promise about stars she could not see.
//
// It is now one list of every level. The difficulty is where a tile sits, what
// colour it has, and — the whole point — **how many stars it still has to
// give**: three on a fresh Leicht tile, six on Mittel, nine on Schwer. Nobody
// has to be told that hard work pays more; the tile is three times as full.
// A tile with nothing left to give shows a tick.

import { overlayFrom } from "../../assets/js/overlay.js";
import { createLevelFox } from "../../assets/js/levelfox.js";
import { iconHTML } from "../../assets/js/graphics.js";
import { t } from "../../assets/js/i18n.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import {
  tablesFor, starDigit, DIFF_KEYS, DIFF_SLUGS, TEMPO_ICONS, TEMPO_KEYS,
} from "./logic.js";

// A tile's short name, in the current language. The round title chip borrows
// it too, so the name over the stage is the name on the tile that started it.
export function tableName(tbl) {
  return tbl === 0 ? t("emMixed") : t("emTableShort", { t: tbl });
}

// The tile's FACE: the die alone for the mixed tile — a picture, no word, the
// same face the Rechenberg's Mix tile wears (user cleanup, 2026-07-13). The
// spoken name stays `tableName` for the aria-label.
export function tableFace(tbl) {
  return tbl === 0 ? "🎲" : tableName(tbl);
}

// Wrap the picker overlay that sits in the page markup.
//   current()        — the {diff, table} being played, for the ring and the fox
//   onPick(d, tbl)   — a level was chosen; runs BEFORE the overlay closes, so
//                      the round exists by the time onDismiss can be asked
//   onDismiss()      — waved away without choosing; the game decides what a
//                      childless stage should do (start a round, or reopen the
//                      summary behind it)
export function createLevelPicker(el, { current, onPick, onDismiss }) {
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

  // Open the level `tile` stands for. Called when the fox has arrived on it, so
  // a round never starts under a fox that is still in the air. The order is the
  // whole contract: `onPick` starts the round, and only then does the overlay
  // close — closed first, onClose would reopen the summary of the round she
  // just walked away from, or start a second round on top of this one.
  function openLevel(d, tbl) {
    onPick(d, tbl);
    overlay.close();
  }

  // A tile she tapped. The fox walks there first — that walk is the answer to
  // the tap, and the level it opens is where the fox came to rest.
  function chooseLevel(d, tbl, tile) {
    if (levelFox?.walking) return;
    const cur = current();
    if (d === cur.diff && tbl === cur.table) return openLevel(d, tbl); // already standing there
    // The list scrolls, and a fox walking to a tile below the fold walks off
    // the screen. Bring the destination into view; the fox's coordinates are
    // the list's own, so the scroll moves it with the tiles.
    tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
    levelFox.walkTo(tile, () => openLevel(d, tbl));
  }

  function render() {
    list.innerHTML = "";
    // read the cookie as it is now, not as it was when the game loaded
    const savedNow = getGame("einmaleins");
    const starsByDiff = savedNow.stars ?? {};
    const tempoByDiff = savedNow.tempo ?? {};
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
      for (const tbl of tablesFor(d)) {
        const left = tilePointsLeft(starDigit(starsByDiff[d], tbl), d);
        const b = document.createElement("button");
        if (left === 0) b.classList.add("mastered");
        if (d === cur.diff && tbl === cur.table) {
          b.classList.add("current");
          b.setAttribute("aria-current", "true");
          currentTile = b;
        }
        const name = tableFace(tbl);
        const art = left > 0 ? "<i>⭐</i>".repeat(left) : '<b class="tdone">✓</b>';
        // The tempo symbol the tile has earned (§10.6), a badge in the corner.
        // Tier 0 draws nothing at all — an empty corner, never a snail.
        const tempo = starDigit(tempoByDiff[d], tbl);
        const badge = tempo > 0
          ? `<span class="ttempo" aria-hidden="true">${iconHTML(TEMPO_ICONS[tempo], { size: 18 })}</span>`
          : "";
        b.innerHTML = `<span class="tstars" aria-hidden="true">${art}</span>`
          + badge + `<span class="tname">${name}</span>`;
        // The fox on the current tile is decorative markup; a screen reader is
        // told where it stands in words.
        const here = b === currentTile ? ` · ${t("tileHere")}` : "";
        const pace = tempo > 0 ? ` · ${t("tileTempo", { name: t(TEMPO_KEYS[tempo]) })}` : "";
        b.setAttribute(
          "aria-label",
          `${t(key)} · ${tableName(tbl)}${here} — ${left > 0 ? t("tileStarsLeft", { n: left }) : t("tileMastered")}${pace}`,
        );
        b.addEventListener("click", () => chooseLevel(d, tbl, b));
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
