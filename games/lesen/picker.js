// The lesen level picker (§14.1, §3.3): one scrollable list of every tile the
// game has — four themed packs and an "Alle" per difficulty — with the fox
// standing on the one being played. Same contract as the einmaleins picker: a
// tile opens only once the fox has arrived on it, and how many stars a tile
// still has to give IS the difficulty display.

import { overlayFrom } from "../../assets/js/overlay.js";
import { createLevelFox } from "../../assets/js/levelfox.js";
import { t } from "../../assets/js/i18n.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import { CONTENT } from "./content.js";
import { packsFor, starDigit, DIFF_KEYS, DIFF_SLUGS, MIXED } from "./logic.js";

// A tile's short name, in the current language. The round title chip borrows
// it too, so the name over the stage is the name on the tile that started it.
// Pack keys become i18n keys (lesenPack<Key>); the content test keeps every
// key named in both languages.
export function packName(diff, pack) {
  if (pack === MIXED) return t("lesenMixed");
  const key = packsFor(diff, CONTENT.de)[pack]?.key ?? "";
  return t(`lesenPack${key[0].toUpperCase()}${key.slice(1)}`);
}

// Wrap the picker overlay that sits in the page markup. Same contract as the
// einmaleins picker:
//   current()         — the {diff, pack} being played, for the ring and the fox
//   onPick(d, p)      — a tile was chosen; runs BEFORE the overlay closes
//   onDismiss()       — waved away without choosing
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

  // Open the tile once the fox has arrived on it: `onPick` starts the round,
  // and only then does the overlay close (see the einmaleins picker for why
  // the order is the whole contract).
  function openLevel(d, p) {
    onPick(d, p);
    overlay.close();
  }

  function chooseLevel(d, p, tile) {
    if (levelFox?.walking) return;
    const cur = current();
    if (d === cur.diff && p === cur.pack) return openLevel(d, p); // already standing there
    tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
    levelFox.walkTo(tile, () => openLevel(d, p));
  }

  function render() {
    list.innerHTML = "";
    // read the cookie as it is now, not as it was when the game loaded
    const starsByDiff = getGame("lesen").stars ?? {};
    const cur = current();
    let currentTile = null;

    DIFF_KEYS.forEach((key, d) => {
      const head = document.createElement("h3");
      head.className = `lvl-head lvl-${DIFF_SLUGS[d]}`;
      head.textContent = t(key);
      list.appendChild(head);

      const grid = document.createElement("div");
      grid.className = `tilegrid lvl-${DIFF_SLUGS[d]}`;
      const tiles = [...packsFor(d, CONTENT.de).keys(), MIXED];
      for (const p of tiles) {
        const left = tilePointsLeft(starDigit(starsByDiff[d], p), d);
        const b = document.createElement("button");
        if (left === 0) b.classList.add("mastered");
        if (d === cur.diff && p === cur.pack) {
          b.classList.add("current");
          b.setAttribute("aria-current", "true");
          currentTile = b;
        }
        // "Alle" is the only tile whose name means a mix, and the die says so
        // to a child who is here because she reads nothing fluently yet.
        const name = p === MIXED ? `🎲 ${packName(d, p)}` : packName(d, p);
        const art = left > 0 ? "<i>⭐</i>".repeat(left) : '<b class="tdone">✓</b>';
        b.innerHTML = `<span class="tstars" aria-hidden="true">${art}</span>`
          + `<span class="tname">${name}</span>`;
        const here = b === currentTile ? ` · ${t("tileHere")}` : "";
        b.setAttribute(
          "aria-label",
          `${t(key)} · ${packName(d, p)}${here} — ${left > 0 ? t("tileStarsLeft", { n: left }) : t("tileMastered")}`,
        );
        b.addEventListener("click", () => chooseLevel(d, p, b));
        grid.appendChild(b);
      }
      list.appendChild(grid);
    });

    levelFox = createLevelFox(list);
    if (currentTile) levelFox.jumpTo(currentTile);
  }

  return overlay;
}
