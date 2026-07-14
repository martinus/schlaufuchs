// The Rechnungen level picker (§12.1, §3.3): the shared picker
// (assets/js/levelpicker.js — tiles, fox, walk-then-open) over this game's
// tiles. What is rechnungen's own: every difficulty offers the six mode chips
// (＋ − ÷R 🧱 ⊞ 🎲, §12.1), and — the one twist versus einmaleins — a mode's
// star string is indexed by DIFFICULTY (§12.3), so a difficulty section reads
// the SAME mode key across all three: `starDigit(starsByMode[mode], d)`, not
// `starsByDiff[d]`.

import { createLevelPicker as sharedPicker } from "../../assets/js/levelpicker.js";
import { t } from "../../assets/js/i18n.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import { MODES, starDigit } from "./logic.js";

// The tile's face: the operators as the child's schoolbook writes them
// (division follows the UI language, §12.1); 🧱 for the number walls, ⊞ for
// the grids, 🎲 for Mix. The round-title chip borrows this, so the symbol over
// the stage is the symbol on the tile that started it.
export function modeSymbol(mode) {
  if (mode === "+") return "＋";
  if (mode === "-") return "−";
  if (mode === "rest") return `${t("divSign")}R`;
  if (mode === "mauer") {
    // A number wall IS a pyramid of bricks (§12.1) — the flat 🧱 wall read as
    // the grid's rectangles instead (user cleanup, 2026-07-13). Drawn, not an
    // emoji: no glyph has this shape, and currentColor follows the tile text.
    return `<svg class="modeglyph" viewBox="0 0 26 23" aria-hidden="true"><g fill="currentColor">`
      + `<rect x="9" y="0.5" width="8" height="6" rx="1.4"/>`
      + `<rect x="4.5" y="8" width="8" height="6" rx="1.4"/><rect x="13.5" y="8" width="8" height="6" rx="1.4"/>`
      + `<rect x="0" y="15.5" width="8" height="6" rx="1.4"/><rect x="9" y="15.5" width="8" height="6" rx="1.4"/><rect x="18" y="15.5" width="8" height="6" rx="1.4"/>`
      + `</g></svg>`;
  }
  if (mode === "quad") return "⊞";
  return "🎲";
}

// The spoken name of a mode, for a screen reader and the aria-label.
function modeName(mode) {
  return t({
    "+": "modePlus", "-": "modeMinus", rest: "modeRest",
    mauer: "modeMauer", quad: "modeQuad", mix: "modeMix",
  }[mode]);
}

// Same contract the game module always had: current() → {diff, mode},
// onPick(d, mode), onDismiss().
export function createLevelPicker(el, { current, onPick, onDismiss }) {
  return sharedPicker(el, {
    current: () => {
      const c = current();
      return { diff: c.diff, id: c.mode };
    },
    onPick,
    onDismiss,
    tilesFor(d) {
      // read the store as it is now, not as it was when the game loaded
      const savedNow = getGame("rechnungen");
      const starsByMode = savedNow.stars ?? {};
      const tempoByMode = savedNow.tempo ?? {};
      return MODES.map((mode) => ({
        id: mode,
        face: modeSymbol(mode),
        name: modeName(mode),
        left: tilePointsLeft(starDigit(starsByMode[mode], d), d),
        tempo: starDigit(tempoByMode[mode], d),
      }));
    },
  });
}
