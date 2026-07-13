// The einmaleins level picker (§10.2, §3.3): the shared picker
// (assets/js/levelpicker.js — tiles, fox, walk-then-open) over this game's
// tiles. What is einmaleins' own: each difficulty offers its tables plus
// "Alle" (tablesFor, §10.2), and a tile's stars sit in a per-difficulty
// string indexed by table (§10.4).

import { createLevelPicker as sharedPicker } from "../../assets/js/levelpicker.js";
import { t } from "../../assets/js/i18n.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import { tablesFor, starDigit } from "./logic.js";

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

// Same contract the game module always had: current() → {diff, table},
// onPick(d, tbl), onDismiss().
export function createLevelPicker(el, { current, onPick, onDismiss }) {
  return sharedPicker(el, {
    current: () => {
      const c = current();
      return { diff: c.diff, id: c.table };
    },
    onPick,
    onDismiss,
    tilesFor(d) {
      // read the cookie as it is now, not as it was when the game loaded
      const savedNow = getGame("einmaleins");
      const starsByDiff = savedNow.stars ?? {};
      const tempoByDiff = savedNow.tempo ?? {};
      return tablesFor(d).map((tbl) => ({
        id: tbl,
        face: tableFace(tbl),
        name: tableName(tbl),
        left: tilePointsLeft(starDigit(starsByDiff[d], tbl), d),
        tempo: starDigit(tempoByDiff[d], tbl),
      }));
    },
  });
}
