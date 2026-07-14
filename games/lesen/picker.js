// The lesen level picker (§14.1, §3.3): the shared picker
// (assets/js/levelpicker.js — tiles, fox, walk-then-open) over this game's
// tiles. What is lesen's own: each difficulty offers its four themed packs
// plus "Alle" (§14.1), and a tile's stars sit in a per-difficulty string
// indexed by pack (§14.5).

import { createLevelPicker as sharedPicker } from "../../assets/js/levelpicker.js";
import { t } from "../../assets/js/i18n.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import { CONTENT } from "./content.js";
import { packsFor, starDigit, MIXED } from "./logic.js";

// A tile's short name, in the current language. The round title chip borrows
// it too, so the name over the stage is the name on the tile that started it.
// Pack keys become i18n keys (lesenPack<Key>); the content test keeps every
// key named in both languages.
function packName(diff, pack) {
  if (pack === MIXED) return t("lesenMixed");
  const key = packsFor(diff, CONTENT.de)[pack]?.key ?? "";
  return t(`lesenPack${key[0].toUpperCase()}${key.slice(1)}`);
}

// The tile's FACE: the die alone for the mixed tile — a picture, no word, the
// same face every game's mixed tile wears (user cleanup, 2026-07-13). The
// spoken name stays `packName` for the aria-label.
export function packFace(diff, pack) {
  return pack === MIXED ? "🎲" : packName(diff, pack);
}

// Same contract the game module always had: current() → {diff, pack},
// onPick(d, p), onDismiss().
export function createLevelPicker(el, { current, onPick, onDismiss }) {
  return sharedPicker(el, {
    current: () => {
      const c = current();
      return { diff: c.diff, id: c.pack };
    },
    onPick,
    onDismiss,
    tilesFor(d) {
      // read the store as it is now, not as it was when the game loaded
      const savedNow = getGame("lesen");
      const starsByDiff = savedNow.stars ?? {};
      const tempoByDiff = savedNow.tempo ?? {};
      return [...packsFor(d, CONTENT.de).keys(), MIXED].map((p) => ({
        id: p,
        face: packFace(d, p),
        name: packName(d, p),
        left: tilePointsLeft(starDigit(starsByDiff[d], p), d),
        tempo: starDigit(tempoByDiff[d], p),
      }));
    },
  });
}
