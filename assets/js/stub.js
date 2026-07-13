// The games that do not exist yet (§3.1). Their pages were copies of one
// script, differing in a single word — the game's name — which is now on
// the <body>. The page says what it is; this module says it once for all.

import { initI18n, t } from "./i18n.js";
import { iconHTML } from "./graphics.js";
import { initTopBar } from "./chrome.js";
import { GAMES, isPlayable } from "./rewards.js";

const game = document.body.dataset.game;
if (!GAMES.includes(game) || isPlayable(game)) {
  // A stub page for a game that ships, or for no game at all, is a bug that
  // would otherwise render as an empty page with the wrong heading.
  throw new Error(`stub.js: "${game}" is not an unbuilt game`);
}

initI18n();
initTopBar({ back: "../../" });

const main = document.getElementById("stub");
if (main) {
  // The sentence above already points at the one game that exists; the first
  // chip is that sentence made pressable. Without it the page named a game
  // ready to play and then offered only the way back.
  main.innerHTML = `
    <span class="stub-emoji">${iconHTML(`region-${game}`, { size: 64 })}</span>
    <h1 data-i18n="game_${game}">${t(`game_${game}`)}</h1>
    <p data-i18n="comingSoon">${t("comingSoon")}</p>
    <a class="chip" href="../einmaleins/" data-i18n="stubPlay">${t("stubPlay")}</a>
    <a class="chip" href="../../" data-i18n="back">${t("back")}</a>`;
}
