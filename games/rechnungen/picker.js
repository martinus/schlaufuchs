// The Rechnungen level picker (§12.1, §3.3): one scrollable list of every tile
// the game has — six mode chips (＋ − ×÷ 🧱 ⊞ 🎲) per difficulty — with the fox
// standing on the one being played. Same contract as the einmaleins picker: a
// tile opens only once the fox has arrived on it, and how many stars a tile
// still has to give IS the difficulty display.
//
// The one twist versus einmaleins: a mode's star string is indexed by
// DIFFICULTY (§12.3), so a difficulty section reads the SAME mode key across
// all three — `starDigit(starsByMode[mode], d)`, not `starsByDiff[d]`.

import { overlayFrom } from "../../assets/js/overlay.js";
import { createLevelFox } from "../../assets/js/levelfox.js";
import { iconHTML } from "../../assets/js/graphics.js";
import { t } from "../../assets/js/i18n.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import {
  MODES, starDigit, DIFF_KEYS, DIFF_SLUGS, TEMPO_ICONS, TEMPO_KEYS,
} from "./logic.js";

// The tile's face: the operators as the child's schoolbook writes them
// (division follows the UI language, §12.1); 🧱 for the number walls, ⊞ for
// the grids, 🎲 for Mix. The round-title chip borrows this, so the symbol over
// the stage is the symbol on the tile that started it.
export function modeSymbol(mode) {
  if (mode === "+") return "＋";
  if (mode === "-") return "−";
  if (mode === "x:") return `×${t("divSign")}`;
  if (mode === "mauer") return "🧱";
  if (mode === "quad") return "⊞";
  return "🎲";
}

// The spoken name of a mode, for a screen reader and the aria-label.
function modeName(mode) {
  return t({
    "+": "modePlus", "-": "modeMinus", "x:": "modeTimesDiv",
    mauer: "modeMauer", quad: "modeQuad", mix: "modeMix",
  }[mode]);
}

// Wrap the picker overlay that sits in the page markup. Same contract as the
// einmaleins picker:
//   current()        — the {diff, mode} being played, for the ring and the fox
//   onPick(d, mode)  — a tile was chosen; runs BEFORE the overlay closes
//   onDismiss()      — waved away without choosing
export function createLevelPicker(el, { current, onPick, onDismiss }) {
  const list = el.querySelector("#pick-levels");
  let levelFox = null; // rebuilt with the tiles on every open

  const overlay = overlayFrom(el, {
    onOpen: render,
    initialFocus: "[aria-current='true']",
    onClose() {
      if (levelFox?.walking) return; // the walk opens the tile it is walking to
      onDismiss();
    },
  });

  // Open the tile once the fox has arrived on it (see the einmaleins picker for
  // why the order — onPick, then close — is the whole contract).
  function openLevel(d, mode) {
    onPick(d, mode);
    overlay.close();
  }

  function chooseLevel(d, mode, tile) {
    if (levelFox?.walking) return;
    const cur = current();
    if (d === cur.diff && mode === cur.mode) return openLevel(d, mode); // already here
    tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
    levelFox.walkTo(tile, () => openLevel(d, mode));
  }

  function render() {
    list.innerHTML = "";
    // read the cookie as it is now, not as it was when the game loaded
    const savedNow = getGame("rechnungen");
    const starsByMode = savedNow.stars ?? {};
    const tempoByMode = savedNow.tempo ?? {};
    const cur = current();
    let currentTile = null;

    DIFF_KEYS.forEach((key, d) => {
      const head = document.createElement("h3");
      head.className = `lvl-head lvl-${DIFF_SLUGS[d]}`;
      head.textContent = t(key);
      list.appendChild(head);

      const grid = document.createElement("div");
      grid.className = `tilegrid lvl-${DIFF_SLUGS[d]}`;
      for (const mode of MODES) {
        const left = tilePointsLeft(starDigit(starsByMode[mode], d), d);
        const b = document.createElement("button");
        if (left === 0) b.classList.add("mastered");
        if (d === cur.diff && mode === cur.mode) {
          b.classList.add("current");
          b.setAttribute("aria-current", "true");
          currentTile = b;
        }
        const art = left > 0 ? "<i>⭐</i>".repeat(left) : '<b class="tdone">✓</b>';
        // The tempo symbol the tile has earned (§10.6), a badge in the corner.
        // Tier 0 draws nothing at all — an empty corner, never a snail.
        const tempo = starDigit(tempoByMode[mode], d);
        const badge = tempo > 0
          ? `<span class="ttempo" aria-hidden="true">${iconHTML(TEMPO_ICONS[tempo], { size: 18 })}</span>`
          : "";
        b.innerHTML = `<span class="tstars" aria-hidden="true">${art}</span>`
          + badge + `<span class="tname">${modeSymbol(mode)}</span>`;
        const here = b === currentTile ? ` · ${t("tileHere")}` : "";
        const pace = tempo > 0 ? ` · ${t("tileTempo", { name: t(TEMPO_KEYS[tempo]) })}` : "";
        b.setAttribute(
          "aria-label",
          `${t(key)} · ${modeName(mode)}${here} — ${left > 0 ? t("tileStarsLeft", { n: left }) : t("tileMastered")}${pace}`,
        );
        b.addEventListener("click", () => chooseLevel(d, mode, b));
        grid.appendChild(b);
      }
      list.appendChild(grid);
    });

    levelFox = createLevelFox(list);
    if (currentTile) levelFox.jumpTo(currentTile);
  }

  return overlay;
}
